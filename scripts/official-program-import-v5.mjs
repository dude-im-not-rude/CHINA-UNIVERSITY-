import { neon } from '@neondatabase/serverless';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required.');
const exec = promisify(execFile);
const UA = 'ChinaUniTracker-ProgramImporter/6.0';
const TIMEOUT = 18000;
const MAX_RETRIES = 3;
const MAX_PAGES = Number(process.env.OFFICIAL_MAX_PAGES || 120);
const MAX_DOCS = Number(process.env.OFFICIAL_MAX_DOCS || 40);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MEDIA = /\.(?:mp4|webm|mov|avi|mkv|mp3|wav|ogg|png|jpe?g|gif|svg|webp|ico|zip|rar|7z|docx?|xlsx?|pptx?)$/i;
const DOC = /\.(?:pdf|docx?|xlsx?|pptx?)($|[?#])/i;
const BAD_PATH = /\/(?:login|logout|search|wp-content|uploads?|assets?|images?|img|media|video|audio|fonts?)(?:\/|$)/i;
const PROGRAM_PATH = /(?:program|programme|major|degree|course|curriculum|bachelor|undergraduate|master|graduate|mba|msc|phd|doctoral|non[- ]degree|language|summer|winter|exchange|visiting|training|certificate|foundation|preparatory|admission|application|tuition|fee|requirement|international)/i;
const DOC_HINT = /(?:program|programme|curriculum|tuition|fee|fees|requirement|admission|application|international|undergraduate|bachelor|master|mba|phd|doctoral|prospectus|catalog|catalogue|brochure|handbook|guide|2026|2027|summer|language|exchange|visiting|training)/i;
const DRIVE_HOST = /(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/i;
const BAD_NAME = /^(home|homepage|news|notice|notices|faculty|faculties|staff|people|department|departments|school|schools|college|colleges|contact|contact us|about|about us|academic calendar|calendar|scholarship|scholarships|admissions?|application|requirements?|procedures?|documents?|fees?|tuition|accommodation|overview|degree programs?|graduate programs?|undergraduate programs?|academics?|students?|student services?|student experience|more projects?)$/i;

function clean(s) {
  return String(s || '').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/&#x27;/gi,"'").replace(/\s+/g,' ').trim();
}
function sameSite(a, root) { try { const x=new URL(a), r=new URL(root); return x.hostname===r.hostname || x.hostname.endsWith(`.${r.hostname}`); } catch { return false; } }
function absolute(raw, base) { try { const u=new URL(raw, base); return /^https?:$/i.test(u.protocol) ? u.href : null; } catch { return null; } }
function extractRefs(html, base) {
  const out=[]; const re=/(?:href|src|data-src|data-url|data-href|poster)\s*=\s*["']([^"']+)["']/gi; let m;
  while((m=re.exec(html))) { const u=absolute(m[1],base); if(u) out.push(u); }
  return [...new Set(out)];
}
function anchorLinks(html, base) {
  const out=[]; const re=/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while((m=re.exec(html))) { const u=absolute(m[1],base); if(u) out.push({url:u,text:clean(m[2]).slice(0,240)}); }
  return out;
}
function title(html,url) { return clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || new URL(url).pathname.split('/').filter(Boolean).pop() || 'Program').replace(/\s*[|–—-]\s*(official.*|home.*)$/i,'').trim().slice(0,180); }
function classify(text,url,name) {
  const h=`${name} ${url} ${text.slice(0,14000)}`;
  if(!PROGRAM_PATH.test(`${url} ${name}`)) return null;
  if(BAD_NAME.test(name)) return null;
  if(/summer school|summer camp|winter school|language program|chinese language|exchange program|visiting student|study abroad|professional training|certificate|foundation|preparatory|non-degree|short[- ]term|continuing education/i.test(h)) return 'other';
  if(/phd|doctoral|doctorate/i.test(h)) return 'phd';
  if(/master|graduate|mba|msc/i.test(h)) return 'master';
  if(/bachelor|undergraduate|bba|bsc/i.test(h)) return 'bachelor';
  return null;
}
function nonDegreeType(text,url,name) {
  const h=`${name} ${url} ${text.slice(0,12000)}`.toLowerCase();
  if(/professional training|vocational|professional development/.test(h)) return 'professional_training';
  if(/summer school|summer camp|summer program/.test(h)) return 'summer_camp';
  if(/winter school|winter camp|winter program/.test(h)) return 'winter_camp';
  if(/language program|chinese language|mandarin|language course/.test(h)) return 'language';
  if(/exchange program|student exchange/.test(h)) return 'exchange';
  if(/visiting student|visiting scholar|visiting program/.test(h)) return 'visiting';
  if(/foundation|preparatory/.test(h)) return 'foundation';
  if(/certificate|certification/.test(h)) return 'certificate';
  if(/short[- ]term|two[- ]week|six[- ]month|one[- ]semester/.test(h)) return 'short_term';
  return 'other';
}
function language(text) { if(/bilingual|english and chinese|chinese and english/i.test(text)) return 'Bilingual'; if(/english[- ]taught|taught in english|language of instruction[^.]{0,80}english/i.test(text)) return 'English'; if(/chinese[- ]taught|taught in chinese|language of instruction[^.]{0,80}chinese/i.test(text)) return 'Chinese'; return 'Other'; }
function durationValue(text) { const m=text.match(/(?:duration|study period|program length|length of study)[^\d]{0,45}(\d+(?:\.\d+)?)\s*(years?|months?|weeks?)/i); if(!m)return null; const n=Number(m[1]); return /month/i.test(m[2])?n/12:/week/i.test(m[2])?n/52:n; }
function tuitionValue(text) {
  const patterns=[
    /(?:tuition(?: fee)?|program fee|annual fee|school fee|education fee)[^\d]{0,90}(?:rmb|cny|yuan|¥|￥)?\s*([\d,]+(?:\.\d+)?)/i,
    /(?:rmb|cny|yuan|¥|￥)\s*([\d,]+(?:\.\d+)?)/i
  ];
  for(const p of patterns){const m=text.match(p);if(m)return Number(m[1].replace(/,/g,''));}
  return null;
}
function applicationUrl(candidates) { return candidates.find(x=>/apply|application|admission|enrol|portal|online[-_ ]?apply/i.test(x)) || null; }
function requirementBlock(text) { const m=text.match(/(?:admission requirements?|entry requirements?|application requirements?|eligibility|required documents?)[\s:：-]*([\s\S]{0,7000}?)(?=\n\s*(?:tuition|fees?|application procedure|how to apply|curriculum|program structure|contact|scholarship|accommodation)\b|$)/i); return m?.[1]?.replace(/\s+/g,' ').trim().slice(0,4500)||null; }
async function fetchRaw(url) {
  let last;
  for(let i=1;i<=MAX_RETRIES;i++){
    const c=new AbortController(),t=setTimeout(()=>c.abort(),TIMEOUT);
    try{const r=await fetch(url,{redirect:'follow',signal:c.signal,headers:{'user-agent':UA,accept:'text/html,application/xhtml+xml,application/pdf,application/octet-stream','accept-language':'en-US,en;q=0.8','cache-control':'no-cache'}});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return{url:r.url,type:r.headers.get('content-type')||'',buffer:Buffer.from(await r.arrayBuffer())};}
    catch(e){last=e;if(i<MAX_RETRIES)await sleep(i*800);}finally{clearTimeout(t);}
  }
  throw last;
}
async function pdfText(url,buffer){const file=join(tmpdir(),`chinauni-v5-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);try{await writeFile(file,buffer);const{stdout}=await exec('pdftotext',['-layout',file,'-'],{timeout:45000,maxBuffer:18*1024*1024});return stdout.slice(0,180000);}finally{await unlink(file).catch(()=>{});}}
function driveDownload(url){try{const u=new URL(url);const m=u.pathname.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([^/]+)/);const id=m?.[1]||u.searchParams.get('id');return id?`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`:url;}catch{return url;}}
function documentCandidates(html,base){
  return extractRefs(html,base).filter(u=>DOC.test(u)||DRIVE_HOST.test(new URL(u).hostname)||DOC_HINT.test(u)).filter(u=>!MEDIA.test(u)||DOC.test(u));
}

const universities=await db`SELECT id,name_english,official_website FROM universities WHERE country='China' AND status='active' AND official_website IS NOT NULL AND trim(official_website)<>'' ORDER BY name_english`;
let total=0,docs=0,docEnriched=0;
for(const u of universities){
  const root=u.official_website; const queue=[[root,0]]; const seen=new Set(); const candidates=new Map(); const docUrls=new Set(); let pages=0;
  while(queue.length&&pages<MAX_PAGES){
    queue.sort((a,b)=>a[1]-b[1]); const [url,priority]=queue.shift(); if(seen.has(url))continue; seen.add(url);
    try{
      const r=await fetchRaw(url); if(!/html/i.test(r.type))continue; const html=r.buffer.toString('utf8'); pages++;
      const text=clean(html), name=title(html,r.url), kind=classify(text,r.url,name);
      const refs=extractRefs(html,r.url); for(const d of documentCandidates(html,r.url)) docUrls.add(d);
      if(kind){
        const anchors=anchorLinks(html,r.url); const app=applicationUrl(anchors.map(a=>a.url)); const req=requirementBlock(text); const type=kind==='other'?nonDegreeType(text,r.url,name):kind;
        candidates.set(r.url,{name,kind,type,text,lang:language(text),duration:durationValue(text),tuition:tuitionValue(text),requirements:req,applicationUrl:app});
      }
      for(const a of anchorLinks(html,r.url)){
        if(!sameSite(a.url,root)||seen.has(a.url))continue;
        if(BAD_PATH.test(new URL(a.url).pathname))continue;
        const signal=`${a.url} ${a.text}`;
        if(DOC.test(a.url)||DOC_HINT.test(signal))docUrls.add(a.url);
        if(PROGRAM_PATH.test(signal)) queue.push([a.url, /program|course|bachelor|master|non-degree|language|training|summer|exchange|visiting/i.test(signal)?0:1]);
      }
      // Embedded PDF viewers often expose the document only through iframe/object/embed/data attributes.
      for(const ref of refs){if(!sameSite(ref,root)&&!DRIVE_HOST.test(new URL(ref).hostname))continue;if(DOC.test(ref)||DOC_HINT.test(ref))docUrls.add(ref);}
    }catch(e){console.warn(`[PROGRAMS] ${u.name_english}: ${url} :: ${e.message}`);}
    await sleep(90);
  }

  for(const c of candidates.values()){
    const degree=c.kind==='other'?'other':c.kind; const field=c.kind==='other'?c.type:null;
    const rows=await db`SELECT id FROM programs WHERE university_id=${u.id} AND lower(program_name)=lower(${c.name}) AND degree_level=${degree} LIMIT 1`;
    let id=rows[0]?.id;
    const description=[
      `Official program type: ${c.type}`,
      c.requirements?`Admission requirements (official page): ${c.requirements}`:'',
      'Verified from an official university website.'
    ].filter(Boolean).join('\n\n').slice(0,8000);
    if(id){await db`UPDATE programs SET field_of_study=COALESCE(${field},field_of_study),language=${c.lang},english_taught=${c.lang==='English'},duration_years=COALESCE(${c.duration},duration_years),tuition_fee=COALESCE(${c.tuition},tuition_fee),application_url=COALESCE(${c.applicationUrl},application_url),program_description=COALESCE(NULLIF(${description},''),program_description),official_program_url=${c.url},is_active=true,updated_at=now() WHERE id=${id}`;}
    else{const r=await db`INSERT INTO programs (university_id,program_name,degree_level,field_of_study,language,english_taught,duration_years,tuition_fee,tuition_currency,program_description,official_program_url,application_url,is_active) VALUES (${u.id},${c.name},${degree},${field},${c.lang},${c.lang==='English'},${c.duration},${c.tuition},'CNY',${description},${c.url},${c.applicationUrl},true) RETURNING id`;id=r[0].id;}
    await db`INSERT INTO sources (program_id,source_name,source_url,source_type,is_official,last_checked_at,verification_status,notes) SELECT ${id},${u.name_english},${c.url},'official',true,now(),'verified','Official university program/admission page.' WHERE NOT EXISTS (SELECT 1 FROM sources WHERE program_id=${id} AND source_url=${c.url})`;
    if(c.requirements){const ex=await db`SELECT id FROM admission_requirements WHERE program_id=${id} LIMIT 1`;if(ex[0])await db`UPDATE admission_requirements SET academic_requirements=COALESCE(${c.requirements},academic_requirements),updated_at=now() WHERE id=${ex[0].id}`;else await db`INSERT INTO admission_requirements (program_id,academic_requirements,additional_requirements) VALUES (${id},${c.requirements},${'Official page source: '+c.url})`;}
    total++;
  }

  const programs=await db`SELECT id,program_name,program_description FROM programs WHERE university_id=${u.id} AND is_active=true`;
  for(const raw of [...docUrls].slice(0,MAX_DOCS)){
    const url=driveDownload(raw); try{const p=await fetchRaw(url);if(!/pdf/i.test(p.type)&&!DOC.test(p.url))continue;const text=await pdfText(p.url,p.buffer);if(text.length<100)continue;docs++;
      const fee=tuitionValue(text),req=requirementBlock(text),dur=durationValue(text);
      let matched=0;
      for(const program of programs){const needle=String(program.program_name||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(needle.length<5)continue;const hay=text.toLowerCase().replace(/[^a-z0-9]+/g,' ');if(!hay.includes(needle))continue;matched++;const desc=[program.program_description||'',req?`Admission requirements (official PDF): ${req}`:'',`Official PDF source: ${p.url}`].filter(Boolean).join('\n\n').slice(0,8000);await db`UPDATE programs SET tuition_fee=COALESCE(${fee},tuition_fee),duration_years=COALESCE(${dur},duration_years),program_description=${desc},updated_at=now() WHERE id=${program.id}`;if(req){const ex=await db`SELECT id FROM admission_requirements WHERE program_id=${program.id} LIMIT 1`;if(ex[0])await db`UPDATE admission_requirements SET academic_requirements=COALESCE(${req},academic_requirements),additional_requirements=CONCAT_WS(E'\n\n',additional_requirements,'Official PDF source: '||${p.url}),updated_at=now() WHERE id=${ex[0].id}`;else await db`INSERT INTO admission_requirements (program_id,academic_requirements,additional_requirements) VALUES (${program.id},${req},${'Official PDF source: '+p.url})`;}}
      const title=`${u.name_english} — ${p.url.split('/').pop()||'Official PDF'}`.slice(0,220);const existing=await db`SELECT id FROM documents WHERE university_id=${u.id} AND original_source_url=${p.url} LIMIT 1`;if(existing[0])await db`UPDATE documents SET title=${title},description=${req||null},file_url=${p.url},file_size_bytes=${p.buffer.length},is_official=true,is_verified=true,verified_at=now(),updated_at=now() WHERE id=${existing[0].id}`;else await db`INSERT INTO documents (university_id,document_type,title,description,file_url,original_source_url,file_type,file_size_bytes,is_official,is_verified,verified_at) VALUES (${u.id},'official_document',${title},${req||null},${p.url},${p.url},'pdf',${p.buffer.length},true,true,now())`;docEnriched+=matched;
      await db`INSERT INTO sources (source_name,source_url,source_type,is_official,last_checked_at,verification_status,notes) SELECT ${u.name_english},${p.url},'official_document',true,now(),'verified','Official PDF extracted by the document pipeline.' WHERE NOT EXISTS (SELECT 1 FROM sources WHERE source_url=${p.url})`;
      console.log(`[DOCS] ${u.name_english}: ${p.url} :: fee=${fee??'n/a'} requirements=${req?'yes':'no'} matched=${matched}`);
    }catch(e){console.warn(`[DOCS] ${u.name_english}: ${url} :: ${e.message}`);}
  }
  console.log(`[PROGRAMS] ${u.name_english}: ${pages} pages, ${candidates.size} program candidates, ${docUrls.size} document candidates`);
}
console.log(`[PROGRAMS] complete: ${universities.length} universities scanned; ${total} program records inserted/updated; ${docs} PDFs extracted; ${docEnriched} program records enriched from official documents.`);
