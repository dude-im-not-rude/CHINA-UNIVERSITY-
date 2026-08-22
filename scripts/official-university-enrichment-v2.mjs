import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required.');

const UA = 'ChinaUniTracker-OfficialEnrichment/2.0';
const TIMEOUT = 12000;
const MAX_RETRIES = 2;
const MAX_PAGES = 35;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig;
const PHONE = /(?:\+?86[\s-]?)?(?:\(?0\d{2,3}\)?[\s-]?)?\d{3,4}[\s-]?\d{4,5}/g;
const SKIP_EXT = /\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|png|jpe?g|gif|svg|webp|mp4|mp3)$/i;
const SKIP_PATH = /\/(?:assets?|images?|img|media|video|audio|fonts?|research|faculty|people|staff|login|search)(?:\/|$)/i;

async function fetchPage(url) {
  let last;
  for (let i = 1; i <= MAX_RETRIES; i++) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), TIMEOUT);
    try {
      const r = await fetch(url, { redirect: 'follow', signal: c.signal, headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.8' } });
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !type.includes('text/html')) throw new Error(`${r.status} ${r.statusText}`);
      return { url: r.url, html: await r.text() };
    } catch (e) { last = e; if (i < MAX_RETRIES) await sleep(i * 600); }
    finally { clearTimeout(t); }
  }
  throw last;
}

function clean(s) { return s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim(); }
function sameSite(a, root) { try { const x = new URL(a), r = new URL(root); return x.hostname === r.hostname || x.hostname.endsWith(`.${r.hostname}`); } catch { return false; } }
function anchors(html, base) {
  const out=[]; const re=/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while((m=re.exec(html))) { try { const u=new URL(m[1],base); if(!/^https?:$/i.test(u.protocol)||SKIP_EXT.test(u.pathname)||SKIP_PATH.test(u.pathname)) continue; out.push({url:u.href,text:clean(m[2]).slice(0,220)}); } catch {} }
  return out;
}
function title(html,url) { return clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || new URL(url).pathname.split('/').filter(Boolean).pop() || 'Official page').slice(0,220); }
function unique(values) { return [...new Set(values.map(v=>v.trim().toLowerCase()))].filter(Boolean); }
function pickEmails(text) { return unique((text.match(EMAIL)||[]).filter(e=>!e.endsWith('@example.com')&&!/noreply|no-reply/i.test(e))).slice(0,12); }
function pickPhones(text) { return unique(text.match(PHONE)||[]).slice(0,8); }
function looksLikeCampus(t) { return /\bcampus\b/i.test(t) && !/campus recruitment|campus news|campus event/i.test(t); }

const universities = await db`SELECT id,name_english,official_website,city,address,general_email,admissions_email,international_email,phone FROM universities WHERE country='China' AND status='active' AND official_website IS NOT NULL AND trim(official_website)<>'' ORDER BY id`;
let contactRows=0, campusRows=0;

for (const u of universities) {
  const root=u.official_website;
  const queue=[root]; const seen=new Set(); let pages=0;
  let emails=[]; let phones=[]; let contactUrls=[]; let campusCandidates=[];

  while(queue.length && pages<MAX_PAGES) {
    const url=queue.shift(); if(seen.has(url)) continue; seen.add(url);
    try {
      const p=await fetchPage(url); pages++;
      const text=clean(p.html); const pageTitle=title(p.html,p.url);
      const pageEmails=pickEmails(text); const pagePhones=pickPhones(text);
      const contactish=/contact|admission|international|enrol|student affairs|office|campus|location|address/i.test(`${p.url} ${pageTitle}`);
      if(contactish) { emails.push(...pageEmails); phones.push(...pagePhones); }
      if(contactish && pageEmails.length) contactUrls.push({url:p.url,title:pageTitle,emails:pageEmails,phones:pagePhones});
      if(looksLikeCampus(pageTitle) || looksLikeCampus(p.url)) campusCandidates.push({url:p.url,title:pageTitle,text});

      for(const a of anchors(p.html,p.url)) {
        if(!sameSite(a.url,root)||seen.has(a.url)) continue;
        if(/contact|admission|international|enrol|student affairs|office|campus|location|address/i.test(`${a.url} ${a.text}`)) queue.push(a.url);
      }
    } catch(e) { console.warn(`[ENRICH] ${u.name_english}: ${url} :: ${e.message}`); }
    await sleep(100);
  }

  emails=unique(emails); phones=unique(phones);
  const general= u.general_email || emails.find(e=>/info|contact|office|admin/i.test(e)) || emails[0] || null;
  const admissions= u.admissions_email || emails.find(e=>/admission|admissions|apply|enrol/i.test(e)) || null;
  const international= u.international_email || emails.find(e=>/international|iso|foreign/i.test(e)) || null;
  const phone= u.phone || phones[0] || null;

  if(general || admissions || international || phone) {
    await db`UPDATE universities SET general_email=COALESCE(${general},general_email), admissions_email=COALESCE(${admissions},admissions_email), international_email=COALESCE(${international},international_email), phone=COALESCE(${phone},phone), updated_at=now() WHERE id=${u.id}`;
  }

  const contactSeeds=[
    ['General',general,'general'],
    ['Admissions',admissions,'admissions'],
    ['International Office',international,'international']
  ];
  for(const [department,email,type] of contactSeeds) {
    if(!email && !phone) continue;
    const website=type==='admissions' ? u.admissions_website : type==='international' ? u.international_website : u.official_website;
    const exists=await db`SELECT id FROM university_contacts WHERE university_id=${u.id} AND lower(coalesce(email,''))=lower(coalesce(${email},'')) AND contact_type=${type} LIMIT 1`;
    if(!exists[0]) {
      await db`INSERT INTO university_contacts (university_id,department,email,phone,website_url,contact_type,notes) VALUES (${u.id},${department},${email},${phone},${website},${type},'Extracted from official university website; verify before contacting.')`;
      contactRows++;
    }
  }

  for(const c of campusCandidates.slice(0,8)) {
    const existing=await db`SELECT id FROM campuses WHERE university_id=${u.id} AND lower(name)=lower(${c.title}) LIMIT 1`;
    if(existing[0]) continue;
    const addressMatch=c.text.match(/(?:address|located at|location)\s*[:：-]?\s*([^.;]{15,220})/i);
    const address=addressMatch ? addressMatch[1].trim() : (u.address || null);
    const cityMatch=c.text.match(/\b(Beijing|Shanghai|Tianjin|Chongqing|Guangzhou|Shenzhen|Wuhan|Nanjing|Hangzhou|Harbin|Xi'an|Chengdu|Kunming|Jinan|Qingdao|Hefei|Changsha|Zhengzhou|Shenyang|Dalian|Nanchang|Fuzhou|Xiamen|Nanning|Guiyang|Lanzhou|Urumqi|Hohhot|Taiyuan|Shijiazhuang|Haikou|Sanya|Ningbo|Suzhou|Wuxi|Xuzhou)\b/i);
    await db`INSERT INTO campuses (university_id,name,city,address,description) VALUES (${u.id},${c.title},${cityMatch?.[1]||u.city},${address},${`Campus page discovered on official university website: ${c.url}`})`;
    campusRows++;
  }
  console.log(`[ENRICH] ${u.name_english}: ${pages} pages, ${emails.length} emails, ${phones.length} phones, ${campusCandidates.length} campus pages`);
}
console.log(`[ENRICH] complete: ${universities.length} universities; ${contactRows} contacts inserted; ${campusRows} campuses inserted.`);
