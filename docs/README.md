# Caprichos

Plataforma digital de **Caprichos**, cafetería artesanal de Lima: carta virtual, módulo administrativo (caja, cocina, mozo, reparto, stock, compras) y chatbot de WhatsApp.

Cliente y dueño del negocio: Kevin Rosales. Desarrollo: José Ángel Espinoza.

## Qué hay aquí

Paquete de análisis y diseño del marco Aybar (todo en `draft` hasta que se firme cada gate):

| Carpeta | Contenido |
|---|---|
| `analisis/` | Intake, BRD, registro de decisiones (`decisiones.md`), plano del local, informes de apoyo |
| `roadmap/` | Roadmap, dependencias y riesgos |
| `epicas/` · `features/` · `historias/` | 22 épicas (incluidas la de plataforma, EP-CAP-021, y la de iniciativas, EP-CAP-022), 61 features y 194 historias de usuario |
| `adr/` | 14 decisiones técnicas (ADR-001 a ADR-014) |
| `arquitectura/` · `datos/` | Vista de arquitectura, catálogo de API, modelo de datos y diagramas ER |
| `dor/` · `backlog/tareas/` · `pruebas/` | Definition of Ready, tareas por épica y plan de pruebas |
| `gates/CAP-PENDIENTE/` | Envío de G0 a G4 |
| `operacion/` | Documentos de DevOps: runbooks, plan de release, revisión de seguridad e inventario de infraestructura |
| `scripts/aprobar.py` | Firma de cada gate (la corre la persona que firma) |
| `../mockup/` | Fuente del mockup navegable publicado en Claude |
| `recursos/` | Cartas, íconos y fotos de la carta del cliente |
| `../legacy/` | Proyecto anterior: bot actual (`capri-bot/`), web anterior (`web-anterior/`) y mockup viejo |

## Verificar el paquete

```bash
python3 -I .claude/skills/aybar-siguiente-paso/scripts/estado.py docs
python3 -I .claude/skills/aybar-trazabilidad/scripts/trazabilidad.py docs
python3 docs/scripts/aprobar.py --estado
```

## Qué NO está en el repositorio

Por seguridad y por la Ley 29733 no se suben: archivos `.env`, llaves SSH, datos y fotos de clientes del bot, capturas con tokens de sesión de restaurant.pe y entornos virtuales. `mockup-web/` vive en `JoseEM26/caprichos-mockup`.
