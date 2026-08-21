import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div>
          <b>ChinaUniTracker</b>
          <p>Independent discovery platform for studying in China.</p>
          <small>Last updated: 21 August 2026</small>
        </div>
        <div className="footer-columns">
          <div><strong>Explore</strong><Link href="/universities">Universities</Link><Link href="/scholarships">Scholarships</Link><Link href="/csca">CSCA</Link><Link href="/translate">Translation Desk</Link></div>
          <div><strong>Information</strong><Link href="/sources">Data Sources</Link><Link href="/sitemap.xml">Sitemap</Link><Link href="/disclaimer">Disclaimer</Link></div>
          <div><strong>Legal</strong><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms & Conditions</Link><Link href="/cookies">Cookie Notice</Link></div>
          <div><strong>Contact</strong><a href="mailto:dud91260@gmail.com">dud91260@gmail.com</a><span>Mon–Sat · 09:00–18:00 IST</span></div>
        </div>
      </div>
      <div className="footer-bottom"><span>© 2026 ChinaUniTracker</span><span>University information should be verified with the official source before applying.</span></div>
    </footer>
  );
}
