"use client";

import { useEffect, useState } from "react";

export default function SiteControls(){
  const [dark,setDark]=useState(true);
  useEffect(()=>{
    const saved=localStorage.getItem("chinauni-theme");
    const isDark=saved ? saved==="dark" : true;
    setDark(isDark);
    document.documentElement.classList.toggle("dark-mode",isDark);
    if(!saved) localStorage.setItem("chinauni-theme","dark");
  },[]);
  const toggleTheme=()=>{
    const next=!dark;
    setDark(next);
    document.documentElement.classList.toggle("dark-mode",next);
    localStorage.setItem("chinauni-theme",next?"dark":"light");
  };
  return <div className="site-controls" aria-label="Site controls">
    <button className="theme-toggle" onClick={toggleTheme} aria-label={dark?"Switch to light mode":"Switch to dark mode"} title={dark?"Light mode":"Dark mode"}>{dark?"☀":"☾"}</button>
  </div>;
}
