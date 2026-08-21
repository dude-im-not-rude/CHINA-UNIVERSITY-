"use client";
import {useEffect,useState} from "react";
import "./admin.css";

const baseCards=[
 ["Universities found","universities","Discovery"],["Official sources","sources","Monitoring"],["Pages/events tracked","events","Crawler"],["Programs in database","programs","Database"],["Healthy sources","healthySources","Health"],["Failed sources","failedSources","Errors"],["Needs admin review","needsReview","Review"],["Published reviews","published","Publishing"]
];

export default function AdminDashboard({email}){
 const [data,setData]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 async function load(){setLoading(true);try{const r=await fetch("/api/admin/dashboard",{cache:"no-store"});const j=await r.json();if(!r.ok)throw Error(j.error);setData(j)}catch(e){setError(e.message||"Unable to load dashboard")}finally{setLoading(false)}}
 useEffect(()=>{load();const t=setInterval(load,60000);return()=>clearInterval(t)},[]);
 return <main className="admin-dashboard"><header className="admin-head"><div><div className="admin-kicker">PRIVATE CONTROL CENTER</div><h1>ChinaUniTracker</h1><p>Signed in as {email}</p></div><div className="admin-actions"><button onClick={load} disabled={loading}>{loading?"Refreshing…":"Refresh"}</button><a href="/">Open public site ↗</a></div></header>
 {error&&<div className="admin-error">{error}</div>}
 <section className="admin-cards">{baseCards.map(([label,key,group])=><article key={key}><span>{group}</span><strong>{data?data.metrics[key]:"—"}</strong><h2>{label}</h2></article>)}</section>
 <section className="admin-panel"><div><span className="admin-kicker">PIPELINE</span><h2>Monitoring & import health</h2></div><div className="pipeline"><div><b>Official sources</b><span>{data?`${data.metrics.healthySources} healthy · ${data.metrics.failedSources} failed`:"Loading…"}</span></div><div><b>Program database</b><span>{data?`${data.metrics.programs} program records currently stored`:"Loading…"}</span></div><div><b>Admin review</b><span>{data?`${data.metrics.needsReview} records waiting for review`:"Loading…"}</span></div><div><b>Last source check</b><span>{data?.metrics.lastChecked?new Date(data.metrics.lastChecked).toLocaleString():"No check recorded"}</span></div></div></section>
 <section className="admin-panel"><span className="admin-kicker">REVIEW QUEUE</span><h2>Needs Admin Review</h2><p className="muted">The review editor will let you inspect the source, change fields, save a draft, verify a record and publish it to the public site.</p><div className="review-actions"><a href="/admin/reviews">Open review queue →</a></div></section>
 <section className="admin-panel"><span className="admin-kicker">AUDIT</span><h2>Recent admin activity</h2>{data?.activity?.length?<div className="activity-list">{data.activity.map(x=><div key={x.id}><b>{x.action}</b><span>{x.entity_type||"system"} · {new Date(x.created_at).toLocaleString()}</span></div>)}</div>:<p className="muted">No admin activity recorded yet.</p>}</section>
 </main>
}
