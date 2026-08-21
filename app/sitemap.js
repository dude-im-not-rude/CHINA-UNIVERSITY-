export default function sitemap(){
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const base = configured || (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
  const routes = ["/","/universities","/scholarships","/csca","/contact","/privacy","/terms","/disclaimer","/sources","/cookies"];
  return routes.map((path) => ({ url: `${base}${path}`, lastModified: new Date("2026-08-21") }));
}
