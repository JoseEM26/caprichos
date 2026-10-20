---
id: REL-CAP-001
tipo: release
titulo: "Plan de release del piloto (H1) en el local"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, EP-CAP-001, EP-CAP-002, EP-CAP-004, EP-CAP-005, EP-CAP-006, EP-CAP-007, EP-CAP-008, EP-CAP-013, EP-CAP-017, EP-CAP-020, RB-CAP-001, RB-CAP-002, SEC-CAP-001, PCN-CAP-001, COS-CAP-001, D-19, D-20]
tags: [release, g8, piloto, devops]
---

# REL-CAP-001 — Plan de release del piloto (H1)

> Documento para el **Release Gate (G8)**. Es una propuesta: las fechas son supuestas hasta que se fije el plazo (D-19) y nada se ha ejecutado.

## 1. Qué sale

| Campo | Valor |
|---|---|
| Versión | `v1.0.0` (piloto en el local) |
| Fecha propuesta | Hito H1, 28/12/2026 (supuesto, D-19) |
| Ventana | Día con menos movimiento, antes de abrir (por ejemplo, lunes 09:00 a 13:00) |
| Alcance | Fase «Ahora»: EP-CAP-021 (plataforma), EP-CAP-013, EP-CAP-017, EP-CAP-001, EP-CAP-002, EP-CAP-004, EP-CAP-006, EP-CAP-007, EP-CAP-008, EP-CAP-005 y EP-CAP-020 |
| Fuera | Fase «Siguiente» (stock, chatbot completo, ofertas, cuentas con puntos…) y el modo sin internet |
| Responsable técnico | José Ángel Espinoza |
| Dueño del negocio | Kevin Rosales |

## 2. Requisitos para salir (go / no-go)

Se decide salir solo si todo está en ✔ el día anterior. Si algo falla ese día, se sigue el plan de continuidad PCN-CAP-001.

| # | Requisito | Evidencia | ✔ |
|---|---|---|---|
| 1 | G0 a G4 aprobados | `python3 scripts/aprobar.py --estado` | ☐ |
| 2 | Ciclos de QA 0 a 2 aprobados y UAT (ciclo 3) firmada por Kevin | `pruebas/test-plan.md` | ☐ |
| 3 | Revisión de seguridad completa sin pendientes críticos | SEC-CAP-001 | ☐ |
| 4 | Runbooks RB-CAP-001 a 005 probados al menos una vez | Tabla de pruebas de cada runbook | ☐ |
| 5 | Restauración de copia probada en menos de 1 hora | RB-CAP-002 | ☐ |
| 6 | Uptime Kuma con los 6 monitores en verde durante 48 horas en pruebas | Captura de Uptime Kuma | ☐ |
| 7 | Ticketeras del local probadas con comanda y etiquetas | DEP-03, prueba en el local | ☐ |
| 8 | Carga inicial revisada por Kevin: carta, precios, fotos, usuarios, plano y zonas | Lista de la sección 4 | ☐ |
| 9 | Personal capacitado por rol | Lista de la sección 5 | ☐ |
| 10 | Claves del bot anterior rotadas | RB-CAP-005 | ☐ |
| 11 | Plan de continuidad probado: simulacro de corte de internet y de modo manual con el personal | PCN-CAP-001 (sección 7) | ☐ |
| 12 | Costos confirmados con los proveedores y aprobados por Kevin | COS-CAP-001 | ☐ |

## 3. Pasos del día de salida

| Hora | Paso | Quién | Comprobación |
|---|---|---|---|
| 09:00 | Copia manual de pruebas y verificación de la copia del día de producción | José | Monitor «copia» en verde |
| 09:15 | Publicar `v1.0.0` siguiendo RB-CAP-001 A | José | `/version` = `v1.0.0` |
| 09:30 | Carga inicial: usuarios reales, carta validada, plano, zonas, horario y parámetros | José con Kevin | Lista de la sección 4 |
| 10:30 | Registrar la TV de cocina y el agente de impresión (llaves de dispositivo) | José | Comanda de prueba impresa |
| 11:00 | Prueba de humo: los 3 primeros flujos E2E (carta con Yape, mesa del mozo, delivery por teléfono) | José y un cajero | Cada flujo de punta a punta |
| 12:00 | Decisión final con Kevin | Kevin y José | Go o vuelta atrás |
| 13:00 | Apertura del local con el sistema nuevo | Equipo | — |

## 4. Carga inicial de datos

| Dato | Fuente | Revisa |
|---|---|---|
| Carta: productos, precios, tamaños, opciones y fotos | `recursos/carta-completa.md` validada por Kevin (DEP-05) | Kevin |
| Usuarios del personal y sus roles | Lista de Kevin | Kevin |
| Plano del local | `analisis/plano-del-local.default.json` validado (D-16) | Kevin |
| Zonas de reparto y tarifas | DEP-07 (D-03) | Kevin |
| Datos del local, horario y fechas especiales | DEP-04 (D-04) | Kevin |
| Parámetros: tiempo prometido, envío gratis, pedido mínimo | D-01, D-02, D-03 | Kevin |

## 5. Comunicación y capacitación

- **Personal:** una sesión corta por rol (caja, cocina y barra, mozo, repartidor) en pruebas, con usuarios de prueba, la semana anterior.
- **Clientes:** la carta nueva reemplaza al enlace anterior el día de salida; el bot actual sigue enviando el enlace (ahora al nuevo).
- **Convivencia (D-20):** durante un mes, restaurant.pe sigue solo para facturar; si el sistema nuevo falla, la contingencia es tomar pedidos en papel y cobrar en restaurant.pe.

## 6. Cómo se vuelve atrás

| Situación | Acción |
|---|---|
| Falla la versión publicada | RB-CAP-001 C (volver a la versión anterior) |
| Falla todo el sistema en la apertura | Contingencia D-20: papel y restaurant.pe; reintentar otro día |
| Se dañaron datos de la carga inicial | RB-CAP-002 (restaurar la copia de las 09:00) |

## 7. Después de salir (G9)

- **Dos semanas de acompañamiento**: revisar GlitchTip y Uptime Kuma cada día, y estar disponible en horario de atención.
- **Primera semana**: medir la línea base de los KPI (tiempo de entrega OBJ-CAP-001, pedidos con agotados OBJ-CAP-002).
- **Cierre de G9**: informe con incidentes, KPI medidos y pendientes para la fase «Siguiente».

## 8. Firmas (G8)

| Rol | Nombre | Fecha | Decisión |
|---|---|---|---|
| Product Owner | José Ángel Espinoza | | ☐ Go ☐ No-go |
| Technical Lead | José Ángel Espinoza | | ☐ Go ☐ No-go |
| Stakeholder | Kevin Rosales | | ☐ Go ☐ No-go |

---

Generado por IA: plan propuesto desde el roadmap (H1), EP-CAP-021, los runbooks, el plan de pruebas y D-19/D-20 — Revisado por: (pendiente)
