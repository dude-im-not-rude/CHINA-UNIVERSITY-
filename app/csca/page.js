import Link from "next/link";

const sessions = [
  {
    label: "Latest confirmed session",
    date: "27 Jun 2026",
    registration: "1 Jun 2026, 14:00 – 7 Jun 2026, 14:00",
    status: "Completed",
    note: "Registration times are Beijing time (UTC+8).",
  },
  {
    label: "Next scheduled session",
    date: "December 2026",
    registration: "TBA",
    status: "Upcoming",
    note: "The official site has not published the exact December date or registration window yet.",
  },
];

const schedule = [
  ["January 2026", "Scheduled window", "Exact date not shown in the current official schedule"],
  ["March 2026", "15 Mar 2026", "Completed"],
  ["April 2026", "25 Apr 2026", "Completed"],
  ["June 2026", "27 Jun 2026", "Completed"],
  ["December 2026", "TBA", "Exact date and registration window not published yet"],
];

const subjects = [
  ["Mathematics", "Chinese / English", "60 min", "48 questions", "0–100"],
  ["Physics", "Chinese / English", "60 min", "48 questions", "0–100"],
  ["Chemistry", "Chinese / English", "60 min", "48 questions", "0–100"],
  ["Professional Chinese — Humanities", "Chinese", "90 min", "80 questions", "0–100"],
  ["Professional Chinese — STEM", "Chinese", "90 min", "80 questions", "0–100"],
];

const fees = [
  ["1 subject", "CNY 450", "Single-subject registration"],
  ["2 or more subjects", "CNY 700", "Combined registration fee"],
];

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main>
      <Header />
      <section className="page-head reveal">
        <div className="eyebrow">CSCA HUB</div>
        <h1>CSCA exam guide</h1>
        <p>
          Keep the schedule, registration windows, subjects, fees, formats and
          official registration steps in one place — with TBA shown when CSCA
          has not published a date yet.
        </p>
      </section>

      <section className="section">
        <div className="notice csca-source-note">
          <b>Official-source status:</b> CSCA says the exam is held five times
          a year — January, March, April, June and December. The exact December
          2026 date and registration window are still TBA, so we do not invent
          them.
        </div>

        <div className="csca-grid csca-section-grid">
          <div className="panel">
            <div className="section-head compact-head">
              <div>
                <h2>Exam timeline</h2>
                <p>Latest confirmed result + next known session.</p>
              </div>
            </div>
            <div className="csca-timeline">
              {sessions.map((session) => (
                <article className="csca-timeline-item" key={session.label}>
                  <div className="csca-timeline-status">{session.status}</div>
                  <div>
                    <h3>{session.label}</h3>
                    <strong>{session.date}</strong>
                    <p><b>Registration:</b> {session.registration}</p>
                    <small>{session.note}</small>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>2026 schedule</h2>
            <div className="csca-schedule-list">
              {schedule.map(([period, date, state]) => (
                <div className="csca-schedule-row" key={period}>
                  <div><b>{period}</b><span>{date}</span></div>
                  <small>{state}</small>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="csca-grid csca-section-grid">
          <div className="panel">
            <h2>Exam fees</h2>
            <p>Official CSCA fee schedule currently lists these registration charges.</p>
            <div className="csca-fee-grid">
              {fees.map(([label, amount, note]) => (
                <div className="csca-fee-card" key={label}>
                  <span>{label}</span>
                  <strong>{amount}</strong>
                  <small>{note}</small>
                </div>
              ))}
            </div>
            <div className="csca-mini-note">
              Fees are charged in CNY. Check the official registration page
              before payment because the platform may update its fee rules.
            </div>
          </div>

          <div className="panel">
            <h2>Registration setup</h2>
            <div className="csca-steps">
              <div><b>01</b><span>Prepare a valid passport, required photo and a supported payment method.</span></div>
              <div><b>02</b><span>Check the exam date, format and test centre availability for your region.</span></div>
              <div><b>03</b><span>Create your personal CSCA account and complete the registration form.</span></div>
              <div><b>04</b><span>Select subjects, reserve the session and complete payment.</span></div>
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Subjects & format</h2>
          <div className="csca-subject-grid">
            {subjects.map(([name, language, duration, questions, score]) => (
              <article className="csca-subject-card" key={name}>
                <h3>{name}</h3>
                <span>{language}</span>
                <div><b>{duration}</b><b>{questions}</b><b>{score}</b></div>
              </article>
            ))}
          </div>
          <div className="csca-format-strip">
            <b>Formats:</b> home-based online · centralized computer-based · paper-based
            <span>Results: computer/home tests within 7 working days; paper tests within 14 working days.</span>
          </div>
        </div>

        <div className="csca-grid csca-section-grid">
          <div className="panel">
            <h2>What to verify</h2>
            <ul>
              <li>Your university/program's required CSCA subjects</li>
              <li>The current exam date and registration window</li>
              <li>Available exam format and test location</li>
              <li>Result release timing</li>
              <li>Whether your target program is English-taught or Chinese-taught</li>
              <li>Any university-specific score requirement</li>
            </ul>
          </div>

          <div className="panel">
            <h2>Official CSCA</h2>
            <p>
              Use the official CSCA site for the final registration date,
              payment, account creation and personal exam booking.
            </p>
            <div className="filter-options">
              <a className="btn primary" href="https://csca.cn/" target="_blank" rel="noreferrer">Official CSCA website ↗</a>
              <a className="btn secondary" href="https://csca.cn/registration/process" target="_blank" rel="noreferrer">Registration process ↗</a>
              <a className="btn secondary" href="https://csca.cn/about/examintro" target="_blank" rel="noreferrer">Exam, subjects & fees ↗</a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Header() {
  return <header className="nav"><Link className="brand" href="/">China<span>Uni</span>Tracker</Link><nav><Link href="/universities">Universities</Link><Link href="/scholarships">Scholarships</Link><Link href="/csca">CSCA</Link><Link href="/contact">Contact</Link></nav></header>;
}
