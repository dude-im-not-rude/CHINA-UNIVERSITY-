import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required.');

const ROOT = process.env.GSC_UNIVERSITIES_URL || 'https://globalstudyconsult.com/universities';
const MAX_PROFILES = Number(process.env.GSC_MAX_PROFILES || 2500);
const UA = 'ChinaUniTracker-GSCSeed/1.0';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return { url: res.url, html: await res.text() };
}
function text(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
}
function links(html, base) {
  const out = new Set(); let m;
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  while ((m=re.exec(html))) { try { const u=new URL(m[1],base); if (u.hostname.endsWith('globalstudyconsult.com')) out.add(u.href); } catch {} }
  return [...out];
}
function first(s, rs) { for (const r of rs) { const m=s.match(r); if(m?.[1]) return m[1].trim(); } return null; }
function money(s) { const m=s?.replace(/,/g,'').match(/(?:USD|US\$|CNY|RMB|¥|\$)\s*([0-9]+(?:\.[0-9]+)?)/i); return m?Number(m[1]):null; }
function degree(s) { const x=s.toLowerCase(); if(/\bbachelor|undergraduate\b/.test(x))return'bachelor'; if(/\bmaster|postgraduate\b/.test(x))return'master'; if(/\bphd|doctor/.test(x))return'phd'; return'other'; }
function cleanName(s) { return s?.replace(/\s+/g,' ').replace(/^(view profile|apply now)\s*/i,'').trim(); }

async function upsertUniversity(p) {
  const rows=await db`SELECT id FROM universities WHERE lower(name_english)=lower(${p.name}) LIMIT 1`;
  let id=rows[0]?.id;
  if(id) {
    await db`UPDATE universities SET official_website=COALESCE(${p.officialWebsite},official_website), admissions_website=COALESCE(${p.applicationUrl},admissions_website), city=COALESCE(${p.city},city), province=COALESCE(${p.province},province), founded_year=COALESCE(${p.foundedYear},founded_year), university_description=COALESCE(${p.overview},university_description), updated_at=now() WHERE id=${id}`;
  } else {
    const r=await db`INSERT INTO universities (name_english,university_type,country,status,official_website,admissions_website,city,province,founded_year,university_description) VALUES (${p.name},'other','China','active',${p.officialWebsite},${p.applicationUrl},${p.city},${p.province},${p.foundedYear},${p.overview}) RETURNING id`;
    id=r[0].id;
  }
  return id;
}

async function upsertProgram(uid,p,sourceUrl) {
  const rows=await db`SELECT id FROM programs WHERE university_id=${uid} AND lower(program_name)=lower(${p.name}) AND lower(degree_level)=lower(${p.degree}) AND lower(language)=lower(${p.language||'Other'}) LIMIT 1`;
  let id=rows[0]?.id;
  if(id) await db`UPDATE programs SET english_taught=${/english/i.test(p.language||'')}, duration_years=COALESCE(${p.duration},duration_years), tuition_fee=COALESCE(${p.tuition},tuition_fee), tuition_currency=COALESCE(${p.currency},tuition_currency), official_program_url=COALESCE(${p.url},official_program_url), field_of_study=COALESCE(${p.field},field_of_study), is_active=true, updated_at=now() WHERE id=${id}`;
  else { const r=await db`INSERT INTO programs (university_id,program_name,degree_level,language,english_taught,duration_years,tuition_fee,tuition_currency,official_program_url,field_of_study,is_active) VALUES (${uid},${p.name},${p.degree},${p.language||'Other'},${/english/i.test(p.language||'')},${p.duration},${p.tuition},${p.currency},${p.url||sourceUrl},${p.field},true) RETURNING id`; id=r[0].id; }
  const src=await db`SELECT id FROM sources WHERE program_id=${id} AND source_url=${sourceUrl} LIMIT 1`;
  if(!src[0]) await db`INSERT INTO sources (program_id,source_name,source_url,source_type,is_official,last_checked_at,verification_status,notes) VALUES (${id},'Global Study Consult',${sourceUrl},'trusted_reference',false,now(),'trusted','Trusted seed supplied by project owner; targeted verification only when ambiguity/conflict is detected.')`;
}

async function parseProfile(url) {
  const {html}=await get(url); const t=text(html);
  const name=cleanName(first(t,[/(?:University|Institute|College)[^|]{0,90}/i])) || cleanName(first(t,[/^([^|]{3,100})\s+(?:Comprehensive|Founded|Established)/i]));
  if(!name || name.length<3) return null;
  const officialWebsite=first(t,[/Official Website\s*:?[ ]*(https?:\/\/[^\s|]+)/i]);
  const applicationUrl=first(t,[/Apply Now\s*:?[ ]*(https?:\/\/[^\s|]+)/i,/Application[^:]*:\s*(https?:\/\/[^\s|]+)/i]);
  const foundedYear=Number(first(t,[/(?:Founded|Established)\s*(?:in)?\s*(19\d{2}|20\d{2})/i]))||null;
  const city=first(t,[/City\s*[:|-]\s*([A-Z][A-Za-z .'-]{2,50})/i]);
  const province=first(t,[/Province\s*[:|-]\s*([A-Z][A-Za-z .'-]{2,50})/i]);
  const overview=first(t,[/(?:About|Overview)\s+([^]{80,700}?)(?:Academic Strength|Programs|Admission Requirements|Scholarship)/i]);
  const programLinks=links(html,url).filter(x=>/program|major|course|degree/i.test(x)).slice(0,250);
  const programs=[];
  for(const purl of programLinks){
    try { const p=await get(purl); const pt=text(p.html); const pn=cleanName(first(pt,[/(?:Program|Major|Course)\s*[:|-]\s*([^|]{3,140})/i,/^([^|]{3,120})\s+(?:Bachelor|Master|PhD)/i])); if(!pn)continue; programs.push({name:pn,degree:degree(pt),language:first(pt,[/Language\s*[:|-]\s*([^|]{2,40})/i,/Teaching Language\s*[:|-]\s*([^|]{2,40})/i])||'Other',duration:Number(first(pt,[/Duration\s*[:|-]\s*([0-9]+(?:\.[0-9]+)?)\s*(?:years?|yr)/i]))||null,tuition:money(first(pt,[/Tuition[^:]*:\s*([^|]+)/i,/Fee[^:]*:\s*([^|]+)/i])),currency:/USD|US\$/i.test(pt)?'USD':/RMB|CNY|¥/i.test(pt)?'RMB':null,url:purl,field:first(pt,[/Field\s*(?:of Study)?\s*[:|-]\s*([^|]{2,80})/i])}); } catch(e){ console.warn('[GSC] program failed',purl,e.message); }
    await sleep(80);
  }
  return {name,officialWebsite,applicationUrl,foundedYear,city,province,overview,programs};
}

async function main(){
  const root=await get(ROOT); const candidates=links(root.html,root.url).filter(u=>/\/universit|\/university|\/profile/i.test(u)&&u!==root.url);
  const unique=[...new Set(candidates)].slice(0,MAX_PROFILES);
  console.log(`[GSC] ${unique.length} university profile candidates`);
  let imported=0, programs=0;
  for(const url of unique){
    try { const p=await parseProfile(url); if(!p)continue; const uid=await upsertUniversity(p); for(const prog of p.programs){ await upsertProgram(uid,prog,url); programs++; } imported++; console.log(`[GSC] ${p.name}: ${p.programs.length} programs`); }
    catch(e){ console.error(`[GSC] ${url}: ${e.message}`); }
    await sleep(150);
  }
  console.log(`[GSC] complete: ${imported} universities, ${programs} programs`);
}
main().catch(e=>{console.error(e);process.exit(1)});
