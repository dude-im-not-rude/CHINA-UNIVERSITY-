import {NextResponse} from "next/server";

const enc=new TextEncoder();
function b64(bytes){return Buffer.from(bytes).toString("base64url")}
function unb64(s){return Buffer.from(s,"base64url").toString()}
async function signature(payload,secret){
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return b64(await crypto.subtle.sign("HMAC",key,enc.encode(payload)));
}
async function valid(token){
 try{
  const [payload,sig]=String(token||"").split(".");
  if(!payload||!sig||!process.env.ADMIN_SESSION_SECRET)return false;
  const expected=await signature(unb64(payload),process.env.ADMIN_SESSION_SECRET);
  if(sig!==expected)return false;
  const data=JSON.parse(unb64(payload));
  return data?.role==="admin"&&Number(data.exp)>Date.now();
 }catch{return false}
}

export async function middleware(request){
 const path=request.nextUrl.pathname;
 if(path.startsWith("/admin/dashboard")||path.startsWith("/admin/reviews")||path.startsWith("/api/admin/dashboard")||path.startsWith("/api/admin/reviews")){
   if(!await valid(request.cookies.get("cut_admin_session")?.value)){
     if(path.startsWith("/api/"))return NextResponse.json({error:"Unauthorized"},{status:401});
     return NextResponse.redirect(new URL("/admin",request.url));
   }
 }
 return NextResponse.next();
}

export const config={matcher:["/admin/dashboard/:path*","/admin/reviews/:path*","/api/admin/dashboard/:path*","/api/admin/reviews/:path*"]};
