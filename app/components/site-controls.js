"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "chinauni-theme-v2";

export default function SiteControls(){
  const [dark,setDark]=useState(true);
  const [progress,setProgress]=useState(0);

  useEffect(()=>{
    const saved=localStorage.getItem(THEME_KEY);
    const isDark=saved ? saved==="dark" : true;
    setDark(isDark);
    document.documentElement.classList.toggle("dark-mode",isDark);
    if(!saved) localStorage.setItem(THEME_KEY,"dark");

    const onScroll=()=>{
      const max=document.documentElement.scrollHeight-window.innerHeight;
      setProgress(max>0 ? Math.min(100,Math.max(0,(window.scrollY/max)*100)) : 0);
    };
    onScroll();
    window.addEventListener("scroll",onScroll,{passive:true});
    window.addEventListener("resize",onScroll);
    return()=>{window.removeEventListener("scroll",onScroll);window.removeEventListener("resize",onScroll)};
  },[]);

  const toggleTheme=()=>{
    const next=!dark;
    setDark(next);
    document.documentElement.classList.toggle("dark-mode",next);
    localStorage.setItem(THEME_KEY,next?"dark":"light");
  };

  return <>
    <div className="reading-progress" aria-hidden="true"><span style={{width:`${progress}%`}} /></div>
    <div className="site-controls" aria-label="Site controls">
      <button className="theme-toggle" onClick={toggleTheme} aria-label={dark?"Switch to light mode":"Switch to dark mode"} title={dark?"Light mode":"Dark mode"}>{dark?"☀":"☾"}</button>
    </div>
  </>;
}
