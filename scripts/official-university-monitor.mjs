import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required for official-university monitoring.');

const USER_AGENT = 'ChinaUniTracker-OfficialMonitor/1.0 (+https://china-university-tracker-12.vercel.app)';
const TIMEOUT_MS = 30000;
const RETRIES = 3;

// Controlled diagnostic batch. These are official university domains only.
// We deliberately test fetching/discovery before importing program records.
const UNIVERSITIES = [
  { name: 'Capital University of Economics and Business', url: 'https://english.cueb.edu.cn/' },
  { name: 'Central University of Finance and Economics', url: 'https://en.cufe.edu.cn/Admissions1.htm' },
  { name: 'Jilin University', url: 'https://cie.jlu.edu.cn/info/1079/3655.htm' },
  { name: 'Civil Aviation University of China', url: 'https://www.cauc.edu.cn/' },
  { name: 'Dongbei University of Finance and Economics', url: 'https://english.dufe.edu.cn/admission/' },
  { name: 'Fuzhou University of International Studies and Trade', url: 'https://www.fzfu.com/gjzx/info/1094/2837.htm' },
  { name: 'Guangdong University of Foreign Studies', url: 'https://iie-en.gdufs.edu.cn/Enrollment1.htm' },
  { name: 'Hainan University', url: 'https://en.hainanu.edu.cn/Admission/InternationalStudents/ProgramInformation/Degree_Programs.htm' },
  { name: 'Harbin University of Commerce', url: 'https://www.hrbcu.edu.cn/' },
  { name: 'Hubei University', url: 'https://eng.hubu.edu.cn/index/Admission/Online_Application1.htm' },
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          'cache-control': 'no-cache',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return {
        url: response.url,
        status: response.status,
        contentType: response.headers.get('content-type') || '',
        text: await response.text(),
      };
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) await sleep(1000 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function cleanHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLinks(html, baseUrl) {
  const out = new Set();
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(html))) {
    try {
      const absolute = new URL(match[1], baseUrl).href;
      if (/^https?:\/\//i.test(absolute)) out.add(absolute);
    } catch {}
  }
  return [...out];
}

function candidateLinks(html, baseUrl) {
  const keywords = /(admission|admissions|international.?student|international.?education|undergraduate|bachelor|master|graduate|program|major|prospectus|scholarship|enroll|enrollment)/i;
  return extractLinks(html, baseUrl)
    .filter(link => keywords.test(link))
    .slice(0, 40);
}

async function upsertSource(university, page, body, candidateCount) {
  const sourceKey = `official:${university.name}`;
  const hash = createHash('sha256').update(body).digest('hex');
  const rows = await db`SELECT id FROM monitor_sources WHERE source_key=${sourceKey} LIMIT 1`;
  let sourceId = rows[0]?.id;
  if (!sourceId) {
    const inserted = await db`INSERT INTO monitor_sources (source_key, source_url, source_type, check_interval_hours, status, last_checked_at, content_hash) VALUES (${sourceKey}, ${page.url}, 'official', 24, 'active', now(), ${hash}) RETURNING id`;
    sourceId = inserted[0].id;
  } else {
    await db`UPDATE monitor_sources SET source_url=${page.url}, source_type='official', check_interval_hours=24, status='active', error_message=NULL, last_checked_at=now(), content_hash=${hash}, updated_at=now() WHERE id=${sourceId}`;
  }
  await db`INSERT INTO monitor_events (monitor_source_id, event_type, source_url, summary, payload) VALUES (${sourceId}, 'official_source_check', ${page.url}, ${`${university.name}: official source reachable; ${candidateCount} candidate admission/program links discovered.`}, ${JSON.stringify({ university: university.name, http_status: page.status, content_type: page.contentType, content_length: body.length, candidate_links: candidateCount, hash })}::jsonb)`;
}

let ok = 0;
let failed = 0;

for (const university of UNIVERSITIES) {
  try {
    const page = await fetchText(university.url);
    const text = cleanHtml(page.text);
    const candidates = candidateLinks(page.text, page.url);
    const yearHits = [...text.matchAll(/\b(?:2026|2027)\b/g)].length;
    await upsertSource(university, page, text, candidates.length);
    console.log(`[OFFICIAL] ${university.name} OK ${page.status}; ${text.length} chars; ${candidates.length} candidate links; ${yearHits} year mentions`);
    for (const link of candidates.slice(0, 12)) console.log(`[OFFICIAL]   -> ${link}`);
    ok++;
  } catch (error) {
    failed++;
    console.error(`[OFFICIAL] ${university.name} FAILED: ${error?.message || error}`);
  }
  await sleep(500);
}

console.log(`[OFFICIAL] diagnostic batch complete: ${ok} reachable, ${failed} failed, ${UNIVERSITIES.length} total; no program import performed`);
if (failed === UNIVERSITIES.length) process.exitCode = 1;
