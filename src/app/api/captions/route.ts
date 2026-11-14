import { NextResponse } from 'next/server';
import { CaptionError, fetchCaption } from '@/lib/captions';

export const dynamic = 'force-dynamic';

function parseHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function getCorsOrigin(req: Request): string {
  const allowedEnv =
    process.env.CORS_ALLOWED_ORIGIN ||
    process.env.CORS_ALLOWED_ORIGINS ||
    '*';

  if (allowedEnv === '*') return '*';

  const allowed = allowedEnv.split(',').map((origin) => origin.trim());
  const requestOrigin = req.headers.get('origin');
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;

  return allowed[0] || '';
}

/**
 * GET /api/captions?url=<track file>&referer=<optional>&format=vtt|json
 *
 * Fetches a subtitle track discovered by `/api/watch/:slug` and returns it as
 * normalized WebVTT (default) or as a JSON cue list.
 *
 * Why this exists:
 * - Upstream tracks are frequently SRT or ASS, which browsers cannot render
 *   through a <track> element.
 * - Subtitle hosts usually require the player's Referer/Origin, which browsers
 *   cannot set from a cross-origin page.
 *
 * Add `?refresh=1` to bypass the 24h in-memory cache.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get('url');
  const referer = searchParams.get('referer') || undefined;
  const format = (searchParams.get('format') || 'vtt').toLowerCase();
  const refresh = searchParams.get('refresh') === '1';

  const corsOrigin = getCorsOrigin(req);
  const corsHeaders: Record<string, string> = {
    ...(corsOrigin ? { 'Access-Control-Allow-Origin': corsOrigin } : {}),
    Vary: 'Origin',
  };

  if (!rawUrl) {
    return NextResponse.json(
      { ok: false, message: 'Missing url parameter' },
      { status: 400, headers: corsHeaders }
    );
  }

  const targetUrl = parseHttpUrl(rawUrl);
  if (!targetUrl) {
    return NextResponse.json(
      { ok: false, message: 'Invalid url parameter (expected http/https)' },
      { status: 400, headers: corsHeaders }
    );
  }

  if (format !== 'vtt' && format !== 'json') {
    return NextResponse.json(
      { ok: false, message: 'Invalid format parameter (expected vtt or json)' },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const caption = await fetchCaption(targetUrl, referer, refresh);

    if (format === 'json') {
      return NextResponse.json(
        {
          ok: true,
          data: {
            source: caption.source,
            cues: caption.cues,
            vtt: caption.vtt,
          },
        },
        {
          headers: {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=3600',
          },
        }
      );
    }

    return new Response(caption.vtt, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to fetch caption';
    const status = err instanceof CaptionError ? err.status : 500;
    console.error('[GET /api/captions]', message);
    return NextResponse.json(
      { ok: false, message },
      { status, headers: corsHeaders }
    );
  }
}
