import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required for program cleanup.');

const NON_PROGRAM_RE = /(scholarship|scholarships|degree programs|fine qualities|application procedure|application requirements|admission procedure|admission requirements|contact us|about us|international students|fees\s*(?:&|and)\s*payment|tuition\s*(?:&|and)\s*fees|accommodation|exchange programs|schools\s*(?:&|and)\s*departments|faculties|departments)/i;

function invalidProgram(row) {
  const name = String(row.program_name || '').trim();
  if (!name || NON_PROGRAM_RE.test(name)) return true;

  const hasAcademicSignal =
    Boolean(String(row.field_of_study || '').trim()) ||
    row.duration_years != null ||
    row.tuition_fee != null ||
    row.english_taught === true ||
    Boolean(String(row.official_program_url || '').trim()) ||
    Number(row.intake_count || 0) > 0;

  return !hasAcademicSignal;
}

const rows = await db`
  SELECT p.id, p.program_name, p.field_of_study, p.duration_years,
         p.tuition_fee, p.english_taught, p.official_program_url,
         COUNT(i.id)::int AS intake_count
  FROM programs p
  LEFT JOIN intakes i ON i.program_id = p.id
  WHERE COALESCE(p.is_active,true)=true
  GROUP BY p.id
  ORDER BY p.id
`;

let disabled = 0;
for (const row of rows) {
  if (!invalidProgram(row)) continue;
  await db`UPDATE programs SET is_active=false, updated_at=now() WHERE id=${row.id}`;
  disabled++;
  console.log(`[PROGRAM-CLEANUP] disabled: ${row.program_name}`);
}

console.log(`[PROGRAM-CLEANUP] scanned ${rows.length}; disabled ${disabled}`);
