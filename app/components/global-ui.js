import CookieBanner from "./cookie-banner";
import ContactWidget from "./contact-widget";
import SiteFooter from "./site-footer";
import MobileNav from "./mobile-nav";
import SiteControls from "./site-controls";

export default function GlobalUI() {
  return <><MobileNav /><SiteControls /><SiteFooter /><ContactWidget /><CookieBanner /></>;
}
