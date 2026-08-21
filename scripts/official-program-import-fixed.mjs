import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required for official program import.');

const USER_AGENT = 'ChinaUniTracker-OfficialProgramImporter/1.1';
const TIMEOUT_MS = 25000;
const RETRIES = 3;
const MAX_PAGES_PER_UNIVERSITY = 60;
const ACCEPTED_YEARS = ['2026', '2027'];

const UNIVERSITIES = [
  ['Capital University of Economics and Business', 'https://english.cueb.edu.cn/'],
  ['Central University of Finance and Economics', 'https://en.cufe.edu.cn/'],
  ['Jilin University', 'https://www.jlu.edu.cn/index/English.htm'],
  ['Civil Aviation University of China', 'https://www.cauc.edu.cn/'],
  ['Dongbei University of Finance and Economics', 'https://english.dufe.edu.cn/'],
  ['Fuzhou University of International Studies and Trade', 'https://www.fzfu.com/'],
  ['Guangdong University of Foreign Studies', 'https://www.gdufs.edu.cn/'],
  ['Hainan University', 'https://en.hainanu.edu.cn/'],
  ['Harbin University of Commerce', 'https://www.hrbcu.edu.cn/'],
  ['Hubei University', 'https://eng.hubu.edu.cn/'],
  ['Lanzhou University', 'https://en.lzu.edu.cn/'],
  ['Nanchang University', 'https://english.ncu.edu.cn/'],
  ['Lishui University', 'https://www.lsu.edu.cn/'],
  ['Ningbo University', 'https://www.nbu.edu.cn/'],
  ['Renmin University of China', 'https://en.ruc.edu.cn/'],
  ['SIAS University', 'https://www.sias.edu.cn/'],
  ['Shanghai University of Finance and Economics', 'https://english.sufe.edu.cn/'],
  ['Southwestern University of Finance and Economics', 'https://e.swufe.edu.cn/'],
  ['Taizhou University', 'https://www.tzu.edu.cn/'],
  ['Tongji University', 'https://en.tongji.edu.cn/'],
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
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.8',
          'cache-control': 'no-cache',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return { url: response.url, html: await response.text() };
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) await sleep(attempt * 1000);
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
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLinks(html, baseUrl) {
  const out = new Map();
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    try {
      const url = new URL(match[1], baseUrl);
      if (!/^https?:$/i.test(url.protocol)) continue;
      out.set(url.href, cleanHtml(match[2]).slice(0, 180));
    } catch {}
  }
  return [...out.entries()];
}

function sameSite(url, root) {
  try {
    const a = new URL(url);
    const b = new URL(root);
    return a.hostname === b.hostname || a.hostname.endsWith(`.${b.hostname}`);
  } catch {
    return false;
  }
}

function likelyPage(url, anchorText = '') {
  const hay = `${url} ${anchorText}`.toLowerCase();
  return /(admission|undergraduate|bachelor|master|graduate|program|programme|major|course|degree|international.?student|study|academic|school|college|faculty|prospectus)/i.test(hay);
}

function first(regex, text) {
  const match = text.match(regex);
  return match?.[1] ? cleanHtml(match[1]) : null;
}

function degreeFrom(text, url = '') {
  const hay = `${url} ${text}`.toLowerCase();
  if (/\b(phd|doctoral|doctorate)\b/.test(hay)) return 'phd';
  if (/\b(master|msc|mba|graduate)\b/.test(hay)) return 'master';
  if (/\b(bachelor|bsc|ba|bba|undergraduate)\b/.test(hay)) return 'bachelor';
  return null;
}

function languageFrom(text) {
  if (/\b(bilingual|english and chinese|chinese and english)\b/i.test(text)) return 'Bilingual';
  if (/\b(english[- ]taught|taught in english|language of instruction[^.]{0,40}english|teaching language[^.]{0,40}english)\b/i.test(text)) return 'English';
  if (/\b(chinese[- ]taught|taught in chinese|language of instruction[^.]{0,40}chinese|teaching language[^.]{0,40}chinese)\b/i.test(text)) return 'Chinese';
  return 'Other';
}

function durationFrom(text) {
  const value = first(/(?:duration|study period)[^\d]{0,30}(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i, text);
  return value ? Number(value) : null;
}

function tuitionFrom(text) {
  const patterns = [
    /(?:tuition|tuition fee|tuition fees)[^\d]{0,40}(?:rmb|cny|yuan)?\s*([\d,]+(?:\.\d+)?)/i,
    /(?:rmb|cny|yuan)\s*([\d,]+(?:\.\d+)?)[^a-z]{0,20}(?:per year|annual|tuition)/i,
  ];
  for (const pattern of patterns) {
    const value = first(pattern, text);
    if (value) return Number(value.replace(/,/g, ''));
  }
  return null;
}

function yearFrom(text) {
  for (const year of ACCEPTED_YEARS) {
    if (new RegExp(`\\b${year}\\b`).test(text)) return year;
  }
  return null;
}

function dateFrom(text) {
  const month = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*';
  const re = new RegExp(`(?:application deadline|deadline|apply by)[^\\n|:]{0,80}(${month}\\s+\\d{1,2}(?:,\\s*|\\s+)\\d{4}|\\d{4}[/-]\\d{1,2}[/-]\\d{1,2})`, 'i');
  const value = first(re, text);
  if (!value) return null;
  const parsed = new Date(value.replace(/-/g, '/'));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function titleFrom(html, url) {
  const h1 = first(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html);
  const h2 = first(/<h2[^>]*>([\s\S]*?)<\/h2>/i, html);
  const title = first(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const fallback = new URL(url).pathname.split('/').filter(Boolean).pop() || 'Program';
  return cleanHtml(h1 || h2 || title || fallback).replace(/\s*[|–—-]\s*(official.*|home.*)$/i, '').slice(0, 180);
}

function isGenericTitle(name) {
  return /^(home|homepage|admissions?|international students?|undergraduate|undergraduate programs?|graduate|graduate programs?|programs?|courses?|academics?|study|news|notice|school|college|faculty)$/i.test(name.trim());
}

async function ensureUniversity(name, officialUrl) {
  const rows = await db`SELECT id FROM universities WHERE lower(name_english)=lower(${name}) LIMIT 1`;
  if (rows[0]) {
    await db`UPDATE universities SET official_website=${officialUrl}, updated_at=now() WHERE id=${rows[0].id}`;
    return rows[0].id;
  }
  const inserted = await db`INSERT INTO universities (name_english, university_type, country, status, official_website, university_description) VALUES (${name}, 'other', 'China', 'active', ${officialUrl}, 'Imported from the university official website.') RETURNING id`;
  return inserted[0].id;
}

async function upsertProgram(universityId, record) {
  if (!record.name || record.name.length < 3 || isGenericTitle(record.name)) return false;
  const degree = record.degree || 'other';
  if (degree === 'other') return false;
  const language = record.language || 'Other';

  const rows = await db`SELECT id FROM programs WHERE university_id=${universityId} AND lower(program_name)=lower(${record.name}) AND lower(degree_level)=lower(${degree}) AND lower(language)=lower(${language}) LIMIT 1`;
  let programId = rows[0]?.id;
  if (programId) {
    await db`UPDATE programs SET english_taught=${language === 'English'}, duration_years=${record.duration}, tuition_fee=${record.tuition}, tuition_currency='RMB', official_program_url=${record.url}, is_active=true, updated_at=now() WHERE id=${programId}`;
  } else {
    const inserted = await db`INSERT INTO programs (university_id, program_name, degree_level, language, english_taught, duration_years, tuition_fee, tuition_currency, official_program_url, is_active) VALUES (${universityId}, ${record.name}, ${degree}, ${language}, ${language === 'English'}, ${record.duration}, ${record.tuition}, 'RMB', ${record.url}, true) RETURNING id`;
    programId = inserted[0].id;
  }

  if (record.year) {
    const start = `${record.year}-09-01`;
    const deadline = record.deadline;
    const status = deadline && new Date(deadline) < new Date() ? 'closed' : 'upcoming';
    const existing = await db`SELECT id FROM intakes WHERE program_id=${programId} AND semester_start_date=${start} LIMIT 1`;
    if (existing[0]) {
      await db`UPDATE intakes SET application_deadline=${deadline}, application_status=${status}, notes='Official university website discovery. Verify against the university admission notice.' WHERE id=${existing[0].id}`;
    } else {
      await db`INSERT INTO intakes (program_id, intake_name, application_deadline, semester_start_date, application_status, notes) VALUES (${programId}, 'September', ${deadline}, ${start}, ${status}, 'Official university website discovery. Verify against the university admission notice.')`;
    }
  }

  const source = await db`SELECT id FROM sources WHERE program_id=${programId} AND source_url=${record.url} LIMIT 1`;
  if (source[0]) {
    await db`UPDATE sources SET last_checked_at=now(), verification_status='verified', notes='Program discovered on the university official website.' WHERE id=${source[0].id}`;
  } else {
    await db`INSERT INTO sources (program_id, source_name, source_url, source_type, is_official, last_checked_at, verification_status, notes) VALUES (${programId}, ${record.university}, ${record.url}, 'official', true, now(), 'verified', 'Program discovered on the university official website.')`;
  }
  return true;
}

async function crawlUniversity(name, rootUrl) {
  const queue = [rootUrl];
  const seen = new Set();
  const candidates = new Map();
  let pages = 0;

  while (queue.length && pages < MAX_PAGES_PER_UNIVERSITY) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const page = await fetchText(url);
      pages++;
      const text = cleanHtml(page.html);
      const degree = degreeFrom(text, page.url);
      const strong = likelyPage(page.url) && degree && (/program|programme|course|major|degree|bachelor|master|undergraduate|graduate/i.test(page.url) || /program|programme|course|major|degree/i.test(text.slice(0, 5000)));
      if (strong) candidates.set(page.url, { url: page.url, html: page.html, text, degree });

      for (const [link, anchor] of extractLinks(page.html, page.url)) {
        if (!sameSite(link, rootUrl) || seen.has(link)) continue;
        if (likelyPage(link, anchor)) queue.push(link);
      }
      await sleep(150);
    } catch (error) {
      console.warn(`[OFFICIAL] ${name} page failed: ${url} :: ${error.message}`);
    }
  }

  const universityId = await ensureUniversity(name, rootUrl);
  let imported = 0;
  for (const candidate of candidates.values()) {
    const record = {
      university: name,
      name: titleFrom(candidate.html, candidate.url),
      degree: candidate.degree,
      language: languageFrom(candidate.text),
      duration: durationFrom(candidate.text),
      tuition: tuitionFrom(candidate.text),
      year: yearFrom(candidate.text),
      deadline: dateFrom(candidate.text),
      url: candidate.url,
    };
    try {
      if (await upsertProgram(universityId, record)) imported++;
    } catch (error) {
      console.warn(`[OFFICIAL] ${name} import failed for ${record.name}: ${error.message}`);
    }
  }

  console.log(`[OFFICIAL] ${name}: crawled ${pages} pages, ${candidates.size} candidate program pages, imported/updated ${imported}`);
  return imported;
}

let totalImported = 0;
let totalFailed = 0;
for (const [name, url] of UNIVERSITIES) {
  try {
    totalImported += await crawlUniversity(name, url);
  } catch (error) {
    totalFailed++;
    console.error(`[OFFICIAL] ${name} FAILED: ${error.message}`);
  }
}

console.log(`[OFFICIAL] batch complete: ${UNIVERSITIES.length - totalFailed} universities processed, ${totalFailed} failed, ${totalImported} program records imported/updated`);
