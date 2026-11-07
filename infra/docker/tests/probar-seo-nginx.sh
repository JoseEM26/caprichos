#!/usr/bin/env bash
# Prueba el SEO por host con el nginx real: nginx -t y curl con cabecera Host.
# Uso: infra/docker/tests/probar-seo-nginx.sh   (requiere docker)
set -u
D="$(cd "$(dirname "$0")/.." && pwd)"
N=caprichos-seo-test; PUERTO=18089; fallos=0
T="$(mktemp -d)"; echo '<html>carta</html>' > "$T/index.html"
trap 'docker rm -f $N >/dev/null 2>&1; rm -rf "$T"' EXIT
docker rm -f $N >/dev/null 2>&1
docker run -d --name $N -p $PUERTO:80 \
  -v "$D/nginx-caprichos.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$D/seo:/usr/share/nginx/seo:ro" -v "$T:/usr/share/nginx/html:ro" nginx:alpine >/dev/null
docker exec $N nginx -t 2>&1 | grep -q "successful" && echo "ok  nginx -t" || { echo "FALLA nginx -t"; fallos=1; }
sleep 1
ok(){ if [ "$2" = "$3" ]; then echo "ok  $1"; else echo "FALLA $1: esperado [$2] obtenido [$3]"; fallos=1; fi; }
hdr(){ curl -s -o /dev/null -D- -H "Host: $1" "localhost:$PUERTO$2" | tr -d '\r' | grep -i '^x-robots-tag' | cut -d' ' -f2- ; }
body(){ curl -s -H "Host: $1" "localhost:$PUERTO$2"; }
code(){ curl -s -o /dev/null -w '%{http_code}' -H "Host: $1" "localhost:$PUERTO$2"; }
C="noindex, nofollow, noarchive"
for h in caprichos.pe www.caprichos.pe; do
  for r in / /legal/privacidad /legal/terminos /reclamos; do ok "$h$r abierto" "" "$(hdr $h $r)"; done
  for r in /admin /admin/ingresar /admin/pedidos?x=1 /api/admin/x /asistencia/pantalla/tok /pantalla/cocina /seguimiento /seguimiento/abc; do ok "$h$r cerrado" "$C" "$(hdr $h $r)"; done
  body $h /robots.txt | grep -q '^Allow: /$' && body $h /robots.txt | grep -q 'Disallow: /admin' && body $h /robots.txt | grep -q 'Sitemap: https://caprichos.pe/sitemap.xml' && echo "ok  $h robots abierto" || { echo "FALLA $h robots"; fallos=1; }
  body $h /sitemap.xml | grep -q '<loc>https://caprichos.pe/</loc>' && echo "ok  $h sitemap" || { echo "FALLA $h sitemap"; fallos=1; }
done
for h in demo.caprichos.pe staging.caprichos.pe admin.caprichos.pe otro.ejemplo.com localhost; do
  for r in / /legal/privacidad /admin; do ok "$h$r cerrado" "$C" "$(hdr $h $r)"; done
  ok "$h robots" "Disallow: /" "$(body $h /robots.txt | grep Disallow)"
  ok "$h sitemap 404" 404 "$(code $h /sitemap.xml)"
done
ok "caprichos.pe:80 con puerto" "" "$(hdr caprichos.pe:443 /)"
[ $fallos = 0 ] && echo "TODO OK" || { echo "HAY FALLOS"; exit 1; }
