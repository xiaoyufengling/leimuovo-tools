import type { APIRoute } from "astro";

export const GET: APIRoute = () => new Response(
  "User-agent: *\nAllow: /\nDisallow: /offline/\nDisallow: /control/\nDisallow: /api/control/\nSitemap: https://leimuovo.com/sitemap-index.xml\n",
  { headers: { "Content-Type": "text/plain; charset=utf-8" } },
);
