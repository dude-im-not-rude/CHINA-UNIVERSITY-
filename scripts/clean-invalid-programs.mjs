import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required for program cleanup.');

// University navigation/section pages are occasionally imported as programs.
// Disable them rather than deleting them so the audit trail and source records remain intact.
const NON_PROGRAM_EXACT = new Set([
  'international', 'schools & departments', 'schools and departments',
  'application procedures', 'application procedure', 'application requirements',
  'admission requirements', 'admission procedure', 'admission procedures',
  'application process', 'admission process', 'scholarship programs',
  'scholarship program', 'exchange programs', 'exchange program',
  'fees & payment', 'fees and payment', 'tuition & fees', 'tuition and fees',
  'accommodation', 'how to apply', 'admissions', 'admission', 'scholarships',
  'scholarship', 'departments', 'department', 'faculties', 'faculty',
  'international students', 'contact us', 'about us', 'basic information',
  'university information', 'overview', 'home', 'homepage', 'research',
  'schools', 'colleges', 'academics', 'programs', 'courses', 'news', 'notices'
]);

function invalidName(value) {
  const name = String(value || '').replace(/\s+/g, ' ').trim();
  const normalized = name.toLowerCase();
  if (!name || NON_PROGRAM_EXACT.has(normalized)) return true;
  if (/^(application|admission|scholarship|exchange|department|faculty|school|college|fees|tuition|accommodation|contact|about|overview|research|more projects|degree programs|fine qualities|government scholarship)\b/i.test(name)) return true;
  if (/^(home|homepage|programs?|courses?|academics?|study|news|notices?)$/i.test(name)) return true;
  if (/-(?:hainan|dongbei|hubei|university)\b/i.test(name) && /^(home|overview|research|more projects|degree programs|fine qualities|government scholarship|schools?|colleges?|faculties?|departments?|international|admission|application|scholarship|contact)\b/i.test(name)) return true;
  return false;
}

const rows = await db`SELECT id, program_name, degree_level, field_of_study, duration_years, tuition_fee, official_program_url, english_taught, language FROM programs WHERE COALESCE(is_active,true) = true`;
let disabled = 0;
for (const row of rows) {
  const weakAcademicRecord = !row.degree_level || ['other', 'unknown'].includes(String(row.degree_level).toLowerCase());
  const missingSignals = !row.field_of_study && !row.duration_years && !row.tuition_fee && !row.official_program_url && !row.english_taught && !row.language;
  if (!invalidName(row.program_name) && !(weakAcademicRecord && missingSignals)) continue;
  await db`UPDATE programs SET is_active=false, updated_at=now() WHERE id=${row.id}`;
  disabled++;
  console.log(`[PROGRAM-CLEANUP] disabled non-program record: ${row.program_name}`);
}
console.log(`[PROGRAM-CLEANUP] scanned ${rows.length}; disabled ${disabled}`);
