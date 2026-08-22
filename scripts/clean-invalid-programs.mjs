import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required for program cleanup.');

// Imported university pages can contain navigation/notice headings that look like
// programs. Keep these out of the academic program table's active records.
const NON_PROGRAM_EXACT = new Set([
  'international', 'schools & departments', 'schools and departments',
  'application procedures', 'application procedure', 'application requirements',
  'admission requirements', 'admission procedure', 'admission procedures',
  'application process', 'admission process', 'scholarship programs',
  'scholarship program', 'exchange programs', 'exchange program', 'fees & payment',
  'fees and payment', 'tuition & fees', 'tuition and fees', 'accommodation',
  'how to apply', 'admissions', 'admission', 'scholarships', 'scholarship',
  'departments', 'department', 'faculties', 'faculty', 'international students',
  'contact us', 'about us', 'basic information', 'university information',
  'programs', 'program', 'courses', 'course', 'academics', 'study', 'home',
  'homepage', 'news', 'notices',
]);

function invalidName(value) {
  const name = String(value || '').replace(/\s+/g, ' ').trim();
  const normalized = name.toLowerCase();
  if (!name || NON_PROGRAM_EXACT.has(normalized)) return true;
  if (/^(application|admission|scholarship|exchange|department|faculty|school|fees|tuition|accommodation|contact|about|home|news|notice)\b/i.test(name)) return true;
  if (/(government scholarship|fine qualities of excellent students|application process|admission process|how to apply|university information|contact us|about us)/i.test(name)) return true;
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
