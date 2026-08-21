import CookieBanner from "./cookie-banner";
import ContactWidget from "./contact-widget";
import SiteFooter from "./site-footer";
import MobileNav from "./mobile-nav";

export default function GlobalUI() {
  return <><MobileNav /><SiteFooter /><ContactWidget /><CookieBanner /></>;
}
