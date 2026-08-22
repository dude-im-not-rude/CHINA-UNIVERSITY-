import { getDb } from './db';

export async function getUniversities(filters = {}) {
  const db = getDb();
  const where = ["u.country = 'China'", "COALESCE(u.status, 'active') <> 'inactive'"];
  const values = [];
  const add = (sql, value) => { values.push(value); where.push(sql.replace('$VALUE', `$${values.length}`)); };

  if (filters.q) add(`(u.name_english ILIKE '%' || $VALUE || '%' OR COALESCE(u.name_chinese,'') ILIKE '%' || $VALUE || '%' OR COALESCE(u.city,'') ILIKE '%' || $VALUE || '%' OR EXISTS (SELECT 1 FROM programs p WHERE p.university_id=u.id AND (p.program_name ILIKE '%' || $VALUE || '%' OR COALESCE(p.field_of_study,'') ILIKE '%' || $VALUE || '%')))`, filters.q);
  if (filters.university) add(`u.name_english ILIKE '%' || $VALUE || '%'`, filters.university);
  if (filters.degree) add(`EXISTS (SELECT 1 FROM programs p WHERE p.university_id=u.id AND lower(p.degree_level)=lower($VALUE))`, filters.degree);
  if (filters.type) add(`lower(u.university_type)=lower($VALUE)`, filters.type);
  if (filters.province) add(`lower(COALESCE(u.province,''))=lower($VALUE)`, filters.province);
  if (filters.city) add(`lower(COALESCE(u.city,''))=lower($VALUE)`, filters.city);
  if (filters.major) add(`EXISTS (SELECT 1 FROM programs p WHERE p.university_id=u.id AND (p.field_of_study ILIKE '%' || $VALUE || '%' OR p.program_name ILIKE '%' || $VALUE || '%'))`, filters.major);
  if (filters.program) add(`EXISTS (SELECT 1 FROM programs p WHERE p.university_id=u.id AND p.program_name ILIKE '%' || $VALUE || '%')`, filters.program);
  if (filters.language) add(`EXISTS (SELECT 1 FROM programs p WHERE p.university_id=u.id AND lower(COALESCE(p.language, CASE WHEN p.english_taught THEN 'English' ELSE '' END))=lower($VALUE))`, filters.language);
  if (filters.english === 'true') where.push(`EXISTS (SELECT 1 FROM programs p WHERE p.university_id=u.id AND p.english_taught=true)`);
  if (filters.scholarship === 'true') where.push(`EXISTS (SELECT 1 FROM university_scholarships us WHERE us.university_id=u.id AND COALESCE(us.available,true)=true)`);
  if (filters.scholarshipType) add(`EXISTS (SELECT 1 FROM university_scholarships us JOIN scholarships s ON s.id=us.scholarship_id WHERE us.university_id=u.id AND COALESCE(us.available,true)=true AND lower(COALESCE(s.scholarship_type,''))=lower($VALUE))`, filters.scholarshipType);
  if (filters.coverage === 'tuition') where.push(`EXISTS (SELECT 1 FROM university_scholarships us JOIN scholarships s ON s.id=us.scholarship_id WHERE us.university_id=u.id AND COALESCE(us.available,true)=true AND s.tuition_coverage=true)`);
  if (filters.coverage === 'accommodation') where.push(`EXISTS (SELECT 1 FROM university_scholarships us JOIN scholarships s ON s.id=us.scholarship_id WHERE us.university_id=u.id AND COALESCE(us.available,true)=true AND s.accommodation_coverage=true)`);
  if (filters.coverage === 'stipend') where.push(`EXISTS (SELECT 1 FROM university_scholarships us JOIN scholarships s ON s.id=us.scholarship_id WHERE us.university_id=u.id AND COALESCE(us.available,true)=true AND s.stipend_coverage=true)`);
  if (filters.csca === 'true') where.push(`EXISTS (SELECT 1 FROM programs p JOIN admission_requirements ar ON ar.program_id=p.id WHERE p.university_id=u.id AND ar.csca_required=true)`);
  if (filters.csca === 'false') where.push(`EXISTS (SELECT 1 FROM programs p LEFT JOIN admission_requirements ar ON ar.program_id=p.id WHERE p.university_id=u.id AND COALESCE(ar.csca_required,false)=false)`);
  if (filters.classification === 'c9') where.push('u.c9=true');
  if (filters.classification === '985') where.push('u.project_985=true');
  if (filters.classification === '211') where.push('u.project_211=true');
  if (filters.classification === 'double-first-class') where.push('u.double_first_class=true');
  if (filters.intake) add(`EXISTS (SELECT 1 FROM programs p JOIN intakes i ON i.program_id=p.id WHERE p.university_id=u.id AND i.intake_name ILIKE '%' || $VALUE || '%')`, filters.intake);
  if (filters.open === 'true') where.push(`EXISTS (SELECT 1 FROM programs p JOIN intakes i ON i.program_id=p.id WHERE p.university_id=u.id AND (i.application_status ILIKE '%open%' OR (i.application_open_date IS NOT NULL AND CURRENT_DATE >= i.application_open_date AND (i.application_deadline IS NULL OR CURRENT_DATE <= i.application_deadline))))`);

  return db.query(`SELECT u.id, u.name_english, u.name_chinese, u.short_name, u.university_type, u.city, u.province, u.country, u.official_website, u.admissions_website, u.c9, u.project_985, u.project_211, u.double_first_class, u.university_description, u.logo_url, u.cover_image_url,
    EXISTS (SELECT 1 FROM programs p WHERE p.university_id=u.id AND p.english_taught=true) AS has_english_program,
    EXISTS (SELECT 1 FROM university_scholarships us WHERE us.university_id=u.id AND COALESCE(us.available,true)=true) AS has_scholarship,
    EXISTS (SELECT 1 FROM programs p JOIN admission_requirements ar ON ar.program_id=p.id WHERE p.university_id=u.id AND ar.csca_required=true) AS has_csca,
    (SELECT COUNT(*)::int FROM programs p WHERE p.university_id=u.id AND COALESCE(p.is_active,true)=true) AS program_count
    FROM universities u WHERE ${where.join(' AND ')} ORDER BY u.name_english ASC`, values);
}

export async function getUniversityById(id) {
  const db = getDb();
  const rows = await db.query(`SELECT * FROM universities WHERE id=$1 LIMIT 1`, [id]);
  if (!rows[0]) return null;
  const u = rows[0];
  const programs = await db.query(`SELECT p.*, ar.csca_required, ar.csca_subjects, ar.english_requirement, ar.ielts_min, ar.toefl_min, ar.hsk_requirement, ar.minimum_percentage, ar.mathematics_required,
    COALESCE(json_agg(DISTINCT jsonb_build_object('id',i.id,'name',i.intake_name,'open',i.application_open_date,'deadline',i.application_deadline,'status',i.application_status)) FILTER (WHERE i.id IS NOT NULL),'[]') AS intakes
    FROM programs p LEFT JOIN admission_requirements ar ON ar.program_id=p.id LEFT JOIN intakes i ON i.program_id=p.id WHERE p.university_id=$1 GROUP BY p.id, ar.id ORDER BY p.degree_level, p.program_name`, [id]);
  const scholarships = await db.query(`SELECT s.id, s.name, s.scholarship_type, s.provider, s.description, s.tuition_coverage, s.accommodation_coverage, s.stipend_coverage, s.insurance_coverage, s.application_deadline, s.application_url, s.official_website, us.notes FROM university_scholarships us JOIN scholarships s ON s.id=us.scholarship_id WHERE us.university_id=$1 AND COALESCE(us.available,true)=true ORDER BY s.name`, [id]);
  const campuses = await db.query(`SELECT * FROM campuses WHERE university_id=$1 ORDER BY name`, [id]);
  const contacts = await db.query(`SELECT * FROM university_contacts WHERE university_id=$1 ORDER BY department`, [id]);
  const sources = await db.query(`SELECT * FROM sources WHERE university_id=$1 ORDER BY is_official DESC, last_checked_at DESC NULLS LAST`, [id]);
  return { ...u, programs, scholarships, campuses, contacts, sources };
}

export async function getProgramById(id) {
  const db = getDb();
  const rows = await db.query(`SELECT p.*, u.id AS university_id, u.name_english AS university_name, u.city, u.province, u.university_type, u.c9, u.project_985, u.project_211, u.double_first_class, u.official_website, u.admissions_website, u.university_description,
    ar.csca_required, ar.csca_subjects, ar.english_requirement, ar.ielts_min, ar.toefl_min, ar.hsk_requirement, ar.minimum_percentage, ar.mathematics_required,
    COALESCE((SELECT json_agg(jsonb_build_object('id',i.id,'name',i.intake_name,'open',i.application_open_date,'deadline',i.application_deadline,'status',i.application_status) ORDER BY i.application_deadline NULLS LAST) FROM intakes i WHERE i.program_id=p.id),'[]') AS intakes
    FROM programs p JOIN universities u ON u.id=p.university_id LEFT JOIN admission_requirements ar ON ar.program_id=p.id WHERE p.id=$1 LIMIT 1`, [id]);
  if (!rows[0]) return null;
  const program = rows[0];
  const scholarships = await db.query(`SELECT s.id, s.name, s.scholarship_type, s.provider, s.description, s.tuition_coverage, s.accommodation_coverage, s.stipend_coverage, s.insurance_coverage, s.application_deadline, s.application_url, s.official_website, us.notes FROM university_scholarships us JOIN scholarships s ON s.id=us.scholarship_id WHERE us.university_id=$1 AND COALESCE(us.available,true)=true ORDER BY s.name`, [program.university_id]);
  const contacts = await db.query(`SELECT * FROM university_contacts WHERE university_id=$1 ORDER BY department`, [program.university_id]);
  const sources = await db.query(`SELECT * FROM sources WHERE program_id=$1 ORDER BY is_official DESC, last_checked_at DESC NULLS LAST`, [id]);
  return { ...program, scholarships, contacts, sources };
}

export async function getScholarships() {
  const db = getDb();
  return db.query(`SELECT s.*, COUNT(DISTINCT us.university_id)::int AS university_count FROM scholarships s LEFT JOIN university_scholarships us ON us.scholarship_id=s.id AND COALESCE(us.available,true)=true GROUP BY s.id ORDER BY s.application_deadline NULLS LAST, s.name`);
}
