// Offline regression test for the caption fetch/convert pipeline.
//
// It transpiles `src/lib/captions.ts` with the TypeScript compiler, stubs the
// modules that need network/proxy state, and exercises the real conversion code
// against a local subtitle server. No external network access is required.
//
// Run with: npm run test:captions

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = process.cwd();
const tempDir = path.join(root, 'node_modules', '.cache', 'captions-test');

function writeStubs() {
  fs.writeFileSync(
    path.join(tempDir, 'constants.js'),
    'exports.DEFAULT_HEADERS = {};\n'
  );
  fs.writeFileSync(
    path.join(tempDir, 'cache.js'),
    'exports.getOrSet = async (_key, fetcher) => fetcher();\n'
  );
  fs.writeFileSync(
    path.join(tempDir, 'proxy-pool.js'),
    [
      'exports.isAllowedStreamDomain = () => true;',
      'exports.isPrivateUrl = () => false;',
      'exports.isPrivateUrlAsync = async () => false;',
      '',
    ].join('\n')
  );
}

function compileCaptions() {
  const source = fs.readFileSync(
    path.join(root, 'src', 'lib', 'captions.ts'),
    'utf8'
  );

  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  fs.writeFileSync(path.join(tempDir, 'captions.js'), output);
}

const fixtures = {
  '/sample.srt': {
    type: 'application/x-subrip',
    body: [
      '1',
      '00:00:01,000 --> 00:00:04,500',
      'Hello, world',
      '',
      '2',
      '00:00:05,000 --> 00:00:06,250',
      'Line one',
      'Line two',
      '',
    ].join('\r\n'),
  },
  '/sample.ass': {
    type: 'text/plain',
    body: [
      '[Script Info]',
      'Title: Test',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.00,0:00:04.50,Default,,0,0,0,,{\\i1}Hello\\Nworld{\\i0}',
      '',
    ].join('\n'),
  },
  '/comma.ass': {
    type: 'text/plain',
    body: [
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello, world',
      '',
    ].join('\n'),
  },
  '/bom.vtt': {
    type: 'text/vtt',
    body: '\uFEFFWEBVTT\n\n00:00:01,000 --> 00:00:02,000\nHi\n',
  },
  '/bom.srt': {
    type: 'application/x-subrip',
    body: '\uFEFF1\n00:00:01,000 --> 00:00:02,000\nBOM\n',
  },
};

let failures = 0;

function check(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`);
  if (!pass) {
    console.log('  expected:', JSON.stringify(expected));
    console.log('  actual:  ', JSON.stringify(actual));
  }
}

async function main() {
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  compileCaptions();
  writeStubs();

  const { fetchCaption } = require(path.join(tempDir, 'captions.js'));

  const server = http.createServer((req, res) => {
    const fixture = fixtures[req.url ?? ''];
    if (!fixture) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': fixture.type });
    res.end(Buffer.from(fixture.body, 'utf8'));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Could not determine test server port');
    }
    const base = `http://127.0.0.1:${address.port}`;

    const srt = await fetchCaption(`${base}/sample.srt`, 'https://example.com/');
    check('SRT detected', srt.source, 'srt');
    check(
      'SRT converted to VTT',
      srt.vtt,
      'WEBVTT\n\n00:00:01.000 --> 00:00:04.500\nHello, world\n\n00:00:05.000 --> 00:00:06.250\nLine one\nLine two\n'
    );
    check('SRT cue count', srt.cues.length, 2);
    check('SRT first cue start', srt.cues[0].start, 1);
    check('SRT first cue end', srt.cues[0].end, 4.5);
    check('SRT first cue text', srt.cues[0].text, 'Hello, world');
    check('SRT second cue text', srt.cues[1].text, 'Line one\nLine two');

    const ass = await fetchCaption(`${base}/sample.ass`, 'https://example.com/');
    check('ASS detected', ass.source, 'ass');
    check(
      'ASS converted to VTT',
      ass.vtt,
      'WEBVTT\n\n00:00:01.000 --> 00:00:04.500\nHello\nworld\n'
    );

    const commaAss = await fetchCaption(
      `${base}/comma.ass`,
      'https://example.com/'
    );
    check(
      'ASS keeps commas in cue text',
      commaAss.vtt,
      'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello, world\n'
    );

    const bomVtt = await fetchCaption(`${base}/bom.vtt`, 'https://example.com/');
    check('BOM VTT detected', bomVtt.source, 'vtt');
    check(
      'BOM VTT comma timestamps normalized',
      bomVtt.vtt,
      'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n'
    );

    const bomSrt = await fetchCaption(`${base}/bom.srt`, 'https://example.com/');
    check('BOM SRT detected', bomSrt.source, 'srt');
    check(
      'BOM SRT converted',
      bomSrt.vtt,
      'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nBOM\n'
    );

    const missing = await fetchCaption(`${base}/missing`, 'https://example.com/').then(
      () => 'resolved',
      (err) => err.message
    );
    check('404 becomes an error', missing.includes('HTTP 404'), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log(
    failures === 0
      ? '\nAll caption tests passed.'
      : `\n${failures} caption test(s) failed.`
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.exitCode = 1;
});
