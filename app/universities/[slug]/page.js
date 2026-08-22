import Link from 'next/link';
import { getUniversityById } from '../../university-queries';
import ReportButton from '../../components/report-button';

export const dynamic = 'force-dynamic';

const INVALID_PROGRAM_NAME = /^(programs?|courses?|academics?|study|home|homepage|news|notices?|degree programs?|admission|admissions|application|application procedure|application procedures|application requirements|admission requirements|scholarship|scholarships|scholarship program|scholarship programs|exchange program|exchange programs|departments?|facult(y|ies)|schools? (&|and) departments?|international students|contact us|about us|basic information|university information|fees (&|and) payment|tuition (&|and) fees|accommodation)$/i;

function isAcademicProgram(program) {
  const name = String(program?.program_name || '').replace(/\s+/g, ' ').trim();
  if (!name || INVALID_PROGRAM_NAME.test(name)) return false;
  if (/(government scholarship|fine qualities of excellent students|application process|admission process|how to apply|university information|contact us|about us)/i.test(name)) return false;
  return true;
}

function rankingUrl(name) {
  return `https://www.shanghairanking.com/universities/${name.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`;
}

export default async function Page({ params }) {
  const u = await getUniversityById(params.slug);
  if (!u) return <main><Header/><section className="page-head"><h1>University not found.</h1><Link className="btn secondary" href="/universities">Back to directory</Link></section></main>;

  const programs = u.programs.filter(isAcademicProgram);
  const officialSources = u.sources.filter((s) => !/cucas/i.test(`${s.source_name || ''} ${s.source_url || ''}`));
  const verifiedDates = officialSources.map((s) => s.last_checked_at).filter(Boolean).sort();
  const lastVerified = verifiedDates.length ? new Date(verifiedDates[verifiedDates.length - 1]).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : null;
  const ranking = rankingUrl(u.name_english);

  const rankingRows = [
    ['ShanghaiRanking / BCUR', u.bcur_rank || u.shanghai_ranking || u.ranking],
    ['ARWU', u.arwu_rank],
    ['Subject ranking', u.subject_ranking],
  ].filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '');

  return <main><Header/>
    <section className="detail-hero reveal">
      <div className="uni-logo big">{u.short_name || u.name_english.slice(0,3).toUpperCase()}</div>
      <div><div className="tag">{u.university_type || 'University'} · {classification(u)}</div><h1>{u.name_english}</h1><p>{u.city || 'China'}{u.province ? `, ${u.province}` : ''}</p>{lastVerified && <div className="verified-badge">✓ Source record checked · {lastVerified}</div>}</div>
      <a className="rank-pill" href={ranking} target="_blank" rel="noreferrer">ShanghaiRanking ↗</a>
    </section>

    <section className="detail-grid"><div>
      <article className="panel"><h2>About</h2><p>{u.university_description || 'University profile information is being verified and expanded.'}</p><div className="chips">{u.c9 && <span>C9</span>}{u.project_985 && <span>985</span>}{u.project_211 && <span>211</span>}{u.double_first_class && <span>Double First-Class</span>}{!u.c9 && !u.project_985 && !u.project_211 && !u.double_first_class && <span>{u.university_type || 'Classification pending'}</span>}</div><ReportButton university={u.name_english}/></article>

      <article className="panel"><div className="section-head compact-head"><div><h2>Programs</h2><p>Only academic degree/program records are shown here. Navigation pages, scholarships and admission notices are excluded.</p></div></div>{programs.length ? <div className="table-wrap"><table><thead><tr><th>Program</th><th>Degree</th><th>Language</th><th>Duration</th><th>Tuition</th><th>CSCA</th><th>Deadline</th></tr></thead><tbody>{programs.map(p=><tr key={p.id}><td><Link className="program-link" href={`/universities/${u.id}/programs/${p.id}`}><b>{p.program_name}</b></Link>{p.field_of_study && <><br/><small>{p.field_of_study}</small></>}<br/><ReportButton university={u.name_english} program={p.program_name}/></td><td>{p.degree_level || '—'}</td><td>{p.language || (p.english_taught ? 'English' : '—')}</td><td>{p.duration_years ? `${p.duration_years} years` : '—'}</td><td>{p.tuition_fee ? `${p.tuition_fee} ${p.tuition_currency || ''}` : 'To verify'}</td><td>{p.csca_required ? 'Required' : 'Not listed'}</td><td>{p.intakes?.[0]?.deadline ? new Date(p.intakes[0].deadline).toLocaleDateString('en-IN') : '—'}</td></tr>)}</tbody></table></div> : <p>No verified academic programs have been entered yet.</p>}</article>

      <article className="panel"><h2>Scholarships</h2>{u.scholarships.length ? <div className="scholar-grid">{u.scholarships.map(s=><div className="scholar-card" key={s.id}><div className="tag">{s.scholarship_type || 'Scholarship'} · {s.provider || 'Provider varies'}</div><h3>{s.name}</h3><p>{s.description || 'University-linked scholarship. Verify the current call.'}</p><div className="chips small">{s.tuition_coverage && <span>Tuition</span>}{s.accommodation_coverage && <span>Accommodation</span>}{s.stipend_coverage && <span>Stipend</span>}{s.insurance_coverage && <span>Insurance</span>}</div>{s.application_deadline && <small>Deadline: {s.application_deadline}</small>}{(s.application_url || s.official_website) && <p><a href={s.application_url || s.official_website} target="_blank" rel="noreferrer">Scholarship details ↗</a></p>}</div>)}</div> : <p>No scholarship links have been entered yet.</p>}</article>

      <article className="panel"><h2>Campus & facilities</h2>{u.campuses.length ? <div className="campus-list">{u.campuses.map(c=>{
        const facilities = c.facilities || c.facility_list || c.amenities || c.services;
        return <div className="campus-card" key={c.id}><div className="section-head compact-head"><div><h3>{c.name || 'Campus'}</h3><p>{c.city || u.city || 'China'}{c.address ? ` · ${c.address}` : ''}</p></div></div>{c.description && <p>{c.description}</p>}{facilities && <div className="chips small">{String(facilities).split(/[,;|]/).map((item,i)=><span key={`${c.id}-${i}`}>{item.trim()}</span>)}</div>}{c.website && <p><a href={c.website} target="_blank" rel="noreferrer">Campus website ↗</a></p>}</div>})}</div> : <p>Campus information is being collected. We will only display facilities that have a source record rather than inventing them.</p>}</article>

      <article className="panel"><h2>Verification sources</h2>{officialSources.length ? <ul>{officialSources.map(s=><li key={s.id}><a href={s.source_url} target="_blank" rel="noreferrer">{s.source_name || 'Official source'} ↗</a> — {s.verification_status || 'Unverified'}{s.last_checked_at ? ` · checked ${new Date(s.last_checked_at).toLocaleDateString('en-IN')}` : ''}</li>)}</ul> : <p>Official source records are being collected. Critical admissions facts should be verified against the university's official notice.</p>}</article>
    </div>

    <aside>
      <div className="panel"><h3>Official links</h3>{u.official_website && <a className="btn primary full" href={u.official_website} target="_blank" rel="noreferrer">Official website ↗</a>}{u.admissions_website && <a className="btn secondary full" href={u.admissions_website} target="_blank" rel="noreferrer">Admissions ↗</a>}<a className="btn secondary full" href={ranking} target="_blank" rel="noreferrer">ShanghaiRanking profile ↗</a></div>

      <div className="panel"><h3>Ranking</h3>{rankingRows.length ? rankingRows.map(([label,value])=><div className="contact-row" key={label}><b>{label}</b><p>{value}</p></div>) : <><p>Live ranking data is not stored for this university yet.</p><a href={ranking} target="_blank" rel="noreferrer">Open the official ShanghaiRanking profile ↗</a></>}</div>

      <div className="panel"><h3>University contact details</h3>{u.contacts.length ? <div className="contact-list">{u.contacts.map(c=><div className="contact-row" key={c.id}><b>{c.department || c.contact_type || 'University contact'}</b>{c.name && <p>{c.name}</p>}{c.email && <p><a href={`mailto:${c.email}`}>{c.email}</a></p>}{c.phone && <p><a href={`tel:${c.phone}`}>{c.phone}</a></p>}{c.address && <p>{c.address}</p>}{c.office_hours && <p>{c.office_hours}</p>}{c.website && <p><a href={c.website} target="_blank" rel="noreferrer">Department website ↗</a></p>}{c.notes && <p>{c.notes}</p>}</div>)}</div> : <p>Official university contact details are not entered yet.</p>}</div>

      <div className="panel warning"><b>Verification</b><p>Critical fees, deadlines, contacts and eligibility should be confirmed against the university's official notice before applying.</p></div>
    </aside>
    </section></main>;
}

function classification(u){ if(u.c9) return 'C9'; if(u.double_first_class) return 'Double First-Class'; if(u.project_985) return '985'; if(u.project_211) return '211'; return u.university_type || 'Classification pending'; }
function Header(){return <header className="nav"><Link className="brand" href="/">China<span>Uni</span>Tracker</Link><nav><Link href="/universities">Universities</Link><Link href="/scholarships">Scholarships</Link><Link href="/csca">CSCA</Link><Link href="/contact">Contact</Link></nav></header>}
