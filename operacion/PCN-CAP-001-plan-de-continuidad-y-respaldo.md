---
id: PCN-CAP-001
tipo: continuidad
titulo: "Plan de continuidad y respaldo: qué hacer si algo falla"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-03, FT-PLA-04, FT-PLA-05, EP-CAP-019, ADR-011, ADR-012, RB-CAP-001, RB-CAP-002, RB-CAP-003, RB-CAP-004, RB-CAP-005, INV-CAP-001, COS-CAP-001, REL-CAP-001, R-06, D-11, D-20]
tags: [continuidad, respaldo, contingencia, devops]
---

# PCN-CAP-001 — Plan de continuidad y respaldo

> Responde una pregunta: **si algo falla, ¿cómo seguimos vendiendo y cómo recuperamos todo?** Tiene dos partes: lo que **hace el local** mientras se arregla (sección 4) y lo que **hace el técnico** para recuperar (sección 3). Es una propuesta: nada está construido ni probado todavía.

## 1. Principios

1. **Primero se sigue vendiendo, después se arregla.** Nadie espera al técnico para atender a un cliente: hay un modo manual (sección 4).
2. **Los datos nunca viven en un solo lugar.** Cada dato tiene una copia fuera de donde se creó (sección 2).
3. **Cada falla tiene un runbook** y cada runbook se prueba antes de necesitarse (sección 7).
4. **Se avisa pronto y claro**: al dueño, al personal y, si hace falta, a los clientes (sección 5).

## 2. Qué se respalda, dónde y cada cuánto

| Qué | Dónde está el original | Respaldo | Frecuencia | Se conserva | Quién restaura | Runbook |
|---|---|---|---|---|---|---|
| **Base de datos** (pedidos, cobros, clientes, stock, auditoría) | VPS | Copia cifrada (restic) en R2 o B2, fuera del VPS | Diaria, 03:00 | 30 diarias y 6 mensuales | Técnico | RB-CAP-002 |
| **Fotos y comprobantes de pago** | VPS (`/data/uploads`) | Misma copia cifrada | Diaria, 03:00 | Igual | Técnico | RB-CAP-002 |
| **Todo el servidor** (sistema, Docker, Dokploy) | VPS | Auto Backup y 1 snapshot del proveedor | Según el proveedor | Según el plan | Técnico | RB-CAP-004 |
| **Código** | GitHub | Cada equipo que lo clona; las imágenes se reconstruyen | En cada cambio | Historial completo | Técnico | RB-CAP-001 |
| **Configuración del servidor** | `infra/ansible` en GitHub | El mismo repositorio | En cada cambio | Historial completo | Técnico | RB-CAP-004 |
| **Secretos y claves** | Dokploy y GitHub Secrets | **Gestor de contraseñas** (con acceso de emergencia a Kevin) | Al crear o rotar | — | Responsable técnico | RB-CAP-005 |
| **Documentación del paquete** | Repositorio | GitHub | En cada cambio | Historial completo | Cualquiera | — |
| **Clave de restic** | Gestor de contraseñas | Una copia impresa guardada por Kevin | Al crearla | — | Responsable técnico | RB-CAP-002 |

La copia diaria se **verifica sola** (Uptime Kuma avisa si no corrió) y se **prueba restaurando cada 3 meses** en el ambiente de pruebas (DT-47).

## 3. Metas de recuperación

| Meta | Valor propuesto | Qué significa |
|---|---|---|
| **RPO**: cuánto trabajo se puede perder | **Hasta 24 horas** | La copia es diaria: si el servidor y su base se pierden a las 18:00, se pierde lo ocurrido desde las 03:00. Los pedidos del día se reconstruyen con las comandas en papel y los comprobantes de pago (sección 4.4). *Decisión D-21.* |
| **RTO** de la carta y el administrativo | **Menos de 1 hora** con la copia; **menos de 30 minutos** con el snapshot del proveedor | Tiempo hasta que el sistema vuelve a responder |
| **RTO** del modo manual | **Inmediato** | El local sigue con papel apenas se detecta la falla |
| **Disponibilidad** en horario de atención | **99,5 % mensual** | RNF-CAP-003; se mide con Uptime Kuma |

## 4. Si algo falla: escenarios

Cada fila dice **qué se nota**, **qué hace el local** y **qué hace el técnico**. «Modo manual» es la sección 4.1.

| # | Escenario | Qué se nota | Qué hace el local | Qué hace el técnico | RTO | Se puede perder |
|---|---|---|---|---|---|---|
| **E1** | **Se cae el internet del local** | Las pantallas no cargan; el bot y la carta siguen funcionando (están en el VPS) | **Primero**: conectar las PC y tablets a los **datos del celular** (compartir internet): el sistema vuelve a funcionar. Si no, modo manual | Llamar al proveedor de internet. Nada que restaurar | Minutos | Nada |
| **E2** | **Se cae la API o la carta** (error o publicación mala) | Uptime Kuma avisa; el local ve errores | Modo manual. Poner la carta en pausa si se demora (FT-COC-03) | RB-CAP-003 y, si fue una publicación, **volver atrás** con RB-CAP-001 | < 10 min si es rollback | Nada |
| **E3** | **Se cae todo el VPS** | Carta, administrativo y bot sin respuesta | Modo manual; avisar a Kevin | Revisar el panel del proveedor; **restaurar el snapshot**; si no, servidor nuevo con **RB-CAP-004** y datos con **RB-CAP-002** | < 30 min (snapshot) a < 1 h | Hasta 24 h (RPO) |
| **E4** | **El proveedor del VPS falla o cierra la cuenta** | No se puede entrar ni al panel | Modo manual | Contratar **otro proveedor** (candidato por elegir, D-23), **RB-CAP-004** y **RB-CAP-002**. Cambiar los registros en Cloudflare | 2 a 4 h | Hasta 24 h |
| **E5** | **Se borran o se dañan datos** (error humano, bug, migración mala) | Faltan productos, pedidos o clientes | Seguir trabajando; no repetir cobros | **RB-CAP-002 B**: restaurar en una base aparte y copiar solo lo dañado; la auditoría dice quién y cuándo | 20 a 60 min | Solo lo dañado, si está en la copia |
| **E6** | **Falla Cloudflare** | La carta y el administrativo no cargan aunque el VPS esté bien | Modo manual | Revisar su página de estado. Si dura más de 1 h: apuntar el DNS directo al VPS y abrir 80/443 **temporalmente** (menos seguro) y cerrarlo al volver | 30 a 60 min | Nada |
| **E7** | **WhatsApp o Meta falla, o el número se bloquea** | El bot no responde; no llegan los mensajes | Caja confirma pedidos escribiendo por WhatsApp normal desde el celular del negocio. Los pedidos de la carta siguen entrando «por confirmar» | **Pausar el bot**; revisar la cuenta en Meta; RB-CAP-005 si fue el token | Horas a días | Nada |
| **E8** | **OpenAI caído o tope de gasto alcanzado** | El bot no contesta dudas libres | Los botones y los pedidos siguen igual (DT-18) | La IA responde un mensaje fijo y deriva a una persona; subir el tope si corresponde | Inmediato | Nada |
| **E9** | **Google Maps caído o tope diario** | El buscador de direcciones no responde | Tocar el punto en el mapa o escribir la dirección (NEC-CAP-059, NEC-CAP-092) | Revisar el tope y la clave | Inmediato | Nada |
| **E10** | **Falla la ticketera, la etiquetera o el agente de impresión** | Alerta «No se imprimió la comanda» | Cocina trabaja con las pantallas; caja **reimprime** cuando vuelva (RN-CAP-021) | Reiniciar el agente en la PC de caja; revisar cable, papel y red | Minutos | Nada |
| **E11** | **Se daña la PC de caja** | Caja sin equipo | Usar **cualquier otra PC o la tablet**: el administrativo se abre desde cualquier navegador con su usuario | Reinstalar el agente de impresión en otro equipo | Minutos | Nada |
| **E12** | **Corte de luz en el local** | Todo apagado | Modo manual con calculadora y celulares | Nada que restaurar (el VPS no depende del local). Un **UPS** para el router y la PC de caja da minutos extra (D-23) | Al volver la luz | Nada |
| **E13** | **Falla la copia diaria** | Uptime Kuma avisa a la mañana | Nada | Correr la copia a mano (RB-CAP-003 E). Si pasan 2 días sin copia, se vuelve prioridad | Mismo día | — |
| **E14** | **Se filtra una clave o hay acceso indebido** | Aviso, actividad rara en el Historial de acciones | Cambiar contraseñas si se pide | **RB-CAP-005 C**: contener, rotar, revisar el historial y evaluar el aviso legal (Ley 29733) | 1 a 3 h | Depende |
| **E15** | **Virus o secuestro de datos en una PC del local** | Equipo bloqueado o con comportamiento raro | Desconectar el equipo de la red; usar otro | Reinstalar el equipo; **revocar sesiones**; cambiar contraseñas. Los datos están en el VPS y en las copias | Horas | Nada en el VPS |
| **E16** | **Vence o se pierde el dominio `caprichos.pe`** | La carta y el administrativo dejan de abrir | Modo manual | Renovar en punto.pe; **renovación automática** y a nombre del negocio; aviso 60 días antes | Horas | Nada |
| **E17** | **El responsable técnico no está disponible** (enfermedad, viaje, deja el proyecto) | Nadie puede arreglar | Modo manual; avisar a Kevin | Un **segundo responsable** con acceso de emergencia, runbooks y gestor de contraseñas (D-22) | Según disponibilidad | Nada |

### 4.1 Modo manual (el local no se detiene)

**Kit en caja y cocina** (impreso y a mano, revisado cada mes):

- Bloc de **comandas en papel** numeradas, con campos: fecha, hora, mesa o delivery, productos, opciones, nota, total, forma de pago.
- **Carta con precios** impresa, y la lista de **productos agotados** del día.
- **Hoja de cierre**: ventas por medio de pago, ingresos y egresos, efectivo contado.
- Calculadora, bolígrafos y un celular con datos móviles.

**Reglas del modo manual**

1. Mozo y caja anotan cada pedido en una comanda numerada; cocina la prepara igual que siempre.
2. Los pedidos por **WhatsApp o teléfono** se anotan igual; el pago por Yape o Plin se guarda con captura en el celular.
3. El cobro se hace como siempre; el **comprobante** puede salir del facturador actual (D-20).
4. **Nada se pierde**: cada comanda queda archivada con el número y la hora.

### 4.2 Cómo se avisa a los clientes

- Si la carta no puede recibir pedidos: **pausar pedidos** desde Alta demanda (FT-COC-03); la carta muestra el aviso y deja de recibir.
- Si solo el bot falla: avisar por la carta y atender por WhatsApp normal.
- Mensaje corto sugerido: «Estamos con un inconveniente técnico. Puedes pedir por WhatsApp o en el local. Gracias por tu paciencia.»

### 4.3 Qué hace el técnico, en orden, ante cualquier falla

1. **Confirmar** qué monitor está en rojo (Uptime Kuma) y desde cuándo.
2. **Avisar** al local en una línea: qué falla y si pasan a modo manual.
3. **Elegir el escenario** de la tabla 4 y seguir su runbook.
4. **Anotar** hora de inicio y de fin en el registro del runbook.
5. **Cerrar**: avisar que ya funciona, revisar lo ocurrido y abrir un issue si se puede evitar.

### 4.4 Cuando el sistema vuelve

1. **Comprobar** el sistema con las pruebas de humo de REL-CAP-001 (los 3 primeros E2E).
2. **Cargar lo que quedó en papel**: caja y el administrador cargan los pedidos del modo manual como pedidos de mostrador, marcados «carga posterior», con su hora real, para que el cierre de caja cuadre.
3. **Reconciliar**: si hubo restauración de copia, comparar lo perdido (RPO) con las comandas en papel y los comprobantes en WhatsApp.
4. **Revisar la caja del día** y hacer el cierre con la hoja de cierre manual como apoyo.

## 5. Quién avisa a quién

| Situación | Avisa | A quién | Cómo | Cuándo |
|---|---|---|---|---|
| Falla de menos de 5 min | Nadie | — | — | — |
| Falla de más de 5 min en horario de atención | Técnico | Kevin y el local | WhatsApp | En el momento |
| Se pasa a modo manual | Kevin o la persona en caja | Mozo, cocina y repartidores | Voz | En el momento |
| Pérdida de datos o filtración | Técnico | Kevin; asesor legal si hay datos personales | WhatsApp y llamada | En las 2 primeras horas |
| Resuelto | Técnico | Kevin y el local | WhatsApp | Al terminar |

**Contactos** (se completan antes del piloto, sin escribir aquí claves ni contraseñas):

| Rol | Nombre | Teléfono |
|---|---|---|
| Responsable técnico | José Ángel Espinoza | *(por completar)* |
| Segundo responsable (D-22) | *(por definir)* | *(por completar)* |
| Dueño | Kevin Rosales | *(por completar)* |
| Proveedor del VPS | *(por definir)* | Soporte del proveedor |
| Proveedor de internet del local | *(por relevar)* | *(por completar)* |
| Asesor legal | *(por definir, DEP-09)* | *(por completar)* |

## 6. Mejoras opcionales y su costo (para decidir)

| Mejora | Qué evita | Costo aproximado | Decisión |
|---|---|---|---|
| **Copia continua de la base (WAL)** en lugar de diaria | Bajar la pérdida máxima de 24 h a minutos | Un poco más de almacenamiento de copias (centavos) y más trabajo de configuración | **D-21** |
| **Segundo VPS en espera** | Volver en minutos si el principal cae | Unos US$ 7 al mes más | D-23 |
| **UPS** para router y PC de caja | Cortes de luz cortos | Pago único *(por cotizar)* | D-23 |
| **Datos móviles de respaldo** (chip o celular) | Internet del local caído | Mensual *(por cotizar)* | D-23 |
| **Modo sin internet** (EP-CAP-019) | Operar sin conexión y sincronizar después | Fase aparte con su cotización | D-11 |
| **Segundo responsable técnico** | Que el sistema no dependa de una sola persona | Según el acuerdo | **D-22** |

Los costos de operación habituales están en COS-CAP-001.

## 7. Cómo se prueba este plan

| Simulacro | Cada cuánto | Qué se hace | Se mide |
|---|---|---|---|
| **Restaurar una copia** (E3, E5) | Cada 3 meses | Restaurar la copia del día en pruebas con RB-CAP-002 | Tiempo total y que esté completa |
| **Volver atrás una publicación** (E2) | Antes del piloto y cada 6 meses | Publicar y revertir en pruebas con RB-CAP-001 | Minutos |
| **Corte de internet** (E1) | Antes del piloto | Pasar el local a datos del celular y a modo manual, con el personal | Minutos hasta volver a vender |
| **Servidor nuevo** (E3, E4) | Una vez antes del piloto | Preparar un VPS de prueba con RB-CAP-004 | Tiempo hasta responder |
| **Modo manual** (todos) | Antes del piloto y cada 6 meses | Una hora de servicio con el kit, sin sistema | Pedidos tomados y cuadre del cierre |
| **Rotar una clave** (E14) | Antes del piloto | RB-CAP-005 B en pruebas | Minutos |

| Fecha | Simulacro | Quién | Resultado | Tiempo | Qué se corrigió |
|---|---|---|---|---|---|
| *(pendiente: antes del piloto)* | | | | | |

## 8. Decisiones pendientes

| # | Decisión | Recomendación |
|---|---|---|
| D-21 | Cuánto trabajo se puede perder si el servidor se pierde: hasta 24 h (copia diaria) o minutos (copia continua) | Empezar con 24 h y el modo manual; evaluar la copia continua si Kevin no tolera perder un día de pedidos |
| D-22 | Segundo responsable técnico y acceso de emergencia (gestor de contraseñas y clave de restic) | Una persona de confianza con acceso de emergencia, más Kevin con la clave de restic impresa guardada |
| D-23 | Equipos de respaldo del local: UPS, datos móviles de respaldo, segundo proveedor de VPS candidato | UPS y datos móviles antes del piloto; un segundo proveedor identificado, sin contratarlo |

---

Generado por IA: plan propuesto desde ADR-011, ADR-012, los runbooks RB-CAP-001 a 005, R-06, D-11 y D-20; escenarios y metas se ajustan con Kevin y se prueban con los simulacros — Revisado por: (pendiente)
