import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cleanAppOrigin, normalizePlatformReply, normalizeResource, loadCatalogue } from '../catalogue-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const file = JSON.parse(read('resources.json'));
const platformPaper = {
  id: '2027-mathematics-advanced-assessment-1', title: '2027 HSC Mathematics Advanced — 100-Mark Practice Examination', subtitle: null,
  description: 'An original, challenging HSC-style Mathematics Advanced practice paper.', type: 'paper', subject: 'Mathematics Advanced', year: 2027,
  grade: 'Year 12', marks: 100, durationMinutes: 180, readingMinutes: 10, questionCount: 27,
  sections: [{ label: 'Section I', firstQuestion: 1, lastQuestion: 10, kind: 'multiple-choice', marks: 10 }, { label: 'Section II', firstQuestion: 11, lastQuestion: 27, kind: 'extended-response', marks: 90 }],
  tags: ['Practice examination'], course: 'nsw', certificationState: 'uploaded', availability: 'external', url: 'https://example.org/paper',
  source: 'Bored of Studies', attribution: 'x', rightsNote: 'y', disclaimer: 'Independent practice paper.', publishedAt: Date.parse('2026-11-12'), updatedAt: Date.parse('2026-11-13')
};
const reply = (...resources) => ({ ok: true, status: 200, json: async () => ({ resources, hasMore: false }) });
const fileReply = { ok: true, status: 200, json: async () => file };
const stub = routes => { const calls = []; const fn = async (url, options) => { calls.push({ url, options }); const r = routes[url] ?? routes.default; if (r instanceof Error) throw r; return typeof r === 'function' ? r(url, options) : r; }; fn.calls = calls; return fn; };

test('the app origin must be a clean https origin; empty means off', () => {
  assert.equal(cleanAppOrigin(''), ''); assert.equal(cleanAppOrigin(undefined), '');
  assert.equal(cleanAppOrigin('https://app.prithagoras.example'), 'https://app.prithagoras.example');
  assert.equal(cleanAppOrigin(' https://app.prithagoras.example/ '), 'https://app.prithagoras.example');
  for (const bad of ['http://app.example', 'https://app.example/path', 'https://u:p@app.example', 'https://app.example/?q=1', 'javascript:alert(1)', 'app.example', '//app.example']) assert.equal(cleanAppOrigin(bad), '', bad);
  assert.equal(cleanAppOrigin('http://localhost:8787'), 'http://localhost:8787');
});

test('a platform resource is read into the site shape', () => {
  const r = normalizeResource(platformPaper);
  assert.equal(r.type, 'exam'); assert.equal(r.questions, 27); assert.equal(r.workingMinutes, 180); assert.equal(r.readingMinutes, 10);
  assert.equal(r.duration, '3 hours'); assert.equal(r.releaseDate, '2026-11-12');
  assert.deepEqual(r.sections.map(s => [s.start, s.end]), [[1, 10], [11, 27]]);
  assert.equal(normalizeResource({ ...platformPaper, type: 'solutions' }).type, 'solutions');
});

test('a malformed reply or item is dropped, never shown', () => {
  assert.deepEqual(normalizePlatformReply(null), []); assert.deepEqual(normalizePlatformReply({}), []); assert.deepEqual(normalizePlatformReply({ resources: 'x' }), []);
  const bad = [{ ...platformPaper, id: '../x' }, { ...platformPaper, url: 'http://example.org/p' }, { ...platformPaper, url: 'javascript:alert(1)' }, { ...platformPaper, type: 'exam' }, { ...platformPaper, year: 'x' }, { ...platformPaper, title: '' }, null, 7];
  assert.deepEqual(normalizePlatformReply({ resources: bad }), []);
  assert.equal(normalizePlatformReply({ resources: [platformPaper, platformPaper] }).length, 1, 'duplicate ids collapse');
});

test('with no app origin nothing but the committed file is requested', async () => {
  const fetchFn = stub({ './resources.json': fileReply });
  const out = await loadCatalogue({ appOrigin: '', fetchFn });
  assert.equal(out.source, 'file'); assert.deepEqual(fetchFn.calls.map(c => c.url), ['./resources.json']);
  assert.equal(out.resources.length, file.resources.length);
  const bad = await loadCatalogue({ appOrigin: 'http://not-clean.example', fetchFn: stub({ './resources.json': fileReply }) });
  assert.equal(bad.source, 'file', 'an unclean origin is treated as none');
});

test('with an app origin the platform is read without credentials and used when valid', async () => {
  const fetchFn = stub({ './resources.json': fileReply, 'https://app.example/v1/public/resources': reply(platformPaper) });
  const out = await loadCatalogue({ appOrigin: 'https://app.example', fetchFn });
  assert.equal(out.source, 'platform'); assert.equal(out.resources.length, 1); assert.equal(out.updated, '2026-11-12');
  const call = fetchFn.calls.find(c => c.url.endsWith('/v1/public/resources'));
  assert.equal(call.options.credentials, 'omit'); assert.equal(call.options.mode, 'cors');
});

test('every platform failure falls back to the file, never an empty library', async () => {
  const cases = {
    network: new Error('offline'), http500: { ok: false, status: 500, json: async () => ({}) }, notFound: { ok: false, status: 404, json: async () => ({}) },
    malformed: { ok: true, status: 200, json: async () => ({ nope: true }) }, notJson: { ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } },
    emptyList: reply(), allInvalid: reply({ ...platformPaper, url: 'http://x.example' })
  };
  for (const [name, platform] of Object.entries(cases)) {
    const out = await loadCatalogue({ appOrigin: 'https://app.example', fetchFn: stub({ './resources.json': fileReply, 'https://app.example/v1/public/resources': platform }) });
    assert.equal(out.source, 'file', name); assert.equal(out.resources.length, file.resources.length, name);
  }
});

test('the shipped site has no app address: no sign-in link shown, no cross-origin fetch, nothing new tracked', () => {
  assert.match(read('config.js'), /window\.APP_ORIGIN = "";/);
  assert.match(read('index.html'), /id="app-signin"[^>]*\bhidden\b/);
  assert.match(read('desk.html'), /id="desk-account-note"[^>]*\bhidden\b/);
  assert.ok(read('index.html').indexOf('config.js') < read('index.html').indexOf('script.js'), 'config loads first');
  const script = read('script.js');
  assert.ok(script.includes('if(appOrigin){'), 'the platform path is behind the app origin');
  assert.ok(!/https?:\/\/(?!localhost)[a-z0-9.-]+\//i.test(script.replace(/https?:\/\/www\.w3\.org[^"']*/g, '')), 'no hard-coded remote address in script.js');
  assert.ok(!/analytics|gtag|segment|plausible/i.test(read('catalogue-core.mjs') + script + read('config.js')));
  assert.ok(read('desk.html').includes('remain in this browser until you choose to add them to your Prithagoras account'));
});
