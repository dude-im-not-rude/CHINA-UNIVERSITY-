import {NextResponse} from "next/server";
import {sql} from "@neondatabase/serverless";
import {cookies} from "next/headers";
import {readSession} from "../../../../lib/admin-auth";

const STATUSES=new Set(["needs_review","in_progress","verified","published"]);
const PRIORITIES=new Set(["low","normal","high"]);
function getAdmin(){return readSession(cookies().get("cut_admin_session")?.value)}

export async function GET(){
 const admin=getAdmin(); if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});
 try{const db=sql(process.env.DATABASE_URL);const rows=await db`SELECT r.id,r.status,r.priority,r.reason,r.admin_notes,r.reviewed_by,r.reviewed_at,r.published_at,r.created_at,u.id AS university_id,u.name_english AS university_name,p.id AS program_id,p.program_name,p.degree_level,p.language,p.official_program_url,p.application_url FROM admin_reviews r LEFT JOIN universities u ON u.id=r.university_id LEFT JOIN programs p ON p.id=r.program_id ORDER BY CASE r.status WHEN 'needs_review' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'verified' THEN 2 ELSE 3 END,CASE r.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,r.created_at DESC`;return NextResponse.json({reviews:rows})}catch{return NextResponse.json({error:"Unable to load review queue"},{status:500})}
}

export async function PATCH(request){
 const admin=getAdmin(); if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});
 try{const body=await request.json();const id=String(body.id||"");const status=String(body.status||"needs_review");const priority=String(body.priority||"normal");if(!id||!STATUSES.has(status)||!PRIORITIES.has(priority))return NextResponse.json({error:"Invalid review update"},{status:400});const db=sql(process.env.DATABASE_URL);const now=new Date().toISOString();const rows=await db`UPDATE admin_reviews SET status=${status},priority=${priority},reason=${body.reason??null},admin_notes=${body.admin_notes??null},reviewed_by=${status==='verified'||status==='published'?admin.email:null},reviewed_at=${status==='verified'||status==='published'?now:null},published_at=${status==='published'?now:null},updated_at=now() WHERE id=${id} RETURNING id,status,priority,reviewed_at,published_at`;if(!rows.length)return NextResponse.json({error:"Review not found"},{status:404});await db`INSERT INTO admin_audit_logs (admin_email,action,entity_type,entity_id,details) VALUES (${admin.email},${`review_${status}`},'admin_review',${id},${JSON.stringify({priority,reason:body.reason??null})})`;return NextResponse.json({ok:true,review:rows[0]})}catch{return NextResponse.json({error:"Unable to update review"},{status:500})}
}
