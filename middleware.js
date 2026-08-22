import {NextResponse} from "next/server";

const enc=new TextEncoder();
const dec=new TextDecoder();

function base64UrlToBytes(value){
 const base64=value.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-value.length%4)%4);
 const binary=atob(base64);
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
}

function decodePayload(value){
 return dec.decode(base64UrlToBytes(value));
}

async function signatureValid(payload,signature,secret){
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 return crypto.subtle.verify("HMAC",key,base64UrlToBytes(signature),enc.encode(payload));
}

async function valid(token){
 try{
  const [payload,sig]=String(token||"").split(".");
  if(!payload||!sig||!process.env.ADMIN_SESSION_SECRET)return false;
  if(!await signatureValid(payload,sig,process.env.ADMIN_SESSION_SECRET))return false;
  const data=JSON.parse(decodePayload(payload));
  return data?.role==="admin"&&Number(data.exp)>Date.now();
 }catch{return false}
}

export async function middleware(request){
 const path=request.nextUrl.pathname;
 const protectedPage=path.startsWith("/admin/dashboard")||path.startsWith("/admin/reviews")||path.startsWith("/ashu/dashboard");
 const protectedApi=path.startsWith("/api/admin/dashboard")||path.startsWith("/api/admin/reviews")||path.startsWith("/api/admin/universities");
 if(protectedPage||protectedApi){
   if(!await valid(request.cookies.get("cut_admin_session")?.value)){
     if(protectedApi)return NextResponse.json({error:"Unauthorized"},{status:401});
     return NextResponse.redirect(new URL("/ashu",request.url));
   }
 }
 return NextResponse.next();
}

export const config={matcher:["/admin/dashboard/:path*","/admin/reviews/:path*","/ashu/dashboard/:path*","/api/admin/dashboard/:path*","/api/admin/reviews/:path*","/api/admin/universities/:path*"]};
