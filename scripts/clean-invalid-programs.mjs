import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required for program cleanup.');

// These are university/admission information sections, not academic programs.
const NON_PROGRAM_EXACT = new Set([
  'international',
  'schools & departments',
  'schools and departments',
  'application procedures',
  'application procedure',
  'application requirements',
  'admission requirements',
  'admission procedure',
  'admission procedures',
  'application process',
  'admission process',
  'scholarship programs',
  'scholarship program',
  'exchange programs',
  'exchange program',
  'fees & payment',
  'fees and payment',
  'tuition & fees',
  'tuition and fees',
  'accommodation',
  'how to apply',
  'admissions',
  'admission',
  'scholarships',
  'scholarship',
  'departments',
  'department',
  'faculties',
  'faculty',
  'international students',
  'contact us',
  'about us',
  'basic information',
  'university information',
]);

function invalidName(value) {
  const name = String(value || '').replace(/\\s+/g, ' ').trim();
  const normalized = name.toLowerCase();
  if (!name || NON_PROGRAM_EXACT.has(normalized)) return true;
  if (/^(application|admission|scholarship|exchange|department|faculty|school|fees|tuition|accommodation|contact|about)\\b/i.test(name)) return true;
  if (/^(home|homepage|programs?|courses?|academics?|study|news|notices?)$/i.test(name)) return true;
  return false;
}

const rows = await db`SELECT id, program_name FROM programs WHERE is_active = true`;
let disabled = 0;
for (const row of rows) {
  if (!invalidName(row.program_name)) continue;
  await db`UPDATE programs SET is_active=false, updated_at=now() WHERE id=${row.id}`;
  disabled++;
  console.log(`[PROGRAM-CLEANUP] disabled non-program record: ${row.program_name}`);
}
console.log(`[PROGRAM-CLEANUP] scanned ${rows.length}; disabled ${disabled}`);
