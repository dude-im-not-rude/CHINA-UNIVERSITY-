import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required for CUCAS discovery.');

const USER_AGENT = 'ChinaUniTracker-CUCASDiscovery/1.0';
const TIMEOUT_MS = 25000;
const RETRIES = 3;
const MAX_PAGES_PER_SEED = Number(process.env.CUCAS_MAX_PAGES_PER_SEED || 40);
const MAX_DISCOVERY_PAGES = Number(process.env.CUCAS_MAX_DISCOVERY_PAGES || 500);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const SEEDS = (process.env.CUCAS_DISCOVERY_SEEDS || [
  'https://bachelor.cucas.cn/search?tag=2-137',
  'https://bachelor.cucas.cn/search?tag=2-48-109-0-0-0%2C14000-0-0-1-0-0-0-0-0-0-0-0',
  'https://bachelor.cucas.cn/search?tag=2-56-71-4%20or%205-0-6200%2C6600-0-0-0-2-0-0--0-0-0-0',
  'https://www.cucas.cn/index/bachelorcourse?lang=en',
  'https://www.cucas.cn/index/mastercourse?lang=en',
  'https://www.cucas.cn/index/chinesecourse?lang=en',
  'https://school.cucas.cn/',
  'https://city.cucas.cn/'
].join('|')).split('|').map(s => s.trim()).filter(Boolean);

function clean(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchText(url) {
  let last;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.8',
          'cache-control': 'no-cache'
        },
        redirect: 'follow',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return { url: response.url, html: await response.text() };
    } catch (error) {
      last = error;
      if (attempt < RETRIES) await sleep(attempt * 1000);
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}

function extractLinks(html, base) {
  const out = new Map();
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    try {
      const url = new URL(match[1], base);
      if (!/^https?:$/i.test(url.protocol)) continue;
      out.set(url.href, clean(match[2]).slice(0, 180));
    } catch {}
  }
  return [...out.entries()];
}

function sameCucas(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'cucas.cn' || host.endsWith('.cucas.cn');
  } catch {
    return false;
  }
}

function isUsefulPath(url) {
  try {
    const u = new URL(url);
    const path = `${u.pathname}${u.search}`.toLowerCase();
    return /(?:search|school|city|program|course|bachelor|master|phd|university|college)/i.test(path);
  } catch {
    return false;
  }
}

function pageVariants(url) {
  const out = new Set();
  try {
    const u = new URL(url);
    if (!/\/search(?:\/|$)/i.test(u.pathname)) return [];
    for (let page = 1; page <= MAX_PAGES_PER_SEED; page++) {
      const v = new URL(u.href);
      v.searchParams.set('page', String(page));
      out.add(v.href);
      const p = new URL(u.href);
      p.searchParams.set('p', String(page));
      out.add(p.href);
    }
  } catch {}
  return [...out];
}

function pageTitle(html, url) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1];
  return clean(h1 || h2 || title || new URL(url).pathname.split('/').filter(Boolean).pop() || '').slice(0, 220);
}

const BAD_NAMES = /^(home|homepage|school|schools|city|cities|search|programs?|courses?|bachelor|master|phd|non[- ]degree|admission|admissions|application|scholarships?|news|notice|contact|about|index)$/i;

function universityNameFromPage(html, url) {
  const text = clean(html);
  const title = pageTitle(html, url);
  const patterns = [
    /Apply to\s+Chinese Universities\s+([^|]{3,140})\s+(?:Basic Information|Bachelor|Master|PhD|Non-degree)/i,
    /([^|]{3,140})\s+Basic Information/i,
    /(?:University|College)\s+of\s+[^|<]{3,120}/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1] && !BAD_NAMES.test(m[1].trim())) return m[1].trim();
  }
  const cleanedTitle = title
    .replace(/\s*[|–—-]\s*(CUCAS|China Universities|Study in China).*$/i, '')
    .replace(/^Study in China\s*[-|:]\s*/i, '')
    .trim();
  if (cleanedTitle && !BAD_NAMES.test(cleanedTitle) && /university|college|institute/i.test(cleanedTitle)) return cleanedTitle;
  return null;
}

function officialUniversityUrl(html, baseUrl) {
  for (const [url] of extractLinks(html, baseUrl)) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.endsWith('.edu.cn') || host === 'edu.cn') return url;
    } catch {}
  }
  return null;
}

async function upsertUniversity(name, officialWebsite) {
  if (!name || BAD_NAMES.test(name) || name.length < 3) return false;
  const existing = await db`SELECT id, official_website FROM universities WHERE lower(name_english)=lower(${name}) LIMIT 1`;
  if (existing[0]) {
    if (!existing[0].official_website && officialWebsite) {
      await db`UPDATE universities SET official_website=${officialWebsite}, updated_at=now() WHERE id=${existing[0].id}`;
      return true;
    }
    return false;
  }
  await db`INSERT INTO universities (name_english, university_type, country, status, official_website, university_description) VALUES (${name}, 'other', 'China', 'active', ${officialWebsite}, 'Discovered from CUCAS. Critical admissions details require direct university-source verification.')`;
  return true;
}

const visited = new Set();
const queued = new Set(SEEDS);
const queue = [...SEEDS];
let discoveredUniversities = 0;
let pagesScanned = 0;
let programLinks = new Set();

console.log(`[DISCOVERY] ${SEEDS.length} seeds; pagination budget ${MAX_PAGES_PER_SEED} pages/seed; global page budget ${MAX_DISCOVERY_PAGES}.`);

for (const seed of SEEDS) {
  for (const variant of pageVariants(seed)) {
    if (!queued.has(variant)) { queued.add(variant); queue.push(variant); }
  }
}

while (queue.length && pagesScanned < MAX_DISCOVERY_PAGES) {
  const url = queue.shift();
  if (visited.has(url)) continue;
  visited.add(url);
  try {
    const page = await fetchText(url);
    pagesScanned++;
    const title = pageTitle(page.html, page.url);
    const official = officialUniversityUrl(page.html, page.url);
    const university = universityNameFromPage(page.html, page.url);
    if (university) {
      if (await upsertUniversity(university, official)) discoveredUniversities++;
    }

    for (const [link] of extractLinks(page.html, page.url)) {
      if (!sameCucas(link) || !isUsefulPath(link) || visited.has(link)) continue;
      if (!queued.has(link)) { queued.add(link); queue.push(link); }
      if (/\/program\//i.test(new URL(link).pathname)) programLinks.add(link);
    }

    for (const variant of pageVariants(page.url)) {
      if (!visited.has(variant) && !queued.has(variant)) { queued.add(variant); queue.push(variant); }
    }

    if (pagesScanned % 10 === 0) {
      console.log(`[DISCOVERY] ${pagesScanned} pages scanned; ${queue.length} queued; ${programLinks.size} program links; ${discoveredUniversities} university records changed.`);
    }
    await sleep(150);
  } catch (error) {
    console.warn(`[DISCOVERY] ${url} :: ${error.message}`);
  }
}

console.log(`[DISCOVERY] complete: ${pagesScanned} pages scanned; ${visited.size} visited; ${programLinks.size} program links discovered; ${discoveredUniversities} university records inserted/enriched.`);
