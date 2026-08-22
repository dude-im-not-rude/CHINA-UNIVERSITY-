import Link from 'next/link';
import { getUniversityById } from '../../university-queries';
import { filterAcademicPrograms } from '../../program-quality';
import ReportButton from '../../components/report-button';

export const dynamic = 'force-dynamic';

export default async function Page({ params }) {
  const u = await getUniversityById(params.slug);
  if (!u) return <main><Header/><section className="page-head"><h1>University not found.</h1><Link className="btn secondary" href="/universities">Back to directory</Link></section></main>;

  const programs = filterAcademicPrograms(u.programs);
  const officialSources = u.sources.filter((s) => !/cucas/i.test(`${s.source_name || ''} ${s.source_url || ''}`));
  const verifiedDates = officialSources.map((s) => s.last_checked_at).filter(Boolean).sort();
  const lastVerified = verifiedDates.length ? new Date(verifiedDates[verifiedDates.length - 1]).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : null;
  const rankingUrl = `https://www.shanghairanking.com/universities/${u.name_english.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`;

  return <main><Header/>
    <section className="detail-hero reveal">
      <div className="uni-logo big">{u.short_name || u.name_english.slice(0,3).toUpperCase()}</div>
      <div><div className="tag">{u.university_type || 'University'} · {classification(u)}</div><h1>{u.name_english}</h1><p>{u.city || 'China'}{u.province ? `, ${u.province}` : ''}</p>{lastVerified && <div className="verified-badge">✓ Source record checked · {lastVerified}</div>}</div>
      <a className="rank-pill" href={rankingUrl} target="_blank" rel="noreferrer">ShanghaiRanking profile ↗</a>
    </section>

    <section className="detail-grid"><div>
      <article className="panel"><h2>About</h2><p>{u.university_description || 'University profile information is being verified and expanded.'}</p><div className="chips">{u.c9 && <span>C9</span>}{u.project_985 && <span>985</span>}{u.project_211 && <span>211</span>}{u.double_first_class && <span>Double First-Class</span>}{!u.c9 && !u.project_985 && !u.project_211 && !u.double_first_class && <span>{u.university_type || 'Classification pending'}</span>}</div><ReportButton university={u.name_english}/></article>

      <article className="panel">
        <div className="section-head compact-head"><div><h2>Programs</h2><p>Only records that pass the academic-program quality check are shown.</p></div></div>
        <div className="program-quality-note">Non-academic scraped pages such as scholarship notices, admissions sections and generic “degree programs” pages are excluded from this list.</div>
        {programs.length ? <div className="table-wrap"><table><thead><tr><th>Program</th><th>Degree</th><th>Language</th><th>Duration</th><th>Tuition</th><th>CSCA</th><th>Deadline</th></tr></thead><tbody>{programs.map(p=><tr key={p.id}><td><Link className="program-link" href={`/universities/${u.id}/programs/${p.id}`}><b>{p.program_name}</b></Link><br/><small>{p.field_of_study || ''}</small><br/><ReportButton university={u.name_english} program={p.program_name}/></td><td>{p.degree_level}</td><td>{p.language || (p.english_taught ? 'English' : '—')}</td><td>{p.duration_years ? `${p.duration_years} years` : '—'}</td><td>{p.tuition_fee ? `${p.tuition_fee} ${p.tuition_currency || ''}` : 'To verify'}</td><td>{p.csca_required ? 'Required' : 'Not listed'}</td><td>{p.intakes?.[0]?.deadline ? new Date(p.intakes[0].deadline).toLocaleDateString('en-IN') : '—'}</td></tr>)}</tbody></table></div> : <div className="university-empty">No verified academic program records are available for this university yet. We are keeping non-academic scraped pages out rather than presenting them as programs.</div>}
      </article>

      <article className="panel"><h2>Scholarships</h2>{u.scholarships.length ? <div className="scholar-grid">{u.scholarships.map(s=><div className="scholar-card" key={s.id}><div className="tag">{s.scholarship_type || 'Scholarship'} · {s.provider || 'Provider varies'}</div><h3>{s.name}</h3><p>{s.description || 'University-linked scholarship. Verify the current call.'}</p><div className="chips small">{s.tuition_coverage && <span>Tuition</span>}{s.accommodation_coverage && <span>Accommodation</span>}{s.stipend_coverage && <span>Stipend</span>}{s.insurance_coverage && <span>Insurance</span>}</div>{s.application_deadline && <small>Deadline: {s.application_deadline}</small>}{(s.application_url || s.official_website) && <p><a href={s.application_url || s.official_website} target="_blank" rel="noreferrer">Scholarship details ↗</a></p>}</div>)}</div> : <p>No scholarship links have been entered yet.</p>}</article>

      <article className="panel"><h2>Campus & facilities</h2>
        {u.campuses.length ? <div className="university-info-grid">{u.campuses.map(c=><div className="university-info-card" key={c.id}><h3>{c.name || 'Campus'}</h3><span className="label">Location</span><p>{c.city || u.city || 'China'}{c.address ? ` · ${c.address}` : ''}</p>{c.description && <><span className="label">Facilities / notes</span><p>{c.description}</p></>}</div>)}</div> : <div className="university-empty">No structured campus record has been verified yet. The university city is shown above; detailed campus facilities will appear here once an official source record is added.</div>}
      </article>

      <article className="panel"><h2>Verification sources</h2>{officialSources.length ? <ul>{officialSources.map(s=><li key={s.id}><a href={s.source_url} target="_blank" rel="noreferrer">{s.source_name || 'Official source'} ↗</a> — {s.verification_status || 'Unverified'}{s.last_checked_at ? ` · checked ${new Date(s.last_checked_at).toLocaleDateString('en-IN')}` : ''}</li>)}</ul> : <p>Official source records are being collected. Critical admissions facts should be verified against the university's official notice.</p>}</article>
    </div>

    <aside>
      <div className="panel"><h3>Official links</h3>{u.official_website && <a className="btn primary full" href={u.official_website} target="_blank" rel="noreferrer">Official website ↗</a>}{u.admissions_website && <a className="btn secondary full" href={u.admissions_website} target="_blank" rel="noreferrer">Admissions ↗</a>}<a className="btn secondary full" href={rankingUrl} target="_blank" rel="noreferrer">ShanghaiRanking profile ↗</a></div>

      <div className="panel"><h3>University contact details</h3>
        {u.contacts.length ? <div className="university-info-grid">{u.contacts.map(c=><div className="university-info-card" key={c.id}><h3>{c.department || c.contact_type || 'Contact'}</h3>{c.email && <p><span className="label">Email</span><a href={`mailto:${c.email}`}>{c.email}</a></p>}{c.phone && <p><span className="label">Phone</span>{c.phone}</p>}{c.address && <p><span className="label">Address</span>{c.address}</p>}</div>)}</div> : <div className="university-empty">No structured contact record is available yet. Use the official university or admissions link below until a verified contact record is added.</div>}
        {u.official_website && <a className="btn secondary full" href={u.official_website} target="_blank" rel="noreferrer">Open official university site ↗</a>}
        {u.admissions_website && <a className="btn secondary full" href={u.admissions_website} target="_blank" rel="noreferrer">Open official admissions site ↗</a>}
      </div>

      <div className="panel warning"><b>Verification</b><p>Critical fees, deadlines, contacts and eligibility should be confirmed against the university's official notice before applying.</p></div>
    </aside></section>
  </main>
}

function classification(u){ if(u.c9) return 'C9'; if(u.double_first_class) return 'Double First-Class'; if(u.project_985) return '985'; if(u.project_211) return '211'; return u.university_type || 'Classification pending'; }
function Header(){return <header className="nav"><Link className="brand" href="/">China<span>Uni</span>Tracker</Link><nav><Link href="/universities">Universities</Link><Link href="/scholarships">Scholarships</Link><Link href="/csca">CSCA</Link><Link href="/contact">Contact</Link></nav></header>}
