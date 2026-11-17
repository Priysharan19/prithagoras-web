// The public catalogue's rules, kept apart from the page so they can be tested:
// what an app address may be, how the platform's public catalogue reply is
// read into the site's own resource shape, and how the site falls back.
// Dependency-free; no network call is made except through the fetch it is given.

const SLUG = /^[a-z0-9][a-z0-9-]{2,119}$/;
const TYPES = { paper: "exam", solutions: "solutions", notes: "notes" };

/** The app's origin, or "" when none is configured or the value is not a clean https origin. */
export function cleanAppOrigin(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    const local = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (url.protocol !== "https:" && !local) return "";
    if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== "/")) return "";
    return url.origin;
  } catch { return ""; }
}

const httpsUrl = value => {
  try { const url = new URL(String(value)); return url.protocol === "https:" && !url.username && !url.password ? url.href : ""; }
  catch { return ""; }
};
const wholeNumber = value => (Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0);
const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function hours(minutes) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return [h ? `${h} hour${h === 1 ? "" : "s"}` : "", m ? `${m} minutes` : ""].filter(Boolean).join(" ");
}

/** One platform resource read into the site's shape, or null when it is not usable. */
export function normalizeResource(item) {
  if (!item || typeof item !== "object") return null;
  const type = TYPES[item.type];
  const url = httpsUrl(item.url);
  const year = Number(item.year);
  if (!type || !url || !SLUG.test(String(item.id)) || !Number.isInteger(year)) return null;
  const title = text(item.title, 200), description = text(item.description, 2000);
  if (!title || !description) return null;
  const working = wholeNumber(item.durationMinutes);
  const sections = (Array.isArray(item.sections) ? item.sections : [])
    .filter(s => s && Number.isInteger(s.firstQuestion) && Number.isInteger(s.lastQuestion))
    .map(s => ({ label: text(s.label, 60), start: s.firstQuestion, end: s.lastQuestion, kind: text(s.kind, 40), marks: wholeNumber(s.marks) }));
  const published = Number(item.publishedAt);
  return {
    id: item.id, title, subtitle: text(item.subtitle, 200), description, type,
    subject: text(item.subject, 120) || "Mathematics", year, grade: text(item.grade, 40),
    marks: wholeNumber(item.marks), duration: hours(working), questions: wholeNumber(item.questionCount),
    readingMinutes: wholeNumber(item.readingMinutes), workingMinutes: working, sections,
    tags: (Array.isArray(item.tags) ? item.tags : []).filter(t => typeof t === "string").slice(0, 12),
    url, source: text(item.source, 120), availability: "external", disclaimer: text(item.disclaimer, 600),
    releaseDate: Number.isFinite(published) && published > 0 ? new Date(published).toISOString().slice(0, 10) : ""
  };
}

/** The usable resources of a platform reply, or [] when the reply is not the expected shape. */
export function normalizePlatformReply(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.resources)) return [];
  const seen = new Set();
  return data.resources.map(normalizeResource).filter(r => r && !seen.has(r.id) && seen.add(r.id)).slice(0, 200);
}

/**
 * The library's resources: from the platform when an app origin is set and it
 * answers with at least one usable resource, otherwise from the committed file.
 * With no app origin the platform is never contacted.
 */
export async function loadCatalogue({ appOrigin = "", fetchFn, timeoutMs = 6000 } = {}) {
  const origin = cleanAppOrigin(appOrigin);
  const file = async () => {
    const response = await fetchFn("./resources.json", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    if (!Array.isArray(data.resources)) throw new Error("Invalid resource index");
    return data;
  };
  const fromFile = await file();
  if (!origin) return { source: "file", file: fromFile, resources: fromFile.resources, updated: fromFile.updated || "" };
  try {
    // One deadline for the whole exchange, headers AND body: a platform that
    // sends headers and then stalls must not leave the library pending.
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    let timer;
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller?.abort(); reject(new Error("timeout")); }, timeoutMs); });
    const exchange = (async () => {
      const response = await fetchFn(origin + "/v1/public/resources", { mode: "cors", credentials: "omit", cache: "no-cache", headers: { Accept: "application/json" }, signal: controller?.signal });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return normalizePlatformReply(await response.json());
    })();
    exchange.catch(() => {});
    let resources;
    try { resources = await Promise.race([exchange, deadline]); } finally { clearTimeout(timer); }
    if (!resources.length) throw new Error("no usable resources");
    const newest = resources.map(r => r.releaseDate).sort().pop();
    return { source: "platform", file: fromFile, resources, updated: newest || fromFile.updated || "" };
  } catch {
    return { source: "file", file: fromFile, resources: fromFile.resources, updated: fromFile.updated || "" };
  }
}
