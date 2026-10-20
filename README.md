# Caprichos

Plataforma digital de **Caprichos**, cafetería artesanal de Lima: carta virtual, módulo administrativo (caja, cocina, mozo, reparto, stock, compras) y chatbot de WhatsApp.

Cliente y dueño del negocio: Kevin Rosales. Desarrollo: José Ángel Espinoza.

## Qué hay aquí

Paquete de análisis y diseño del marco Aybar (todo en `draft` hasta que se firme cada gate):

| Carpeta | Contenido |
|---|---|
| `analisis/` | Intake, BRD, registro de decisiones (`decisiones.md`), plano del local, informes de apoyo |
| `roadmap/` | Roadmap, dependencias y riesgos |
| `epicas/` · `features/` · `historias/` | 21 épicas (incluida la de plataforma, EP-CAP-021), 60 features y 189 historias de usuario |
| `adr/` | 14 decisiones técnicas (ADR-001 a ADR-014) |
| `arquitectura/` · `datos/` | Vista de arquitectura, catálogo de API, modelo de datos y diagramas ER |
| `dor/` · `backlog/tareas/` · `pruebas/` | Definition of Ready, tareas por épica y plan de pruebas |
| `gates/CAP-PENDIENTE/` | Envío de G0 a G4 |
| `operacion/` | Documentos de DevOps: runbooks, plan de release, revisión de seguridad e inventario de infraestructura |
| `scripts/aprobar.py` | Firma de cada gate (la corre la persona que firma) |
| `.publicar-tmp/` | Fuente del mockup navegable publicado en Claude |
| `capri-bot/` · `web-anterior/` · `recursos/` | Bot actual, extracción de la web anterior y recursos del cliente |

## Verificar el paquete

```bash
python3 -I .claude/skills/aybar-siguiente-paso/scripts/estado.py .
python3 -I .claude/skills/aybar-trazabilidad/scripts/trazabilidad.py .
python3 scripts/aprobar.py --estado
```

## Qué NO está en el repositorio

Por seguridad y por la Ley 29733 no se suben: archivos `.env`, llaves SSH, datos y fotos de clientes del bot, capturas con tokens de sesión de restaurant.pe y entornos virtuales. `mockup-web/` vive en `JoseEM26/caprichos-mockup`.
