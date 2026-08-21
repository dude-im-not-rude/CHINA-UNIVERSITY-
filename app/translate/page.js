import Link from 'next/link';

export const metadata = { title: 'Translation Desk · ChinaUniTracker' };

const langs = [
  ['English', 'en'], ['中文', 'zh-CN'], ['हिन्दी', 'hi'], ['Italiano', 'it'],
  ['Deutsch', 'de'], ['Русский', 'ru'], ['日本語', 'ja']
];

export default function Page() {
  return <main>
    <Header />
    <section className="page-head">
      <div className="eyebrow">TRANSLATION DESK</div>
      <h1>Translate Chinese university pages without leaving the tracker.</h1>
      <p>Paste an official university or admissions URL, choose the language you want, and open a translated version. You can also translate short Chinese notices or application text.</p>
    </section>
    <section className="section translation-grid">
      <article className="panel">
        <div className="eyebrow">WEB PAGE</div>
        <h2>Translate a university page</h2>
        <form className="translation-form" action="https://translate.google.com/translate" method="get" target="_blank">
          <label>Official page URL<input name="u" type="url" placeholder="https://..." required /></label>
          <input type="hidden" name="sl" value="auto" />
          <label>Translate to<select name="tl" defaultValue="en">{langs.map(([name, code]) => <option key={code} value={code}>{name}</option>)}</select></label>
          <button className="btn primary" type="submit">Translate page ↗</button>
        </form>
      </article>
      <article className="panel">
        <div className="eyebrow">TEXT</div>
        <h2>Translate text</h2>
        <form className="translation-form" action="https://translate.google.com/" method="get" target="_blank">
          <label>Text to translate<textarea name="text" rows="7" placeholder="Paste a Chinese admission notice, requirement or programme name..." required /></label>
          <input type="hidden" name="sl" value="auto" />
          <label>Translate to<select name="tl" defaultValue="en">{langs.map(([name, code]) => <option key={code} value={code}>{name}</option>)}</select></label>
          <button className="btn secondary" type="submit">Translate text ↗</button>
        </form>
      </article>
    </section>
    <section className="section muted">
      <div className="section-head"><div><div className="eyebrow">USEFUL FOR CHINA APPLICATIONS</div><h2>Common terms</h2></div></div>
      <div className="feature-grid">
        <div className="feature"><span>01</span><h3>国际学生</h3><p>International student</p></div>
        <div className="feature"><span>02</span><h3>本科</h3><p>Bachelor's / undergraduate</p></div>
        <div className="feature"><span>03</span><h3>硕士</h3><p>Master's / postgraduate</p></div>
        <div className="feature"><span>04</span><h3>申请截止日期</h3><p>Application deadline</p></div>
      </div>
    </section>
  </main>;
}

function Header(){return <header className="nav"><Link className="brand" href="/">China<span>Uni</span>Tracker</Link><nav><Link href="/universities">Universities</Link><Link href="/scholarships">Scholarships</Link><Link href="/csca">CSCA</Link><Link href="/translate">Translate</Link><Link href="/contact">Contact</Link></nav></header>}
