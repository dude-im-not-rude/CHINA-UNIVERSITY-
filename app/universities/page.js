import Link from 'next/link';
import { getUniversities } from '../university-queries';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }) {
  const filters = searchParams || {};
  const universities = await getUniversities(filters);
  return <main><Header/><section className="page-head"><div className="eyebrow">LIVE DIRECTORY</div><h1>China universities</h1><p>Database-driven university discovery for the 2027 intake. Filter by degree, language, location, major, funding and classification.</p></section><section className="section">
    <form className="filterbar" method="get">
      <input name="q" defaultValue={filters.q || ''} placeholder="Search university, city or program..."/>
      <select name="degree" defaultValue={filters.degree || ''}><option value="">All degrees</option><option value="Bachelor">Bachelor</option><option value="Master">Master</option></select>
      <select name="type" defaultValue={filters.type || ''}><option value="">All types</option><option value="public">Public</option><option value="private">Private</option></select>
      <select name="province" defaultValue={filters.province || ''}><option value="">All provinces</option><option>Guangdong</option><option>Heilongjiang</option><option>Fujian</option><option>Zhejiang</option><option>Shanghai</option></select>
      <select name="classification" defaultValue={filters.classification || ''}><option value="">All classifications</option><option value="c9">C9</option><option value="985">985</option><option value="211">211</option><option value="double-first-class">Double First-Class</option></select>
      <select name="major" defaultValue={filters.major || ''}><option value="">All majors</option><option>Business</option><option>Economics</option><option>Engineering</option><option>Medicine</option><option>Computer Science</option></select>
      <label className="check"><input type="checkbox" name="english" value="true" defaultChecked={filters.english === 'true'}/> English-taught</label>
      <label className="check"><input type="checkbox" name="scholarship" value="true" defaultChecked={filters.scholarship === 'true'}/> Scholarship</label>
      <label className="check"><input type="checkbox" name="csca" value="true" defaultChecked={filters.csca === 'true'}/> CSCA</label>
      <select name="intake" defaultValue={filters.intake || ''}><option value="">All intakes</option><option value="September">September</option><option value="March">March</option></select>
      <button className="btn primary" type="submit">Apply filters</button>
      <Link className="btn secondary" href="/universities">Reset</Link>
    </form>
    <div className="result-meta"><b>{universities.length}</b> universities found</div>
    {universities.length ? <div className="uni-grid">{universities.map(u=><Link className="uni-card" href={`/universities/${u.id}`} key={u.id}><div className="uni-logo">{u.short_name || u.name_english.slice(0,3).toUpperCase()}</div><div><div className="tag">{u.university_type} · {classification(u)}</div><h3>{u.name_english}</h3><p>{u.city || 'China'}{u.province ? `, ${u.province}` : ''}</p><div className="chips small"><span>{u.program_count} programs</span>{u.has_english_program && <span>English</span>}{u.has_scholarship && <span>Scholarship</span>}{u.has_csca && <span>CSCA</span>}</div></div></Link>)}</div> : <div className="panel empty"><h2>No universities match those filters.</h2><p>Try clearing one or two filters. The database is ready for more verified university records.</p><Link className="btn secondary" href="/universities">Clear filters</Link></div>}
  </section></main>
}
function classification(u){ if(u.c9) return 'C9'; if(u.double_first_class) return 'Double First-Class'; if(u.project_985) return '985'; if(u.project_211) return '211'; return 'University'; }
function Header(){return <header className="nav"><Link className="brand" href="/">China<span>Uni</span>Tracker</Link><nav><Link href="/universities">Universities</Link><Link href="/scholarships">Scholarships</Link><Link href="/csca">CSCA</Link><Link href="/contact">Contact</Link></nav></header>}
