import {NextResponse} from "next/server";
export async function POST(){const r=NextResponse.json({ok:true});r.cookies.set("cut_admin_session","",{httpOnly:true,secure:true,sameSite:"lax",path:"/",expires:new Date(0)});return r}
