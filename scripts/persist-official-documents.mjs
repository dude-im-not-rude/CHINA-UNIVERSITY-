import { neon } from '@neondatabase/serverless';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required.');
const exec = promisify(execFile);
const UA = 'ChinaUniTracker-OfficialDocuments/1.0';
const TIMEOUT = 20000;
const MAX_RETRIES = 2;
const MAX_PAGES = 60;
const MAX_DOCS = 20;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DRIVE_HOST = /(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/i;
const DOC_HINT = /(?:program|programme|curriculum|tuition|fee|fees|requirement|admission|application|international|undergraduate|bachelor|master|mba|phd|doctoral|prospectus|catalog|catalogue|brochure|handbook|guide|2026|2027)/i;

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
function links(html,base,docs=false){
  const out=[];const re=/(?:href|src|data-src|data-url)\s*=\s*["']([^"']+)["']/gi;let m;
  while((m=re.exec(html))){try{
    const u=new URL(m[1],base);if(!/^https?:$/i.test(u.protocol))continue;
    const href=u.href;
    if(/\.(pdf)($|[?#])/i.test(u.pathname))out.push(href);
    else if(docs&&(DRIVE_HOST.test(u.hostname)||DOC_HINT.test(`${href} ${m[1]}`)))out.push(href);
    else if(!docs&&!/\.(?:png|jpe?g|gif|svg|webp|ico|mp4|webm|mov|zip|rar|7z)$/i.test(u.pathname)&&!/(?:\/wp-content\/|\/uploads?\/|\/assets?\/|\/images?\/|\/img\/|\/media\/|\/fonts?\/)/i.test(u.pathname))out.push(href);
  }catch{}}
  return [...new Set(out)];
}
async function fetchRaw(url){
  let last;
  for(let i=1;i<=MAX_RETRIES;i++){
    const c=new AbortController(),t=setTimeout(()=>c.abort(),TIMEOUT);
    try{const r=await fetch(url,{redirect:'follow',signal:c.signal,headers:{'user-agent':UA,accept:'text/html,application/xhtml+xml,application/pdf,*/*','accept-language':'en-US,en;q=0.8'}});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return{url:r.url,type:r.headers.get('content-type')||'',buffer:Buffer.from(await r.arrayBuffer())};}
    catch(e){last=e;if(i<MAX_RETRIES)await sleep(i*700);}finally{clearTimeout(t);}
  }
  throw last;
}
async function fetchPage(url){const r=await fetchRaw(url);if(!/html/i.test(r.type))throw new Error(`not HTML: ${r.type}`);return{url:r.url,html:r.buffer.toString('utf8')};}
async function pdfText(url,buffer){const file=join(tmpdir(),`chinauni-doc-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);try{await writeFile(file,buffer);const{stdout}=await exec('pdftotext',['-layout',file,'-'],{timeout:30000,maxBuffer:16*1024*1024});return stdout.slice(0,160000);}finally{await unlink(file).catch(()=>{});}}
function driveDownload(url){try{const u=new URL(url),m=u.pathname.match(/\/(?:file|document)\/d\/([^/]+)/),id=m?.[1]||u.searchParams.get('id');return id?`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`:url;}catch{return url;}}
function docTitle(url,text){const first=text.split(/\n/).map(x=>x.trim()).find(x=>x.length>=8&&x.length<180);if(first)return first;try{return decodeURIComponent(new URL(url).pathname.split('/').pop()||'Official document');}catch{return'Official document';}}
function tuition(text){const m=text.match(/(?:tuition(?: fee)?|program fee|annual fee|school fee)[^\d]{0,60}(?:rmb|cny|yuan|¥)?\s*([\d,]+(?:\.\d+)?)/i);return m?Number(m[1].replace(/,/g,'')):null;}
function requirementBlock(text){const m=text.match(/(?:admission requirements?|entry requirements?|application requirements?|eligibility|required documents?)[\s:：-]*([\s\S]{0,5000}?)(?=\n\s*(?:tuition|fees?|application procedure|how to apply|curriculum|program structure|contact|scholarship|accommodation)\b|$)/i);return m?.[1]?.replace(/\s+/g,' ').trim().slice(0,3500)||null;}
function inferDocType(url,text){const h=`${url} ${text}`.toLowerCase();if(/scholarship|funding|financial aid/.test(h))return'scholarship';if(/tuition|fee schedule|fee/.test(h))return'tuition';if(/admission|application|requirement|eligibility/.test(h))return'admission';if(/curriculum|program|programme|catalog|catalogue|brochure|handbook/.test(h))return'program';return'official_document';}

const universities=await db`SELECT id,name_english,official_website FROM universities WHERE country='China' AND status='active' AND official_website IS NOT NULL AND trim(official_website)<>'' ORDER BY id`;
let scanned=0,stored=0,enriched=0;
for(const u of universities){
  const queue=[u.official_website],seen=new Set(),docUrls=new Set();let pages=0;
  while(queue.length&&pages<MAX_PAGES){const url=queue.shift();if(seen.has(url))continue;seen.add(url);try{const p=await fetchPage(url);pages++;for(const d of links(p.html,p.url,true))docUrls.add(d);for(const l of links(p.html,p.url,false)){if(same(l,u.official_website)&&!seen.has(l)&&DOC_HINT.test(l))queue.push(l);}}catch(e){console.warn(`[DOC-PERSIST] ${u.name_english}: ${url} :: ${e.message}`);}await sleep(60);}
  for(const rawUrl of [...docUrls].slice(0,MAX_DOCS)){
    const url=driveDownload(rawUrl);try{const p=await fetchRaw(url);if(!/pdf/i.test(p.type)&&!/\.pdf($|[?#])/i.test(p.url))continue;const text=await pdfText(p.url,p.buffer);if(text.length<80)continue;scanned++;
      const title=docTitle(p.url,text),type=inferDocType(p.url,text),fee=tuition(text),req=requirementBlock(text);
      const existing=await db`SELECT id FROM documents WHERE university_id=${u.id} AND original_source_url=${p.url} LIMIT 1`;
      if(existing[0])await db`UPDATE documents SET title=${title},description=${req||null},file_url=${p.url},original_source_url=${p.url},file_type='pdf',file_size_bytes=${p.buffer.length},is_official=true,is_verified=true,verified_at=now(),updated_at=now() WHERE id=${existing[0].id}`;
      else await db`INSERT INTO documents (university_id,document_type,title,description,file_url,original_source_url,file_type,file_size_bytes,is_official,is_verified,verified_at) VALUES (${u.id},${type},${title},${req||null},${p.url},${p.url},'pdf',${p.buffer.length},true,true,now())`;
      stored++;
      const programs=await db`SELECT id,program_name FROM programs WHERE university_id=${u.id} AND is_active=true`;
      for(const program of programs){const needle=String(program.program_name||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(needle.length<5)continue;const hay=text.toLowerCase().replace(/[^a-z0-9]+/g,' ');if(!hay.includes(needle))continue;
        const rows=await db`SELECT id FROM admission_requirements WHERE program_id=${program.id} LIMIT 1`;
        if(rows[0])await db`UPDATE admission_requirements SET academic_requirements=COALESCE(${req},academic_requirements),additional_requirements=CASE WHEN ${req} IS NOT NULL THEN CONCAT_WS(E'\n\n',additional_requirements,'Official PDF source: '||${p.url}) ELSE additional_requirements END,updated_at=now() WHERE id=${rows[0].id}`;
        else await db`INSERT INTO admission_requirements (program_id,academic_requirements,additional_requirements) VALUES (${program.id},${req},${'Official PDF source: '+p.url})`;
        if(fee!==null)await db`UPDATE programs SET tuition_fee=COALESCE(${fee},tuition_fee),updated_at=now() WHERE id=${program.id}`;
        enriched++;
      }
      console.log(`[DOC-PERSIST] ${u.name_english}: ${p.url} :: stored=${title}`);
    }catch(e){console.warn(`[DOC-PERSIST] ${u.name_english}: ${url} :: ${e.message}`);}
  }
  console.log(`[DOC-PERSIST] ${u.name_english}: ${pages} pages, ${docUrls.size} document candidates`);
}
console.log(`[DOC-PERSIST] complete: ${universities.length} universities scanned; ${scanned} PDFs extracted; ${stored} documents stored; ${enriched} program requirement/fee enrichments.`);
