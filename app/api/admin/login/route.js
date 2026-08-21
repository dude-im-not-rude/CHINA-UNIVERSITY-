import { NextResponse } from "next/server";
import { createSession, verifyPassword, verifyTotp } from "../../../../../lib/admin-auth";

export async function POST(request){
  try{
    const {email,password,code}=await request.json();
    if(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD_HASH||!process.env.ADMIN_TOTP_SECRET||!process.env.ADMIN_SESSION_SECRET){
      return NextResponse.json({error:"Admin security is not configured yet."},{status:503});
    }
    const okEmail=String(email||"").trim().toLowerCase()===process.env.ADMIN_EMAIL.trim().toLowerCase();
    const okPassword=verifyPassword(String(password||""),process.env.ADMIN_PASSWORD_HASH);
    const okTotp=verifyTotp(String(code||""),process.env.ADMIN_TOTP_SECRET);
    if(!okEmail||!okPassword||!okTotp) return NextResponse.json({error:"Invalid admin credentials or authenticator code."},{status:401});
    const response=NextResponse.json({ok:true});
    response.cookies.set("cut_admin_session",createSession(process.env.ADMIN_EMAIL),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:60*60*8});
    return response;
  }catch{return NextResponse.json({error:"Unable to sign in."},{status:400})}
}
