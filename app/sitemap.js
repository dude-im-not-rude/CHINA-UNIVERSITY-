export default function sitemap(){
  const base = "https://china-university-tracker-12.vercel.app";
  const routes = ["/","/universities","/scholarships","/csca","/contact","/privacy","/terms","/disclaimer","/sources","/cookies"];
  return routes.map((path) => ({ url: `${base}${path}`, lastModified: new Date("2026-08-21") }));
}
