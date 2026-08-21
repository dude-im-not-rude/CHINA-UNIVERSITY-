import Link from 'next/link';
import { getUniversities } from '../university-queries';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }) {
  const filters = searchParams || {};
  const universities = await getUniversities(filters);
  return <main><Header/><section className="page-head reveal"><div className="eyebrow">LIVE DIRECTORY</div><h1>Find your university.</h1><p>Search programs the way you actually compare them: degree, teaching language, major, city, scholarship coverage, intake and CSCA.</p></section><section className="section directory-section">
    <form className="advanced-filters reveal" method="get">
      <div className="filter-heading"><div><span className="filter-kicker">PROGRAM SEARCH</span><h2>Build your shortlist</h2><p>Mix as many filters as you want. Nothing is hidden behind tiny checkboxes.</p></div><Link className="btn secondary filter-reset" href="/universities">Reset</Link></div>
      <div className="filter-grid">
        <label><span>Search</span><input name="q" defaultValue={filters.q || ''} placeholder="University, program or city"/></label>
        <label><span>University</span><input name="university" defaultValue={filters.university || ''} placeholder="e.g. Shenzhen University"/></label>
        <label><span>Program / course</span><input name="program" defaultValue={filters.program || ''} placeholder="e.g. International Business"/></label>
        <label><span>Degree</span><select name="degree" defaultValue={filters.degree || ''}><option value="">All degrees</option><option>Bachelor</option><option>Master</option><option>PhD</option><option>Non-degree</option></select></label>
        <label><span>Teaching language</span><select name="language" defaultValue={filters.language || ''}><option value="">All languages</option><option>English</option><option>Chinese</option><option>Bilingual</option><option>Other</option></select></label>
        <label><span>Major / field</span><select name="major" defaultValue={filters.major || ''}><option value="">All majors</option><option>Business</option><option>Economics</option><option>International Trade</option><option>Accounting</option><option>Finance</option><option>Marketing</option><option>Computer Science</option><option>Engineering</option><option>Medicine</option><option>Other</option></select></label>
        <label><span>City</span><select name="city" defaultValue={filters.city || ''}><option value="">All cities</option><option>Beijing</option><option>Shanghai</option><option>Shenzhen</option><option>Guangzhou</option><option>Wuhan</option><option>Harbin</option><option>Hangzhou</option><option>Xiamen</option><option>Ningbo</option><option>Dongguan</option></select></label>
        <label><span>Province</span><select name="province" defaultValue={filters.province || ''}><option value="">All provinces</option><option>Beijing</option><option>Shanghai</option><option>Guangdong</option><option>Heilongjiang</option><option>Fujian</option><option>Zhejiang</option><option>Jiangsu</option><option>Hubei</option><option>Shandong</option><option>Sichuan</option></select></label>
        <label><span>University type</span><select name="type" defaultValue={filters.type || ''}><option value="">Public + private</option><option value="public">Public</option><option value="private">Private</option></select></label>
        <label><span>Classification</span><select name="classification" defaultValue={filters.classification || ''}><option value="">All classifications</option><option value="c9">C9</option><option value="985">985</option><option value="211">211</option><option value="double-first-class">Double First-Class</option></select></label>
        <label><span>Intake</span><select name="intake" defaultValue={filters.intake || ''}><option value="">All intakes</option><option>September</option><option>March</option><option>Spring</option><option>Fall</option></select></label>
        <label><span>Application status</span><select name="open" defaultValue={filters.open || ''}><option value="">Any status</option><option value="true">Open / accepting</option></select></label>
        <label><span>CSCA</span><select name="csca" defaultValue={filters.csca || ''}><option value="">Any</option><option value="true">Required</option><option value="false">Not listed / not required</option></select></label>
        <label><span>Scholarship type</span><select name="scholarshipType" defaultValue={filters.scholarshipType || ''}><option value="">Any scholarship</option><option>CSC</option><option>University</option><option>Provincial</option><option>Municipal</option><option>Other</option></select></label>
        <label><span>Scholarship coverage</span><select name="coverage" defaultValue={filters.coverage || ''}><option value="">Any coverage</option><option value="tuition">Tuition</option><option value="accommodation">Accommodation</option><option value="stipend">Living stipend</option></select></label>
      </div>
      <div className="filter-options"><label className="toggle-check"><input type="checkbox" name="english" value="true" defaultChecked={filters.english === 'true'}/><span>English-taught</span></label><label className="toggle-check"><input type="checkbox" name="scholarship" value="true" defaultChecked={filters.scholarship === 'true'}/><span>Scholarship available</span></label><button className="btn primary filter-submit" type="submit">Apply filters</button></div>
    </form>
    <div className="result-toolbar"><div className="result-meta"><b>{universities.length}</b> universities found</div><span>Database results · verified-source records</span></div>
    {universities.length ? <div className="uni-grid">{universities.map((u,i)=><Link className="uni-card reveal" style={{animationDelay:`${Math.min(i,8)*35}ms`}} href={`/universities/${u.id}`} key={u.id}><div className="uni-logo">{u.short_name || u.name_english.slice(0,3).toUpperCase()}</div><div><div className="tag">{u.university_type} · {classification(u)}</div><h3>{u.name_english}</h3><p>{u.city || 'China'}{u.province ? `, ${u.province}` : ''}</p><div className="chips small"><span>{u.program_count} programs</span>{u.has_english_program && <span>English</span>}{u.has_scholarship && <span>Scholarship</span>}{u.has_csca && <span>CSCA</span>}</div></div></Link>)}</div> : <div className="panel empty"><h2>No universities match those filters.</h2><p>Try clearing one or two filters. The database is ready for more verified university records.</p><Link className="btn secondary" href="/universities">Clear filters</Link></div>}
  </section></main>
}
function classification(u){ if(u.c9) return 'C9'; if(u.double_first_class) return 'Double First-Class'; if(u.project_985) return '985'; if(u.project_211) return '211'; return 'University'; }
function Header(){return <header className="nav"><Link className="brand" href="/">China<span>Uni</span>Tracker</Link></header>}
