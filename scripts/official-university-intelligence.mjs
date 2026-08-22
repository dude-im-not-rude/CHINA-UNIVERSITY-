import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required.');

const USER_AGENT = 'ChinaUniTracker-UniversityIntelligence/2.0';
const TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const MAX_PAGES = 80;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SKIP_EXT = /\.(?:mp4|webm|mov|avi|mkv|mp3|wav|ogg|png|jpe?g|gif|svg|webp|ico|zip|rar|7z|docx?|xlsx?|pptx?|pdf)$/i;
const SKIP_PATH = /\/(?:wp-content|uploads|static|assets?|images?|img|media|video|audio|fonts?|research|faculty|people|staff|login|search)(?:\/|$)/i;
const GENERIC_TITLE = /^(home|homepage|news|notices?|students?|student experience|student services|academic support|academics?|calendar|academic calendar|international students?|admissions?|application|requirements?|scholarships?|scholarship|contact|contact us|about|about us|overview|school|schools|college|colleges|department|departments|facult(?:y|ies))$/i;
const IMPORTANT = [
  ['deadline', /\b(deadline|application period|application date|registration period|last date|closing date)\b/i],
  ['scholarship', /\b(scholarship|financial aid|funding|grant|tuition waiver)\b/i],
  ['requirement', /\b(requirements?|eligibility|english proficiency|ielts|toefl|csca|qualification|required documents?)\b/i],
  ['admission', /\b(admission|application|apply|enrol(?:ment)?|international student|undergraduate admission|graduate admission)\b/i],
  ['calendar', /\b(academic calendar|semester dates?|term dates?|registration date|holiday|vacation)\b/i],
  ['notice', /\b(official notice|important notice|announcement|notification)\b/i],
];

async function fetchPage(url) {
  let last;
  for (let i = 1; i <= MAX_RETRIES; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.8' } });
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !type.includes('text/html')) throw new Error(`${r.status} ${r.statusText} ${type}`);
      return { url: r.url, html: await r.text() };
    } catch (e) { last = e; if (i < MAX_RETRIES) await sleep(i * 700); }
    finally { clearTimeout(timer); }
  }
  throw last;
}

function clean(s) { return s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim(); }
function sameSite(a, root) { try { const x = new URL(a), r = new URL(root); return x.hostname === r.hostname || x.hostname.endsWith(`.${r.hostname}`); } catch { return false; } }
function links(html, base) {
  const out = []; const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while ((m = re.exec(html))) { try { const u = new URL(m[1], base); if (!/^https?:$/i.test(u.protocol) || SKIP_EXT.test(u.pathname) || SKIP_PATH.test(u.pathname)) continue; out.push([u.href, clean(m[2]).slice(0,180)]); } catch {} }
  return out;
}
function pageTitle(html, url) { return clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || new URL(url).pathname.split('/').filter(Boolean).pop() || 'University update').replace(/\s*[|–—-]\s*(official.*|home.*)$/i,'').trim().slice(0,220); }
function classify(title, text, url) {
  const normalizedTitle = title.replace(/\s+/g,' ').trim();
  const path = new URL(url).pathname;
  if (GENERIC_TITLE.test(normalizedTitle)) return null;
  const hay = `${normalizedTitle} ${path} ${text.slice(0,7000)}`;
  for (const [category, re] of IMPORTANT) {
    if (!re.test(`${normalizedTitle} ${path}`)) continue;
    if (category === 'admission' && /\b(news|students?|student experience|student services|academic support)\b/i.test(normalizedTitle)) continue;
    return category;
  }
  if (/\b(news|press release|events?)\b/i.test(`${normalizedTitle} ${path}`) && !/\b(admission|scholarship|requirement|deadline|calendar|notice)\b/i.test(hay)) return 'general_news';
  return null;
}

const universities = await db`SELECT id,name_english,official_website FROM universities WHERE country='China' AND status='active' AND official_website IS NOT NULL AND trim(official_website)<>'' ORDER BY id`;
let total = 0;

for (const u of universities) {
  const root = u.official_website;
  const queue = [root]; const seen = new Set(); let pages = 0; let events = 0;
  while (queue.length && pages < MAX_PAGES) {
    const url = queue.shift(); if (seen.has(url)) continue; seen.add(url);
    try {
      const p = await fetchPage(url); pages++;
      const text = clean(p.html); const title = pageTitle(p.html, p.url); const category = classify(title, text, p.url);
      if (category) {
        const monitorKey = `official:${u.id}`;
        let source = await db`SELECT id FROM monitor_sources WHERE source_key=${monitorKey} LIMIT 1`;
        if (!source[0]) source = await db`INSERT INTO monitor_sources (source_key,source_url,source_type,check_interval_hours,status) VALUES (${monitorKey},${root},'official_university',24,'active') RETURNING id`;
        const excerpt = text.slice(0,1800);
        const fingerprint = Buffer.from(JSON.stringify({title, category, excerpt})).toString('base64url');
        const payload = { university:u.name_english, title, url:p.url, category, excerpt, fingerprint, detectedAt:new Date().toISOString() };
        const existing = await db`SELECT id FROM monitor_events WHERE monitor_source_id=${source[0].id} AND source_url=${p.url} AND event_type=${category} AND payload->>'fingerprint'=${fingerprint} LIMIT 1`;
        if (!existing[0]) {
          await db`INSERT INTO monitor_events (monitor_source_id,event_type,source_url,summary,payload) VALUES (${source[0].id},${category},${p.url},${title},${JSON.stringify(payload)}::jsonb)`;
          events++; total++;
        }
      }
      for (const [link, anchor] of links(p.html, p.url)) {
        if (!sameSite(link, root) || seen.has(link)) continue;
        const hay = `${link} ${anchor}`;
        if (/admission|application|international|scholarship|requirement|notice|announcement|news|calendar|academic|holiday|enrol|registration|student/i.test(hay)) queue.push(link);
      }
    } catch (e) { console.warn(`[INTEL] ${u.name_english}: ${url} :: ${e.message}`); }
    await sleep(100);
  }
  console.log(`[INTEL] ${u.name_english}: ${pages} pages scanned, ${events} new useful updates`);
}
console.log(`[INTEL] complete: ${universities.length} universities scanned, ${total} new useful updates recorded.`);
