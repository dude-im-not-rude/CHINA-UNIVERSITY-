"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function SiteControls(){
  const [dark,setDark]=useState(false);
  useEffect(()=>{
    const saved=localStorage.getItem("chinauni-theme");
    const isDark=saved==="dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark-mode",isDark);
  },[]);
  const toggleTheme=()=>{
    const next=!dark;
    setDark(next);
    document.documentElement.classList.toggle("dark-mode",next);
    localStorage.setItem("chinauni-theme",next?"dark":"light");
  };
  return <div className="site-controls" aria-label="Site controls">
    <button className="theme-toggle" onClick={toggleTheme} aria-label={dark?"Switch to light mode":"Switch to dark mode"} title={dark?"Light mode":"Dark mode"}>{dark?"☀":"☾"}</button>
    <Link className="language-control" href="/translate" aria-label="Open translation page" title="Translation">EN · 文</Link>
  </div>;
}
