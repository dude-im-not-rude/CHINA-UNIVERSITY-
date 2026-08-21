import {NextResponse} from "next/server";
import {sql} from "@neondatabase/serverless";
import {cookies} from "next/headers";
import {readSession} from "../../../../../lib/admin-auth";

function getAdmin(){return readSession(cookies().get("cut_admin_session")?.value)}

export async function GET(){
 const admin=getAdmin(); if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});
 try{const db=sql(process.env.DATABASE_URL);const rows=await db`SELECT r.id,r.status,r.priority,r.reason,r.admin_notes,r.reviewed_by,r.reviewed_at,r.created_at,u.id AS university_id,u.name_english AS university_name,p.id AS program_id,p.program_name,p.degree_level,p.language,p.official_program_url,p.application_url FROM admin_reviews r LEFT JOIN universities u ON u.id=r.university_id LEFT JOIN programs p ON p.id=r.program_id WHERE r.status IN ('needs_review','in_progress') ORDER BY CASE r.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,r.created_at DESC`;return NextResponse.json({reviews:rows})}catch{return NextResponse.json({error:"Unable to load review queue"},{status:500})}
}

export async function PATCH(request){
 const admin=getAdmin(); if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});
 try{const body=await request.json();const {id,status,priority,reason,admin_notes}=body;if(!id)return NextResponse.json({error:"Review id required"},{status:400});const db=sql(process.env.DATABASE_URL);const rows=await db`UPDATE admin_reviews SET status=${status||'needs_review'},priority=${priority||'normal'},reason=${reason??null},admin_notes=${admin_notes??null},reviewed_by=${admin.email},reviewed_at=${status==='verified'||status==='published'?new Date().toISOString():null},published_at=${status==='published'?new Date().toISOString():null},updated_at=now() WHERE id=${id} RETURNING id,status`;await db`INSERT INTO admin_audit_logs (admin_email,action,entity_type,entity_id,details) VALUES (${admin.email},${`review_${status||'updated'}`},'admin_review',${id},${JSON.stringify({priority,reason})})`;return NextResponse.json({ok:true,review:rows[0]})}catch{return NextResponse.json({error:"Unable to update review"},{status:500})}
}
