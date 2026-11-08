---
id: OPS-CAP-000
tipo: indice
titulo: "Documentos de operación de Caprichos (DevOps)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, ADR-011, ADR-012, ADR-014, DT-51, COS-CAP-001, PCN-CAP-001]
tags: [operacion, devops, indice]
---

# Documentos de operación (DevOps)

Esta carpeta guarda los documentos que **no describen qué hace el sistema**, sino **cómo se publica, se vigila, se protege y se recupera**. Son de la épica habilitadora EP-CAP-021 «Plataforma, despliegue y operación» (DT-51). Se escriben y se prueban durante la construcción, y se exigen en los gates de salida del marco Aybar.

| Tipo | Prefijo | Para qué sirve | Gate que lo pide | Lo aprueba |
|---|---|---|---|---|
| **Runbook** | `RB-CAP-###` | Pasos exactos para una tarea de operación o un incidente, escritos para que los siga otra persona sin ayuda | G8 (release) y G9 (post-release) | TL |
| **Plan de release** | `REL-CAP-###` | Qué sale, cuándo, cómo, cómo se vuelve atrás y cómo se decide salir o no (go/no-go) | G8 | PO + TL (y Stakeholder en T3) |
| **Revisión de seguridad** | `SEC-CAP-###` | Lista de controles de seguridad revisados con evidencia antes de salir a producción | G7 | TL (y quien haga de seguridad) |
| **Inventario de infraestructura** | `INV-CAP-###` | Qué servicios, dominios, cuentas, puertos y costos hay, y dónde vive cada secreto (sin su valor) | G3 y G8 | TL |
| **Costos de operación** | `COS-CAP-###` | Cuánto cuesta mantener el sistema: fijos, variables por escenario, gratuitos, topes y pagos únicos | G3 y G8 | PO + Stakeholder |
| **Plan de continuidad y respaldo** | `PCN-CAP-###` | Qué se respalda, metas de recuperación y qué hacen el local y el técnico ante cada falla | G8 | PO + TL |

## Documentos actuales

| ID | Documento | Estado |
|---|---|---|
| RB-CAP-001 | [Publicar y volver atrás](RB-CAP-001-publicar-y-volver-atras.md) | draft |
| RB-CAP-002 | [Restaurar una copia](RB-CAP-002-restaurar-una-copia.md) | draft |
| RB-CAP-003 | [Un servicio se cayó](RB-CAP-003-un-servicio-se-cayo.md) | draft |
| RB-CAP-004 | [Preparar un servidor nuevo](RB-CAP-004-preparar-un-servidor-nuevo.md) | draft |
| RB-CAP-005 | [Rotar claves y responder a una filtración](RB-CAP-005-rotar-claves-y-responder-a-una-filtracion.md) | draft |
| RB-CAP-005B | [Desplegar, actualizar y volver atrás con Docker Compose](RB-CAP-005-desplegar-actualizar-y-volver-atras-con-compose.md) | listo |
| RB-CAP-006 | [Código rotativo del supervisor (TOTP), RETIRADO](RB-CAP-006-codigo-del-supervisor.md) | retirado |
| RB-CAP-007 | [Configuración, conexión y operación del Chatbot de WhatsApp](RB-CAP-007-chatbot-whatsapp.md) | listo |
| RB-CAP-008 | [Despliegue sin corte con docker-rollout y verificación continua con sonda](RB-CAP-008-despliegue-sin-corte-y-sonda.md) | draft |
| CHK-CAP-001 | [Requisitos para subir a producción](CHK-CAP-001-requisitos-para-subir-a-produccion.md) | draft |
| RB-CAP-009 | [Activación y operación de la lectura de vouchers Yape y Plin con IA](RB-CAP-009-activar-y-operar-vouchers-ia.md) | draft |
| RB-CAP-010 | [Operación y mantenimiento del agente local de impresión de etiquetas TSPL2](RB-CAP-010-operar-agente-impresion-etiquetas.md) | draft |
| RB-CAP-011 | [Activación y operación del Asistente de Ayuda Capri](RB-CAP-011-activar-ayuda-capri.md) | draft |
| RB-CAP-012 | [Guía paso a paso: cómo hacer público el bot de WhatsApp](GUIA-hacer-publico-el-bot-de-whatsapp.md) | draft |
| RB-CAP-DEMO | [Desplegar la demo sin dominio](RB-CAP-DEMO-desplegar-la-demo-sin-dominio.md) | listo |
| PLAN-CAP-BOT | [Plan por olas del chatbot de WhatsApp](PLAN-CHATBOT-OLAS.md) | actualizado |
| PLA-CAP-WSP | [Catálogo de plantillas oficiales de WhatsApp](PLANTILLAS-WHATSAPP.md) | listo |
| GUIA-CD | [Guía: Secretos, entornos y llaves SSH de GitHub](GUIA-CD-secretos-de-github.md) | listo |
| REL-CAP-001 | [Plan de release del piloto (H1)](REL-CAP-001-plan-de-release-del-piloto.md) | draft |
| SEC-CAP-001 | [Revisión de seguridad antes del piloto](SEC-CAP-001-revision-de-seguridad.md) | draft |
| INV-CAP-001 | [Inventario de infraestructura](INV-CAP-001-inventario-de-infraestructura.md) | draft |
| COS-CAP-001 | [Costos de operación](COS-CAP-001-costos-de-operacion.md) | draft |
| PCN-CAP-001 | [Plan de continuidad y respaldo](PCN-CAP-001-plan-de-continuidad-y-respaldo.md) | draft |

## Reglas

1. **Nunca se escribe un secreto aquí.** Se escribe dónde vive (Dokploy, GitHub Secrets, gestor de contraseñas) y quién lo rota.
2. **Un runbook no vale hasta que alguien distinto de quien lo escribió lo sigue sin ayuda** (se anota en su tabla de pruebas).
3. Cada runbook dice cuánto tarda, qué se necesita antes de empezar, los pasos con los comandos exactos, cómo comprobar que funcionó y cómo volver atrás.
4. Cuando cambie la infraestructura (un servicio, un dominio, una cuenta), se actualiza INV-CAP-001 en el mismo PR.
5. Como todo el paquete, nacen en `draft`; la IA no los aprueba (DT-02).

Plantillas y reglas para crear documentos nuevos: skill `aybar-devops-operacion`.

---

Generado por IA: índice armado desde DT-51, ADR-011, ADR-012 y EP-CAP-021 — Revisado por: (pendiente)
