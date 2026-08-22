import { neon } from '@neondatabase/serverless';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required.');

const exec = promisify(execFile);
const UA = 'ChinaUniTracker-ProgramImporter/5.0';
const TIMEOUT = 15000;
const MAX_RETRIES = 2;
const MAX_PAGES = 90;
const MAX_DOC_PAGES = 35;
const MAX_DOCS = 25;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MEDIA = /\.(?:mp4|webm|mov|avi|mkv|mp3|wav|ogg|png|jpe?g|gif|svg|webp|ico|zip|rar|7z|pdf|docx?|xlsx?|pptx?)$/i;
const JUNK = /(?:\/wp-content\/|\/uploads?\/|\/assets?\/|\/images?\/|\/img\/|\/media\/|\/video\/|\/audio\/|\/fonts?\/|\/login(?:\/|$)|\/search(?:\/|$))/i;
const BAD = /^(home|homepage|news|notice|notices|faculty|faculties|staff|people|department|departments|school|schools|college|colleges|contact|contact us|about|about us|academic calendar|calendar|scholarship|scholarships|admissions?|application|requirements?|procedures?|documents?|fees?|tuition|accommodation|overview|degree programs?|graduate programs?|undergraduate programs?|academics?|students?|student services?|student experience|more projects?|non-degree programs?)$/i;
const DEG = /(?:bachelor|undergraduate|master|graduate|mba|msc|phd|doctoral|doctorate)/i;
const PROGRAM_SIGNAL = /(?:program|programme|major|degree|bachelor|undergraduate|master|mba|msc|phd|doctoral|course list|curriculum|study plan|field of study)/i;
const DOC_HINT = /(?:program|programme|curriculum|tuition|fee|fees|requirement|admission|application|international|undergraduate|bachelor|master|mba|phd|doctoral|prospectus|catalog|catalogue|brochure|handbook|guide|2026|2027)/i;
const DRIVE_HOST = /(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/i;

function clean(s) {
  return s.replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"').replace(/&#39;/g,"'")
    .replace(/\s+/g,' ').trim();
}
function same(a,b){try{const x=new URL(a),r=new URL(b);return x.hostname===r.hostname||x.hostname.endsWith(`.${r.hostname}`);}catch{return false;}}
function links(html,base,includeDocs=false){
  const out=[]; const re=/(?:href|src|data-src|data-url)\s*=\s*["']([^"']+)["']/gi; let m;
  while((m=re.exec(html))){
    try{
      const u=new URL(m[1],base); if(!/^https?:$/i.test(u.protocol)) continue;
      if(MEDIA.test(u.pathname)){ if(includeDocs && /\.(pdf|docx?|xlsx?|pptx?)$/i.test(u.pathname)) out.push(u.href); continue; }
      const hint=DOC_HINT.test(`${u.href} ${m[1]}`);
      if(includeDocs && (DRIVE_HOST.test(u.hostname)||hint)) out.push(u.href);
      else if(!includeDocs && !JUNK.test(u.pathname)) out.push(u.href);
    }catch{}
  }
  return [...new Set(out)];
}
function title(html,url){
  return clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    new URL(url).pathname.split('/').filter(Boolean).pop() || 'Program')
    .replace(/\s*[|–—-]\s*(official.*|home.*)$/i,'').trim().slice(0,180);
}
function typeOf(text,url,name){
  const h=`${name} ${url} ${text.slice(0,9000)}`;
  if(!PROGRAM_SIGNAL.test(`${name} ${url}`)||!DEG.test(h)) return null;
  if(/summer school|summer camp|winter school|language program|chinese language|exchange program|visiting student|study abroad|professional training|certificate|foundation|preparatory|non-degree/i.test(h)) return null;
  if(/phd|doctoral|doctorate/i.test(h)) return 'phd';
  if(/master|graduate|mba|msc/i.test(h)) return 'master';
  if(/bachelor|undergraduate|bba|bsc/i.test(h)) return 'bachelor';
  return null;
}
function language(text){if(/bilingual|english and chinese|chinese and english/i.test(text))return'Bilingual';if(/english[- ]taught|taught in english|language of instruction[^.]{0,50}english/i.test(text))return'English';if(/chinese[- ]taught|taught in chinese|language of instruction[^.]{0,50}chinese/i.test(text))return'Chinese';return'Other';}
function durationValue(text){const m=text.match(/(?:duration|study period|program length)[^\d]{0,35}(\d+(?:\.\d+)?)\s*(years?|months?|weeks?)/i);if(!m)return null;const n=Number(m[1]);return/month/i.test(m[2])?n/12:/week/i.test(m[2])?n/52:n;}
function tuitionValue(text){
  const patterns=[
    /(?:tuition(?: fee)?|program fee|annual fee|school fee)[^\d]{0,55}(?:rmb|cny|yuan|¥)?\s*([\d,]+(?:\.\d+)?)/i,
    /(?:rmb|cny|yuan|¥)\s*([\d,]+(?:\.\d+)?)/i
  ];
  for(const p of patterns){const m=text.match(p);if(m)return Number(m[1].replace(/,/g,''));}
  return null;
}
function requirementValue(text){
  const m=text.match(/(?:admission requirements?|entry requirements?|application requirements?|eligibility|applicants must|required documents?)[\s:：-]*([\s\S]{0,5000}?)(?=\n\s*(?:tuition|fees?|application procedure|how to apply|curriculum|program structure|contact|scholarship|accommodation)\b|$)/i);
  return m?.[1]?.replace(/\s+/g,' ').trim().slice(0,3500)||null;
}
async function fetchRaw(url){
  let last;
  for(let i=1;i<=MAX_RETRIES;i++){
    const c=new AbortController(),t=setTimeout(()=>c.abort(),TIMEOUT);
    try{
      const r=await fetch(url,{redirect:'follow',signal:c.signal,headers:{'user-agent':UA,accept:'text/html,application/xhtml+xml,application/pdf,application/octet-stream','accept-language':'en-US,en;q=0.8'}});
      if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);
      return {url:r.url,type:r.headers.get('content-type')||'',buffer:Buffer.from(await r.arrayBuffer())};
    }catch(e){last=e;if(i<MAX_RETRIES)await sleep(i*700);}finally{clearTimeout(t);}
  }
  throw last;
}
async function fetchPage(url){const r=await fetchRaw(url);if(!/html/i.test(r.type))throw new Error(`not HTML: ${r.type}`);return{url:r.url,html:r.buffer.toString('utf8')};}
async function pdfText(url,buffer){
  const file=join(tmpdir(),`chinauni-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  try{await writeFile(file,buffer);const {stdout}=await exec('pdftotext',['-layout',file,'-'],{timeout:30000,maxBuffer:12*1024*1024});return stdout.slice(0,120000);}
  finally{await unlink(file).catch(()=>{});}
}
function driveDownload(url){
  try{const u=new URL(url),m=u.pathname.match(/\/(?:file|document)\/d\/([^/]+)/),id=m?.[1]||u.searchParams.get('id');return id?`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`:url;}
  catch{return url;}
}

const universities=await db`SELECT id,name_english,official_website FROM universities WHERE country='China' AND status='active' AND official_website IS NOT NULL AND trim(official_website)<>'' ORDER BY id`;
let total=0,docs=0,docEnriched=0;

for(const u of universities){
  const q=[[u.official_website,'']],seen=new Set(),candidates=new Map(),docUrls=new Set();let pages=0,docPages=0;
  while(q.length&&pages<MAX_PAGES){
    const [url]=q.shift();if(seen.has(url))continue;seen.add(url);
    try{
      const p=await fetchPage(url);pages++;
      const text=clean(p.html),name=title(p.html,p.url),kind=typeOf(text,p.url,name);
      if(kind&&!BAD.test(name))candidates.set(p.url,{name,kind,text});
      for(const l of links(p.html,p.url,false)){if(same(l,u.official_website)&&!seen.has(l)&&PROGRAM_SIGNAL.test(l))q.push([l,'']);}
      if(docPages<MAX_DOC_PAGES){
        for(const d of links(p.html,p.url,true)){
          try{const du=new URL(d);if(DRIVE_HOST.test(du.hostname)||/\.(pdf|docx?|xlsx?|pptx?)($|[?#])/i.test(du.href))docUrls.add(d);else if(same(d,u.official_website)&&DOC_HINT.test(d))q.push([d,'']);}catch{}
        }
        docPages++;
      }
    }catch(e){console.warn(`[PROGRAMS] ${u.name_english}: ${url} :: ${e.message}`);}
    await sleep(80);
  }

  let imported=0;
  for(const [url,c] of candidates){
    const degree=c.kind,lang=language(c.text),durationYears=durationValue(c.text),tuitionFee=tuitionValue(c.text);
    const rows=await db`SELECT id FROM programs WHERE university_id=${u.id} AND lower(program_name)=lower(${c.name}) AND degree_level=${degree} AND lower(coalesce(language,''))=lower(${lang}) LIMIT 1`;
    let id=rows[0]?.id;
    if(id)await db`UPDATE programs SET english_taught=${lang==='English'},duration_years=COALESCE(${durationYears},duration_years),tuition_fee=COALESCE(${tuitionFee},tuition_fee),official_program_url=${url},is_active=true,updated_at=now() WHERE id=${id}`;
    else{const r=await db`INSERT INTO programs (university_id,program_name,degree_level,language,english_taught,duration_years,tuition_fee,tuition_currency,program_description,official_program_url,is_active) VALUES (${u.id},${c.name},${degree},${lang},${lang==='English'},${durationYears},${tuitionFee},'CNY',${`Verified category: ${c.kind}. Discovered on the official university website; verify current intake details.`},${url},true) RETURNING id`;id=r[0].id;}
    await db`INSERT INTO sources (program_id,source_name,source_url,source_type,is_official,last_checked_at,verification_status,notes) SELECT ${id},${u.name_english},${url},'official',true,now(),'verified','Official university program source.' WHERE NOT EXISTS (SELECT 1 FROM sources WHERE program_id=${id} AND source_url=${url})`;
    imported++;
  }
  total+=imported;

  const programs=await db`SELECT id,program_name,degree_level,language,tuition_fee,duration_years,program_description FROM programs WHERE university_id=${u.id} AND is_active=true`;
  for(const rawUrl of [...docUrls].slice(0,MAX_DOCS)){
    const docUrl=driveDownload(rawUrl);
    try{
      const p=await fetchRaw(docUrl);
      if(!/pdf/i.test(p.type)&&!/\.(pdf)($|[?#])/i.test(p.url))continue;
      const text=await pdfText(p.url,p.buffer);if(text.length<80)continue;docs++;
      const fee=tuitionValue(text),req=requirementValue(text),dur=durationValue(text);
      for(const program of programs){
        const pn=String(program.program_name||'').trim();if(pn.length<5)continue;
        const hay=text.toLowerCase().replace(/[^a-z0-9]+/g,' '),normalized=pn.toLowerCase().replace(/[^a-z0-9]+/g,' ');
        if(!hay.includes(normalized))continue;
        const additions=[req?`Admission requirements (official document): ${req}`:'',`Official document source: ${p.url}`].filter(Boolean).join('\n\n');
        const description=[program.program_description||'',additions].filter(Boolean).join('\n\n').slice(0,8000);
        await db`UPDATE programs SET tuition_fee=COALESCE(${fee},tuition_fee),duration_years=COALESCE(${dur},duration_years),program_description=${description},updated_at=now() WHERE id=${program.id}`;
        await db`INSERT INTO sources (program_id,source_name,source_url,source_type,is_official,last_checked_at,verification_status,notes) SELECT ${program.id},${u.name_english},${p.url},'official_document',true,now(),'verified','Extracted from an official university PDF/document or embedded viewer.' WHERE NOT EXISTS (SELECT 1 FROM sources WHERE program_id=${program.id} AND source_url=${p.url})`;
        docEnriched++;
      }
      console.log(`[DOCS] ${u.name_english}: ${p.url} :: tuition=${fee??'n/a'} requirements=${req?'yes':'no'}`);
    }catch(e){console.warn(`[DOCS] ${u.name_english}: ${docUrl} :: ${e.message}`);}
  }
  console.log(`[PROGRAMS] ${u.name_english}: ${pages} pages, ${candidates.size} web candidates, ${imported} imported/updated, ${docUrls.size} document candidates`);
}
console.log(`[PROGRAMS] complete: ${universities.length} universities scanned; ${total} web program records imported/updated; ${docs} PDFs extracted; ${docEnriched} program records enriched from official documents.`);
