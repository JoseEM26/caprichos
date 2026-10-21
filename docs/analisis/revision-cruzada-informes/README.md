---
id: ANA-CAP-050
tipo: analisis
titulo: "Revision cruzada (v110): lista unificada"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, revision-cruzada-informes]
---

# Revision cruzada (v110): lista unificada

Fecha: 18/10/2026. Seis informes de agentes de Antigravity (docs, admin-carta, chatbot, workflow, homogeneidad, autonomia). Cada punto de abajo lo comprobe contra el codigo v110 salvo los marcados "sin verificar". Los informes completos estan en esta carpeta.

## Descartado tras comprobar (el agente se equivoco)
- "Mozo puede editar precios": el rol Mozo tiene `manage: false`.
- "horarioTexto no se actualiza": la carta lo recalcula desde el horario (`INFO.horarioTexto = schedText(...)`).
- "Indicadores con formulas sinusoidales falsas": son la serie de ejemplo ya declarada; el escritorio de hoy usa pedidos reales.
- "Cierre ignora el efectivo de repartidores": existe el aviso y las filas de liquidacion pendiente (`liqRows`); lo que falta es bloquear el cierre.

## Confirmado: discordancias y huecos

Prioridad alta
1. Chatbot simulador con carta propia (9 productos, `CATS`), agotados fijos (`AGOTADOS`), envio plano S/ 3 (`sub < 70 ? 3 : 0`), sin pedido minimo, sin zonas, sin tarjeta/transferencia: no lee la configuracion compartida.
2. Cupones validados contra fecha fija `TODAY = '2026-10-15'` en la carta: desde el 16/10 todo cupon "vence".
3. Carta web: no hay Libro de Reclamaciones ni forma de pedir boleta/factura con RUC (0 menciones).
4. Tiempo prometido: 13 min en carta/Admin frente a 30-45 min del bot real.
5. Anular un pedido ya cobrado no se puede (solo cola/prep/listo/ruta y no pagado).
6. Pedidos de la carta web no llegan al Admin (limite del mockup; en el sistema real es la integracion principal).
7. Precios editados solo se reflejan en productos de 1 tamano (`pover`).
8. Bot real: horario 14-22 y telefono/titular de pago fijos en Python.

Prioridad media
9. Simulador dice "no hace falta capturas de pago" y el bot real las exige; el simulador acepta direccion escrita y el bot real la rechaza.
10. Promociones "llevas mas, pagas menos" no se aplican en la carta.
11. Credito del personal: 25 % y 15 dias escritos en textos y calculos, no leen la configuracion.
12. Pedidos permitidos con el local cerrado (la carta muestra el estado, no bloquea).
13. Cierre de caja deberia bloquearse con efectivo de repartidor sin liquidar.
14. Documentacion: numeracion RN/NEC repetida, rutas `analisis/` y `actas/` rotas, rol Produccion y modulos nuevos ausentes de `modulos-y-roles.md`, cajero con Ofertas distinto entre BRD y codigo (sin verificar punto por punto).
15. Modalidad con nombres distintos entre canales; area "Bebidas/Postres/Salados" frente a estaciones; 20 oz frente a 21 oz; "Waffle Nutella" con tres nombres (sin verificar cada uno).

## Lo que depende del programador hoy (autonomia)
Logo, coordenadas del local, poligonos de zonas, recetas, plantillas de WhatsApp (listo/recojo/ubicacion/pago), terminos y privacidad, tolerancia de reserva (15 min fijos), tiempos base, puntos (1 sol = 1 punto), encuesta y recompensa posventa, clave Wi-Fi en ticket, altas/bajas de usuarios, areas de cocina, matriz de permisos. Ya administrables: datos del local, redes, horarios y feriados, pedido minimo, envio gratis, tarifas Z2-Z7, cupones, descuentos, medios de pago y cuentas, banner, paleta, novedades.
Propuesta: pantalla unica "Ajustes del negocio" con seis secciones (Identidad, Operacion, Delivery, Pagos, Mensajes, Personal y seguridad). Detalle en `autonomia.md`.

## Diseno (mi parte, medido)
Admin con colores a mano (azul #0B2C3E, mas de 1000 usos) frente a Main con variables CSS; 223 de 523 botones del Admin bajo 44 px; 10 tamanos de letra y 86 usos de 11 px o menos; radios mezclados; Chatbot con paleta propia y casi sin aria-label. Propuesta: escala 12/14/16/20/24, tokens de color, botones de 44 px.

## Limites
Informes de agentes; nada se probo en navegador. Nada se modifico.

## Estado tras v111
Construido: puntos 2, 7, 12 (cerrado/pausa), 13 (cierre), 1 y 9 (simulador), parte de 11 (el crédito ya era configurable; faltaba la nota del Call center) y la mayor parte de "autonomia" (ver `registro-mockup.md`, seccion v111). Correccion al informe de autonomia: el porcentaje y plazo del credito ya eran editables.
