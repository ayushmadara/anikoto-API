import axios from 'axios';
import crypto from 'crypto';
import { DEFAULT_HEADERS } from './constants';
import { getOrSet } from './cache';
import {
  isAllowedStreamDomain,
  isPrivateUrl,
  isPrivateUrlAsync,
} from './proxy-pool';

export type CaptionFormat = 'vtt' | 'srt' | 'ass';

export interface CaptionCue {
  /** Cue start time in seconds. */
  start: number;
  /** Cue end time in seconds. */
  end: number;
  /** Cue text (plain, newline separated). */
  text: string;
  /** Optional WebVTT cue settings, e.g. `align:start position:10%`. */
  settings?: string;
}

export interface CaptionResult {
  /** Format of the upstream file. `vtt` is always normalized WebVTT. */
  source: CaptionFormat;
  /** Normalized WebVTT document. */
  vtt: string;
  /** Parsed cue list, convenient for players that don't use <track>. */
  cues: CaptionCue[];
}

export class CaptionError extends Error {
  public readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'CaptionError';
    this.status = status;
  }
}

const MAX_CAPTION_BYTES = 5 * 1024 * 1024;
const CAPTION_TTL = 60 * 60 * 24; // 24 hours
const TRACK_TIMEOUT_MS = 8_000;

// ── Decoding ─────────────────────────────────────────────────────────────────

function decodeCaptionBuffer(buf: Buffer): string {
  // UTF-8 BOM
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8');
  }
  // UTF-16 LE BOM
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buf.subarray(2));
  }
  // UTF-16 BE BOM
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    try {
      const swapped = Buffer.from(buf.subarray(2));
      swapped.swap16();
      return swapped.toString('utf16le');
    } catch {
      // Odd byte count — fall through to UTF-8.
    }
  }

  const utf8 = buf.toString('utf8');
  if (!utf8.includes('\uFFFD')) return utf8;

  // Legacy Windows-1252 / Latin-1 subtitle files.
  try {
    return new TextDecoder('windows-1252').decode(buf);
  } catch {
    return buf.toString('latin1');
  }
}

function toUnixNewlines(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

// ── Format detection ─────────────────────────────────────────────────────────

function detectFormat(
  text: string,
  url: string,
  contentType: string
): CaptionFormat | null {
  const head = toUnixNewlines(text).slice(0, 4096).trimStart();

  if (/^WEBVTT\b/i.test(head)) return 'vtt';
  if (/\[Script Info\]|\[Events\]/i.test(head)) return 'ass';

  const timestampLine = head.match(
    /^\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/m
  );
  if (timestampLine) {
    return /\d{1,2}:\d{2}:\d{2},\d{1,3}\s*-->/.test(head) ? 'srt' : 'vtt';
  }

  if (/\.ass($|\?)/i.test(url)) return 'ass';
  if (/\.srt($|\?)/i.test(url)) return 'srt';
  if (/text\/vtt/i.test(contentType)) return 'vtt';

  return null;
}

// ── Conversion ───────────────────────────────────────────────────────────────

function ensureVttHeader(text: string): string {
  const body = toUnixNewlines(text)
    .trimStart()
    .split('\n')
    .map((line) =>
      line.includes('-->')
        ? line.replace(/(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g, '$1.$2')
        : line
    )
    .join('\n');

  return /^WEBVTT\b/i.test(body) ? body : `WEBVTT\n\n${body}`;
}

/**
 * Convert SubRip (SRT) to WebVTT.
 *
 * SRT cue indices are valid WebVTT cue identifiers but are dropped for
 * cleanliness, and the `,` millisecond separator becomes `.`.
 */
function srtToVtt(text: string): string {
  const body = toUnixNewlines(text)
    .replace(
      /^[ \t]*\d+[ \t]*\n(?=[ \t]*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}[ \t]*-->)/gm,
      ''
    )
    .replace(/(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g, '$1.$2')
    .trim();

  return `WEBVTT\n\n${body}\n`;
}

/**
 * Minimal Advanced SubStation Alpha (ASS/SSA) to WebVTT converter.
 *
 * Reads the `[Events]` section, uses the `Format:` line to locate the
 * Start/End/Text columns, strips override tags such as `{\pos(...)}`, and
 * converts centisecond timestamps to milliseconds.
 */
function assToVtt(text: string): string {
  const out: string[] = ['WEBVTT', ''];
  let inEvents = false;
  let fields: string[] = [];

  const toVttTime = (value: string): string | null => {
    const match = value.trim().match(/^(\d+):(\d{2}):(\d{2})[.](\d{1,3})$/);
    if (!match) return null;
    const [, hours, minutes, seconds, fraction] = match;
    return `${hours.padStart(2, '0')}:${minutes}:${seconds}.${fraction
      .padEnd(3, '0')
      .slice(0, 3)}`;
  };

  for (const rawLine of toUnixNewlines(text).split('\n')) {
    const line = rawLine.trim();

    if (line.startsWith('[')) {
      inEvents = /^\[events\]$/i.test(line);
      fields = [];
      continue;
    }

    if (!inEvents) continue;

    if (/^Format:/i.test(line)) {
      fields = line
        .slice('Format:'.length)
        .split(',')
        .map((field) => field.trim().toLowerCase());
      continue;
    }

    if (!/^Dialogue:/i.test(line) || fields.length === 0) continue;

    const payload = line.slice('Dialogue:'.length).trim();
    const parts: string[] = [];
    let rest = payload;

    // The Text column is last, so split only the preceding fields; that way
    // commas inside the subtitle text are preserved.
    for (let i = 0; i < fields.length - 1; i++) {
      const comma = rest.indexOf(',');
      if (comma === -1) break;
      parts.push(rest.slice(0, comma));
      rest = rest.slice(comma + 1);
    }
    parts.push(rest);

    const start = toVttTime(parts[fields.indexOf('start')] ?? '');
    const end = toVttTime(parts[fields.indexOf('end')] ?? '');
    if (!start || !end) continue;

    const textIndex = fields.indexOf('text');
    const cueText = (textIndex >= 0 ? parts[textIndex] : parts[parts.length - 1])
      .replace(/\{[^}]*\}/g, '') // strip ASS override tags
      .replace(/\\N/gi, '\n')
      .replace(/\\h/gi, ' ')
      .trim();

    if (cueText) out.push(`${start} --> ${end}`, cueText, '');
  }

  return out.join('\n');
}

// ── Cue parsing ──────────────────────────────────────────────────────────────

function parseTimestamp(value: string): number | null {
  const match = value
    .trim()
    .match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/);
  if (!match) return null;

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = Number(match[4].padEnd(3, '0'));

  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

function parseVttCues(vtt: string): CaptionCue[] {
  const lines = toUnixNewlines(vtt).split('\n');
  const cues: CaptionCue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(
      /^\s*((?:\d+:)?\d{1,2}:\d{2}\.\d{1,3})\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}\.\d{1,3})(.*)$/
    );
    if (!match) continue;

    const start = parseTimestamp(match[1]);
    const end = parseTimestamp(match[2]);
    if (start === null || end === null) continue;

    const textLines: string[] = [];
    let cursor = i + 1;
    for (; cursor < lines.length && lines[cursor].trim() !== ''; cursor++) {
      textLines.push(lines[cursor]);
    }

    const settings = match[3].trim();
    cues.push({
      start,
      end,
      text: textLines.join('\n').trim(),
      ...(settings ? { settings } : {}),
    });

    i = cursor;
  }

  return cues;
}

// ── Fetching ─────────────────────────────────────────────────────────────────

/**
 * Fetch an upstream subtitle file with the required Referer and normalize it
 * to WebVTT. Results are cached for 24 hours (per URL + referer pair).
 */
export async function fetchCaption(
  url: string,
  referer?: string,
  refresh = false
): Promise<CaptionResult> {
  const cacheKey = `caption:${crypto
    .createHash('sha1')
    .update(`${url}|${referer ?? ''}`)
    .digest('hex')}`;

  return getOrSet(
    cacheKey,
    async () => {
      // Captions are fetched from third-party hosts, so apply the same
      // SSRF/allowlist protections as the streaming proxy.
      if (/\.(m3u8|m3u|ts|m4s|mp4|aac|m4a|webm|key)($|\?)/i.test(url)) {
        throw new CaptionError(
          'URL does not look like a subtitle file',
          415
        );
      }
      if (!isAllowedStreamDomain(url, referer)) {
        throw new CaptionError(
          'Caption URL is not an allowed streaming domain',
          403
        );
      }
      if (await isPrivateUrlAsync(url)) {
        throw new CaptionError(
          'Caption URL resolves to a private or local address',
          403
        );
      }

      let response;
      try {
        response = await axios.get<ArrayBuffer>(url, {
          headers: {
            ...DEFAULT_HEADERS,
            Accept: 'text/vtt,text/plain,application/x-subrip,*/*',
            ...(referer ? { Referer: referer } : {}),
          },
          responseType: 'arraybuffer',
          timeout: TRACK_TIMEOUT_MS,
          maxRedirects: 3,
          maxContentLength: MAX_CAPTION_BYTES,
          beforeRedirect: (options) => {
            const target = options.href;
            if (!target) return;
            if (
              isPrivateUrl(target) ||
              !isAllowedStreamDomain(target, referer)
            ) {
              throw new CaptionError('Blocked caption redirect', 403);
            }
          },
        });
      } catch (err) {
        if (err instanceof CaptionError) throw err;
        if (axios.isAxiosError(err)) {
          throw new CaptionError(
            `Failed to fetch caption from upstream (HTTP ${
              err.response?.status ?? 'network error'
            })`,
            502
          );
        }
        throw err;
      }

      const contentType = String(response.headers['content-type'] ?? '');
      if (contentType.toLowerCase().includes('text/html')) {
        throw new CaptionError(
          'Caption URL returned HTML instead of a subtitle file',
          415
        );
      }

      const buffer = Buffer.from(response.data);
      if (buffer.length > MAX_CAPTION_BYTES) {
        throw new CaptionError('Caption file is too large', 413);
      }

      const text = decodeCaptionBuffer(buffer);
      const source = detectFormat(text, url, contentType);
      if (!source) {
        throw new CaptionError(
          'Unrecognized caption format (expected VTT, SRT, or ASS)',
          415
        );
      }

      const vtt =
        source === 'vtt'
          ? ensureVttHeader(text)
          : source === 'srt'
            ? srtToVtt(text)
            : assToVtt(text);

      return { source, vtt, cues: parseVttCues(vtt) };
    },
    CAPTION_TTL,
    refresh
  );
}
