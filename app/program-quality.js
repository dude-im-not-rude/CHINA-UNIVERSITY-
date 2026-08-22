const NON_PROGRAM_RE = /(scholarship|scholarships|degree programs|fine qualities|application procedure|application requirements|admission procedure|admission requirements|contact us|about us|international students|fees\s*(?:&|and)\s*payment|tuition\s*(?:&|and)\s*fees|accommodation|exchange programs|schools\s*(?:&|and)\s*departments|faculties|departments)/i;

export function isAcademicProgram(program) {
  const name = String(program?.program_name || '').trim();
  if (!name || NON_PROGRAM_RE.test(name)) return false;

  const hasAcademicSignal =
    Boolean(String(program?.field_of_study || '').trim()) ||
    program?.duration_years != null ||
    program?.tuition_fee != null ||
    program?.english_taught === true ||
    Boolean(String(program?.official_program_url || '').trim()) ||
    Array.isArray(program?.intakes) && program.intakes.length > 0;

  return hasAcademicSignal;
}

export function filterAcademicPrograms(programs = []) {
  return programs.filter(isAcademicProgram);
}
