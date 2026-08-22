"use client";

import {useEffect,useState} from "react";
import AdminDashboard from "../admin/admin-dashboard";
import "../admin/admin.css";

export const dynamic="force-dynamic";

export default function AshuAdmin(){
  const [state,setState]=useState("checking");
  const [password,setPassword]=useState("");
  const [totp,setTotp]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);

  async function checkSession(){
    try{
      const res=await fetch("/api/admin/session",{cache:"no-store"});
      setState(res.ok?"authenticated":"login");
    }catch{setState("login")}
  }

  useEffect(()=>{checkSession()},[]);

  async function login(event){
    event.preventDefault();
    setLoading(true);setError("");
    try{
      const res=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password,totp})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Unable to sign in");
      setPassword("");setTotp("");setState("authenticated");
    }catch(e){setError(e.message||"Unable to sign in")}finally{setLoading(false)}
  }

  if(state==="checking") return <div className="admin-app"><main className="admin-shell"><section className="admin-login-card"><div className="admin-kicker">PRIVATE CONTROL CENTER</div><h1>Checking session…</h1><p>Connecting to the admin system.</p></section></main></div>;

  if(state==="login") return <div className="admin-app"><main className="admin-shell"><section className="admin-login-card"><div className="admin-kicker">PRIVATE CONTROL CENTER</div><h1>Admin access</h1><p>Sign in to open the ChinaUniTracker dashboard.</p>{error&&<div className="admin-error">{error}</div>}<form onSubmit={login}><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required /></label><label>Authenticator code <span className="muted">(if enabled)</span><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,"").slice(0,6))} autoComplete="one-time-code" /></label><button type="submit" disabled={loading}>{loading?"Signing in…":"Sign in"}</button></form><small>Your admin session is stored in an HTTP-only cookie and expires after 8 hours.</small></section></main></div>;

  return <AdminDashboard />;
}
