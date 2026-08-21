"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    return () => document.body.classList.remove("menu-open");
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button className={`menu-fab ${open ? "is-open" : ""}`} onClick={() => setOpen(v => !v)} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open}>
        <span></span><span></span><span></span>
      </button>
      {open && (
        <div className="mobile-menu-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <aside className="mobile-menu" aria-label="Main navigation">
            <div className="mobile-menu-head"><div className="eyebrow">EXPLORE</div><button className="mobile-menu-close" onClick={close} aria-label="Close navigation">×</button></div>
            <nav>
              <Link href="/universities" onClick={close}><span>01</span>Universities</Link>
              <Link href="/scholarships" onClick={close}><span>02</span>Scholarships</Link>
              <Link href="/csca" onClick={close}><span>03</span>CSCA</Link>
              <Link href="/sources" onClick={close}><span>04</span>Data sources</Link>
              <Link href="/contact" onClick={close}><span>05</span>Contact</Link>
            </nav>
            <div className="mobile-menu-note">ChinaUniTracker · 2027 intake</div>
          </aside>
        </div>
      )}
    </>
  );
}
