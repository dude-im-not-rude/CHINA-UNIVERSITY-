"use client";

import { usePathname } from "next/navigation";
import CookieBanner from "./cookie-banner";
import ContactWidget from "./contact-widget";
import SiteFooter from "./site-footer";
import MobileNav from "./mobile-nav";
import SiteControls from "./site-controls";

export default function GlobalUI() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/ashu")) return null;
  return <><MobileNav /><SiteControls /><SiteFooter /><ContactWidget /><CookieBanner /></>;
}
