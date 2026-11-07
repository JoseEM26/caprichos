# SEO: solo caprichos.pe se indexa

- El nginx del contenedor web decide por el `Host` (`infra/docker/nginx-caprichos.conf`, `map $host $robots_host`). Abiertos: `caprichos.pe` y `www.caprichos.pe`. Cualquier otro host (demo, staging, `admin.caprichos.pe`) queda cerrado: `X-Robots-Tag: noindex, nofollow, noarchive` en todo y `robots.txt` con `Disallow: /`. Misma imagen en todos los ambientes, sin variables.
- En caprichos.pe la carta (`/`, `/legal/*`, `/reclamos`) se indexa. `noindex` siempre en `/admin*`, `/api/*`, `/pantalla*`, `/asistencia/*` y `/seguimiento*`.
- `robots.txt` y `sitemap.xml` viven en `infra/docker/seo/` (sitemap solo en caprichos.pe; en los demás hosts da 404). Si se agrega una ruta pública, se agrega al sitemap a mano.
- `apps/web/index.html` trae el título, descripción, canonical y Open Graph de la carta; el panel pone su propio título en el cliente.
- Prueba: `infra/docker/tests/probar-seo-nginx.sh` (docker; hace `nginx -t` y curl por Host).
- Cloudflare: revisar que «Managed robots.txt» / «Content Signals» (Security > Settings > Bots / AI Crawl Control) no sobrescriba el robots.txt, que ninguna Transform Rule añada `X-Robots-Tag`, y que "Block AI bots" no moleste. Después de desplegar, comprobar `curl -sI https://caprichos.pe/` y `https://caprichos.pe/robots.txt`, y pedir la indexación en Google Search Console.
