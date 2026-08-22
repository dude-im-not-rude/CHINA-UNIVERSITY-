import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required for official program import.');

const USER_AGENT = 'ChinaUniTracker-OfficialProgramImporter/3.1';
const TIMEOUT_MS = 25000;
const RETRIES = 3;
const MAX_PAGES_PER_UNIVERSITY = 120;
const ACCEPTED_YEARS = ['2026', '2027', '2028'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchText(url) {
  let last;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {headers:{'user-agent':USER_AGENT,accept:'text/html,application/xhtml+xml,*/*;q=0.8','accept-language':'en-US,en;q=0.8','cache-control':'no-cache'},redirect:'follow',signal:controller.signal});
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return {url:response.url,html:await response.text()};
    } catch (error) { last=error; if (attempt<RETRIES) await sleep(attempt*1000); }
    finally { clearTimeout(timer); }
  }
  throw last;
}

function clean(html){return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim();}
function links(html,base){const out=new Map();const re=/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(html))){try{const u=new URL(m[1],base);if(/^https?:$/i.test(u.protocol))out.set(u.href,clean(m[2]).slice(0,180));}catch{}}return [...out.entries()];}
function sameSite(a,root){try{const x=new URL(a),r=new URL(root);return x.hostname===r.hostname||x.hostname.endsWith(`.${r.hostname}`);}catch{return false;}}
function title(html,url){const h1=html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];const h2=html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1];const t=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];return clean(h1||h2||t||new URL(url).pathname.split('/').filter(Boolean).pop()||'Program').replace(/\s*[|–—-]\s*(official.*|home.*)$/i,'').slice(0,180);}
function degree(text,url=''){const h=`${url} ${text}`.toLowerCase();if(/\b(phd|doctoral|doctorate)\b/.test(h))return'phd';if(/\b(master|msc|mba|graduate)\b/.test(h))return'master';if(/\b(bachelor|bsc|ba|bba|undergraduate)\b/.test(h))return'bachelor';return null;}
function language(text){if(/\b(bilingual|english and chinese|chinese and english)\b/i.test(text))return'Bilingual';if(/\b(english[- ]taught|taught in english|language of instruction[^.]{0,40}english|teaching language[^.]{0,40}english)\b/i.test(text))return'English';if(/\b(chinese[- ]taught|taught in chinese|language of instruction[^.]{0,40}chinese|teaching language[^.]{0,40}chinese)\b/i.test(text))return'Chinese';return'Other';}
function duration(text){const m=text.match(/(?:duration|study period)[^\d]{0,30}(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);return m?Number(m[1]):null;}
function tuition(text){const m=text.match(/(?:tuition|tuition fee|tuition fees)[^\d]{0,40}(?:rmb|cny|yuan)?\s*([\d,]+(?:\.\d+)?)/i);return m?Number(m[1].replace(/,/g,'')):null;}
function deadline(text){const m=text.match(/(?:application deadline|deadline|apply by)[^\n|:]{0,80}((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*|\s+)\d{4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})/i);if(!m)return null;const d=new Date(m[1].replace(/-/g,'/'));return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10);}
function year(text){return ACCEPTED_YEARS.find(y=>new RegExp(`\\b${y}\\b`).test(text))||null;}

const BAD_NAME=/^(home|homepage|admissions?|application( process| procedures?| requirements?| documents?)?|admission( process| procedures?| requirements?)?|academic calendar|international students?|undergraduate( programs?)?|graduate( programs?)?|programs?|courses?|academics?|study|news|notice|school|college|faculty|application|scholarship(s)?( programs?)?|exchange( programs?)?|department(s)?|schools? (&|and) departments|fees?|tuition|accommodation|how to apply|contact( us)?|about( us)?|basic information|university information|semester arrangement.*)$/i;
const PROGRAM_PATH=/(^|[/_-])(programs?|programmes?|courses?|majors?|degrees?|bachelor|master|mba|undergraduate|graduate|phd|doctoral)([/_.?&#=-]|$)/i;
const ADMIN_PATH=/(application|admission|requirement|procedure|document|calendar|scholarship|exchange|department|faculty|school|contact|about|fees|tuition|accommodation|how[-_ ]to[-_ ]apply)/i;

function isRealProgramPage(url,anchor,name,text){
  const path=new URL(url).pathname;
  const hay=`${url} ${anchor}`;
  if(BAD_NAME.test(name.trim()))return false;
  if(/^(academic|application|admission|scholarship|exchange|department|faculty|school|fees|tuition|calendar|requirements?|procedures?)/i.test(name.trim()))return false;
  if(!degree(text,url))return false;
  if(!PROGRAM_PATH.test(hay))return false;
  if(ADMIN_PATH.test(path)&&!PROGRAM_PATH.test(path)&&!PROGRAM_PATH.test(anchor))return false;
  return true;
}

async function upsert(universityId,universityName,record){
  if(!record.name||record.name.length<3||BAD_NAME.test(record.name)||!record.degree)return false;
  const rows=await db`SELECT id FROM programs WHERE university_id=${universityId} AND lower(program_name)=lower(${record.name}) AND lower(degree_level)=lower(${record.degree}) AND lower(language)=lower(${record.language}) LIMIT 1`;
  let id=rows[0]?.id;
  if(id)await db`UPDATE programs SET english_taught=${record.language==='English'},duration_years=${record.duration},tuition_fee=${record.tuition},tuition_currency='RMB',official_program_url=${record.url},is_active=true,updated_at=now() WHERE id=${id}`;
  else{const r=await db`INSERT INTO programs (university_id,program_name,degree_level,language,english_taught,duration_years,tuition_fee,tuition_currency,official_program_url,is_active) VALUES (${universityId},${record.name},${record.degree},${record.language},${record.language==='English'},${record.duration},${record.tuition},'RMB',${record.url},true) RETURNING id`;id=r[0].id;}
  if(record.year){const start=`${record.year}-09-01`;const status=record.deadline&&new Date(record.deadline)<new Date()?'closed':'upcoming';const existing=await db`SELECT id FROM intakes WHERE program_id=${id} AND semester_start_date=${start} LIMIT 1`;if(existing[0])await db`UPDATE intakes SET application_deadline=${record.deadline},application_status=${status},updated_at=now() WHERE id=${existing[0].id}`;else await db`INSERT INTO intakes (program_id,intake_name,application_deadline,semester_start_date,application_status,notes) VALUES (${id},'September',${record.deadline},${start},${status},'Discovered from the official university website; verify against the current admission notice.')`;}
  const source=await db`SELECT id FROM sources WHERE program_id=${id} AND source_url=${record.url} LIMIT 1`;if(source[0])await db`UPDATE sources SET last_checked_at=now(),verification_status='verified',notes='Program discovered on the official university website.' WHERE id=${source[0].id}`;else await db`INSERT INTO sources (program_id,source_name,source_url,source_type,is_official,last_checked_at,verification_status,notes) VALUES (${id},${universityName},${record.url},'official',true,now(),'verified','Program discovered on the official university website.')`;return true;
}

const universities=await db`SELECT id,name_english,official_website FROM universities WHERE country='China' AND status='active' AND official_website IS NOT NULL AND trim(official_website)<>'' ORDER BY id`;
console.log(`[OFFICIAL-ALL] ${universities.length} universities queued; no fixed university-count limit.`);
let total=0;
for(const u of universities){
 const queue=[[u.official_website,'']];const seen=new Set();const candidates=new Map();let pages=0;
 while(queue.length&&pages<MAX_PAGES_PER_UNIVERSITY){const [url,anchor]=queue.shift();if(seen.has(url))continue;seen.add(url);try{const p=await fetchText(url);pages++;const text=clean(p.html);const name=title(p.html,p.url);if(isRealProgramPage(p.url,anchor,name,text))candidates.set(p.url,{text,degree:degree(text,p.url),name});for(const [link,a] of links(p.html,p.url)){const path=new URL(link).pathname;if(sameSite(link,u.official_website)&&!seen.has(link)&&(!ADMIN_PATH.test(path)||PROGRAM_PATH.test(path)||PROGRAM_PATH.test(a)))queue.push([link,a]);}await sleep(100);}catch(e){console.warn(`[OFFICIAL-ALL] ${u.name_english}: ${url} :: ${e.message}`);}}
 let imported=0;for(const [url,c] of candidates){const record={name:c.name,degree:c.degree,language:language(c.text),duration:duration(c.text),tuition:tuition(c.text),year:year(c.text),deadline:deadline(c.text),url};try{if(await upsert(u.id,u.name_english,record))imported++;}catch(e){console.warn(`[OFFICIAL-ALL] ${u.name_english}: import failed ${record.name} :: ${e.message}`);}}
 total+=imported;console.log(`[OFFICIAL-ALL] ${u.name_english}: ${pages} pages, ${candidates.size} verified candidates, ${imported} imported/updated`);
}
console.log(`[OFFICIAL-ALL] complete: ${universities.length} universities scanned; ${total} program records imported/updated.`);
