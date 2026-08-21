"use client";
import {useState} from "react";
import "./admin.css";

export default function AdminLogin(){
 const [form,setForm]=useState({email:"",password:"",code:""}); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 async function submit(e){e.preventDefault();setBusy(true);setError("");const r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});const j=await r.json();if(r.ok) location.href="/admin/dashboard";else setError(j.error||"Login failed");setBusy(false)}
 return <main className="admin-shell"><section className="admin-login-card"><div className="admin-kicker">PRIVATE CONTROL CENTER</div><h1>ChinaUniTracker Admin</h1><p>Sign in with your admin account and authenticator code.</p><form onSubmit={submit}><label>Admin email<input type="email" autoComplete="username" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label><label>Password<input type="password" autoComplete="current-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></label><label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.code} onChange={e=>setForm({...form,code:e.target.value.replace(/\D/g,"")})} placeholder="6-digit code" required/></label>{error&&<div className="admin-error">{error}</div>}<button disabled={busy}>{busy?"Checking…":"Sign in"}</button></form><small>Your password and authenticator secret never need to be sent to ChatGPT.</small></section></main>
}
