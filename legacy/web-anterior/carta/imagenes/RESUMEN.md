# Resumen de Descarga y Auditoría de Imágenes — Caprichos (OlaClick)

> **Aviso de contexto histórico:** Esta web (`https://caprichos-per.ola.click/products`) corresponde a la plataforma anterior del cliente y representa una fuente histórica. La carta vigente oficial se encuentra documentada en los archivos PDF de `/home/jose/JoseEM/caprichos/recursos` (`carta-bebidas-y-waffles.pdf` y `carta-salados-y-complementos.pdf`).

## 1. Métricas Generales

- **Total de archivos descargados:** 52
- **Total de imágenes de productos:** 48
- **Recursos de negocio/marca:** 4 (logo, logo miniatura, banner de portada, favicon)
- **Productos sin imagen:** 1
- **Incidencias o errores de descarga:** 0

## 2. Conteos por Categoría

| Categoría | Slug Carpeta | Imágenes Descargadas |
| :--- | :--- | :--- |
| Frío🥤 | `frio` | 19 |
| Caliente☕️ | `caliente` | 7 |
| Salado🍗 | `salado` | 9 |
| Postres🍰 | `postres` | 13 |
| Recursos de Marca | `negocio` | 4 |

## 3. Resolución y Variantes de Imágenes

- **Variante máxima detectada y usada:** En OlaClick (CDN `assets.olaclick.app`), las imágenes de productos se almacenan pre-renderizadas en dos segmentos: `800` (alta resolución, 800x800 px) y `150` (miniaturas de 150x150 px). Las pruebas a variantes 300, 600, 1024, 1200 y `original` devuelven HTTP 403 (no generadas en el bucket S3).
- El 100% de los productos con imagen tenían disponible la versión `800/` con respuesta HTTP 200.
- Todas las imágenes fueron validadas satisfactoriamente como archivos de imagen íntegros mediante la librería `PIL` (Pillow).

## 4. Productos sin Imagen

- **Nota** (Categoría: `Postres🍰`, ID: `a05c0b0b-170c-4a97-9a65-6051f6c893d2`)
  - *Nota técnica:* Corresponde a un ítem especial en la carta (`slug: nota`, precio S/ 0.00, sin descripción) que la plataforma usaba como separador o indicación.

## 5. Incidencias y Problemas Encontrados

Ninguno. Todas las peticiones respondieron satisfactoriamente (HTTP 200), los archivos abrieron como imágenes válidas y se respetó la tasa de 1 a 2 peticiones por segundo.
