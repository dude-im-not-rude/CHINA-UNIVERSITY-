"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const items=[
  ["/universities","01","Universities"],
  ["/scholarships","02","Scholarships"],
  ["/csca","03","CSCA"],
  ["/sources","04","Data sources"],
  ["/contact","05","Contact"]
];

export default function MobileNav() {
  const [open,setOpen]=useState(false);
  const pathname=usePathname();
  useEffect(()=>{document.body.classList.toggle("menu-open",open);return()=>document.body.classList.remove("menu-open")},[open]);
  const close=()=>setOpen(false);
  return <>
    <button className={`menu-fab ${open?"is-open":""}`} onClick={()=>setOpen(v=>!v)} aria-label={open?"Close navigation":"Open navigation"} aria-expanded={open}><span></span><span></span><span></span></button>
    {open&&<div className="mobile-menu-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><aside className="mobile-menu" aria-label="Main navigation">
      <div className="mobile-menu-head"><div className="eyebrow">EXPLORE</div><button className="mobile-menu-close" onClick={close} aria-label="Close navigation">×</button></div>
      <nav>
        {items.map(([href,num,label])=>{
          const active=pathname===href||pathname?.startsWith(`${href}/`);
          return <Link key={href} href={href} className={active?"active":""} aria-current={active?"page":undefined} onClick={close}><span>{num}</span>{label}</Link>;
        })}
      </nav>
      <div className="mobile-menu-note">ChinaUniTracker · 2027 intake</div>
    </aside></div>}
  </>;
}
