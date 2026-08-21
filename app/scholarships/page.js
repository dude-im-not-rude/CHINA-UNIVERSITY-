import Link from 'next/link';
import { getScholarships } from '../university-queries';

export const dynamic = 'force-dynamic';

export default async function Page(){
  const scholarships = await getScholarships();
  return <main><Header/><section className="page-head"><div className="eyebrow">FUNDING DIRECTORY</div><h1>Scholarships</h1><p>Database-driven funding records linked to universities, with coverage and application details where available.</p></section><section className="section"><div className="scholar-grid">{scholarships.map(s=><article className="scholar-card" key={s.id}><div className="tag">{s.scholarship_type || 'Scholarship'} · {s.provider || 'Provider varies'}</div><h2>{s.name}</h2><p>{s.description || 'Verify the current scholarship call for eligibility, benefits and deadline.'}</p><div className="chips">{s.tuition_coverage && <span>Tuition</span>}{s.accommodation_coverage && <span>Accommodation</span>}{s.stipend_coverage && <span>Stipend</span>}{s.insurance_coverage && <span>Insurance</span>}</div><p><b>{s.university_count}</b> linked universities{s.application_deadline ? ` · Deadline ${s.application_deadline}` : ''}</p>{s.application_url && <a href={s.application_url} target="_blank" rel="noreferrer">Application ↗</a>}</article>)}</div>{!scholarships.length && <div className="panel empty"><h2>No scholarships in the database yet.</h2><p>The schema is ready; scholarship records will appear here as they are added.</p></div>}</section></main>
}
function Header(){return <header className="nav"><Link className="brand" href="/">China<span>Uni</span>Tracker</Link><nav><Link href="/universities">Universities</Link><Link href="/scholarships">Scholarships</Link><Link href="/csca">CSCA</Link><Link href="/contact">Contact</Link></nav></header>}
