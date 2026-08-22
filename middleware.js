import {NextResponse} from "next/server";

// The private admin area is intentionally exposed at /ashu without
// login/session/TOTP checks, per the current project configuration.
export function middleware(){
  return NextResponse.next();
}

export const config={matcher:["/admin/:path*","/api/admin/:path*"]};
