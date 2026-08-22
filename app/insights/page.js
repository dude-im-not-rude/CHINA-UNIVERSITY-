import Link from 'next/link';

const guides = [
  ['Study in China Guide','A practical roadmap from choosing a university to arrival in China.'],
  ['Student Guide','Key things to know about applications, documents, budgeting and campus life.'],
  ['First Week in China','A simple arrival checklist for registration, accommodation, SIM, banking and campus setup.'],
  ['Scholarship Guide','How to understand CSC, university and other scholarship routes.'],
  ['Admission Guide','A clear checklist for programs, requirements, deadlines and applications.'],
  ['CSCA Guide','Understand the CSCA, timelines, subjects and preparation workflow.'],
  ['Pre-departure Checklist','Passport, documents, health forms, visa preparation and travel planning.'],
  ['Arrival & Campus Setup','What to handle during the first days after reaching your university.'],
];

export default function Insights(){
  return <main className="section"><div className="eyebrow">INSIGHTS & GUIDES</div><h1>Useful China study information, in one place.</h1><p className="lede">Practical, original guides for applicants — built around the questions students actually face.</p><div className="feature-grid">{guides.map(([title,desc],i)=><article className="feature" key={title}><span>{String(i+1).padStart(2,'0')}</span><h2>{title}</h2><p>{desc}</p><Link href="/contact">Open guide →</Link></article>)}</div></main>
}
