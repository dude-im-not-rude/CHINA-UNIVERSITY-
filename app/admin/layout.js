"use client";

import { useEffect, useState } from "react";
import "./admin.css";

export default function AdminLayout({children}){
  const [light,setLight]=useState(false);
  useEffect(()=>{
    const saved=localStorage.getItem("chinauni-admin-theme");
    const isLight=saved==="light";
    setLight(isLight);
  },[]);
  const toggle=()=>{
    const next=!light;
    setLight(next);
    localStorage.setItem("chinauni-admin-theme",next?"light":"dark");
  };
  return <div className={`admin-app ${light?"admin-light":""}`}>
    <button className="admin-theme-toggle" onClick={toggle} aria-label={light?"Switch to dark mode":"Switch to light mode"} title={light?"Dark mode":"Light mode"}>{light?"☾":"☀"}</button>
    <div className="admin-brand-mark"><span>CU</span><div><b>CONTROL</b><small>ChinaUniTracker</small></div></div>
    {children}
  </div>;
}
