---
id: FT-CON-03
tipo: spec
titulo: "Novedades y destacadas"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-016, FT-CON-02, FT-CAR-03, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, NEC-CAP-030, NEC-CAP-044, NEC-CAP-045, NEC-CAP-046, NEC-CAP-051, RN-CAP-063, RN-CAP-064]
tags: [contenidos, plt-03, ep-cap-016, ft-con-03, deberia-tener]
---

# FT-CON-03 — Novedades y destacadas

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CONTENIDOS · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CON-03 | Novedades y destacadas | EP-CAP-016 Administración de la carta y contenidos |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-030 · NEC-CAP-044 · NEC-CAP-045 · NEC-CAP-051) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** **Novedades:** una página de la carta con promociones, banners, videos (TikTok, Instagram o YouTube), fotos de clientes o de un evento, eventos con fecha y lugar y avisos, con etiqueta o tema (por ejemplo, Navidad) y **varias fotos por publicación** (NEC-CAP-044, NEC-CAP-046, NEC-CAP-051). Tiene portada con banners, filtros por tipo, galería y datos útiles. Se administra desde un módulo que la muestra **como la ve el cliente**, editando una novedad a la vez, con orden por arrastre, duplicar y publicar. Una novedad se muestra solo si está **activa y vigente** (desde y hasta); no se elimina, se desactiva (RN-CAP-063). **Destacadas («Momentos Caprichos»):** círculos en la carta que abren un **visor de fotos** como las historias de Instagram, con **varias fotos** de clientes, del local o del equipo; solo muestran fotos, sin enlaces. Un círculo sin fotos no se ve. Se pueden editar, ordenar, **archivar** y eliminar (excepción a la regla general, DT-06), y se publican con confirmación (RN-CAP-064). También el **espacio de publicidad** «Caprichos del mes», que se puede desactivar (NEC-CAP-030).

**Beneficio esperado.** Mostrar la vida del local y sus campañas en la carta, sin programador. Hipótesis medible: **0 novedades vencidas visibles**; **0 círculos vacíos en la carta**.

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (publica novedades y destacadas) · ACT-CAP-006 Clientes (las ven).

**Pantallas de referencia.** Carta ▸ Novedades y círculos de destacadas; administrativo ▸ Novedades y publicidad, Destacadas de la carta (`Main.dc.html`, `Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CON-03-01 | El administrador crea una novedad de tipo promoción, banner, video, fotos, evento o aviso, con tema y varias fotos. | Debería tener | NEC-CAP-051 | Dado el tipo «Evento», cuando crea «Noche de jazz» con fecha, lugar, 3 fotos y tema «Aniversario», entonces queda como borrador. | Propuesto |
| RQ-CON-03-02 | Un video se agrega con el enlace de TikTok, Instagram o YouTube. | Debería tener | NEC-CAP-044 · NEC-CAP-051 | Dado un enlace de TikTok válido, cuando se pega, entonces la vista previa lo muestra; un enlace de otro sitio no se acepta. | Propuesto |
| RQ-CON-03-03 | La novedad se ve solo si está activa y vigente. | Debería tener | RN-CAP-063 | Dada una novedad hasta el 31/10, cuando un cliente abre Novedades el 1/11, entonces no aparece. | Propuesto |
| RQ-CON-03-04 | El módulo muestra Novedades como la ve el cliente, edita una a la vez, ordena por arrastre y duplica. | Debería tener | NEC-CAP-044 | Dadas 5 novedades, cuando el administrador arrastra la quinta al inicio y la duplica, entonces la vista previa refleja el orden y la copia queda inactiva. | Propuesto |
| RQ-CON-03-05 | La página Novedades tiene portada con banners, filtros por tipo, galería y datos útiles. | Debería tener | NEC-CAP-046 | Dadas novedades de varios tipos, cuando el cliente filtra «Eventos», entonces solo ve eventos; al tocar una con fotos, abre la galería. | Propuesto |
| RQ-CON-03-06 | Los cambios de novedades se publican con Sí/No; no se eliminan, se desactivan. | Debería tener | RN-CAP-063 | Dada una novedad publicada, cuando el administrador la desactiva y publica, entonces sale de la carta y sigue en el módulo. | Propuesto |
| RQ-CON-03-07 | Una destacada tiene varias fotos y abre un visor tipo historias sin enlaces. | Debería tener | NEC-CAP-045 · RN-CAP-064 | Dado el círculo «Equipo» con 4 fotos, cuando el cliente lo toca, entonces ve las 4 fotos en secuencia, puede avanzar o cerrar, y no hay enlaces. | Propuesto |
| RQ-CON-03-08 | Un círculo sin fotos no se ve en la carta. | Debería tener | RN-CAP-064 | Dado un círculo sin fotos, cuando se publica, entonces no aparece en la carta. | Propuesto |
| RQ-CON-03-09 | Las destacadas se editan, ordenan, archivan y eliminan, con portada elegida y confirmación. | Debería tener | NEC-CAP-045 · DT-06 | Dado un círculo, cuando el administrador lo archiva, entonces sale de la carta y queda en «Archivadas»; al eliminarlo con Sí/No, desaparece. | Propuesto |
| RQ-CON-03-10 | El título y el subtítulo de la sección Novedades de la carta son textos que el administrador edita. | Debería tener | Acta 03 | Dado el subtítulo «Lo nuevo en Caprichos», cuando el administrador lo cambia a «¡Feliz Navidad para todos!» y publica, entonces la carta muestra el texto nuevo; no es una imagen. | Propuesto |
| RQ-CON-03-11 | El espacio de publicidad «Caprichos del mes» se activa y desactiva. | Podría tener | NEC-CAP-030 | Dado el espacio activo, cuando el administrador lo desactiva y publica, entonces deja de verse en la carta. | Propuesto |

Prioridad *Debería tener* por la épica. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-001 | Rendimiento | La carta abre en un celular con 4G y muestra la primera categoría sin esperar a que carguen todas las fotos. | Primera vista ≤ 3 s (p75) · medición: monitoreo del navegador (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-012 | Usabilidad | Toda acción que cambia datos pide confirmación Sí/No (RN-CAP-015). | 100 % de acciones de cambio con confirmación (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-019 | Hora local | Horarios, vigencias, «agotado por hoy» y cierres usan la hora de Lima. | Zona America/Lima · 0 cambios de día fuera de las 00:00 locales (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-001 aplica porque las fotos y videos no deben hacer lenta la carta (carga diferida). RNF-CAP-019 a la vigencia.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-063 | Una novedad se muestra solo activa y vigente; no se elimina; se publica con Sí/No. | Pedido del 17/10 |
| RN-CAP-064 | Una destacada solo muestra fotos; un círculo sin fotos no se ve; se publican con confirmación. | Pedido del 17/10 |
| DT-06 | Excepción: un círculo de destacadas se puede eliminar. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CON-03-01 | HU-CAP-151 | — | R-01 |
| RQ-CON-03-02 | HU-CAP-151 | — | R-01 |
| RQ-CON-03-03 | HU-CAP-152 | — | R-01 |
| RQ-CON-03-04 | HU-CAP-152 | — | R-01 |
| RQ-CON-03-05 | HU-CAP-153 | — | R-01 |
| RQ-CON-03-06 | HU-CAP-152 | — | R-01 |
| RQ-CON-03-07 | HU-CAP-154 | — | R-01 |
| RQ-CON-03-08 | HU-CAP-154 | — | R-01 |
| RQ-CON-03-09 | HU-CAP-154 | — | R-01 |
| RQ-CON-03-10 | HU-CAP-151 | — | R-01 |
| RQ-CON-03-11 | HU-CAP-151 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-151 Crear y publicar una novedad con varias fotos o video
- HU-CAP-152 Ver la página Novedades con filtros y galería
- HU-CAP-153 Gestionar destacadas con varias fotos y archivarlas
- HU-CAP-154 Ver las destacadas como historias en la carta

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012.

**Fuera de alcance**

- Diseño general de la carta: FT-CON-02.
- Subir videos al servidor (solo enlaces).

**Preguntas abiertas**

1. **¿Se elimina o se archiva una destacada?** RN-CAP-064 dice que se desactivan; el mockup permite eliminar (DT-06). Por confirmar con Kevin.

---

Generado por IA: BRD (NEC-CAP-030, 044 a 046, 051; RN-CAP-063, 064), DT-06 y el mockup de Novedades y Destacadas — Revisado por: *(pendiente)*
