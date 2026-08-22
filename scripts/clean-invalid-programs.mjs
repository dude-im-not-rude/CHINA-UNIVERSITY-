import { neon } from '@neondatabase/serverless';

const db = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (!db) throw new Error('DATABASE_URL is required for program cleanup.');

const NON_PROGRAM_EXACT = new Set([
  'international','schools & departments','schools and departments','application procedures','application procedure','application requirements','admission requirements','admission procedure','admission procedures','application process','admission process','scholarship programs','scholarship program','exchange programs','exchange program','fees & payment','fees and payment','tuition & fees','tuition and fees','accommodation','how to apply','admissions','admission','scholarships','scholarship','departments','department','faculties','faculty','international students','contact us','about us','basic information','university information','overview','home','homepage','research','schools','colleges','academics','programs','courses','news','notices','graduate','undergraduate','professional training programs','non-degree program'
]);

function invalidName(value) {
  const name=String(value||'').replace(/\s+/g,' ').trim();
  const n=name.toLowerCase();
  if(!name||NON_PROGRAM_EXACT.has(n)) return true;
  if(/^(application|admission|scholarship|exchange|department|faculty|school|college|fees|tuition|accommodation|contact|about|overview|research|more projects|degree programs|fine qualities|government scholarship|professional training|non-degree)\b/i.test(name)) return true;
  if(/^(home|homepage|programs?|courses?|academics?|study|news|notices?|graduate|undergraduate|students?|admissions?)$/i.test(name)) return true;
  if(/^renmin university(?: of china)?$/i.test(name)) return true;
  if(/^首都经济贸易大学$/i.test(name)) return true;
  if(/\b(?:university|college)\b/i.test(name) && !/\b(?:business|management|economics|trade|engineering|science|arts|law|medicine|computer|finance|accounting|marketing|education|architecture|design|international relations)\b/i.test(name)) return true;
  return false;
}

const rows=await db`SELECT id,program_name,degree_level,field_of_study,duration_years,tuition_fee,official_program_url,english_taught,language FROM programs WHERE COALESCE(is_active,true)=true`;
let disabled=0;
for(const row of rows){
  const weakAcademicRecord=!row.degree_level||['other','unknown'].includes(String(row.degree_level).toLowerCase());
  const nonDegreeLabel=/non[- ]degree|professional training|language program|summer school|winter school|exchange program|visiting student|certificate|foundation|preparatory/i.test(String(row.program_name||''));
  const genericAcademic=/^(graduate|undergraduate|students?|admissions?)$/i.test(String(row.program_name||''));
  if(!invalidName(row.program_name)&&!nonDegreeLabel&&!genericAcademic&&!(weakAcademicRecord&&!row.field_of_study&&!row.duration_years&&!row.tuition_fee&&!row.official_program_url&&!row.english_taught&&!row.language)) continue;
  await db`UPDATE programs SET is_active=false,updated_at=now() WHERE id=${row.id}`;
  disabled++;
  console.log(`[PROGRAM-CLEANUP] disabled: ${row.program_name}`);
}
console.log(`[PROGRAM-CLEANUP] scanned ${rows.length}; disabled ${disabled}`);
