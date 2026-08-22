import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {createSession,verifyPassword,verifyTotp} from "../../../../lib/admin-auth";

export async function POST(request){
  try{
    const body=await request.json();
    const password=String(body.password||"");
    const totp=String(body.totp||"");
    const hash=process.env.ADMIN_PASSWORD_HASH;
    const secret=process.env.ADMIN_SESSION_SECRET;
    const email=process.env.ADMIN_EMAIL||"admin";
    const totpSecret=process.env.ADMIN_TOTP_SECRET||"";

    if(!hash||!secret) return NextResponse.json({error:"Admin authentication is not configured"},{status:503});
    if(!verifyPassword(password,hash)) return NextResponse.json({error:"Invalid admin credentials"},{status:401});
    if(totpSecret&&!verifyTotp(totp,totpSecret)) return NextResponse.json({error:"Invalid verification code"},{status:401});

    const token=createSession(email);
    cookies().set("cut_admin_session",token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:60*60*8});
    return NextResponse.json({ok:true});
  }catch{
    return NextResponse.json({error:"Unable to sign in"},{status:400});
  }
}
