import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required for official program import.');

const USER_AGENT = 'ChinaUniTracker-OfficialProgramImporter/1.0';
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
      return { url: response.url, html: await response.text(), contentType: response.headers.get('content-type') || '' };
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
    .replace(/<script[\\s\\S]*?<\\/script>/gi, ' ')
    .replace(/<style[\\s\\S]*?<\\/style>/gi, ' ')
    .replace(/<noscript[\\s\\S]*?<\\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\\s+/g, ' ')
    .trim();
}

function extractLinks(html, baseUrl) {
  const out = new Map();
  const re = /<a\\b[^>]*href\\s*=\\s*["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    try {
      const url = new URL(match[1], baseUrl);
      if (!/^https?:$/i.test(url.protocol)) continue;
      const text = cleanHtml(match[2]).slice(0, 180);
      out.set(url.href, text);
    } catch {}
  }
  return [...out.entries()];
}

function sameSite(url, root) {
  try {
    const a = new URL(url);
    const b = new URL(root);
    return a.hostname === b.hostname || a.hostname.endsWith(`.${b.hostname}`);
  } catch { return false; }
}

function likelyPage(url, anchorText = '') {
  const hay = `${url} ${anchorText}`.toLowerCase();
  return /(admission|admissions|undergraduate|bachelor|master|graduate|program|programme|major|course|degree|international.?student|study|academic|school|college|faculty|prospectus)/i.test(hay);
}

function stripTags(value) {
  return cleanHtml(value || '').replace(/\\s+/g, ' ').trim();
}

function first(regex, text) {
  const m = text.match(regex);
  return m?.[1] ? stripTags(m[1]) : null;
}

function degreeFrom(text, url) {
  const hay = `${url} ${text}`.toLowerCase();
  if (/\\b(phd|doctoral|doctorate)\\b/.test(hay)) return 'phd';
  if (/\\b(master|msc|mba|graduate)\\b/.test(hay)) return 'master';
  if (/\\b(bachelor|bsc|ba|bba|undergraduate)\\b/.test(hay)) return 'bachelor';
  return null;
}

function languageFrom(text) {
  if (/\\b(bilingual|english and chinese|chinese and english)\\b/i.test(text)) return 'Bilingual';
  if (/\\b(english[- ]taught|taught in english|language of instruction[^.]{0,40}english|teaching language[^.]{0,40}english)\\b/i.test(text)) return 'English';
  if (/\\b(chinese[- ]taught|taught in chinese|language of instruction[^.]{0,40}chinese|teaching language[^.]{0,40}chinese)\\b/i.test(text)) return 'Chinese';
  return 'Other';
}

function tuitionFrom(text) {
  const patterns = [
    /(?:tuition|tuition fee|tuition fees)[^\\d]{0,40}(?:rmb|cny|yuan)?\\s*([\\d,]+(?:\\.\\d+)?)/i,
    /(?:rmb|cny|yuan)\\s*([\\d,]+(?:\\.\\d+)?)[^a-z]{0,20}(?:per year|annual|tuition)/i,
  ];
  for (const re of patterns) {
    const value = first(re, text);
    if (value) return Number(value.replace(/,/g, ''));
  }
  return null;
}

function durationFrom(text) {
  const value = first(/(?:duration|study period)[^\\d]{0,20}(\\d+(?:\\.\\d+)?)\\s*(?:years?|yrs?)/i, text);
  return value ? Number(value) : null;
}

function yearFrom(text) {
  const years = ACCEPTED_YEARS.filter(y => new RegExp(`\\\\b${y}\\\\b`).test(text));
  return years.length ? years[0] : null;
}

function dateFrom(text, label) {
  const month = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*';
  const re = new RegExp(`${label}[^\\n|:]{0,80}(${month}\\s+\\d{1,2}(?:,\\s*|\\s+)\\d{4}|\\d{4}[/-]\\d{1,2}[/-]\\d{1,2})`, 'i');
  const value = first(re, text);
  if (!value) return null;
  const d = new Date(value.replace(/-/g, '/'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function titleAndHeading(html, url) {
  const title = first(/<title[^>]*>([\\s\\S]*?)<\\/title>/i, html);
  const h1 = first(/<h1[^>]*>([\\s\\S]*?)<\\/h1>/i, html);
  const h2 = first(/<h2[^>]*>([\\s\\S]*?)<\\/h2>/i, html);
  const value = h1 || h2 || title || new URL(url).pathname.split('/').filter(Boolean).pop() || 'Program';
  return stripTags(value).replace(/\\s*[|–—-]\\s*(official.*|home.*)$/i, '').slice(0, 180);
}

function isGenericTitle(name) {
  return /^(home|homepage|admissions?|international students?|undergraduate|undergraduate programs?|graduate|graduate programs?|programs?|courses?|academics?|study|news|notice|school|college|faculty)$/i.test(name.trim());
}

function jsonLdCourses(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items = Array.isArray(parsed) ? parsed : (parsed?.['@graph'] || [parsed]);
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        if (/Course|EducationalOccupationalProgram/i.test(String(item['@type'] || ''))) {
          out.push({ name: item.name, language: item.inLanguage, url: item.url });
        }
      }
    } catch {}
  }
  return out.filter(x => x.name);
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
  const degree = record.degree || 'other';
  const language = record.language || 'Other';
  if (!record.name || record.name.length < 3 || isGenericTitle(record.name)) return false;
  if (degree === 'other') return false;

  // Identity is deliberately strict. Degree, language and intake context are never collapsed.
  const rows = await db`SELECT id FROM programs WHERE university_id=${universityId} AND lower(program_name)=lower(${record.name}) AND lower(degree_level)=lower(${degree}) AND lower(language)=lower(${language}) LIMIT 1`;
  let programId = rows[0]?.id;
  if (programId) {
    await db`UPDATE programs SET english_taught=${language === 'English'}, duration_years=${record.duration}, tuition_fee=${record.tuition}, tuition_currency='RMB', official_program_url=${record.url}, is_active=true, updated_at=now() WHERE id=${programId}`;
  } else {
    const inserted = await db`INSERT INTO programs (university_id, program_name, degree_level, language, english_taught, duration_years, tuition_fee, tuition_currency, official_program_url, is_active) VALUES (${universityId}, ${record.name}, ${degree}, ${language}, ${language === 'English'}, ${record.duration}, ${record.tuition}, 'RMB', ${record.url}, true) RETURNING id`;
    programId = inserted[0].id;
  }

  if (record.year) {
    const start = record.year === '2027' ? '2027-09-01' : '2026-09-01';
    const deadline = record.deadline;
    const existing = await db`SELECT id FROM intakes WHERE program_id=${programId} AND semester_start_date=${start} LIMIT 1`;
    if (existing[0]) await db`UPDATE intakes SET application_deadline=${deadline}, application_status=${deadline && new Date(deadline) < new Date() ? 'closed' : 'upcoming'}, notes='Official university website discovery. Verify against the university admission notice.' WHERE id=${existing[0].id}`;
    else await db`INSERT INTO intakes (program_id, intake_name, application_deadline, semester_start_date, application_status, notes) VALUES (${programId}, 'September', ${deadline}, ${start}, ${deadline && new Date(deadline) < new Date() ? 'closed' : 'upcoming'}, 'Official university website discovery. Verify against the university admission notice.')`;
  }

  const source = await db`SELECT id FROM sources WHERE program_id=${programId} AND source_url=${record.url} LIMIT 1`;
  if (source[0]) await db`UPDATE sources SET last_checked_at=now(), verification_status='verified', notes='Program discovered on the university official website.' WHERE id=${source[0].id}`;
  else await db`INSERT INTO sources (program_id, source_name, source_url, source_type, is_official, last_checked_at, verification_status, notes) VALUES (${programId}, ${record.university}, ${record.url}, 'official', true, now(), 'verified', 'Program discovered on the university official website.')`;
  return true;
}

async function crawlUniversity(name, rootUrl) {
  const queue = [rootUrl];
  const seen = new Set();
  const candidates = new Set();
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
      const strong = likelyPage(page.url) && degree && (/(program|programme|course|major|degree|bachelor|master|undergraduate|graduate)/i.test(page.url) || /(program|programme|course|major|degree)/i.test(text.slice(0, 5000)));
      if (strong) candidates.add({ url: page.url, html: page.html, text, degree });

      for (const [link, anchor] of extractLinks(page.html, page.url)) {
        if (!sameSite(link, rootUrl) || seen.has(link)) continue;
        if (likelyPage(link, anchor)) queue.push(link);
      }
      await sleep(150);
    } catch (error) {
      console.warn(`[OFFICIAL] ${name} page failed: ${url} :: ${error.message}`);
    }
  }

  let imported = 0;
  for (const candidate of candidates) {
    const structured = jsonLdCourses(candidate.html);
    const records = structured.length ? structured : [{ name: titleAndHeading(candidate.html, candidate.url) }];
    for (const item of records) {
      const text = candidate.text;
      const record = {
        university: name,
        name: stripTags(item.name || titleAndHeading(candidate.html, candidate.url)),
        degree: degreeFrom(`${item.name || ''} ${text}`, candidate.url) || candidate.degree,
        language: item.language ? (String(item.language).toLowerCase().includes('en') ? 'English' : String(item.language)) : languageFrom(text),
        duration: durationFrom(text),
        tuition: tuitionFrom(text),
        year: yearFrom(text),
        deadline: dateFrom(text, 'application deadline|deadline|apply by'),
        url: item.url ? new URL(item.url, candidate.url).href : candidate.url,
      };
      try {
        if (await upsertProgram(await ensureUniversity(name, rootUrl), record)) imported++;
      } catch (error) {
        console.warn(`[OFFICIAL] ${name} import failed for ${record.name}: ${error.message}`);
      }
    }
  }
  console.log(`[OFFICIAL] ${name}: crawled ${pages} pages, ${candidates.size} candidate program pages, imported/updated ${imported}`);
  return { pages, candidates: candidates.size, imported };
}

let totalImported = 0;
let totalFailed = 0;
for (const [name, url] of UNIVERSITIES) {
  try {
    const result = await crawlUniversity(name, url);
    totalImported += result.imported;
  } catch (error) {
    totalFailed++;
    console.error(`[OFFICIAL] ${name} FAILED: ${error.message}`);
  }
}
console.log(`[OFFICIAL] batch complete: ${UNIVERSITIES.length - totalFailed} universities processed, ${totalFailed} failed, ${totalImported} program records imported/updated`);
