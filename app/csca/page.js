import Link from "next/link";

const sessions = [
  { label: "Latest completed session", date: "27 Jun 2026", registration: "1 Jun 2026, 14:00 – 7 Jun 2026, 14:00 (Beijing time)", status: "Completed" },
  { label: "Next scheduled session", date: "December 2026", registration: "Not announced yet", status: "Upcoming" },
];

const subjects = [
  ["Mathematics", "Chinese / English · 60 min · 48 questions · 0–100"],
  ["Physics", "Chinese / English · 60 min · 48 questions · 0–100"],
  ["Chemistry", "Chinese / English · 60 min · 48 questions · 0–100"],
  ["Professional Chinese — Humanities", "Chinese · 90 min · 80 questions · 0–100"],
  ["Professional Chinese — STEM", "Chinese · 90 min · 80 questions · 0–100"],
];

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main>
      <Header />
      <section className="page-head">
        <div className="eyebrow">CSCA HUB</div>
        <h1>CSCA exam guide</h1>
        <p>Exam schedule, registration windows, subjects, results and official links — without making you hunt through three different pages.</p>
      </section>
      <section className="section">
        <div className="notice">
          <b>Official-source status:</b> CSCA confirms that exams are held in January, March, April, June and December. The December 2026 date and registration window have not been published on the official schedule yet, so we show them as <b>TBA</b> instead of guessing.
        </div>
        <div className="csca-grid" style={{ marginTop: 18 }}>
          <div className="panel">
            <h2>Exam timeline</h2>
            <div className="timeline-stack">
              {sessions.map((session) => (
                <div className="timeline" key={session.label}>
                  <div><span className="tag">{session.status}</span><h3>{session.label}</h3><b>{session.date}</b><span>Registration: {session.registration}</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <h2>Important dates</h2>
            <ul>
              <li><b>Previous exam:</b> 27 June 2026</li>
              <li><b>Previous registration:</b> 1–7 June 2026</li>
              <li><b>Next session:</b> December 2026</li>
              <li><b>Next registration deadline:</b> TBA</li>
              <li><b>Results:</b> normally within 7 working days for home-based and on-site computer tests; paper tests may take up to 14 working days.</li>
            </ul>
          </div>
        </div>
        <div className="csca-grid" style={{ marginTop: 18 }}>
          <div className="panel">
            <h2>Subjects & format</h2>
            {subjects.map(([name, note]) => <div className="timeline" key={name}><div><b>{name}</b><span>{note}</span></div></div>)}
          </div>
          <div className="panel">
            <h2>What to verify</h2>
            <ul>
              <li>Your university/program's required CSCA subjects</li>
              <li>Current exam date and registration window</li>
              <li>Exam format and available test location</li>
              <li>Result release timing</li>
              <li>Whether your target program is English-taught or Chinese-taught</li>
            </ul>
            <div className="chips small"><span>Official schedule</span><span>Updated from CSCA</span></div>
          </div>
        </div>
        <div className="panel" style={{ marginTop: 18 }}>
          <h2>Official CSCA</h2>
          <p>Always use the official CSCA site for the final registration date, exam notice and your personal registration.</p>
          <div className="filter-options">
            <a className="btn primary" href="https://csca.cn/" target="_blank" rel="noreferrer">Official CSCA website ↗</a>
            <a className="btn secondary" href="https://csca.cn/registration/process" target="_blank" rel="noreferrer">Registration process ↗</a>
            <a className="btn secondary" href="https://csca.cn/about/examintro" target="_blank" rel="noreferrer">Exam & subjects ↗</a>
          </div>
        </div>
      </section>
    </main>
  );
}

function Header() {
  return <header className="nav"><Link className="brand" href="/">China<span>Uni</span>Tracker</Link><nav><Link href="/universities">Universities</Link><Link href="/scholarships">Scholarships</Link><Link href="/csca">CSCA</Link><Link href="/contact">Contact</Link></nav></header>;
}
