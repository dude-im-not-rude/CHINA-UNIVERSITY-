import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "../../../../lib/admin-auth";

export async function POST(request){
  try{
    const {email,password}=await request.json();
    if(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD_HASH||!process.env.ADMIN_SESSION_SECRET){
      return NextResponse.json({error:"Admin security is not configured yet."},{status:503});
    }
    const okEmail=String(email||"").trim().toLowerCase()===process.env.ADMIN_EMAIL.trim().toLowerCase();
    const okPassword=verifyPassword(String(password||""),process.env.ADMIN_PASSWORD_HASH);
    if(!okEmail||!okPassword) return NextResponse.json({error:"Invalid admin credentials."},{status:401});
    const response=NextResponse.json({ok:true});
    response.cookies.set("cut_admin_session",createSession(process.env.ADMIN_EMAIL),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:60*60*8});
    return response;
  }catch{return NextResponse.json({error:"Unable to sign in."},{status:400})}
}
