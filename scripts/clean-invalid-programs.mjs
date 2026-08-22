import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required for program cleanup.');

// Keep real degree AND non-degree offerings. Only disable records that are clearly
// navigation/section artefacts or university-level pages masquerading as programs.
const NON_PROGRAM_EXACT = new Set([
  'international','schools & departments','schools and departments','application procedures','application procedure',
  'application requirements','admission requirements','admission procedure','admission procedures','application process',
  'admission process','fees & payment','fees and payment','tuition & fees','tuition and fees','accommodation',
  'how to apply','admissions','admission','scholarships','scholarship','departments','department','faculties','faculty',
  'international students','contact us','about us','basic information','university information','overview','home','homepage',
  'research','schools','colleges','academics','programs','courses','news','notices','graduate','undergraduate','students'
]);

const NON_DEGREE_SIGNAL = /non[- ]degree|professional training|language program|chinese language|summer school|summer camp|winter school|exchange program|visiting student|visiting scholar|certificate|foundation|preparatory|short[- ]term|continuing education/i;

function invalidName(value) {
  const name = String(value || '').replace(/\s+/g, ' ').trim();
  const n = name.toLowerCase();
  if (!name || NON_PROGRAM_EXACT.has(n)) return true;
  if (/^(application|admission|scholarship|department|faculty|school|college|fees|tuition|accommodation|contact|about|overview|research|more projects|degree programs)\b/i.test(name)) return true;
  if (/^(home|homepage|programs?|courses?|academics?|study|news|notices?|graduate|undergraduate|students?|admissions?)$/i.test(name)) return true;
  return false;
}

const rows = await db`SELECT id,program_name,degree_level,field_of_study,duration_years,tuition_fee,official_program_url,english_taught,language,program_description FROM programs WHERE COALESCE(is_active,true)=true`;
let disabled = 0;
for (const row of rows) {
  const name = String(row.program_name || '').trim();
  const nonDegree = NON_DEGREE_SIGNAL.test(`${name} ${row.program_description || ''}`);
  const weakOther = ['other','unknown'].includes(String(row.degree_level || '').toLowerCase());
  const hasEvidence = Boolean(row.field_of_study || row.duration_years || row.tuition_fee || row.official_program_url || row.english_taught || row.language || row.program_description);

  // Non-degree offerings are intentionally preserved when they have an official source/evidence.
  if (nonDegree && row.official_program_url) continue;
  if (!invalidName(name) && (hasEvidence || !weakOther)) continue;

  await db`UPDATE programs SET is_active=false, updated_at=now() WHERE id=${row.id}`;
  disabled++;
  console.log(`[PROGRAM-CLEANUP] disabled: ${name}`);
}
console.log(`[PROGRAM-CLEANUP] scanned ${rows.length}; disabled ${disabled}; preserved legitimate non-degree offerings.`);
