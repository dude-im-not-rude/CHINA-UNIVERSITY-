import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {readSession} from "../../../../lib/admin-auth";

export async function GET(){
  const session=readSession(cookies().get("cut_admin_session")?.value);
  if(!session) return NextResponse.json({authenticated:false},{status:401});
  return NextResponse.json({authenticated:true,email:session.email||"admin"});
}
