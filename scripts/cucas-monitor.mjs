import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const mode = process.argv[2] || 'cucas';
const CUCAS_SEEDS = (process.env.CUCAS_SEED_URLS || 'https://bachelor.cucas.cn/search|https://scholarship.cucas.cn/').split('|').filter(Boolean);
const CSCA_SEEDS = (process.env.CSCA_SEED_URLS || 'https://csca.cn/').split('|').filter(Boolean);
const USER_AGENT = 'ChinaUniTracker-Monitor/1.2 (+https://china-university-tracker-12.vercel.app)';
const MAX_PROGRAM_PAGES = Number(process.env.MAX_PROGRAM_PAGES || 1000);
const ACCEPTED_YEARS = ['2026', '2027'];

if (!db) throw new Error('DATABASE_URL is required for monitoring.');

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8' }, redirect: 'follow' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return { url: response.url, text: await response.text(), contentType: response.headers.get('content-type') || '' };
}

function cleanHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

function links(html, pattern, baseUrl) {
  const out = new Set();
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const absolute = new URL(m[1], baseUrl).href;
      if (pattern.test(absolute)) out.add(absolute);
    } catch {}
  }
  return [...out];
}

function firstMatch(text, regexes) {
  for (const re of regexes) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function numberFrom(value) {
  if (!value) return null;
  const m = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function parseProgram(url, html) {
  const text = cleanHtml(html);
  const programName = firstMatch(text, [/Apply to\s+Chinese Universities\s+([^|]{2,100})\s+(?:Bachelor|Master|PhD|Non-degree)\b/i, /^([^|]{2,100})\s+(?:Bachelor|Master|PhD|Non-degree)\b/i]) || url.split('/').pop().replace(/-\d+\.html$/, '').replace(/-/g, ' ');
  const degreeRaw = firstMatch(text, [/(Bachelor|Master|PhD|Non-degree)\b/i]);
  const degree = ({ bachelor:'bachelor', master:'master', phd:'phd', 'non-degree':'other' })[(degreeRaw || '').toLowerCase()] || 'other';
  const university = firstMatch(text, [/Apply to\s+Chinese Universities\s+([^|]{2,100})\s+Basic Information/i, /([^|]{2,100})\s+Basic Information/i]);
  const starting = firstMatch(text, [/Starting Date:\s*[^|]*?([A-Z][a-z]{2}\s+\d{1,2}\s*,\s*(?:2026|2027))/i, /Starting Data[^|]*?([A-Z][a-z]{2}\s+\d{1,2}\s*,\s*(?:2026|2027))/i]);
  const deadline = firstMatch(text, [/Application Deadline:[^|]*?([A-Z][a-z]{2}\s+\d{1,2}\s*,\s*(?:2026|2027))/i]);
  const language = firstMatch(text, [/Teaching Language:\s*([^|]+?)(?:\s+Application Deadline|\s+Tuition|\s+Application Fee|$)/i]);
  const duration = numberFrom(firstMatch(text, [/Duration:\s*([0-9]+)\s*Years?/i]));
  const tuition = numberFrom(firstMatch(text, [/Tuition(?: Fees)?:\s*(?:RMB|CNY)\s*([\d,]+(?:\.\d+)?)/i, /Bachelor\s*\|\s*RMB\s*([\d,]+)/i]));
  const cscaBlock = text.match(/(?:CSCA|China Scholastic Competency Assessment)[\s\S]{0,1800}/i)?.[0] || '';
  const cscaRequired = /(?:take|test|transcript|assessment).{0,120}(?:CSCA|China Scholastic Competency Assessment)|CSCA.{0,160}(?:required|mandatory|need)/i.test(cscaBlock);
  const subjects = firstMatch(cscaBlock, [/Mandatory Assessment Subject\s*:\s*([^\.]+)/i, /(?:subjects|subject)[^:]*:\s*([^\.]+)/i]);
  const openForApplication = /Open For Application/i.test(text);
  const normalizedLanguage = (language || '').toLowerCase().includes('bilingual') ? 'Bilingual' : (language || '').toLowerCase().includes('english') ? 'English' : (language || '').toLowerCase().includes('chinese') ? 'Chinese' : language || 'Other';
  const officialCandidate = links(html, /\.edu\.cn(?:\/|$)/i, url).find(link => !/cucas\.cn/i.test(link)) || null;
  return { university: university?.replace(/\s+/g, ' ').trim(), programName: programName?.replace(/\s+/g, ' ').trim(), degree, starting, deadline, language: normalizedLanguage, duration, tuition, cscaRequired, subjects, openForApplication, officialCandidate, url };
}

function isoDate(value) {
  if (!value) return null;
  const d = new Date(value.replace(',', ''));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function intakeName(value) {
  if (!value) return 'Other';
  const month = value.slice(0, 3).toLowerCase();
  if (month === 'sep') return 'September';
  if (month === 'mar') return 'March';
  if (month === 'jan') return 'January';
  return 'Other';
}

async function upsertMonitorSource(sourceKey, url, interval) {
  const rows = await db`SELECT id FROM monitor_sources WHERE source_key=${sourceKey} LIMIT 1`;
  if (rows[0]) return rows[0].id;
  const inserted = await db`INSERT INTO monitor_sources (source_key, source_url, source_type, check_interval_hours) VALUES (${sourceKey}, ${url}, ${mode}, ${interval}) RETURNING id`;
  return inserted[0].id;
}

async function recordSnapshot(sourceKey, url, body, summary) {
  const sourceId = await upsertMonitorSource(sourceKey, url, mode === 'csca' ? 4 : 24);
  const hash = createHash('sha256').update(body).digest('hex');
  const old = await db`SELECT content_hash FROM monitor_sources WHERE id=${sourceId} LIMIT 1`;
  const changed = !old[0]?.content_hash || old[0].content_hash !== hash;
  if (changed) await db`UPDATE monitor_sources SET last_checked_at=now(), last_changed_at=now(), content_hash=${hash}, status='active', error_message=NULL, updated_at=now() WHERE id=${sourceId}`;
  else await db`UPDATE monitor_sources SET last_checked_at=now(), content_hash=${hash}, status='active', error_message=NULL, updated_at=now() WHERE id=${sourceId}`;
  if (changed) await db`INSERT INTO monitor_events (monitor_source_id, event_type, source_url, summary, payload) VALUES (${sourceId}, 'content_changed', ${url}, ${summary}, ${JSON.stringify({ hash })}::jsonb)`;
  return changed;
}

async function upsertProgram(record) {
  if (!record.university || !record.programName || !record.starting || !ACCEPTED_YEARS.some(year => record.starting.includes(year))) return false;
  const uniRows = await db`SELECT id, official_website FROM universities WHERE lower(name_english)=lower(${record.university}) LIMIT 1`;
  let universityId = uniRows[0]?.id;
  if (!universityId) {
    const inserted = await db`INSERT INTO universities (name_english, university_type, country, status, official_website, university_description) VALUES (${record.university}, 'other', 'China', 'active', ${record.officialCandidate}, 'Discovered from CUCAS. CUCAS is an aggregator; critical admissions details require direct university-source verification.') RETURNING id`;
    universityId = inserted[0].id;
  } else if (!uniRows[0].official_website && record.officialCandidate) {
    await db`UPDATE universities SET official_website=${record.officialCandidate}, updated_at=now() WHERE id=${universityId}`;
  }
  const programRows = await db`SELECT id FROM programs WHERE university_id=${universityId} AND lower(program_name)=lower(${record.programName}) LIMIT 1`;
  let programId = programRows[0]?.id;
  if (programId) await db`UPDATE programs SET degree_level=${record.degree}, language=${record.language}, english_taught=${record.language === 'English'}, duration_years=${record.duration}, tuition_fee=${record.tuition}, tuition_currency='RMB', official_program_url=${record.url}, is_active=true, updated_at=now() WHERE id=${programId}`;
  else { const inserted = await db`INSERT INTO programs (university_id, program_name, degree_level, language, english_taught, duration_years, tuition_fee, tuition_currency, official_program_url, is_active) VALUES (${universityId}, ${record.programName}, ${record.degree}, ${record.language}, ${record.language === 'English'}, ${record.duration}, ${record.tuition}, 'RMB', ${record.url}, true) RETURNING id`; programId = inserted[0].id; }
  const intake = intakeName(record.starting);
  const semesterStart = isoDate(record.starting);
  const deadline = isoDate(record.deadline);
  const existingIntake = await db`SELECT id FROM intakes WHERE program_id=${programId} AND intake_name=${intake} LIMIT 1`;
  const status = record.openForApplication ? 'open' : (deadline && new Date(deadline) < new Date() ? 'closed' : 'upcoming');
  if (existingIntake[0]) await db`UPDATE intakes SET application_deadline=${deadline}, semester_start_date=${semesterStart}, application_status=${status}, notes='CUCAS discovery record. Verify dates against the university official notice.' WHERE id=${existingIntake[0].id}`;
  else await db`INSERT INTO intakes (program_id, intake_name, application_deadline, semester_start_date, application_status, notes) VALUES (${programId}, ${intake}, ${deadline}, ${semesterStart}, ${status}, 'CUCAS discovery record. Verify dates against the university official notice.')`;
  const req = await db`SELECT id FROM admission_requirements WHERE program_id=${programId} LIMIT 1`;
  if (req[0]) await db`UPDATE admission_requirements SET csca_required=${record.cscaRequired}, csca_subjects=${record.subjects}, updated_at=now() WHERE id=${req[0].id}`;
  else await db`INSERT INTO admission_requirements (program_id, csca_required, csca_subjects) VALUES (${programId}, ${record.cscaRequired}, ${record.subjects})`;
  const source = await db`SELECT id FROM sources WHERE program_id=${programId} AND source_url=${record.url} LIMIT 1`;
  if (source[0]) await db`UPDATE sources SET last_checked_at=now(), verification_status='unverified', notes='CUCAS aggregator record. Direct university verification is required for critical admissions fields.' WHERE id=${source[0].id}`;
  else await db`INSERT INTO sources (program_id, source_name, source_url, source_type, is_official, last_checked_at, verification_status, notes) VALUES (${programId}, 'CUCAS', ${record.url}, 'aggregator', false, now(), 'unverified', 'CUCAS aggregator record. Direct university verification is required for critical admissions fields.')`;
  return true;
}

async function runCucas() {
  const visited = new Set();
  const programPages = new Set();
  for (const seed of CUCAS_SEEDS) {
    try {
      const page = await fetchText(seed);
      visited.add(page.url);
      const changed = await recordSnapshot(`cucas:${seed}`, page.url, cleanHtml(page.text), 'CUCAS discovery source changed');
      for (const link of links(page.text, /(?:^|\.)cucas\.cn\/program\//i, page.url)) programPages.add(link);
      for (const link of links(page.text, /(?:^|\.)cucas\.cn\/search/i, page.url).slice(0, 50)) {
        if (visited.has(link)) continue;
        const child = await fetchText(link);
        visited.add(child.url);
        await recordSnapshot(`cucas:${link}`, child.url, cleanHtml(child.text), 'CUCAS search/category source changed');
        for (const program of links(child.text, /(?:^|\.)cucas\.cn\/program\//i, child.url)) programPages.add(program);
      }
      console.log(`[CUCAS] ${seed} ${changed ? 'changed' : 'unchanged'}; ${programPages.size} program links found`);
    } catch (error) { console.error(`[CUCAS] ${seed} failed:`, error.message); }
  }
  let imported = 0;
  for (const url of [...programPages].slice(0, MAX_PROGRAM_PAGES)) {
    try { const page = await fetchText(url); const record = parseProgram(url, page.text); if (await upsertProgram(record)) imported++; }
    catch (error) { console.error(`[CUCAS] program failed ${url}:`, error.message); }
  }
  console.log(`[CUCAS] processed ${Math.min(programPages.size, MAX_PROGRAM_PAGES)} program pages; imported/updated ${imported}`);
}

async function runCsca() {
  for (const seed of CSCA_SEEDS) {
    try { const page = await fetchText(seed); const changed = await recordSnapshot(`csca:${seed}`, page.url, cleanHtml(page.text), 'CSCA official source changed'); console.log(`[CSCA] ${seed} ${changed ? 'CHANGED' : 'unchanged'}`); }
    catch (error) { console.error(`[CSCA] ${seed} failed:`, error.message); }
  }
}

if (mode === 'csca') await runCsca();
else await runCucas();
