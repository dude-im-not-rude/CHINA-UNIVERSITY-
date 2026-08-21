import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required for deduplication.');

const normalize = (value) => String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

const rows = await db`
  SELECT id, university_id, program_name, degree_level, language, updated_at
  FROM programs
  WHERE is_active = true
  ORDER BY university_id, lower(program_name), degree_level, language, updated_at ASC, id ASC
`;

const groups = new Map();
for (const row of rows) {
  const key = [row.university_id, normalize(row.program_name), normalize(row.degree_level), normalize(row.language)].join('|');
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row);
}

let merged = 0;
for (const group of groups.values()) {
  if (group.length < 2) continue;
  const keeper = group[0];
  for (const duplicate of group.slice(1)) {
    await db`UPDATE intakes SET program_id=${keeper.id} WHERE program_id=${duplicate.id}`;
    await db`UPDATE admission_requirements SET program_id=${keeper.id} WHERE program_id=${duplicate.id}`;
    await db`UPDATE sources SET program_id=${keeper.id} WHERE program_id=${duplicate.id}`;
    await db`UPDATE programs SET is_active=false, updated_at=now() WHERE id=${duplicate.id}`;
    merged++;
  }
}

console.log(`[DEDUPE] merged ${merged} duplicate program records; identity = university + normalized program name + degree + language; separate intakes remain separate intake records.`);
