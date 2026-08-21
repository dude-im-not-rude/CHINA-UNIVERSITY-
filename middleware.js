import {NextResponse} from "next/server";
import crypto from "node:crypto";

function b64(s){return Buffer.from(s).toString("base64url")}
function unb64(s){return Buffer.from(s,"base64url").toString()}
function valid(token){
  try{
    const [payload,sig]=String(token||"").split(".");
    if(!payload||!sig||!process.env.ADMIN_SESSION_SECRET)return false;
    const expected=b64(crypto.createHmac("sha256",process.env.ADMIN_SESSION_SECRET).update(unb64(payload)).digest());
    const a=Buffer.from(sig),b=Buffer.from(expected);
    if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return false;
    const data=JSON.parse(unb64(payload));
    return data?.role==="admin"&&Number(data.exp)>Date.now();
  }catch{return false}
}

export function middleware(request){
 const path=request.nextUrl.pathname;
 if(path.startsWith("/admin/dashboard")||path.startsWith("/admin/reviews")||path.startsWith("/api/admin/dashboard")||path.startsWith("/api/admin/reviews")){
   if(!valid(request.cookies.get("cut_admin_session")?.value)){
     if(path.startsWith("/api/"))return NextResponse.json({error:"Unauthorized"},{status:401});
     return NextResponse.redirect(new URL("/admin",request.url));
   }
 }
 return NextResponse.next();
}

export const config={matcher:["/admin/dashboard/:path*","/admin/reviews/:path*","/api/admin/dashboard/:path*","/api/admin/reviews/:path*"]};
