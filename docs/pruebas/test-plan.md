---
id: TP-CAP-001
tipo: test-plan
titulo: "Plan de pruebas de Caprichos — CAP-PENDIENTE"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, EP-CAP-001, EP-CAP-002, EP-CAP-003, EP-CAP-004, EP-CAP-005, EP-CAP-006, EP-CAP-007, EP-CAP-008, EP-CAP-009, EP-CAP-010, EP-CAP-011, EP-CAP-012, EP-CAP-013, EP-CAP-014, EP-CAP-015, EP-CAP-016, EP-CAP-017, EP-CAP-018, EP-CAP-019, EP-CAP-020, EP-CAP-021, EP-CAP-022, FT-CAR-01, FT-CAR-02, FT-CAR-03, FT-PED-01, FT-PED-02, FT-PED-03, FT-CLI-01, FT-CLI-02, FT-CAJ-01, FT-CAJ-02, FT-CAJ-03, FT-CIE-01, FT-CIE-02, FT-COC-01, FT-COC-02, FT-COC-03, FT-SAL-01, FT-SAL-02, FT-SAL-03, FT-DEL-01, FT-DEL-02, FT-DEL-03, FT-STK-01, FT-STK-02, FT-STK-03, FT-ALM-01, FT-ALM-02, FT-ALM-03, FT-COM-01, FT-COM-02, FT-COM-03, FT-OFE-01, FT-OFE-02, FT-OFE-03, FT-USR-01, FT-USR-02, FT-USR-03, FT-BOT-01, FT-BOT-02, FT-BOT-03, FT-ATN-01, FT-ATN-02, FT-ATN-03, FT-CON-01, FT-CON-02, FT-CON-03, FT-CFG-01, FT-CFG-02, FT-INF-01, FT-INF-02, FT-INF-03, FT-OFF-01, FT-LEG-01, FT-LEG-02, FT-USR-04, FT-PLA-01, FT-PLA-02, FT-PLA-03, FT-PLA-04, FT-PLA-05, FT-INI-01]
tags: [test-plan, caprichos, qa, g4, g6, t3]
---

# Test Plan (T-TEST-PLAN) - G6 · Caprichos (carta, administrativo y chatbot)

- Ticket: *(pendiente — R13, D-14)*
- HU referenciadas: 201 (HU-CAP-001 a HU-CAP-201). Todas son de capa A. HU-CAP-168 y HU-CAP-169 (modo sin internet, mini servidor en la caja) llevan casos que se ejecutan en la segunda meta (DT-52).
- Tipo: T3 (BRD §Ticket).
- Flujos críticos E2E propuestos para que el PO los confirme: sección «Flujos críticos E2E».
- Fuente de verdad: `analisis/decisiones.md`.
- **Estado: plan, nada ejecutado.** No hay código (no se construye antes de G3 y G4).

## Ciclos ejecutados (referencia: qa-ciclos.md)

| Ciclo | Fecha | Casos | Fallidos | % | Sev x Impacto | Resultado | Valida |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 · Performance y seguridad |  | 12 SEC + 7 PERF |  |  |  |  | QA José Ángel Espinoza (DT-48) |
| 1 · Funcional |  | TC de las HU de la entrega |  |  |  |  | QA José Ángel Espinoza (DT-48) |
| 2 · Integral |  | 10 E2E + 5 REG |  |  |  |  | QA José Ángel Espinoza (DT-48) |
| 3 · UAT |  | E2E con Kevin en el local |  |  |  |  | Kevin (Stakeholder) |

Criterios de salida: Ciclo 0 sin fallos de seguridad críticos y PERF dentro de umbral; Ciclo 1 con ≤ 20 % de fallidos y ninguno crítico; Ciclo 2 con ≤ 10 % y ningún E2E fallido; Ciclo 3 con la aceptación de Kevin. Cada entrega (H1 piloto, H2, H3) repite los ciclos con sus HU.

## Casos

Convención: un caso `TC-CAP-<HU>-<NN>` por cada criterio `CA-NN` de la historia (1 a 1). Tipos: func, E2E, API, integ, regres, advers. Entregas: H1 (piloto), H2 y H3; el modo sin internet va en la segunda meta (DT-52). Datos **sintéticos**: clientes «Cliente 9001», teléfonos +51 900 000 0xx, correos `@ejemplo.test`, DNI 00000001 a 00000099, RUC 20000000001.

### EP-CAP-001 Carta virtual y catálogo

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-001-01 | HU-CAP-001 · CA-1: dado un catálogo con categorías y productos activos e inactivos, cuando el cliente abre la carta → ve solo los activos, agrupados por categoría y en el orden publicado (FT-CON-02) (RQ-CAR-01-01) | func |  |  |
| TC-CAP-001-02 | HU-CAP-001 · CA-2: dado que el cliente se desplazó por la carta, cuando toca una categoría en la barra → la carta salta a esa categoría y la barra marca la categoría visible (RQ-CAR-01-02) | func |  |  |
| TC-CAP-001-03 | HU-CAP-001 · CA-3: dado el producto «Frappé de Café», cuando el cliente escribe «frappe cafe» → aparece en los resultados; si no hay coincidencias, ve «No encontramos ese producto» (RQ-CAR-01-03) | func |  |  |
| TC-CAP-001-04 | HU-CAP-001 · CA-4: dado la carta abierta, cuando se revisa la pantalla → no hay filtros por rango de precio ni páginas: todo el catálogo se recorre por categorías y buscador (RQ-CAR-01-04) | func |  |  |
| TC-CAP-001-05 | HU-CAP-001 · CA-5: dado un celular de 360 px de ancho, cuando el cliente abre la pantalla de esta historia → todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) | func |  |  |
| TC-CAP-002-01 | HU-CAP-002 · CA-1: dado un producto con foto, cuando el cliente lo abre → ve la foto cuadrada, puede ampliarla con un toque y la foto ampliada se adapta sin recortarse a productos anchos o altos y al tamaño de la pantalla; ve sus tamaños y grupos de opciones (RQ-CAR-01-05) | func |  |  |
| TC-CAP-002-02 | HU-CAP-002 · CA-2: dado un grupo obligatorio con mínimo 1 y máximo 2, cuando el cliente intenta agregar sin elegir → el botón queda desactivado con el aviso del grupo; al marcar una tercera opción, la más antigua no se agrega y se avisa del máximo (RQ-CAR-01-06) | func |  |  |
| TC-CAP-002-03 | HU-CAP-002 · CA-3: dado un frappé de S/ 12 en tamaño grande (+S/ 2) con leche de almendras (+S/ 1,50) y cantidad 2, cuando el cliente lo arma → el precio mostrado es S/ 31,00 (RQ-CAR-01-07) | func |  |  |
| TC-CAP-002-04 | HU-CAP-002 · CA-4: dado un frappé, cuando el cliente abre su ficha → ve el aviso de hielo y los toppings secos (Oreo triturado, chispas, chin chin, almendra) a S/ 1 cada uno (RQ-CAR-01-08) | func |  |  |
| TC-CAP-002-05 | HU-CAP-002 · CA-5: dado 3 capuchinos, cuando el cliente los agrega → ve tres campos «Ingresa el nombre de la persona que tomará esta bebida» con la imagen de una etiqueta de ejemplo; si deja uno vacío se usa el nombre del cliente, y cada nombre sale en la etiqueta de su bebida (FT-COC-02) (RQ-CAR-01-09) | func |  |  |
| TC-CAP-002-06 | HU-CAP-002 · CA-6: dado un celular de 360 px de ancho, cuando el cliente abre la pantalla de esta historia → todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) | func |  |  |
| TC-CAP-003-01 | HU-CAP-003 · CA-1: dado el tipo «Donas» con 5 sabores, 1 desactivado, cuando el cliente elige donas → ve 4 sabores y no puede pedir el desactivado (RQ-CAR-01-10) | func |  |  |
| TC-CAP-003-02 | HU-CAP-003 · CA-2: dado un combo de 2 frappés, cuando el cliente lo arma → elige sabor, leche, dulzor y toppings de cada frappé en un paso plegable propio; si un paso tiene 11 opciones, aparece un buscador dentro (RQ-CAR-01-11) | func |  |  |
| TC-CAP-003-03 | HU-CAP-003 · CA-3: dado un celular de 360 px de ancho, cuando el cliente abre la pantalla de esta historia → todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) | func |  |  |
| TC-CAP-004-01 | HU-CAP-004 · CA-1: dado un producto de S/ 20 con promoción a S/ 15, cuando aparece en la carta → se ve «S/ 20» tachado, «S/ 15» y «-25 %» (RQ-CAR-01-12) | func |  |  |
| TC-CAP-004-02 | HU-CAP-004 · CA-2: dado el combo Dúo con precio para tamaño regular y grande, cuando el cliente lo abre → ve los dos precios y el total cambia al elegir el tamaño (RQ-CAR-01-13) | func |  |  |
| TC-CAP-004-03 | HU-CAP-004 · CA-3: dado un celular de 360 px de ancho, cuando el cliente abre la pantalla de esta historia → todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) | func |  |  |
| TC-CAP-005-01 | HU-CAP-005 · CA-1: dado un horario de 14:00 a 22:00, cuando un cliente abre la carta a las 13:30 → ve «Cerrado · abre a las 14:00»; a las 14:00 ve «Abierto» (RQ-CAR-02-01) | func |  |  |
| TC-CAP-005-02 | HU-CAP-005 · CA-2: dado un feriado marcado como cerrado, cuando un cliente abre la carta ese día en horario normal → ve «Cerrado por feriado» y no puede pedir (RQ-CAR-02-02) | func |  |  |
| TC-CAP-005-03 | HU-CAP-005 · CA-3: dado el local cerrado, cuando el cliente intenta enviar un carrito → el botón de enviar queda desactivado con el horario de apertura (RQ-CAR-02-03) | func |  |  |
| TC-CAP-006-01 | HU-CAP-006 · CA-1: dado un producto marcado agotado, cuando aparece en la carta → se ve en gris con «Agotado» y su botón de agregar no responde (RQ-CAR-02-04) | func |  |  |
| TC-CAP-006-02 | HU-CAP-006 · CA-2: dado el sabor «Manjar» agotado, cuando el cliente elige donas → el sabor aparece apagado y no se puede marcar (RQ-CAR-02-05) | func |  |  |
| TC-CAP-006-03 | HU-CAP-006 · CA-3: dado un producto cuya receta usa un insumo con stock cero en su área, cuando el cliente abre la carta → el producto aparece agotado sin que nadie lo marque (RQ-CAR-02-09) | func |  |  |
| TC-CAP-007-01 | HU-CAP-007 · CA-1: dado la Alta demanda con pausa activa, cuando el cliente abre la carta → ve «Por ahora no estamos recibiendo pedidos» y no puede enviar; al apagar la pausa vuelve a recibir (RQ-CAR-02-06) | func |  |  |
| TC-CAP-007-02 | HU-CAP-007 · CA-2: dado el rango de entrega de 25 a 35 minutos y Alta demanda de +30, cuando el cliente ve el tiempo estimado → lee «de 55 a 65 minutos» (RQ-CAR-02-07) | func |  |  |
| TC-CAP-008-01 | HU-CAP-008 · CA-1: dado un carrito con un producto que se agotó mientras el cliente lo armaba, cuando envía → el pedido no se envía, ve qué producto ya no está y puede quitarlo y continuar (RQ-CAR-02-08) | func |  |  |
| TC-CAP-009-01 | HU-CAP-009 · CA-1: dado las ventas del mes con A (40), B (30) y C (20) como los más vendidos, cuando el cliente abre la carta → A lleva tres estrellas y B y C una (RQ-CAR-03-01) | func |  |  |
| TC-CAP-009-02 | HU-CAP-009 · CA-2: dado el cambio de mes a las 00:00 de Lima, cuando el cliente abre la carta el día 1 → no hay estrellas hasta que haya ventas del mes, y el ranking de octubre queda en el historial del administrativo (RQ-CAR-03-02) | func |  |  |
| TC-CAP-009-03 | HU-CAP-009 · CA-3: dado las estrellas visibles, cuando el administrador las oculta con confirmación Sí/No → la carta deja de mostrarlas sin perder el ranking (RQ-CAR-03-03) | func |  |  |
| TC-CAP-009-04 | HU-CAP-009 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-010-01 | HU-CAP-010 · CA-1: dado la configuración del local completa, cuando el cliente abre Conócenos → ve cada dato tal como está en Configuración del local y el botón de mapa abre la ubicación (RQ-CAR-03-04) | func |  |  |
| TC-CAP-010-02 | HU-CAP-010 · CA-2: dado que el administrador cambia el teléfono en Configuración del local, cuando el cliente abre Conócenos y el pie → ve el teléfono nuevo en los dos sitios (RQ-CAR-03-05) | func |  |  |
| TC-CAP-010-03 | HU-CAP-010 · CA-3: dado la carta, cuando el cliente llega al final → ve el pie con los datos de Configuración del local y enlaces a WhatsApp y redes (RQ-CAR-03-09) | integ |  |  |
| TC-CAP-010-04 | HU-CAP-010 · CA-4: dado el enlace de Google Maps cargado en Configuración del local, cuando el cliente toca «Ver nuestras reseñas en Google» → se abre la ficha del local en Google Maps; en la carta no aparece ninguna reseña, nombre ni foto de terceros (RQ-CAR-03-10) | func |  |  |
| TC-CAP-011-01 | HU-CAP-011 · CA-1: dado el formulario, cuando el cliente elige «Queja», escribe el texto y envía → ve un agradecimiento y el mensaje queda en el administrativo como «Nuevo» (RQ-CAR-03-06) | func |  |  |
| TC-CAP-011-02 | HU-CAP-011 · CA-2: dado una queja recibida, cuando se guarda → se envía un aviso al correo del dueño guardado en Configuración y una notificación en el administrativo (FT-INF-03) (RQ-CAR-03-07) | func |  |  |
| TC-CAP-011-03 | HU-CAP-011 · CA-3: dado un mensaje nuevo, cuando el administrador lo marca atendido con Sí/No → cambia de estado, guarda quién y cuándo, y no hay opción de borrarlo (RQ-CAR-03-08) | func |  |  |
| TC-CAP-011-04 | HU-CAP-011 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |

### EP-CAP-002 Pedido del cliente en la carta

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-012-01 | HU-CAP-012 · CA-1: dado dos productos con opciones distintas, cuando el cliente los agrega → el carrito los muestra por separado con sus opciones, nota y subtotal (RQ-PED-01-01) | func |  |  |
| TC-CAP-012-02 | HU-CAP-012 · CA-2: dado un producto en el carrito, cuando el cliente cambia la cantidad a 3 → el subtotal y el total se recalculan; al quitarlo con Sí/No desaparece (RQ-PED-01-02) | func |  |  |
| TC-CAP-012-03 | HU-CAP-012 · CA-3: dado el carrito, cuando el cliente va a confirmar → elige entre «Delivery» y «Para recoger»; no aparece «En el local» (RQ-PED-01-03) | func |  |  |
| TC-CAP-012-04 | HU-CAP-012 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-012-05 | HU-CAP-012 · CA-5: dado un celular de 360 px de ancho, cuando el cliente abre la pantalla de esta historia → todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) | func |  |  |
| TC-CAP-013-01 | HU-CAP-013 · CA-1: dado el paso de datos, cuando el cliente deja vacío el correo y no tiene cuenta → puede enviar el pedido; sin nombre o con un teléfono de menos de 9 dígitos no puede (RQ-PED-01-04) | func |  |  |
| TC-CAP-013-02 | HU-CAP-013 · CA-2: dado un cliente que ya pidió y aceptó el aviso, cuando vuelve a pedir desde el mismo celular o escribe el mismo teléfono → su nombre y última dirección aparecen llenos y editables (RQ-PED-01-05) | func |  |  |
| TC-CAP-013-03 | HU-CAP-013 · CA-3: dado un celular de 360 px de ancho, cuando el cliente abre la pantalla de esta historia → todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) | func |  |  |
| TC-CAP-014-01 | HU-CAP-014 · CA-1: dado los medios activos en Configuración del local, cuando el cliente llega al pago → solo ve esos medios, con Yape y Plin como opciones propias y visibles, y sin elegir uno no puede enviar el pedido (RQ-PED-01-06) | func |  |  |
| TC-CAP-014-02 | HU-CAP-014 · CA-2: dado un total de S/ 37,50, cuando el cliente elige efectivo y escribe S/ 50 → ve vuelto S/ 12,50; un monto menor al total no se acepta (RQ-PED-01-07) | func |  |  |
| TC-CAP-014-03 | HU-CAP-014 · CA-3: dado cualquier medio de pago, cuando el cliente envía → ve «Un asesor te escribirá por WhatsApp para coordinar el pago», sin campo para subir la captura (RQ-PED-01-08) | integ |  |  |
| TC-CAP-014-04 | HU-CAP-014 · CA-4: dado un celular de 360 px de ancho, cuando el cliente abre la pantalla de esta historia → todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) | func |  |  |
| TC-CAP-015-01 | HU-CAP-015 · CA-1: dado un carrito con un descuento automático vigente y envío de S/ 4, cuando el cliente ve el resumen → cada línea aparece por separado y el total es la suma correcta (RQ-PED-01-09) | func |  |  |
| TC-CAP-015-02 | HU-CAP-015 · CA-2: dado un cupón vigente, cuando el cliente lo escribe → ve el descuento aplicado o el motivo por el que no aplica (RQ-PED-01-10) | func |  |  |
| TC-CAP-015-03 | HU-CAP-015 · CA-3: dado el resumen, cuando el cliente marca «Quiero factura» → se le pide RUC de 11 dígitos y razón social; si no marca nada, el comprobante es nota de venta (RQ-PED-01-11) | func |  |  |
| TC-CAP-015-04 | HU-CAP-015 · CA-4: dado un celular de 360 px de ancho, cuando el cliente abre la pantalla de esta historia → todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) | func |  |  |
| TC-CAP-016-01 | HU-CAP-016 · CA-1: dado un cliente que acepta el permiso, cuando toca el botón → ve «Ubicación encontrada», el pin en el mapa y el enlace que abre ese punto (RQ-PED-02-01) | func |  |  |
| TC-CAP-016-02 | HU-CAP-016 · CA-2: dado un cliente que niega el permiso, cuando toca el botón → ve «No fue posible conseguir la ubicación» y puede terminar el pedido escribiendo la dirección (RQ-PED-02-02) | func |  |  |
| TC-CAP-016-03 | HU-CAP-016 · CA-3: dado un pedido con punto, cuando el cliente deja la dirección vacía → puede enviar; sin punto y con la dirección vacía, no puede (RQ-PED-02-03) | func |  |  |
| TC-CAP-016-04 | HU-CAP-016 · CA-4: dado el pin puesto por el GPS, cuando el cliente intenta seguir sin confirmar → ve «Revisa que el punto rojo sea donde recibirás tu pedido» y el botón «Mi pedido llega aquí»; al confirmar, se calcula el envío con ese punto (RQ-PED-02-04) | func |  |  |
| TC-CAP-016-05 | HU-CAP-016 · CA-5: dado el pin en el mapa, cuando el cliente lo arrastra a su puerta y escribe «casa verde, 2.º piso» → el pedido guarda el punto nuevo y la referencia (RQ-PED-02-05) | func |  |  |
| TC-CAP-016-06 | HU-CAP-016 · CA-6: dado el paso de entrega, cuando se revisa el formulario → no hay campo de código Plus (RQ-PED-02-06) | func |  |  |
| TC-CAP-016-07 | HU-CAP-016 · CA-7: dado un celular de 360 px de ancho, cuando el cliente abre la pantalla de esta historia → todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) | func |  |  |
| TC-CAP-017-01 | HU-CAP-017 · CA-1: dado un punto dentro de la zona Z3 con tarifa S/ 4, cuando el cliente confirma la ubicación → ve «Envío S/ 4,00», sin el nombre de la zona y sin líneas de zonas en el mapa (RQ-PED-02-07) | func |  |  |
| TC-CAP-017-02 | HU-CAP-017 · CA-2: dado un punto fuera de todas las zonas activas, cuando el cliente lo confirma → ve «Aún no llegamos a esa dirección» con el botón «Recoger en tienda», y no puede enviar como delivery (RQ-PED-02-08) | func |  |  |
| TC-CAP-017-03 | HU-CAP-017 · CA-3: dado un pedido enviado solo con dirección escrita, cuando llega a caja → el envío figura «por calcular» y el pedido no se puede confirmar hasta ubicarlo (FT-CAJ-01) (RQ-PED-02-09) | func |  |  |
| TC-CAP-017-04 | HU-CAP-017 · CA-4: dado un celular de 360 px de ancho, cuando el cliente abre la pantalla de esta historia → todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) | func |  |  |
| TC-CAP-018-01 | HU-CAP-018 · CA-1: dado envío gratis con «más de S/ 70», cuando los productos suman S/ 70,00 → se cobra envío; con S/ 70,10, el envío es S/ 0 (RQ-PED-02-10) | func |  |  |
| TC-CAP-018-02 | HU-CAP-018 · CA-2: dado un pedido mínimo de S/ 14,50, cuando los productos suman S/ 12 → se ve cuánto falta y no se puede enviar como delivery (RQ-PED-02-11) | func |  |  |
| TC-CAP-018-03 | HU-CAP-018 · CA-3: dado un celular de 360 px de ancho, cuando el cliente abre la pantalla de esta historia → todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) | func |  |  |
| TC-CAP-019-01 | HU-CAP-019 · CA-1: dado un carrito válido, cuando el cliente envía → cada parte aparece en la pantalla de su área y se imprime su comanda, y el pedido figura en Pedidos y caja como «en cocina, pago por coordinar» con código, productos, opciones, notas, modalidad, ubicación, método de pago y total (RQ-PED-03-01) | func |  |  |
| TC-CAP-019-02 | HU-CAP-019 · CA-2: dado un pedido de la carta sin pagar, cuando el asesor confirma el pago por WhatsApp → caja lo marca cobrado; si el cliente no paga, caja lo anula con motivo y PIN de la supervisora y cocina lo ve anulado (RQ-PED-03-02) | integ |  |  |
| TC-CAP-019-03 | HU-CAP-019 · CA-3: dado la pausa activada mientras el cliente confirmaba, cuando envía → el pedido no se registra y el cliente ve el motivo (FT-CAR-02) (RQ-PED-03-08) | func |  |  |
| TC-CAP-019-04 | HU-CAP-019 · CA-4: dado un doble toque en «Enviar», cuando llegan las dos solicitudes → queda un solo pedido con un solo código (RQ-PED-03-09) | func |  |  |
| TC-CAP-020-01 | HU-CAP-020 · CA-1: dado el pedido enviado, cuando termina el envío → el cliente ve «Pedido N.º ABC123 recibido», el resumen y el mensaje del asesor por WhatsApp (RQ-PED-03-03) | integ |  |  |
| TC-CAP-020-02 | HU-CAP-020 · CA-2: dado la confirmación, cuando el cliente toca «Escribir por WhatsApp» → se abre un chat con el número del local y un mensaje con código, productos, opciones, nota, entrega, total y pago preferido (RQ-PED-03-04) | integ |  |  |
| TC-CAP-021-01 | HU-CAP-021 · CA-1: dado un usuario de caja con la sesión abierta, cuando entra un pedido de la carta → suena un aviso y la campanita suma una notificación que abre el pedido (RQ-PED-03-05) | func |  |  |
| TC-CAP-021-02 | HU-CAP-021 · CA-2: dado el acceso a WhatsApp configurado, cuando entra un pedido de la carta → el número del local envía al teléfono del cliente «Recibimos tu pedido» con el código, los productos, el total y el método de pago; el asesor sigue la conversación para pedir la captura (RQ-PED-03-06) | integ |  |  |
| TC-CAP-021-03 | HU-CAP-021 · CA-3: dado un plazo de 5 minutos, cuando un pedido de la carta sigue con el pago por coordinar a los 5 minutos → caja recibe un recordatorio; a los 30 minutos sigue sin anularse (RQ-PED-03-07) | func |  |  |

### EP-CAP-003 Cuenta del cliente y puntos

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-022-01 | HU-CAP-022 · CA-1: dado un cliente sin sesión, cuando toca «Ingresar» → ve las tres opciones y «Seguir como invitado» lo devuelve a la carta sin pedir nada (RQ-CLI-01-01) | func |  |  |
| TC-CAP-022-02 | HU-CAP-022 · CA-2: dado el formulario, cuando el cliente deja el correo vacío y acepta → la cuenta se crea; sin aceptación, sin cumpleaños (persona) o con las contraseñas distintas, no (RQ-CLI-01-02) | func |  |  |
| TC-CAP-022-03 | HU-CAP-022 · CA-3: dado un DNI ya registrado, cuando alguien intenta crear otra cuenta con él → ve «Ese DNI ya tiene cuenta» con la opción de ingresar (RQ-CLI-01-03) | func |  |  |
| TC-CAP-023-01 | HU-CAP-023 · CA-1: dado un cliente con cuenta, cuando ingresa con su DNI y contraseña → la cabecera muestra su nombre y su saldo de puntos (RQ-CLI-01-04) | func |  |  |
| TC-CAP-023-02 | HU-CAP-023 · CA-2: dado un DNI con 5 contraseñas erradas seguidas, cuando se intenta una sexta → se rechaza y se avisa cuánto falta para reintentar (RQ-CLI-01-05) | func |  |  |
| TC-CAP-023-03 | HU-CAP-023 · CA-3: dado un trabajador con usuario, cuando pide para sí mismo → el pedido se asocia a su cuenta y suma puntos al cobrarse (FT-CLI-02) (RQ-CLI-01-12) | func |  |  |
| TC-CAP-024-01 | HU-CAP-024 · CA-1: dado un cliente sin cuenta en el local, cuando el cajero lo registra con DNI, nombre, cumpleaños y aceptación → queda creado sin contraseña y puede crearla después en la carta (RQ-CLI-01-06) | func |  |  |
| TC-CAP-024-02 | HU-CAP-024 · CA-2: dado un cliente sin contraseña, cuando entra a «Ingresar», escribe su DNI y confirma un dato (cumpleaños) → crea su contraseña y entra (RQ-CLI-01-07) | func |  |  |
| TC-CAP-024-03 | HU-CAP-024 · CA-3: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-025-01 | HU-CAP-025 · CA-1: dado un cliente con 3 pedidos, cuando el cajero escribe su DNI completo → lo encuentra y ve sus pedidos con fecha y total; con un DNI parcial no se muestra nada (RQ-CLI-01-08) | func |  |  |
| TC-CAP-025-02 | HU-CAP-025 · CA-2: dado un cliente, cuando el cajero lo edita → el DNI o RUC aparece bloqueado y no hay campos de puntos ni pedidos (RQ-CLI-01-09) | func |  |  |
| TC-CAP-025-03 | HU-CAP-025 · CA-3: dado la lista de clientes, cuando la abre el cajero → ve «4567****» y «2060******5»; el administrador toca «Ver completo» en la ficha y el Historial de acciones registra quién lo vio (RQ-CLI-01-10) | func |  |  |
| TC-CAP-025-04 | HU-CAP-025 · CA-4: dado 300 clientes con cuenta, cuando el administrador toca «Exportar a Excel» → descarga nombre, teléfono, cumpleaños y fecha del último pedido (sin DNI completo) para importarlos a Google Contactos, y el historial registra la exportación (RQ-CLI-01-11) | func |  |  |
| TC-CAP-025-05 | HU-CAP-025 · CA-5: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-026-01 | HU-CAP-026 · CA-1: dado un pedido de S/ 70,00 de un cliente con cuenta y 5 %, cuando se cobra → suma 3,50 puntos; si se reimprime o se vuelve a abrir, no suma otra vez (RQ-CLI-02-01) | func |  |  |
| TC-CAP-026-02 | HU-CAP-026 · CA-2: dado un pedido con un 2×1 de frappé marcado «No suma puntos» (S/ 15) y un sándwich de S/ 20, con 5 %, cuando se cobra → suma 1,00 punto (solo por el sándwich); un pedido pagado con cupón no suma (RQ-CLI-02-02) | func |  |  |
| TC-CAP-026-03 | HU-CAP-026 · CA-3: dado un pedido sin cuenta, cuando se cobra → no se suman puntos a nadie (RQ-CLI-02-03) | func |  |  |
| TC-CAP-026-04 | HU-CAP-026 · CA-4: dado un pedido que sumó 37 puntos, cuando se anula con su motivo → el saldo baja 37 y el historial muestra la reversa (RQ-CLI-02-04) | func |  |  |
| TC-CAP-026-05 | HU-CAP-026 · CA-5: dado un cliente con cuenta que paga en el local, cuando el cajero escribe su DNI en el pedido → el pedido se asocia y suma al cobrarse, sin pedir contraseña (RQ-CLI-02-05) | func |  |  |
| TC-CAP-026-06 | HU-CAP-026 · CA-6: dado 5 %, cuando el administrador lo cambia a 3 % con Sí/No → los pedidos cobrados desde entonces suman el 3 % y los anteriores no cambian; el cambio queda en el Historial de acciones (RQ-CLI-02-08) | func |  |  |
| TC-CAP-026-07 | HU-CAP-026 · CA-7: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-027-01 | HU-CAP-027 · CA-1: dado un cliente que ingresó, cuando abre Mi cuenta → ve su saldo y cada movimiento con fecha, pedido y puntos (RQ-CLI-02-06) | func |  |  |
| TC-CAP-027-02 | HU-CAP-027 · CA-2: dado la ficha de un cliente abierta por el cajero, cuando busca cómo editar puntos → no hay opción (RQ-CLI-02-09) | func |  |  |
| TC-CAP-028-01 | HU-CAP-028 · CA-1: dado un cliente con cumpleaños el 20/11, cuando ingresa a la carta en la semana de su cumpleaños → la campanita muestra su cupón con código y vigencia (RQ-CLI-02-07) | func |  |  |
| TC-CAP-195-01 | HU-CAP-195 · CA-1: dado un cliente con 1,50 puntos que pide S/ 70, cuando termina → ve «Por esta compra acumulas 3,50 puntos · Tendrás 5,00»; un invitado ve «Ingresa y gana 3,50 puntos con este pedido» y puede seguir sin ingresar (RQ-CLI-02-10) | func |  |  |
| TC-CAP-195-02 | HU-CAP-195 · CA-2: dado un cliente con 3,50 puntos y un pedido de S/ 20, cuando escribe 2 en «¿Cuántos puntos deseas usar?» → ve «Te quedan 1,50» y al tocar «Aplicar» el total baja a S/ 18,00 (RQ-CLI-02-11) | func |  |  |
| TC-CAP-195-03 | HU-CAP-195 · CA-3: dado un saldo de 3,50, cuando el cliente escribe 5 → ve «Solo tienes 3,50 puntos» y no se aplica; si el pedido con 2 puntos canjeados se anula, el saldo vuelve a subir 2 y el historial muestra la devolución (RQ-CLI-02-12) | func |  |  |
| TC-CAP-195-04 | HU-CAP-195 · CA-4: dado un cliente con cuenta en el local, cuando el cajero toca «Usar puntos» en el cobro → el cliente escribe su contraseña en la pantalla de caja y el cajero indica cuántos puntos usar; sin contraseña solo se suman puntos (RQ-CLI-02-13) | func |  |  |

### EP-CAP-004 Confirmación y cobro en caja

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-029-01 | HU-CAP-029 · CA-1: dado 2 pedidos por confirmar de chatbot y teléfono y 1 de la carta, cuando el cajero abre la cola → ve los 2 primeros ordenados por llegada con su canal y tiempo de espera, y el de la carta en «Pago por coordinar» (RQ-CAJ-01-01) | func |  |  |
| TC-CAP-029-02 | HU-CAP-029 · CA-2: dado un pedido por confirmar, cuando el cajero toca «Escribir al cliente» → se abre WhatsApp con el número del cliente y el resumen (productos, opciones, nota, entrega, total y pago preferido) (RQ-CAJ-01-04) | integ |  |  |
| TC-CAP-029-03 | HU-CAP-029 · CA-3: dado un pedido de mesa del mozo, cuando se envía → no aparece en «Por confirmar» y sí en cocina (RQ-CAJ-01-13) | func |  |  |
| TC-CAP-029-04 | HU-CAP-029 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-030-01 | HU-CAP-030 · CA-1: dado un pedido de la carta con Yape, cuando el asesor recibe la captura por WhatsApp y el cajero la sube y confirma el pago → el pedido queda pagado con su autor y hora, y cocina no recibe una comanda repetida (RQ-CAJ-01-02) | integ |  |  |
| TC-CAP-030-02 | HU-CAP-030 · CA-2: dado un pedido con Yape, cuando el cajero intenta confirmar sin comprobante → no puede; con la imagen del comprobante y Sí/No, el pedido queda confirmado con su autor y hora (RQ-CAJ-01-05) | func |  |  |
| TC-CAP-030-03 | HU-CAP-030 · CA-3: dado un delivery con efectivo y vuelto de S/ 50, cuando el cajero confirma → no se pide comprobante y el pedido conserva con cuánto paga el cliente (RQ-CAJ-01-06) | func |  |  |
| TC-CAP-030-04 | HU-CAP-030 · CA-4: dado un pedido confirmado, cuando termina la confirmación → aparece en las pantallas de sus áreas con el cronómetro en cero y se envía a sus ticketeras (RQ-CAJ-01-07) | integ |  |  |
| TC-CAP-030-05 | HU-CAP-030 · CA-5: dado un pedido abierto por el cajero, cuando el call center intenta confirmarlo al mismo tiempo → solo una confirmación vale y la otra ve «Este pedido ya lo confirmó …» (RQ-CAJ-01-12) | integ |  |  |
| TC-CAP-030-06 | HU-CAP-030 · CA-6: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-030-07 | HU-CAP-030 · CA-7: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-031-01 | HU-CAP-031 · CA-1: dado un pedido de la carta solo con dirección escrita, cuando está listo → el repartidor lo ve con «Falta ubicar» y no puede tomarlo; cuando caja fija el punto, se calculan zona y envío y se puede tomar (RQ-CAJ-01-03) | func |  |  |
| TC-CAP-031-02 | HU-CAP-031 · CA-2: dado un delivery solo con dirección escrita, cuando el cajero intenta confirmar → ve «Ubica el pedido antes de confirmarlo» y el botón queda desactivado (RQ-CAJ-01-08) | func |  |  |
| TC-CAP-031-03 | HU-CAP-031 · CA-3: dado un pedido sin punto, cuando el cajero busca «Av. Brasil 1234» y fija el pin → el pedido guarda el punto y el enlace, el envío pasa de «por calcular» al de su zona y el total se actualiza (RQ-CAJ-01-09) | func |  |  |
| TC-CAP-031-04 | HU-CAP-031 · CA-4: dado un punto fuera de cobertura, cuando el cajero lo fija → se avisa y se ofrece pasar el pedido a «para recoger» (RQ-CAJ-01-10) | func |  |  |
| TC-CAP-031-05 | HU-CAP-031 · CA-5: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-032-01 | HU-CAP-032 · CA-1: dado un pedido por confirmar, cuando el cajero lo rechaza con el motivo «Cliente no responde» y Sí/No → sale de la cola, queda en el historial con su motivo y no llega a cocina (RQ-CAJ-01-11) | func |  |  |
| TC-CAP-032-02 | HU-CAP-032 · CA-2: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-032-03 | HU-CAP-032 · CA-3: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-033-01 | HU-CAP-033 · CA-1: dado un pedido de S/ 42, cuando el cajero elige «Plin» y confirma → el pedido queda cobrado con Plin S/ 42, su autor y hora (RQ-CAJ-02-01) | func |  |  |
| TC-CAP-033-02 | HU-CAP-033 · CA-2: dado un total de S/ 42, cuando el cajero escribe S/ 100 en efectivo → ve vuelto S/ 58,00; con S/ 40 no puede cobrar (RQ-CAJ-02-02) | func |  |  |
| TC-CAP-033-03 | HU-CAP-033 · CA-3: dado un usuario mozo con una mesa ocupada, cuando abre el pedido → puede imprimir la precuenta y no ve el botón «Cobrar» (RQ-CAJ-02-05) | func |  |  |
| TC-CAP-033-04 | HU-CAP-033 · CA-4: dado un pedido que ocupa las mesas 4 y 5, cuando se cobra → ambas quedan libres en el plano (RQ-CAJ-02-06) | func |  |  |
| TC-CAP-033-05 | HU-CAP-033 · CA-5: dado la caja del día sin abrir, cuando el cajero intenta cobrar → ve «Abre la caja para cobrar» (RQ-CAJ-02-11) | func |  |  |
| TC-CAP-034-01 | HU-CAP-034 · CA-1: dado un total de S/ 42, cuando el cajero pone S/ 20 Yape y S/ 20 efectivo → ve «Faltan S/ 2,00» y no puede cobrar; con S/ 22 en efectivo, sí (RQ-CAJ-02-03) | func |  |  |
| TC-CAP-034-02 | HU-CAP-034 · CA-2: dado un total de S/ 42 con S/ 30 Yape y efectivo por S/ 12 entregado con S/ 20, cuando se cobra → el vuelto es S/ 8,00 (RQ-CAJ-02-04) | func |  |  |
| TC-CAP-035-01 | HU-CAP-035 · CA-1: dado un cobro, cuando el cajero no cambia nada → el comprobante es nota de venta; si el cliente pidió factura, se exige RUC (RQ-CAJ-02-07) | func |  |  |
| TC-CAP-035-02 | HU-CAP-035 · CA-2: dado un pedido del personal, cuando el cajero elige «Crédito del personal» → el monto con descuento se suma al mes del trabajador y no entra a la caja (RQ-CAJ-02-08) | func |  |  |
| TC-CAP-036-01 | HU-CAP-036 · CA-1: dado un cobro de la caja abierta, cuando el cajero elige el motivo y la supervisora escribe su PIN de 6 dígitos en la pantalla de caja → el pedido queda anulado y el cobro sale de los totales; sin motivo o con un PIN de 4 dígitos no se acepta; con la caja ya cerrada, no se permite; no existe aprobación por notificación (RQ-CAJ-02-09) | func |  |  |
| TC-CAP-036-02 | HU-CAP-036 · CA-2: dado un pedido anulado por el cajero Luis con el PIN de la supervisora Ana, cuando se revisa el Historial de acciones → aparece «ANULAR · CP-0098 · pidió Luis · aprobó Ana · motivo: cliente no pagó» (RQ-CAJ-02-10) | func |  |  |
| TC-CAP-036-03 | HU-CAP-036 · CA-3: dado 3 PIN erróneos en una anulación, cuando se intenta un cuarto → se rechaza con «Espera 5 minutos» y el Historial de acciones registra los 3 intentos con la caja y la hora (RQ-CAJ-02-12) | func |  |  |
| TC-CAP-037-01 | HU-CAP-037 · CA-1: dado un producto con grupo obligatorio, cuando el cajero lo agrega sin elegir → no puede; puede alternar la vista con o sin imágenes (RQ-CAJ-03-01) | func |  |  |
| TC-CAP-037-02 | HU-CAP-037 · CA-2: dado 3 frappés de fresa tamaño regular, cuando el cajero pone cantidad 3 → se le piden 3 leches y elige «entera, entera, almendra»; la cuenta y la comanda muestran «2 × entera · 1 × almendra» (RQ-CAJ-03-02) | func |  |  |
| TC-CAP-037-03 | HU-CAP-037 · CA-3: dado un pedido tomado por teléfono, cuando el call center lo guarda → entra a la cola «por confirmar» con canal «Teléfono» (RQ-CAJ-03-09) | func |  |  |
| TC-CAP-037-04 | HU-CAP-037 · CA-4: dado un pedido guardado sin cobrar, cuando el call center lo anula con motivo → queda anulado con su autor y motivo (RQ-CAJ-03-11) | func |  |  |
| TC-CAP-037-05 | HU-CAP-037 · CA-5: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-038-01 | HU-CAP-038 · CA-1: dado un cliente que pidió antes, cuando el call center escribe su teléfono → aparecen su nombre y su última dirección con el punto en el mapa, editables (RQ-CAJ-03-03) | func |  |  |
| TC-CAP-038-02 | HU-CAP-038 · CA-2: dado un cliente con pedidos anteriores, cuando el call center toca «Repetir» en uno → el carrito se llena con esos productos y opciones a los precios de hoy (RQ-CAJ-03-04) | func |  |  |
| TC-CAP-038-03 | HU-CAP-038 · CA-3: dado un pedido por teléfono, cuando el call center busca la dirección que dictó el cliente y ajusta el pin → el pedido guarda el punto, el enlace, la zona y su envío (RQ-CAJ-03-05) | func |  |  |
| TC-CAP-038-04 | HU-CAP-038 · CA-4: dado un cliente con envío fijo de S/ 2, cuando se toma su delivery a la zona de S/ 5 → el envío es S/ 2 (RQ-CAJ-03-06) | func |  |  |
| TC-CAP-038-05 | HU-CAP-038 · CA-5: dado un delivery en efectivo de S/ 37, cuando el call center anota «paga con S/ 50» → el pedido muestra vuelto S/ 13 para el repartidor (RQ-CAJ-03-12) | func |  |  |
| TC-CAP-038-06 | HU-CAP-038 · CA-6: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-039-01 | HU-CAP-039 · CA-1: dado un descuento automático vigente para la categoría Frappés, cuando el cajero agrega un frappé → el descuento aparece solo; al escribir un cupón, se aplica según la regla de acumulación (RQ-CAJ-03-07) | func |  |  |
| TC-CAP-039-02 | HU-CAP-039 · CA-2: dado un pedido con dos Ice Coffee de S/ 9, cuando el cajero los agrega → ve «El pedido califica para 2×1 Ice Coffee · ahorra S/ 9 · Aplicar»; si el cliente no la quiere, el aviso se cierra y no vuelve a salir en ese pedido (RQ-CAJ-03-08) | func |  |  |
| TC-CAP-039-03 | HU-CAP-039 · CA-3: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-040-01 | HU-CAP-040 · CA-1: dado el pedido del personal, cuando el cajero elige a un trabajador activo → solo se ofrecen «En el local» y «Para llevar» y se aplica el 25 % salvo a combos, promociones y docenas (RQ-CAJ-03-10) | func |  |  |
| TC-CAP-040-02 | HU-CAP-040 · CA-2: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |

### EP-CAP-005 Apertura y cierre de caja

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-041-01 | HU-CAP-041 · CA-1: dado el día nuevo, cuando el cajero abre la caja sin cambiar el monto → la apertura es S/ 0,00 y los totales del día están en cero; el día anterior queda en el historial (RQ-CIE-01-01) | func |  |  |
| TC-CAP-041-02 | HU-CAP-041 · CA-2: dado una caja abierta, cuando otro usuario intenta abrir otra → ve «Ya hay una caja abierta por …» (RQ-CIE-01-02) | func |  |  |
| TC-CAP-042-01 | HU-CAP-042 · CA-1: dado cobros con efectivo, Yape y tarjeta, cuando el administrador abre el resumen → ve el total de cada medio y del día; cuando lo abre el cajero, ve la lista de cobros sin sumas por medio ni efectivo esperado, y el servidor no le entrega esos totales (RQ-CIE-01-03) | advers |  |  |
| TC-CAP-042-02 | HU-CAP-042 · CA-2: dado un egreso de S/ 15 por «compra de hielo», cuando el cajero lo registra con Sí/No → baja el efectivo esperado en S/ 15 y queda en la lista con su autor y hora (RQ-CIE-01-04) | func |  |  |
| TC-CAP-042-03 | HU-CAP-042 · CA-3: dado un ingreso mal registrado, cuando el cajero lo anula con motivo → deja de sumar y sigue visible tachado con su motivo (RQ-CIE-01-05) | func |  |  |
| TC-CAP-042-04 | HU-CAP-042 · CA-4: dado apertura S/ 50, ventas en efectivo S/ 300, ingresos S/ 20 y egresos S/ 15, cuando se consulta → el efectivo esperado es S/ 355,00 (RQ-CIE-01-06) | func |  |  |
| TC-CAP-042-05 | HU-CAP-042 · CA-5: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-043-01 | HU-CAP-043 · CA-1: dado un delivery cobrado en efectivo por el repartidor (S/ 40), cuando se consulta el efectivo esperado → no lo incluye y figura en «Por liquidar» a nombre del repartidor (RQ-CIE-01-07) | func |  |  |
| TC-CAP-043-02 | HU-CAP-043 · CA-2: dado un repartidor con S/ 120 por liquidar, cuando entrega S/ 120 y el cajero confirma → sube el efectivo esperado y su saldo por liquidar queda en cero; si entrega S/ 110, se registra la diferencia de S/ 10 (RQ-CIE-01-08) | func |  |  |
| TC-CAP-044-01 | HU-CAP-044 · CA-1: dado 3 billetes de 100, 2 de 20 y 5 monedas de 1, cuando el cajero los anota → el contado es S/ 345,00 (RQ-CIE-02-01) | func |  |  |
| TC-CAP-044-02 | HU-CAP-044 · CA-2: dado el arqueo abierto, cuando el cajero cuenta → solo ve lo que él anota; la pantalla y el servidor no le entregan el efectivo esperado, las ventas por medio ni la diferencia (RQ-CIE-02-02) | advers |  |  |
| TC-CAP-044-03 | HU-CAP-044 · CA-3: dado Yape vendido S/ 210, cuando el cajero anota S/ 200 visto en el celular → el sistema guarda el faltante de S/ 10,00 para la supervisora y al cajero no se le muestra el monto (RQ-CIE-02-03) | func |  |  |
| TC-CAP-044-04 | HU-CAP-044 · CA-4: dado un conteo con S/ 4 de menos en efectivo, cuando el cajero toca «Revisar» → ve «No cuadra» sin decir en qué medio ni cuánto; al volver a contar, el intento anterior queda en el Historial de acciones (RQ-CIE-02-04) | func |  |  |
| TC-CAP-044-05 | HU-CAP-044 · CA-5: dado efectivo esperado S/ 355 y contado S/ 360, cuando se cierra → queda «Sobrante S/ 5,00» en el historial que ve el administrador; no se pide justificar a nadie, solo una nota opcional (RQ-CIE-02-06) | func |  |  |
| TC-CAP-044-06 | HU-CAP-044 · CA-6: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-045-01 | HU-CAP-045 · CA-1: dado un pedido por confirmar, cuando el cajero intenta cerrar → ve la lista de pendientes y el cierre no procede (RQ-CIE-02-07) | func |  |  |
| TC-CAP-045-02 | HU-CAP-045 · CA-2: dado un repartidor con S/ 40 por liquidar, cuando el cajero intenta cerrar → ve «Falta liquidar a …» y no puede (RQ-CIE-02-08) | func |  |  |
| TC-CAP-045-03 | HU-CAP-045 · CA-3: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-046-01 | HU-CAP-046 · CA-1: dado un arqueo completo, cuando el cajero confirma el cierre → queda en el historial con fecha, autor, apertura, ventas por medio, movimientos, contado y diferencias (RQ-CIE-02-09) | func |  |  |
| TC-CAP-046-02 | HU-CAP-046 · CA-2: dado un cierre del historial, cuando cualquier usuario lo abre → solo puede verlo, imprimirlo o exportarlo (RQ-CIE-02-10) | func |  |  |
| TC-CAP-046-03 | HU-CAP-046 · CA-3: dado cierres de octubre, cuando el administrador filtra del 1 al 15 → ve esos cierres con sus diferencias y los descarga como CSV (RQ-CIE-02-11) | func |  |  |
| TC-CAP-046-04 | HU-CAP-046 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-046-05 | HU-CAP-046 · CA-5: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-199-01 | HU-CAP-199 · CA-1: dado un cierre que no cuadra, cuando la supervisora escribe su PIN de 6 dígitos → ve «Efectivo: faltan S/ 4,00 · Yape: cuadra», las ventas del día y puede cerrar con la diferencia registrada; sin su PIN el cajero no puede cerrar (RQ-CIE-02-05) | func |  |  |
| TC-CAP-199-02 | HU-CAP-199 · CA-2: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |

### EP-CAP-006 Cocina por áreas e impresión

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-047-01 | HU-CAP-047 · CA-1: dado un pedido con un frappé y un sándwich, cuando pasa a cocina → Bebidas ve el frappé, Salados ve el sándwich y Postres no ve nada (RQ-COC-01-01) | func |  |  |
| TC-CAP-047-02 | HU-CAP-047 · CA-2: dado un combo de bebida y postre, cuando pasa a cocina → la bebida va a Bebidas y el postre a Postres, cada uno con el nombre del combo (RQ-COC-01-02) | func |  |  |
| TC-CAP-047-03 | HU-CAP-047 · CA-3: dado un pedido con 6 productos, cuando aparece en Bebidas → todo cabe en su tarjeta sin scroll, con las opciones y la nota resaltada (RQ-COC-01-03) | func |  |  |
| TC-CAP-047-04 | HU-CAP-047 · CA-4: contando desde que el cliente terminó su pedido, cuando una comanda pasa los 35 y los 50 minutos → cambia a naranja y a rojo (RQ-COC-01-04) | func |  |  |
| TC-CAP-047-05 | HU-CAP-047 · CA-5: dado 3 comandas en Bebidas, cuando se ven en una pantalla de 1366 px → se reparten en todo el ancho, sin espacios en blanco por estado (RQ-COC-01-08) | func |  |  |
| TC-CAP-047-06 | HU-CAP-047 · CA-6: dado un usuario de cocina, cuando elige «Vista general» → ve todas las comandas con el estado de cada área (RQ-COC-01-09) | func |  |  |
| TC-CAP-047-07 | HU-CAP-047 · CA-7: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-048-01 | HU-CAP-048 · CA-1: dado un pedido que llega a Bebidas, cuando el barista lo termina y toca «Despejar» → la comanda sale de la pantalla con un toque y queda en el Historial con la hora; no hay otro botón de estado (RQ-COC-01-05) | func |  |  |
| TC-CAP-048-02 | HU-CAP-048 · CA-2: dado un pedido de dos áreas, cuando solo Bebidas despeja → el pedido sigue «En cocina» y despacho ve que falta Salados; cuando Salados despeja, pasa a «Listo» y se avisa a despacho, caja o al mozo (RQ-COC-01-06) | func |  |  |
| TC-CAP-048-03 | HU-CAP-048 · CA-3: dado una comanda despejada por error, cuando el área abre «Historial» y toca «Devolver» con Sí/No → vuelve a su pantalla, el pedido regresa a «En cocina» si estaba listo y el cambio queda en el Historial de acciones (RQ-COC-01-07) | func |  |  |
| TC-CAP-048-04 | HU-CAP-048 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-048-05 | HU-CAP-048 · CA-5: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-049-01 | HU-CAP-049 · CA-1: dado una TV vinculada, cuando muestra las comandas → no aparecen teléfono ni dirección; cuando el administrador desactiva su llave, la TV deja de ver pedidos (RQ-COC-01-12) | func |  |  |
| TC-CAP-049-02 | HU-CAP-049 · CA-2: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-050-01 | HU-CAP-050 · CA-1: dado un área nueva «Parrilla» con la categoría Hamburguesas, cuando entra un pedido con una hamburguesa → aparece en la pantalla Parrilla; una quinta área no se puede crear (RQ-COC-01-13) | func |  |  |
| TC-CAP-050-02 | HU-CAP-050 · CA-2: dado la categoría Postres en el área Postres, cuando el administrador la cambia a Bebidas con Sí/No → los pedidos nuevos de esa categoría van a Bebidas (RQ-COC-01-14) | func |  |  |
| TC-CAP-050-03 | HU-CAP-050 · CA-3: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-050-04 | HU-CAP-050 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-198-01 | HU-CAP-198 · CA-1: dado un pedido con un capuchino y un sándwich, cuando Bebidas despeja → despacho ve «Rosa Díaz · CP-0104» con el capuchino listo y el sándwich pendiente; cuando Salados despeja, el pedido se marca «Completo» para entregarlo (RQ-COC-01-10) | func |  |  |
| TC-CAP-198-02 | HU-CAP-198 · CA-2: dado un pedido completo, cuando despacho toca «Entregado a reparto» → sale de su vista y el repartidor lo ve como listo para tomar (FT-DEL-02) (RQ-COC-01-11) | func |  |  |
| TC-CAP-198-03 | HU-CAP-198 · CA-3: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-051-01 | HU-CAP-051 · CA-1: dado un pedido con bebida y salado, cuando pasa a cocina → la ticketera de barra imprime la bebida y la de cocina el salado, cada una con ticket, hora, mozo o canal y notas (RQ-COC-02-01) | integ |  |  |
| TC-CAP-051-02 | HU-CAP-051 · CA-2: dado un pedido del chatbot todavía por confirmar, cuando se revisan las ticketeras → no se imprimió nada; un pedido de la carta se imprime apenas el cliente lo envía (RQ-COC-02-02) | integ |  |  |
| TC-CAP-051-03 | HU-CAP-051 · CA-3: dado el área propia «Parrilla», cuando un pedido le llega → su parte se imprime en la ticketera de cocina asignada, sin etiquetera propia (RQ-COC-02-10) | integ |  |  |
| TC-CAP-052-01 | HU-CAP-052 · CA-1: dado el tipo «general» activo, cuando el pedido pasa a cocina → sale una etiqueta con ticket, cliente o mesa, modalidad y cantidad de productos (RQ-COC-02-03) | func |  |  |
| TC-CAP-052-02 | HU-CAP-052 · CA-2: dado un pedido con productos de tres áreas, cuando pasa a cocina → cada etiquetera imprime la etiqueta de su área (RQ-COC-02-04) | func |  |  |
| TC-CAP-052-03 | HU-CAP-052 · CA-3: dado 2 capuchinos para «Lucía» y «Diego», cuando el pedido pasa a cocina → salen 2 etiquetas con «LUCÍA» y «DIEGO» en letra grande, debajo «Capuchino grande» y luego «Contiene: expreso, leche y espuma de leche» con leche, dulzor y toppings (RQ-COC-02-05) | func |  |  |
| TC-CAP-053-01 | HU-CAP-053 · CA-1: dado la etiqueta por bebida desactivada, cuando un pedido pasa a cocina → no se imprime ese tipo y los demás sí (RQ-COC-02-06) | func |  |  |
| TC-CAP-054-01 | HU-CAP-054 · CA-1: dado la ticketera de barra apagada, cuando un pedido pasa a cocina → aparece en la pantalla de Bebidas y caja ve «No se imprimió la comanda de Bebidas · Reimprimir» (RQ-COC-02-07) | integ |  |  |
| TC-CAP-054-02 | HU-CAP-054 · CA-2: dado un pedido en cocina, cuando el cajero toca «Reimprimir» y elige «Etiqueta por bebida» → se vuelve a imprimir solo eso, marcado como copia (RQ-COC-02-08) | func |  |  |
| TC-CAP-054-03 | HU-CAP-054 · CA-3: dado un pedido con productos de tres áreas, cuando despacho imprime la copia de despacho → sale con nombre del cliente, código, todos los productos y, si es delivery, dirección, referencia, enlace al mapa y vuelto (RQ-COC-02-09) | func |  |  |
| TC-CAP-055-01 | HU-CAP-055 · CA-1: dado el frappé de fresa, cuando Bebidas lo marca agotado por hoy y confirma → queda en la lista de agotados con autor y hora (RQ-COC-03-01) | func |  |  |
| TC-CAP-055-02 | HU-CAP-055 · CA-2: dado un producto recién agotado, cuando un cliente tiene la carta abierta → lo ve apagado sin recargar; el chatbot ya no lo ofrece (RQ-COC-03-02) | func |  |  |
| TC-CAP-055-03 | HU-CAP-055 · CA-3: dado un producto agotado por hoy, cuando pasan las 00:00 de Lima → vuelve a ofrecerse sin que nadie lo active (RQ-COC-03-03) | func |  |  |
| TC-CAP-055-04 | HU-CAP-055 · CA-4: dado un producto agotado por hoy, cuando Bebidas lo reactiva con Sí/No → vuelve a la carta al momento (RQ-COC-03-04) | func |  |  |
| TC-CAP-055-05 | HU-CAP-055 · CA-5: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-056-01 | HU-CAP-056 · CA-1: dado un producto agotado desde Productos, cuando cambia el día → sigue agotado hasta que el administrador lo active (RQ-COC-03-05) | func |  |  |
| TC-CAP-057-01 | HU-CAP-057 · CA-1: dado el rango de 25 a 35 minutos, cuando cocina activa Alta demanda con +30 → la carta y el bot dicen «de 55 a 65 minutos» (RQ-COC-03-06) | func |  |  |
| TC-CAP-057-02 | HU-CAP-057 · CA-2: dado tres pantallas de cocina abiertas, cuando Bebidas activa +30 → Postres y Salados ven «Alta demanda +30 · activó Bebidas» sin recargar, y el Historial de acciones registra el cambio (RQ-COC-03-07) | func |  |  |
| TC-CAP-057-03 | HU-CAP-057 · CA-3: dado el control de Alta demanda, cuando cocina escribe 200 → no se acepta; con el atajo «30» se aplica 30 (RQ-COC-03-08) | func |  |  |
| TC-CAP-057-04 | HU-CAP-057 · CA-4: dado Alta demanda apagada, cuando cocina busca la pausa → está desactivada; con Alta demanda activa se puede pausar (RQ-COC-03-09) | func |  |  |
| TC-CAP-057-05 | HU-CAP-057 · CA-5: dado la pausa activa, cuando un cliente intenta pedir por la carta o el bot → ve el aviso de pausa y el bot ofrece hablar con una persona (RQ-COC-03-10) | func |  |  |
| TC-CAP-057-06 | HU-CAP-057 · CA-6: dado Alta demanda con pausa, cuando cocina la apaga con Sí/No → el rango vuelve a «de 25 a 35 minutos» y la carta recibe pedidos (RQ-COC-03-11) | func |  |  |
| TC-CAP-057-07 | HU-CAP-057 · CA-7: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |

### EP-CAP-007 Salón: plano, mesas, pedido del mozo y reservas

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-058-01 | HU-CAP-058 · CA-1: dado el piso 1, cuando el administrador agrega una mesa de 4 asientos → aparece en la cuadrícula con el siguiente número libre (RQ-SAL-01-01) | func |  |  |
| TC-CAP-058-02 | HU-CAP-058 · CA-2: dado la entrada de 4×1, cuando el administrador la gira → pasa a 1×4 en el mismo lugar si cabe (RQ-SAL-01-02) | func |  |  |
| TC-CAP-058-03 | HU-CAP-058 · CA-3: dado la cuadrícula de 12×12, cuando el administrador la cambia a 16×12 → el plano muestra más cuadros y conserva los elementos (RQ-SAL-01-03) | func |  |  |
| TC-CAP-058-04 | HU-CAP-058 · CA-4: dado el piso 1, cuando el administrador abre el plano → ve mesas, asientos totales y mesas activas (RQ-SAL-01-08) | func |  |  |
| TC-CAP-059-01 | HU-CAP-059 · CA-1: dado el piso 2 desactivado, cuando el mozo abre un pedido de mesa → solo ve el piso 1; al activarlo, primero elige piso (RQ-SAL-01-04) | func |  |  |
| TC-CAP-059-02 | HU-CAP-059 · CA-2: dado una pared, cuando el administrador la elimina y confirma → desaparece del plano (RQ-SAL-01-05) | func |  |  |
| TC-CAP-059-03 | HU-CAP-059 · CA-3: dado la mesa 4 con un pedido abierto, cuando el administrador intenta eliminarla → ve el motivo y la opción de desactivarla (RQ-SAL-01-06) | func |  |  |
| TC-CAP-059-04 | HU-CAP-059 · CA-4: dado la mesa 9 con pedidos cobrados ayer, cuando se elimina → esos pedidos siguen mostrando «Mesa 9» (RQ-SAL-01-07) | func |  |  |
| TC-CAP-059-05 | HU-CAP-059 · CA-5: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-060-01 | HU-CAP-060 · CA-1: dado un plano, cuando el administrador toca «Copiar» y luego pega ese texto en otro equipo → el plano queda igual; un texto inválido muestra un error y no cambia nada (RQ-SAL-01-09) | func |  |  |
| TC-CAP-060-02 | HU-CAP-060 · CA-2: dado un sistema nuevo, cuando se abre el plano → el piso 1 tiene 10 mesas con 38 asientos y la entrada horizontal a la derecha, y el piso 2 está desactivado (RQ-SAL-01-10) | func |  |  |
| TC-CAP-061-01 | HU-CAP-061 · CA-1: dado el pedido de mesa, cuando el mozo abre Nuevo pedido → se le pregunta la mesa con las libres como botones y un acceso al plano; la mesa elegida se ve arriba con «Cambiar» (RQ-SAL-02-01) | func |  |  |
| TC-CAP-061-02 | HU-CAP-061 · CA-2: dado dos mozos que eligen la mesa 3 al mismo tiempo, cuando envían → solo uno abre el pedido y el otro ve «La mesa 3 ya está ocupada» (RQ-SAL-02-02) | integ |  |  |
| TC-CAP-061-03 | HU-CAP-061 · CA-3: dado un grupo de 8, cuando el mozo elige las mesas 4 y 5 → ambas quedan ocupadas por el mismo pedido y se liberan juntas al cobrar (RQ-SAL-02-06) | func |  |  |
| TC-CAP-061-04 | HU-CAP-061 · CA-4: dado un pedido para llevar del mozo, cuando lo arma → no se le pide mesa (RQ-SAL-02-08) | func |  |  |
| TC-CAP-062-01 | HU-CAP-062 · CA-1: dado un producto con grupo obligatorio, cuando el mozo lo agrega sin elegir → no puede; puede alternar la vista con o sin imágenes (RQ-SAL-02-03) | func |  |  |
| TC-CAP-062-02 | HU-CAP-062 · CA-2: dado un pedido de mesa, cuando el mozo lo envía con Sí/No → aparece en las pantallas de sus áreas y no en «Por confirmar» (RQ-SAL-02-04) | func |  |  |
| TC-CAP-062-03 | HU-CAP-062 · CA-3: dado 2 Ice Coffee con leches distintas, cuando el mozo pone cantidad 2 → elige la leche de cada uno y ve la sugerencia «2×1 Ice Coffee · Aplicar» para ofrecérsela al cliente (RQ-SAL-02-07) | func |  |  |
| TC-CAP-062-04 | HU-CAP-062 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-063-01 | HU-CAP-063 · CA-1: dado la mesa 3 ocupada, cuando el mozo agrega dos cafés → cocina recibe una comanda adicional marcada «Adicional · Mesa 3» y la cuenta suma los cafés (RQ-SAL-02-05) | func |  |  |
| TC-CAP-063-02 | HU-CAP-063 · CA-2: dado la mesa 3 con consumos, cuando el mozo toca «Precuenta» → se imprime el detalle y el total, sin ser comprobante (RQ-SAL-02-09) | func |  |  |
| TC-CAP-064-01 | HU-CAP-064 · CA-1: dado un pedido listo de la mesa 3, cuando todas las áreas terminan → el mozo que lo tomó recibe un aviso; al marcar «Entregado en mesa», el pedido lo registra con la hora (RQ-SAL-02-10) | func |  |  |
| TC-CAP-064-02 | HU-CAP-064 · CA-2: dado una mesa cobrada, cuando termina el cobro → queda libre; una mesa con pedido cancelado se libera a mano con confirmación (RQ-SAL-02-11) | func |  |  |
| TC-CAP-064-03 | HU-CAP-064 · CA-3: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-065-01 | HU-CAP-065 · CA-1: dado el formulario, cuando el mozo completa todo y confirma → la reserva queda guardada con su autor (RQ-SAL-03-01) | func |  |  |
| TC-CAP-065-02 | HU-CAP-065 · CA-2: dado un horario de 14:00 a 22:00, cuando se elige 22:30 o una hora ya pasada → no se puede guardar (RQ-SAL-03-02) | func |  |  |
| TC-CAP-065-03 | HU-CAP-065 · CA-3: dado una reserva de 8 personas, cuando se eligen las mesas 1 (4) y 2 (2) → se ve «Faltan 2 asientos» y no se guarda; al sumar la mesa 3 (2), sí (RQ-SAL-03-03) | func |  |  |
| TC-CAP-066-01 | HU-CAP-066 · CA-1: dado la mesa 5 reservada a las 19:00, cuando el mozo la elige a las 17:00 → ve el aviso de la reserva y puede abrir el pedido igual (RQ-SAL-03-04) | func |  |  |
| TC-CAP-066-02 | HU-CAP-066 · CA-2: dado una reserva a las 19:00 con tolerancia de 15 minutos, cuando son las 19:15 y no se sentó → pasa a «No asistió» y la marca desaparece del plano (RQ-SAL-03-05) | func |  |  |
| TC-CAP-066-03 | HU-CAP-066 · CA-3: dado una reserva activa, cuando el mozo toca «Sentar» → se abre Nuevo pedido con sus mesas ya elegidas (RQ-SAL-03-06) | func |  |  |
| TC-CAP-067-01 | HU-CAP-067 · CA-1: dado reservas el 5 y el 12, cuando el cajero abre el calendario → esos días tienen marca y al tocar el 12 ve su agenda por hora (RQ-SAL-03-07) | func |  |  |
| TC-CAP-067-02 | HU-CAP-067 · CA-2: dado una reserva, cuando el cajero la cancela con motivo y Sí/No → queda «Cancelada» en el historial (RQ-SAL-03-08) | func |  |  |
| TC-CAP-067-03 | HU-CAP-067 · CA-3: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |

### EP-CAP-008 Delivery y entregas

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-068-01 | HU-CAP-068 · CA-1: dado un punto dentro de Z4 (S/ 5), cuando se calcula el envío desde cualquier canal → es S/ 5,00 (RQ-DEL-01-01) | func |  |  |
| TC-CAP-068-02 | HU-CAP-068 · CA-2: dado un punto fuera de todas las zonas activas, cuando se intenta guardar el delivery → se avisa y se ofrece «Para recoger»; el intento se registra para el mapa de entregas (RQ-DEL-01-09) | func |  |  |
| TC-CAP-069-01 | HU-CAP-069 · CA-1: dado la zona Z3, cuando el administrador pega puntos con una latitud mal escrita → ve el error y la zona sigue con sus puntos anteriores (RQ-DEL-01-02) | func |  |  |
| TC-CAP-069-02 | HU-CAP-069 · CA-2: dado Z5 en S/ 6, cuando el administrador la cambia a S/ 6,50 con Sí/No → los pedidos nuevos en Z5 cobran S/ 6,50 y los anteriores no cambian (RQ-DEL-01-03) | func |  |  |
| TC-CAP-069-03 | HU-CAP-069 · CA-3: dado Z7 apagada, cuando un punto cae en Z7 → se trata como fuera de cobertura (RQ-DEL-01-04) | func |  |  |
| TC-CAP-069-04 | HU-CAP-069 · CA-4: dado Z3 y Z4 vecinas, cuando el administrador mueve un punto de Z3 y deja una franja sin zona entre ambas → ve «Queda un espacio sin zona entre Z3 y Z4» antes de guardar; un pedido en esa franja no queda sin cobrar envío (RQ-DEL-01-05) | func |  |  |
| TC-CAP-069-05 | HU-CAP-069 · CA-5: dado la pantalla de zonas, cuando el administrador la revisa → no hay botón para crear zonas (RQ-DEL-01-06) | func |  |  |
| TC-CAP-069-06 | HU-CAP-069 · CA-6: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-069-07 | HU-CAP-069 · CA-7: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-070-01 | HU-CAP-070 · CA-1: dado «más de S/ 70», cuando los productos suman S/ 70,10 → el envío es S/ 0; el administrador puede cambiar a «desde S/ 70» (RQ-DEL-01-07) | func |  |  |
| TC-CAP-070-02 | HU-CAP-070 · CA-2: dado un cliente con envío fijo de S/ 2 y otro con 50 %, cuando cada uno pide a Z5 (S/ 6) → pagan S/ 2 y S/ 3; si sus productos pasan de S/ 70, ambos pagan S/ 0 (RQ-DEL-01-08) | func |  |  |
| TC-CAP-070-03 | HU-CAP-070 · CA-3: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-071-01 | HU-CAP-071 · CA-1: dado 2 delivery listos sin repartidor, cuando el repartidor abre Repartos → los ve en el mapa y, con «Lista», con zona, total y minutos de espera (RQ-DEL-02-01) | func |  |  |
| TC-CAP-071-02 | HU-CAP-071 · CA-2: dado dos repartidores que tocan «Tomar» a la vez, cuando el sistema responde → uno queda asignado y el otro ve «Otro repartidor ya tomó este pedido» (RQ-DEL-02-02) | integ |  |  |
| TC-CAP-071-03 | HU-CAP-071 · CA-3: dado un repartidor con 1 pedido tomado, cuando abre Mis entregas → solo ve ese pedido; no ve ventas ni otros módulos (RQ-DEL-02-03) | func |  |  |
| TC-CAP-071-04 | HU-CAP-071 · CA-4: dado un repartidor, cuando revisa su menú → no tiene Nuevo pedido (RQ-DEL-02-09) | func |  |  |
| TC-CAP-071-05 | HU-CAP-071 · CA-5: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-072-01 | HU-CAP-072 · CA-1: dado un pedido con punto, cuando toca «Navegar» → se abre Google Maps, Waze u otra aplicación con esas coordenadas (RQ-DEL-02-04) | func |  |  |
| TC-CAP-072-02 | HU-CAP-072 · CA-2: dado un pedido, cuando toca «Llamar» o «WhatsApp» → se abre la llamada o el chat con el teléfono del cliente (RQ-DEL-02-05) | integ |  |  |
| TC-CAP-072-03 | HU-CAP-072 · CA-3: dado un delivery de S/ 37 en efectivo, «paga con S/ 50», cuando lo abre → ve «Cobrar S/ 37,00 · llevar vuelto S/ 13,00»; si ya está pagado con Yape, ve «Pagado» (RQ-DEL-02-06) | func |  |  |
| TC-CAP-072-04 | HU-CAP-072 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-073-01 | HU-CAP-073 · CA-1: dado un pedido tomado, cuando el repartidor pulsa el botón grande → pasa a «En camino», luego a «He llegado» y a «Entregado» (este último con Sí/No), y quedan las cuatro horas para medir el tiempo de entrega; el botón está siempre abajo, al alcance del pulgar (RQ-DEL-02-07) | func |  |  |
| TC-CAP-073-02 | HU-CAP-073 · CA-2: dado un delivery entregado y cobrado en efectivo, cuando se consulta caja → figura en «Por liquidar» del repartidor (FT-CIE-01) (RQ-DEL-02-08) | func |  |  |
| TC-CAP-073-03 | HU-CAP-073 · CA-3: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-073-04 | HU-CAP-073 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-196-01 | HU-CAP-196 · CA-1: dado 2 pedidos a media cuadra entre sí, cuando el repartidor abre Repartos → el mapa se acerca a esos dos puntos; con 10 pedidos en Campoy, Mangomarca y Huachipa, se aleja hasta mostrarlos todos (RQ-DEL-02-10) | func |  |  |
| TC-CAP-196-02 | HU-CAP-196 · CA-2: dado dos pedidos de «Diego», cuando aparecen en el mapa → se leen «Diego Ramos · CP-0104» y «Diego Salas · CP-0107»; si el cliente dejó solo su nombre, el código los distingue (RQ-DEL-02-11) | func |  |  |
| TC-CAP-196-03 | HU-CAP-196 · CA-3: dado umbrales de 35 y 50 minutos, cuando un pedido lleva 20, 40 y 55 minutos → sus puntos se ven verde, naranja (palpita suave) y rojo (palpita fuerte); el administrador cambia los minutos en Configuración (RQ-DEL-02-12) | func |  |  |
| TC-CAP-196-04 | HU-CAP-196 · CA-4: dado 3 pedidos en la zona Z4 y 1 en Z7, cuando el repartidor abre la lista → los ve agrupados «Z4 · 3 pedidos» y «Z7 · 1 pedido»; en el mapa, el filtro de zona muestra solo esa zona (RQ-DEL-02-13) | func |  |  |
| TC-CAP-196-05 | HU-CAP-196 · CA-5: dado un repartidor con 3 pedidos tomados, cuando abre el mapa → ve los números 1, 2 y 3 sobre sus puntos según la distancia desde el local y el tiempo de espera, sin ninguna pregunta; puede entregarlos en otro orden (RQ-DEL-02-14) | func |  |  |
| TC-CAP-196-06 | HU-CAP-196 · CA-6: dado el mapa, cuando el repartidor toca «Rosa Díaz» → ve abajo el código, el total, el vuelto, los botones Llamar, WhatsApp y Navegar, y el botón grande «Tomar pedido» (RQ-DEL-02-15) | integ |  |  |
| TC-CAP-196-07 | HU-CAP-196 · CA-7: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-196-08 | HU-CAP-196 · CA-8: dado un repartidor con 3 pedidos tomados, cuando intenta tomar un cuarto → no se le asigna y ve el aviso del límite (RQ-DEL-02-20) | func |  |  |
| TC-CAP-197-01 | HU-CAP-197 · CA-1: dado un pedido tomado, cuando el repartidor pulsa «En camino» → el cliente recibe el mensaje 1 («Tu pedido está en camino, por favor atento a tu celular para recibir la llamada») en menos de un minuto (RQ-DEL-02-16) | func |  |  |
| TC-CAP-197-02 | HU-CAP-197 · CA-2: dado un repartidor que pulsa «He llegado», cuando el cliente no responde en minuto y medio → recibe el mensaje 3 («Recuerda que el tiempo máximo de espera es de 10 minutos…; si no estás, el repartidor regresará al local con tu pedido») (RQ-DEL-02-17) | func |  |  |
| TC-CAP-197-03 | HU-CAP-197 · CA-3: dado el mensaje 2 enviado, cuando el cliente toca «Ya salgo» → no se envía el mensaje 3 y el repartidor ve «El cliente respondió» (RQ-DEL-02-18) | func |  |  |
| TC-CAP-197-04 | HU-CAP-197 · CA-4: dado el mensaje 1, cuando el administrador cambia el texto en Configuración ▸ Mensajes con Sí/No → los siguientes envíos usan el nuevo texto (RQ-DEL-02-19) | func |  |  |
| TC-CAP-197-05 | HU-CAP-197 · CA-5: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-074-01 | HU-CAP-074 · CA-1: dado un pedido en camino, cuando el repartidor toca «No contesta» → el pedido queda con el incidente, la hora y el intento 1 (RQ-DEL-03-01) | func |  |  |
| TC-CAP-074-02 | HU-CAP-074 · CA-2: dado un reporte, cuando se registra → caja y call center reciben una notificación con el pedido, el motivo y un botón para escribir al cliente (RQ-DEL-03-02) | func |  |  |
| TC-CAP-074-03 | HU-CAP-074 · CA-3: dado un repartidor que llamó dos veces y escribió una, cuando reporta «No contesta» → se guardan los tres intentos con su hora y la foto opcional en la carpeta privada (RQ-DEL-03-10) | func |  |  |
| TC-CAP-075-01 | HU-CAP-075 · CA-1: dado un «No encuentro la dirección», cuando caja corrige el punto → el repartidor ve la nueva ubicación y un aviso «Dirección corregida» (RQ-DEL-03-03) | func |  |  |
| TC-CAP-075-02 | HU-CAP-075 · CA-2: dado 2 intentos y 10 minutos configurados, cuando se llega al segundo intento o a los 10 minutos → el repartidor ve «Volver a la tienda» como recomendación (RQ-DEL-03-04) | func |  |  |
| TC-CAP-076-01 | HU-CAP-076 · CA-1: dado un pedido devuelto a la tienda, cuando un repartidor revisa los disponibles → no lo ve; en caja figura «En coordinación» (RQ-DEL-03-05) | func |  |  |
| TC-CAP-076-02 | HU-CAP-076 · CA-2: dado un pedido en coordinación, cuando caja elige «Reprogramar» → vuelve a los disponibles; con «Devolver», se anula con motivo «Cliente no recibió» y las reglas de PIN; con «Cobrar igual», queda cerrado y cobrado (RQ-DEL-03-06) | func |  |  |
| TC-CAP-076-03 | HU-CAP-076 · CA-3: dado un recargo de S/ 3, cuando caja reprograma con recargo → el total sube S/ 3 y el cliente lo ve en el mensaje (RQ-DEL-03-07) | func |  |  |
| TC-CAP-077-01 | HU-CAP-077 · CA-1: dado un pedido devuelto con un frappé, cuando caja registra su destino «desecho» → queda una merma informativa sin movimiento de stock (RQ-DEL-03-08) | func |  |  |
| TC-CAP-077-02 | HU-CAP-077 · CA-2: dado la configuración, cuando el administrador cambia los intentos de 2 a 3 con Sí/No → la recomendación de volver sale al tercer intento (RQ-DEL-03-09) | func |  |  |
| TC-CAP-077-03 | HU-CAP-077 · CA-3: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |

### EP-CAP-009 Stock y recetas

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-078-01 | HU-CAP-078 · CA-1: dado la leche con «caja de 12 L = 12 L» y «1 L = 1000 ml», cuando se registran 2 cajas → el almacén suma 24 L y una receta de 250 ml descuenta 0,25 L (RQ-STK-01-01) | func |  |  |
| TC-CAP-078-02 | HU-CAP-078 · CA-2: dado la leche con mínimo 10 L, cuando el administrador lo cambia a 12 L con Sí/No → el semáforo se recalcula con el nuevo mínimo (RQ-STK-01-02) | func |  |  |
| TC-CAP-078-03 | HU-CAP-078 · CA-3: dado el pollo, cuando se registra una entrada → no hay campos de lote ni de vencimiento; la frescura de lo producido se controla con la vida útil de los productos (V7) (RQ-STK-01-03) | func |  |  |
| TC-CAP-078-04 | HU-CAP-078 · CA-4: dado un insumo sin uso, cuando se desactiva con Sí/No → deja de ofrecerse en recetas y movimientos y conserva su historial (RQ-STK-01-08) | func |  |  |
| TC-CAP-078-05 | HU-CAP-078 · CA-5: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-079-01 | HU-CAP-079 · CA-1: dado un insumo, cuando el administrador elige el mismo proveedor como A y B → no se acepta (RQ-STK-01-04) | func |  |  |
| TC-CAP-079-02 | HU-CAP-079 · CA-2: dado la leche con 20 L en almacén y 3 L en barra, cuando se abre la ficha → se ven las dos cantidades por separado y el total (RQ-STK-01-05) | func |  |  |
| TC-CAP-079-03 | HU-CAP-079 · CA-3: dado el café asignado a Barra, cuando se vende un capuchino → el café se descuenta del stock de Barra (RQ-STK-01-09) | func |  |  |
| TC-CAP-080-01 | HU-CAP-080 · CA-1: dado un máximo de 40 y un mínimo de 10, cuando hay 8 → se ve rojo y «Poco»; con 0, «Agotado»; con 38, «Lleno» (RQ-STK-01-06) | func |  |  |
| TC-CAP-080-02 | HU-CAP-080 · CA-2: dado 60 insumos, cuando almacén filtra «Por acabarse» en Barra → solo ve esos (RQ-STK-01-07) | func |  |  |
| TC-CAP-081-01 | HU-CAP-081 · CA-1: dado el capuchino, cuando el administrador agrega 18 g de café y 200 ml de leche → la receta queda guardada con su autor (RQ-STK-02-01) | func |  |  |
| TC-CAP-081-02 | HU-CAP-081 · CA-2: dado el capuchino grande, cuando su receta usa 300 ml de leche → vender un grande descuenta 300 ml y no 200 (RQ-STK-02-02) | func |  |  |
| TC-CAP-081-03 | HU-CAP-081 · CA-3: dado una receta, cuando el administrador la cambia → las ventas anteriores conservan lo que descontaron y el historial muestra el cambio (RQ-STK-02-08) | func |  |  |
| TC-CAP-081-04 | HU-CAP-081 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-081-05 | HU-CAP-081 · CA-5: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-082-01 | HU-CAP-082 · CA-1: dado la opción «leche de almendras» que reemplaza la leche entera, cuando se vende un capuchino con esa opción → se usan 200 ml de leche de almendras y nada de leche entera (RQ-STK-02-03) | func |  |  |
| TC-CAP-082-02 | HU-CAP-082 · CA-2: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-083-01 | HU-CAP-083 · CA-1: dado café a S/ 0,08 por g y leche a S/ 0,005 por ml, cuando se abre el capuchino → su costo es S/ 2,44 (RQ-STK-02-04) | func |  |  |
| TC-CAP-083-02 | HU-CAP-083 · CA-2: dado un costo de S/ 2,44 y un precio de S/ 9, cuando se abre el producto → el margen es S/ 6,56 (72,9 %) (RQ-STK-02-05) | func |  |  |
| TC-CAP-083-03 | HU-CAP-083 · CA-3: dado un producto sin receta, cuando se abre la lista → aparece «Sin receta» y cuenta en el indicador de platos sin margen (RQ-STK-02-06) | func |  |  |
| TC-CAP-083-04 | HU-CAP-083 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-084-01 | HU-CAP-084 · CA-1: dado la receta de donas, cuando se define que una tanda usa 1 kg de harina y rinde 24 donas → la producción la usa (FT-ALM-02) (RQ-STK-02-07) | func |  |  |
| TC-CAP-084-02 | HU-CAP-084 · CA-2: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-085-01 | HU-CAP-085 · CA-1: dado un capuchino (18 g café, 200 ml leche) preparado en Barra, cuando el pedido pasa a cocina → Barra baja 18 g de café y 200 ml de leche con un movimiento «Venta · pedido N» (RQ-STK-03-01) | func |  |  |
| TC-CAP-085-02 | HU-CAP-085 · CA-2: dado un combo de frappé y dona, cuando pasa a cocina → el frappé descuenta de Barra, la dona del stock de producto terminado y el informe registra el combo (RQ-STK-03-02) | func |  |  |
| TC-CAP-085-03 | HU-CAP-085 · CA-3: dado un capuchino con shot extra (+9 g de café), cuando pasa a cocina → baja 27 g de café (RQ-STK-03-03) | func |  |  |
| TC-CAP-086-01 | HU-CAP-086 · CA-1: dado un pedido anulado después de pasar a cocina, cuando se anula → se registra un movimiento de devolución por las mismas cantidades, salvo lo que se marque como merma (RQ-STK-03-04) | func |  |  |
| TC-CAP-086-02 | HU-CAP-086 · CA-2: dado 100 ml de leche en Barra, cuando se vende un capuchino de 200 ml → la venta procede, Barra queda en −100 ml y aparece una alerta «Stock negativo en Barra: leche» (RQ-STK-03-05) | func |  |  |
| TC-CAP-086-03 | HU-CAP-086 · CA-3: dado un día de ventas, cuando almacén abre el historial y filtra «Venta» → ve cada movimiento con su pedido (RQ-STK-03-08) | func |  |  |
| TC-CAP-087-01 | HU-CAP-087 · CA-1: dado el café en cero en Barra, cuando el cliente abre la carta → los productos con café se ven agotados hasta que entre café a Barra (RQ-STK-03-06) | func |  |  |
| TC-CAP-087-02 | HU-CAP-087 · CA-2: dado un mínimo de 10 L, cuando una venta deja la leche en 9 L → almacén y el administrador reciben «Leche por debajo del mínimo» (RQ-STK-03-07) | func |  |  |

### EP-CAP-010 Almacén y producción

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-088-01 | HU-CAP-088 · CA-1: dado una entrada de 10 kg de harina, cuando almacén la registra con Sí/No → el almacén sube 10 kg y queda el movimiento con autor y hora (RQ-ALM-01-01) | func |  |  |
| TC-CAP-088-02 | HU-CAP-088 · CA-2: dado el azúcar en cero, cuando almacén registra una salida → no aparece salvo que toque «Ver también sin stock» (RQ-ALM-01-02) | func |  |  |
| TC-CAP-088-03 | HU-CAP-088 · CA-3: dado 5 kg de harina, cuando almacén registra una salida de 6 kg → no se acepta y ve el máximo (RQ-ALM-01-03) | func |  |  |
| TC-CAP-088-04 | HU-CAP-088 · CA-4: dado una entrada mal registrada, cuando almacén la anula con motivo → se crea el movimiento inverso y ambos quedan en el historial (RQ-ALM-01-09) | func |  |  |
| TC-CAP-088-05 | HU-CAP-088 · CA-5: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-088-06 | HU-CAP-088 · CA-6: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-089-01 | HU-CAP-089 · CA-1: dado una salida de 6 L de leche a Barra, cuando se registra → el almacén baja 6 L y Barra ve «Por recibir: 6 L»; al tocar «Recibí», Barra sube 6 L (RQ-ALM-01-04) | func |  |  |
| TC-CAP-089-02 | HU-CAP-089 · CA-2: dado un traslado de 6 L, cuando Barra confirma 5,5 L → Barra sube 5,5 L y queda una diferencia de 0,5 L con su autor (RQ-ALM-01-05) | func |  |  |
| TC-CAP-089-03 | HU-CAP-089 · CA-3: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-090-01 | HU-CAP-090 · CA-1: dado una merma de leche (1 L) y huevos (3 u) con destino «desecho» para ambos, cuando se registra → queda un movimiento por insumo con el mismo destino (RQ-ALM-01-06) | func |  |  |
| TC-CAP-090-02 | HU-CAP-090 · CA-2: dado movimientos de un mes, cuando almacén filtra «Merma» de leche del 1 al 7 → solo ve esos (RQ-ALM-01-07) | func |  |  |
| TC-CAP-090-03 | HU-CAP-090 · CA-3: dado el combo de origen, cuando almacén crea «Proveedor B» → queda disponible al instante; no se puede eliminar, solo desactivar (RQ-ALM-01-08) | func |  |  |
| TC-CAP-090-04 | HU-CAP-090 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-091-01 | HU-CAP-091 · CA-1: dado la receta de donas (1 tanda = 24 donas), cuando producción registra 2 tandas con Sí/No → el stock de donas sube 48 (RQ-ALM-02-01) | func |  |  |
| TC-CAP-091-02 | HU-CAP-091 · CA-2: dado 1 tanda = 1 kg de harina, cuando se registran 2 tandas → baja 2 kg de harina con un movimiento «Producción» (RQ-ALM-02-02) | func |  |  |
| TC-CAP-091-03 | HU-CAP-091 · CA-3: dado un club sándwich que usa 2 rebanadas de pan de molde, cuando se vende → baja el stock de pan de molde producido (RQ-ALM-02-07) | func |  |  |
| TC-CAP-091-04 | HU-CAP-091 · CA-4: dado una tanda registrada por error, cuando producción la anula con motivo → se devuelven la materia prima y se resta el producto terminado (RQ-ALM-02-08) | func |  |  |
| TC-CAP-091-05 | HU-CAP-091 · CA-5: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-092-01 | HU-CAP-092 · CA-1: dado 1,5 kg de harina en cocina y 10 kg en almacén, cuando se registran 2 tandas (2 kg) → se pregunta «Se restarán 0,5 kg del almacén. ¿Seguro?»; con Sí, baja 1,5 kg de cocina y 0,5 kg del almacén (RQ-ALM-02-03) | func |  |  |
| TC-CAP-092-02 | HU-CAP-092 · CA-2: dado 1,2 kg de harina en total, cuando se intentan 2 tandas → no se registra y se ve «Falta 0,8 kg de harina · alcanza para 1 tanda» (RQ-ALM-02-04) | func |  |  |
| TC-CAP-093-01 | HU-CAP-093 · CA-1: dado una tanda de donas a las 07:00, cuando son las 17:00 → las donas de esa tanda avisan «10 horas»; a las 19:00 pasan a alerta alta (RQ-ALM-02-05) | func |  |  |
| TC-CAP-093-02 | HU-CAP-093 · CA-2: dado el pan de molde, cuando el administrador fija 48 horas → sus avisos usan ese valor (RQ-ALM-02-06) | func |  |  |
| TC-CAP-094-01 | HU-CAP-094 · CA-1: dado la barra, cuando pide 6 L de leche y 1 kg de café → almacén ve el pedido interno con el área, autor y hora (RQ-ALM-03-01) | func |  |  |
| TC-CAP-094-02 | HU-CAP-094 · CA-2: dado la repostera con su usuario en la mañana, cuando saca 2 kg de harina → registra la salida a su nombre y el historial del almacén muestra «Salida · harina 2 kg · Rosa (producción)» (RQ-ALM-03-04) | func |  |  |
| TC-CAP-094-03 | HU-CAP-094 · CA-3: dado un pedido interno, cuando almacén lo marca entregado → baja el stock central y el área ve el traslado por recibir (FT-ALM-01) (RQ-ALM-03-05) | func |  |  |
| TC-CAP-095-01 | HU-CAP-095 · CA-1: dado donas con stock 10, cuando cocina registra una merma de 12 → no se acepta; la leche no aparece en la merma de Cocina (RQ-ALM-03-06) | func |  |  |
| TC-CAP-095-02 | HU-CAP-095 · CA-2: dado 3 donas y 2 galletas, cuando cocina registra la merma con destino «personal» → cada una queda con ese destino y su origen (RQ-ALM-03-07) | func |  |  |
| TC-CAP-095-03 | HU-CAP-095 · CA-3: dado un pedido devuelto (FT-DEL-03), cuando se registra su merma con origen Reparto → no hay movimiento de stock (RQ-ALM-03-11) | func |  |  |
| TC-CAP-096-01 | HU-CAP-096 · CA-1: dado donas, galletas y gelatina con stock, cuando producción abre el cierre del día → aparecen los tres con su stock del sistema (RQ-ALM-03-08) | func |  |  |
| TC-CAP-096-02 | HU-CAP-096 · CA-2: dado 10 donas en sistema, cuando se cuentan 9 y se botan 4 a donación → quedan 5 en stock, 4 de merma «donación» y 1 de «diferencia de conteo» (RQ-ALM-03-09) | func |  |  |
| TC-CAP-096-03 | HU-CAP-096 · CA-3: dado el cierre anterior, cuando se confirma con Sí/No → el stock final es 5 y el informe de merma muestra 1 por diferencia (RQ-ALM-03-10) | func |  |  |
| TC-CAP-096-04 | HU-CAP-096 · CA-4: dado el cierre confirmado, cuando el área cierra la estación → su pantalla muestra «Estación cerrada» hasta el día siguiente (RQ-ALM-03-12) | func |  |  |
| TC-CAP-096-05 | HU-CAP-096 · CA-5: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-200-01 | HU-CAP-200 · CA-1: dado la pantalla del almacén abierta, cuando barra pide 6 L de leche → suena un aviso que se repite y no se calla hasta que alguien toca «Recibido»; queda quién lo recibió y a qué hora (RQ-ALM-03-02) | func |  |  |
| TC-CAP-200-02 | HU-CAP-200 · CA-2: dado Marvel de turno de lunes a miércoles y Jeffrey cubriendo el jueves, cuando cocina pide harina un jueves a las 16:00 → el WhatsApp le llega a Jeffrey; a las 07:00, sin nadie de almacén de turno, le llega al administrador (RQ-ALM-03-03) | integ |  |  |

### EP-CAP-011 Compras y proveedores

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-097-01 | HU-CAP-097 · CA-1: dado el formulario, cuando almacén registra un proveedor con RUC de 11 dígitos → queda guardado; un RUC con otro largo no se acepta (RQ-COM-01-01) | func |  |  |
| TC-CAP-097-02 | HU-CAP-097 · CA-2: dado un RUC ya registrado, cuando se intenta registrar otro proveedor con él → se rechaza (RQ-COM-01-02) | func |  |  |
| TC-CAP-097-03 | HU-CAP-097 · CA-3: dado 15 proveedores, cuando almacén busca «leche» → ve los que son A, B o C de la leche (RQ-COM-01-05) | func |  |  |
| TC-CAP-098-01 | HU-CAP-098 · CA-1: dado un proveedor con 3 compras de leche, cuando se abre su ficha → se ven las compras y la evolución del precio de la leche (RQ-COM-01-03) | func |  |  |
| TC-CAP-098-02 | HU-CAP-098 · CA-2: dado un proveedor desactivado, cuando se registra una compra → no aparece; su ficha sigue mostrando su historial (RQ-COM-01-04) | func |  |  |
| TC-CAP-099-01 | HU-CAP-099 · CA-1: dado 3 insumos rojos y 2 naranjas, cuando almacén abre «Pedir» → ve los 3 rojos y, al marcar «Incluir regulares», los 5 (RQ-COM-02-01) | func |  |  |
| TC-CAP-099-02 | HU-CAP-099 · CA-2: dado la leche con 8 L, máximo 40 L y caja de 12 L, cuando se arma el pedido → sugiere 3 cajas (36 L) (RQ-COM-02-02) | func |  |  |
| TC-CAP-099-03 | HU-CAP-099 · CA-3: dado un insumo rojo en Stock, cuando almacén toca «Pedir» → se abre Compras con ese insumo en la lista (RQ-COM-02-07) | func |  |  |
| TC-CAP-100-01 | HU-CAP-100 · CA-1: dado la leche con proveedor A «Lácteos SAC», cuando almacén elige su proveedor B → la leche pasa al grupo del proveedor B y sale del A (RQ-COM-02-03) | func |  |  |
| TC-CAP-100-02 | HU-CAP-100 · CA-2: dado la leche en un pedido por recibir, cuando aparece en la lista → muestra «Ya pedida el 18/10» (RQ-COM-02-04) | func |  |  |
| TC-CAP-101-01 | HU-CAP-101 · CA-1: dado un grupo de 3 insumos para un proveedor, cuando almacén toca «Enviar por WhatsApp» → se abre WhatsApp con el número del proveedor y el mensaje armado (RQ-COM-02-05) | integ |  |  |
| TC-CAP-101-02 | HU-CAP-101 · CA-2: dado el mensaje enviado, cuando almacén confirma → queda un pedido «Por recibir»; al anularlo con motivo, el stock no cambia (RQ-COM-02-06) | func |  |  |
| TC-CAP-102-01 | HU-CAP-102 · CA-1: dado una factura de 2 cajas de leche a S/ 60 cada una, cuando almacén la registra con su foto → queda con total S/ 120 y condición «crédito 15 días» (RQ-COM-03-01) | func |  |  |
| TC-CAP-102-02 | HU-CAP-102 · CA-2: dado 2 cajas de 12 L, cuando se registra la compra → el almacén sube 24 L (RQ-COM-03-02) | func |  |  |
| TC-CAP-102-03 | HU-CAP-102 · CA-3: dado una compra de 15 filetes de pollo, cuando almacén la registra → el formulario no tiene campos de lote ni de vencimiento y la compra se guarda con insumo, cantidad y costo (RQ-COM-03-03) | func |  |  |
| TC-CAP-102-04 | HU-CAP-102 · CA-4: dado la compra guardada, cuando almacén abre el historial → ve la entrada «Compra · proveedor · comprobante» (RQ-COM-03-04) | func |  |  |
| TC-CAP-103-01 | HU-CAP-103 · CA-1: dado un pedido por recibir de 3 cajas, cuando llegan 2 → almacén recibe 2 con su costo y el pedido queda parcial con 1 pendiente (RQ-COM-03-05) | func |  |  |
| TC-CAP-104-01 | HU-CAP-104 · CA-1: dado la leche a S/ 5 por litro en la nueva compra, cuando se registra → el costo de la leche pasa a S/ 5 y los márgenes se recalculan (RQ-COM-03-06) | func |  |  |
| TC-CAP-104-02 | HU-CAP-104 · CA-2: dado una compra a crédito, cuando el administrador la marca pagada → queda con fecha de pago; al anularla, se revierte su entrada al stock (RQ-COM-03-07) | func |  |  |
| TC-CAP-104-03 | HU-CAP-104 · CA-3: dado compras de un mes, cuando se filtra «crédito sin pagar» → solo aparecen esas, con su vencimiento de pago (RQ-COM-03-08) | func |  |  |

### EP-CAP-012 Promociones, descuentos y cupones

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-105-01 | HU-CAP-105 · CA-1: dado el formulario, cuando crea «Dúo Frappé» con 2 frappés a elección y precio regular S/ 22 y grande S/ 26 → el combo queda guardado inactivo hasta publicarlo (RQ-OFE-01-01) | func |  |  |
| TC-CAP-105-02 | HU-CAP-105 · CA-2: dado un combo, cuando una parte es «1 postre de la categoría Postres» y otra «Americano fijo» → la carta pide elegir el postre y el Americano viene incluido (RQ-OFE-01-02) | func |  |  |
| TC-CAP-105-03 | HU-CAP-105 · CA-3: dado el producto «Frappé Oreo», cuando se intenta crear un combo con ese nombre → no se acepta (RQ-OFE-01-03) | func |  |  |
| TC-CAP-106-01 | HU-CAP-106 · CA-1: dado una 3x2 en donas, cuando el cliente lleva 3 donas → se descuenta la más barata; con 2 donas no aplica y se avisa «Lleva 1 más y paga 2» (RQ-OFE-01-04) | func |  |  |
| TC-CAP-106-02 | HU-CAP-106 · CA-2: dado un combo con el postre «Brownie» agotado, cuando el cliente lo arma → el brownie aparece apagado y puede elegir otro postre de la categoría (RQ-OFE-01-09) | func |  |  |
| TC-CAP-107-01 | HU-CAP-107 · CA-1: dado un combo vigente de lunes a viernes de 15:00 a 18:00 solo en la carta, cuando un cliente lo busca un sábado o en el chatbot → no aparece (RQ-OFE-01-05) | func |  |  |
| TC-CAP-107-02 | HU-CAP-107 · CA-2: dado una 2×1 limitada a los 10 primeros pedidos, cuando se vende la décima → deja de ofrecerse en todos los canales y queda «Agotada por límite» (RQ-OFE-01-06) | func |  |  |
| TC-CAP-107-03 | HU-CAP-107 · CA-3: dado una 2×1 de frappé marcada «No suma puntos ni aplica cupones», cuando un cliente con cuenta la compra → esa línea no suma puntos y no se le puede aplicar un cupón (FT-CLI-02, FT-OFE-03) (RQ-OFE-01-07) | func |  |  |
| TC-CAP-107-04 | HU-CAP-107 · CA-4: dado un combo cuya fecha terminó ayer, cuando el cajero abre Nuevo pedido → no aparece (RQ-OFE-01-08) | func |  |  |
| TC-CAP-108-01 | HU-CAP-108 · CA-1: dado un combo vendido, cuando pasa a cocina → cada parte va a su área y se descuenta por separado (FT-STK-03), y el informe cuenta el combo (RQ-OFE-01-10) | func |  |  |
| TC-CAP-108-02 | HU-CAP-108 · CA-2: dado una oferta, cuando el administrador la desactiva con Sí/No → deja de mostrarse y conserva sus ventas (RQ-OFE-01-11) | func |  |  |
| TC-CAP-108-03 | HU-CAP-108 · CA-3: dado un combo nuevo, cuando toca «Vista previa» → lo ve como tarjeta y ficha de la carta antes de publicarlo (RQ-OFE-01-12) | func |  |  |
| TC-CAP-108-04 | HU-CAP-108 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-109-01 | HU-CAP-109 · CA-1: dado «20 % en Frappés», cuando se guarda activo → aplica a los productos de esa categoría (RQ-OFE-02-01) | func |  |  |
| TC-CAP-109-02 | HU-CAP-109 · CA-2: dado un pedido con un frappé de S/ 12 y un sándwich de S/ 15 con 20 % en Frappés, cuando se calcula → el descuento es S/ 2,40 (RQ-OFE-02-04) | func |  |  |
| TC-CAP-109-03 | HU-CAP-109 · CA-3: dado un mismo carrito a la misma hora, cuando se calcula en los tres canales permitidos → el descuento es el mismo (RQ-OFE-02-07) | func |  |  |
| TC-CAP-110-01 | HU-CAP-110 · CA-1: dado un descuento de 15:00 a 18:00, cuando el pedido se hace a las 15:00 → aplica; a las 18:00 ya no aplica (RQ-OFE-02-02) | func |  |  |
| TC-CAP-110-02 | HU-CAP-110 · CA-2: dado un descuento solo en la carta con mínimo S/ 30, cuando el cliente pide S/ 28 en la carta o S/ 40 en el chatbot → no aplica (RQ-OFE-02-03) | func |  |  |
| TC-CAP-111-01 | HU-CAP-111 · CA-1: dado 10 % en todo y 20 % en Frappés, cuando se pide un frappé → se aplica solo el 20 % a esa línea (RQ-OFE-02-05) | func |  |  |
| TC-CAP-111-02 | HU-CAP-111 · CA-2: dado un pedido con descuento automático, cuando el cliente escribe un cupón → ve «Este cupón no se combina con el descuento vigente» y elige cuál usar; si la regla lo permite, se aplican ambos (RQ-OFE-02-06) | func |  |  |
| TC-CAP-111-03 | HU-CAP-111 · CA-3: dado las reglas, cuando el administrador cambia «cupones por comprobante» de 2 a 1 con Sí/No → los comprobantes nuevos llevan 1 (RQ-OFE-02-08) | func |  |  |
| TC-CAP-111-04 | HU-CAP-111 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-112-01 | HU-CAP-112 · CA-1: dado el formulario, cuando crea «20 % en Dúo, mínimo S/ 30, carta, 7 días» → queda guardado y aparece en la lista (RQ-OFE-03-01) | func |  |  |
| TC-CAP-112-02 | HU-CAP-112 · CA-2: dado un cupón compartido, cuando se intenta guardar sin tope de usos → no se acepta (RQ-OFE-03-02) | func |  |  |
| TC-CAP-113-01 | HU-CAP-113 · CA-1: dado 4 cupones de código único activos y N = 2, cuando se imprime un comprobante → salen 2 elegidos al azar; reimprimirlo da los mismos 2 (RQ-OFE-03-03) | func |  |  |
| TC-CAP-113-02 | HU-CAP-113 · CA-2: dado dos comprobantes seguidos, cuando se imprimen → sus códigos no son consecutivos ni predecibles y cada uno vence a los días definidos (RQ-OFE-03-04) | func |  |  |
| TC-CAP-113-03 | HU-CAP-113 · CA-3: dado un cupón compartido activo, cuando se imprime un comprobante → no aparece (RQ-OFE-03-05) | func |  |  |
| TC-CAP-114-01 | HU-CAP-114 · CA-1: dado un pedido con un cupón aplicado, cuando el cliente escribe otro → ve «Solo se puede usar un cupón por compra»; en una línea con promoción o marcada, el cupón no descuenta (RQ-OFE-03-06) | func |  |  |
| TC-CAP-114-02 | HU-CAP-114 · CA-2: dado un código ya canjeado, cuando otro cliente lo escribe → ve «Este cupón ya se usó» (RQ-OFE-03-07) | func |  |  |
| TC-CAP-114-03 | HU-CAP-114 · CA-3: dado un tope de 100 usos con 100 canjes, cuando alguien lo escribe → ve «Se agotaron los usos» (RQ-OFE-03-08) | func |  |  |
| TC-CAP-114-04 | HU-CAP-114 · CA-4: dado 5 códigos inválidos seguidos, cuando el cliente intenta un sexto → el campo queda bloqueado 5 minutos (RQ-OFE-03-09) | func |  |  |
| TC-CAP-115-01 | HU-CAP-115 · CA-1: dado un cupón emitido hace 8 días con validez de 7, cuando el administrador abre Cupones emitidos → aparece «Vencido» (RQ-OFE-03-10) | func |  |  |
| TC-CAP-115-02 | HU-CAP-115 · CA-2: dado un cupón vigente, cuando el administrador lo anula con motivo y Sí/No → queda «Anulado» y no se puede canjear (RQ-OFE-03-11) | func |  |  |
| TC-CAP-115-03 | HU-CAP-115 · CA-3: dado un cupón, cuando el administrador cambia su porcentaje → el historial muestra el cambio con autor y fecha; no hay opción de eliminar (RQ-OFE-03-12) | func |  |  |
| TC-CAP-115-04 | HU-CAP-115 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |

### EP-CAP-013 Personal, usuarios y roles

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-116-01 | HU-CAP-116 · CA-1: dado el formulario, cuando el administrador crea a «Ana, cajera» → queda activa con la contraseña inicial y la fecha de alta (RQ-USR-01-01) | func |  |  |
| TC-CAP-116-02 | HU-CAP-116 · CA-2: dado un DNI ya usado, cuando se crea otro usuario con él → no se acepta (RQ-USR-01-02) | func |  |  |
| TC-CAP-116-03 | HU-CAP-116 · CA-3: dado Ana activa, cuando el administrador la desactiva con Sí/No → no puede entrar y su historial se conserva; al reactivarla vuelve a entrar (RQ-USR-01-03) | func |  |  |
| TC-CAP-116-04 | HU-CAP-116 · CA-4: dado 12 usuarios, cuando el administrador filtra «Cajero» activos dados de alta en octubre → solo ve esos (RQ-USR-01-11) | func |  |  |
| TC-CAP-116-05 | HU-CAP-116 · CA-5: dado un cajero desactivado por el administrador, cuando escribe su usuario y su contraseña correcta → no entra y ve «Tu usuario está desactivado»; si tenía una sesión abierta, la siguiente acción le pide ingresar y no puede; al reactivarlo vuelve a entrar con su misma contraseña (RQ-USR-01-13) | func |  |  |
| TC-CAP-116-06 | HU-CAP-116 · CA-6: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-116-07 | HU-CAP-116 · CA-7: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-117-01 | HU-CAP-117 · CA-1: dado un usuario nuevo, cuando entra con 123456 → ve «Crea tu contraseña» y no puede ir a otra pantalla (RQ-USR-01-04) | func |  |  |
| TC-CAP-117-02 | HU-CAP-117 · CA-2: dado la pantalla de primer ingreso, cuando el usuario escribe «123456» o dos contraseñas distintas → no se acepta; con «café2026» dos veces, sí (RQ-USR-01-05) | func |  |  |
| TC-CAP-117-03 | HU-CAP-117 · CA-3: dado el campo de contraseña, cuando el usuario toca el ojo → ve el texto; otro toque lo oculta (RQ-USR-01-06) | func |  |  |
| TC-CAP-117-04 | HU-CAP-117 · CA-4: dado la contraseña creada, cuando aparece la foto de perfil → el usuario puede subirla o tocar «Ahora no» y entra al escritorio (RQ-USR-01-07) | func |  |  |
| TC-CAP-117-05 | HU-CAP-117 · CA-5: dado 5 intentos errados, cuando se intenta un sexto → se rechaza y se avisa cuánto falta (RQ-USR-01-10) | func |  |  |
| TC-CAP-117-06 | HU-CAP-117 · CA-6: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-118-01 | HU-CAP-118 · CA-1: dado un mozo en Mi perfil, cuando lo abre → puede cambiar su foto y su contraseña, y su nombre, DNI y rol aparecen bloqueados (RQ-USR-01-08) | func |  |  |
| TC-CAP-118-02 | HU-CAP-118 · CA-2: dado un usuario que olvidó su contraseña, cuando el administrador la restablece con Sí/No → vuelve a la inicial y se le pide crear una nueva al entrar (RQ-USR-01-09) | func |  |  |
| TC-CAP-118-03 | HU-CAP-118 · CA-3: dado una cajera que olvidó su contraseña, cuando el administrador pulsa «Restablecer contraseña» en su ficha y responde «Sí» → su contraseña vuelve a la inicial, al entrar el sistema le exige crear una nueva y el historial registra quién la restableció; dado un mozo que intenta la misma acción por la API, entonces recibe 403 y nada cambia (RQ-USR-01-12) | func |  |  |
| TC-CAP-118-04 | HU-CAP-118 · CA-4: dado un mozo en Mi perfil, cuando pulsa «Cambiar mi contraseña» y deja vacía la actual o escribe una equivocada → no se cambia y ve un aviso; con la actual correcta y una nueva válida (6 o más caracteres, distinta de la inicial y de la actual, escrita dos veces igual), entonces se cambia y queda registrado (RQ-USR-01-17) | func |  |  |
| TC-CAP-118-05 | HU-CAP-118 · CA-5: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-118-06 | HU-CAP-118 · CA-6: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-201-01 | HU-CAP-201 · CA-1: dado Marvel, cuando el administrador marca lunes a sábado de 15:00 a 23:00 y el domingo libre, y a la repostera de 06:00 a 12:00 → la ficha de cada uno muestra su horario y se guarda con Sí/No (RQ-USR-01-14) | func |  |  |
| TC-CAP-201-02 | HU-CAP-201 · CA-2: dado el jueves 22/10 como descanso de Marvel, cuando el administrador registra que lo cubre Jeffrey de 15:00 a 23:00 → ese día Jeffrey figura de turno en almacén y Marvel no (RQ-USR-01-15) | func |  |  |
| TC-CAP-201-03 | HU-CAP-201 · CA-3: dado el jueves 22/10 a las 16:00, cuando el sistema busca a quién avisar en almacén → devuelve a Jeffrey; a las 07:00 no devuelve a nadie de almacén (RQ-USR-01-16) | func |  |  |
| TC-CAP-201-04 | HU-CAP-201 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-201-05 | HU-CAP-201 · CA-5: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-119-01 | HU-CAP-119 · CA-1: dado la lista de roles, cuando el administrador asigna un rol → elige entre administrador, cajero, cocina y barra, mozo, call center, almacén y repartidor (RQ-USR-02-01) | func |  |  |
| TC-CAP-119-02 | HU-CAP-119 · CA-2: dado un usuario de cocina, cuando entra → su menú muestra Cocina y Producción y no Pedidos y caja, Informes ni Usuarios (RQ-USR-02-02) | func |  |  |
| TC-CAP-119-03 | HU-CAP-119 · CA-3: dado un mozo, cuando abre la dirección de Informes → ve «No tienes acceso» y el servidor no entrega datos (RQ-USR-02-03) | advers |  |  |
| TC-CAP-119-04 | HU-CAP-119 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-120-01 | HU-CAP-120 · CA-1: dado un cajero, cuando entra → ve pedidos por confirmar, caja abierta y cobros del día, sin ventas del mes ni márgenes (RQ-USR-02-04) | func |  |  |
| TC-CAP-120-02 | HU-CAP-120 · CA-2: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-121-01 | HU-CAP-121 · CA-1: dado el rol mozo sin «Reservas», cuando el administrador le da «ver y crear» con Sí/No → los mozos ven Reservas al volver a entrar (RQ-USR-02-05) | func |  |  |
| TC-CAP-121-02 | HU-CAP-121 · CA-2: dado un sistema nuevo, cuando se revisa la matriz → coincide con la tabla de módulos y roles del análisis (RQ-USR-02-06) | func |  |  |
| TC-CAP-121-03 | HU-CAP-121 · CA-3: dado un solo administrador, cuando intenta cambiar su rol → se rechaza con «Debe quedar al menos un administrador» (RQ-USR-02-09) | func |  |  |
| TC-CAP-121-04 | HU-CAP-121 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-121-05 | HU-CAP-121 · CA-5: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-122-01 | HU-CAP-122 · CA-1: dado un cajero que anula un pedido, cuando confirma → la pantalla de caja pide el PIN de la supervisora y sin él no se anula; no se envía ninguna notificación para aprobar desde otro lugar (RQ-USR-02-07) | func |  |  |
| TC-CAP-122-02 | HU-CAP-122 · CA-2: dado el perfil del administrador, cuando cambia su PIN por otro de 6 dígitos → el nuevo vale y el anterior no; un PIN de 4 dígitos o como 123456 no se acepta (RQ-USR-02-08) | func |  |  |
| TC-CAP-122-03 | HU-CAP-122 · CA-3: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-123-01 | HU-CAP-123 · CA-1: dado un trabajador desactivado, cuando el cajero busca → no aparece; para un activo, no se ofrece delivery ni reserva (RQ-USR-03-01) | func |  |  |
| TC-CAP-123-02 | HU-CAP-123 · CA-2: dado un pedido con un café de S/ 8 y un combo de S/ 22, cuando se aplica el 25 % → el café queda en S/ 6 y el combo en S/ 22 (RQ-USR-03-02) | func |  |  |
| TC-CAP-123-03 | HU-CAP-123 · CA-3: dado un trabajador que pide en la carta con su cuenta, cuando elige el pago → no aparece «Crédito del personal» (RQ-USR-03-06) | func |  |  |
| TC-CAP-123-04 | HU-CAP-123 · CA-4: dado un trabajador desactivado, cuando intenta aplicar su descuento de personal en la carta virtual o el cajero lo busca → no se le aplica descuento ni aparece como trabajador activo; dado el mismo trabajador reactivado, cuando pide de nuevo, entonces vuelve a recibir su descuento (RQ-USR-03-10) | func |  |  |
| TC-CAP-123-05 | HU-CAP-123 · CA-5: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-124-01 | HU-CAP-124 · CA-1: dado un consumo de S/ 28 el jueves 15/10, cuando se cobra a crédito → la semana del lunes 12 al domingo 18/10 del trabajador suma S/ 28 con el pedido y sus productos (RQ-USR-03-03) | func |  |  |
| TC-CAP-124-02 | HU-CAP-124 · CA-2: dado Créditos del personal, cuando el administrador lo revisa → no hay botón de abono ni fechas de vencimiento (RQ-USR-03-04) | func |  |  |
| TC-CAP-124-03 | HU-CAP-124 · CA-3: dado la semana actual, cuando el administrador abre Créditos del personal → ve cada trabajador con su total de la semana; al elegir «del 1 al 20/10», ve el total de ese rango y, al abrir a uno, sus consumos (RQ-USR-03-05) | func |  |  |
| TC-CAP-124-04 | HU-CAP-124 · CA-4: dado un pedido de un cliente, cuando el cajero cobra → no aparece la opción de crédito (RQ-USR-03-08) | func |  |  |
| TC-CAP-124-05 | HU-CAP-124 · CA-5: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-125-01 | HU-CAP-125 · CA-1: dado 25 %, cuando el administrador lo cambia a 20 % con Sí/No → los pedidos nuevos usan 20 % (RQ-USR-03-07) | func |  |  |
| TC-CAP-125-02 | HU-CAP-125 · CA-2: dado la semana del 12 al 18/10, cuando el administrador toca «Exportar» → descarga un archivo de Excel con trabajador, total y detalle, y la exportación queda en el Historial de acciones (RQ-USR-03-09) | func |  |  |
| TC-CAP-125-03 | HU-CAP-125 · CA-3: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-125-04 | HU-CAP-125 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-176-01 | HU-CAP-176 · CA-1: dado un administrador que cambia el precio del capuchino de S/ 9 a S/ 10, cuando guarda → el historial muestra «carta · PRECIO · capuchino», S/ 9 → S/ 10, su nombre, la hora y el dispositivo (RQ-USR-04-01) | func |  |  |
| TC-CAP-176-02 | HU-CAP-176 · CA-2: dado un cajero que anula un cobro con el PIN de la supervisora, cuando se confirma → el historial registra la anulación con el motivo, el cajero que la pidió y la supervisora que la aprobó (RQ-USR-04-02) | func |  |  |
| TC-CAP-176-03 | HU-CAP-176 · CA-3: dado un cajero que marca el club sándwich como agotado, cuando el administrador filtra «AGOTAR» → ve el producto, quién lo marcó, la hora y cuándo volvió a ofrecerse (RQ-USR-04-03) | func |  |  |
| TC-CAP-176-04 | HU-CAP-176 · CA-4: dado un cierre que no cuadró al primer conteo, cuando se revisa el historial → aparecen los dos conteos del cajero y la apertura del detalle por la supervisora con su hora (RQ-USR-04-04) | func |  |  |
| TC-CAP-176-05 | HU-CAP-176 · CA-5: dado 3 intentos fallidos con el DNI 00000012, cuando el administrador filtra «Accesos» → ve los 3 intentos con resultado «Rechazado», la hora y la IP (RQ-USR-04-05) | func |  |  |
| TC-CAP-176-06 | HU-CAP-176 · CA-6: dado un administrador que abre el DNI completo de un cliente, cuando lo ve → el historial registra «LECTURA_SENSIBLE · VER_DNI» con el cliente y quién lo vio (RQ-USR-04-06) | func |  |  |
| TC-CAP-176-07 | HU-CAP-176 · CA-7: dado un cambio en los datos de un cliente, cuando se revisa su registro → el DNI se ve como «4567****» y no hay ninguna contraseña ni PIN (RQ-USR-04-07) | func |  |  |
| TC-CAP-176-08 | HU-CAP-176 · CA-8: dado un registro, cuando alguien intenta editarlo o borrarlo → la base lo rechaza con «La auditoría no se edita ni se borra» (RQ-USR-04-12) | func |  |  |
| TC-CAP-176-09 | HU-CAP-176 · CA-9: dado una fila alterada por fuera, cuando corre la verificación de las 03:30 → el administrador recibe «Historial alterado desde el registro N» y Uptime Kuma marca la alerta (RQ-USR-04-13) | func |  |  |
| TC-CAP-176-10 | HU-CAP-176 · CA-10: dado un registro de hace 25 meses, cuando corre el archivado mensual → queda en el archivo cifrado de copias y ya no aparece en la pantalla; la cadena sigue verificando (RQ-USR-04-14) | func |  |  |
| TC-CAP-177-01 | HU-CAP-177 · CA-1: dado un cajero, cuando abre la dirección del historial → ve «No tienes acceso» y el servidor no entrega datos (RQ-USR-04-08) | advers |  |  |
| TC-CAP-177-02 | HU-CAP-177 · CA-2: dado registros de un mes, cuando el administrador filtra «Ana · caja · ANULAR» del 1 al 15 → ve solo esos y puede exportarlos; la exportación también queda registrada (RQ-USR-04-09) | func |  |  |
| TC-CAP-177-03 | HU-CAP-177 · CA-3: dado un cambio de parámetros, cuando el administrador abre el registro → ve los dos valores lado a lado y el campo cambiado resaltado (RQ-USR-04-10) | func |  |  |
| TC-CAP-177-04 | HU-CAP-177 · CA-4: dado el producto capuchino, cuando el administrador toca «Ver historial» → ve sus cambios de precio, foto y estado en orden (RQ-USR-04-11) | func |  |  |
| TC-CAP-177-05 | HU-CAP-177 · CA-5: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |

### EP-CAP-014 Chatbot: pedido y pago por WhatsApp

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-126-01 | HU-CAP-126 · CA-1: dado un cliente que escribe «hola», cuando elige «Hacer pedido» → ve la lista de categorías y, al elegir una, sus productos con precio (RQ-BOT-01-01) | func |  |  |
| TC-CAP-126-02 | HU-CAP-126 · CA-2: dado un frappé con leche obligatoria, cuando el cliente intenta seguir sin elegir → el bot vuelve a mostrar las leches (RQ-BOT-01-02) | func |  |  |
| TC-CAP-127-01 | HU-CAP-127 · CA-1: dado dos productos agregados, cuando el cliente pide «Ver carrito» → ve los dos con su total y botones «Agregar más», «Quitar» y «Terminar» (RQ-BOT-01-03) | func |  |  |
| TC-CAP-127-02 | HU-CAP-127 · CA-2: dado un delivery, cuando el cliente comparte su ubicación de WhatsApp → el bot calcula el envío; si escribe solo la dirección, el envío queda por calcular para el asesor (RQ-BOT-01-04) | integ |  |  |
| TC-CAP-128-01 | HU-CAP-128 · CA-1: dado un producto agotado, cuando el cliente abre su categoría → no aparece; con la pausa activa, el bot ofrece hablar con una persona (RQ-BOT-01-05) | func |  |  |
| TC-CAP-128-02 | HU-CAP-128 · CA-2: dado un descuento de 20 % en frappés, cuando el cliente agrega uno → el resumen muestra el descuento (RQ-BOT-01-06) | func |  |  |
| TC-CAP-128-03 | HU-CAP-128 · CA-3: dado un carrito terminado, cuando el cliente confirma → el pedido aparece en la cola de caja con todos sus datos (RQ-BOT-01-07) | func |  |  |
| TC-CAP-129-01 | HU-CAP-129 · CA-1: dado un texto libre fuera del flujo, cuando el bot no lo entiende dos veces → avisa «Te comunico con un asesor» y deja el chat en la consola (RQ-BOT-01-08) | func |  |  |
| TC-CAP-130-01 | HU-CAP-130 · CA-1: dado un pedido de la carta, cuando entra → el cliente recibe la plantilla con productos, opciones, entrega y total, y botones de medios de pago (RQ-BOT-02-01) | func |  |  |
| TC-CAP-130-02 | HU-CAP-130 · CA-2: dado Yape elegido, cuando el cliente toca «Yape» → recibe el número, el nombre del titular y el monto a pagar, leídos de Configuración del local (RQ-BOT-02-02) | func |  |  |
| TC-CAP-131-01 | HU-CAP-131 · CA-1: dado una imagen enviada por el cliente, cuando llega → se adjunta al pedido y el chat aparece en «Validar pago» con aviso a caja (RQ-BOT-02-03) | func |  |  |
| TC-CAP-131-02 | HU-CAP-131 · CA-2: dado un chat en «Validar pago», cuando el cajero aprueba con Sí/No → el pedido pasa a cocina con el comprobante; al rechazar, el bot avisa al cliente el motivo (RQ-BOT-02-04) | func |  |  |
| TC-CAP-131-03 | HU-CAP-131 · CA-3: dado un delivery solo con dirección escrita, cuando el cajero intenta aprobar → ve «Ubica el pedido primero» (RQ-BOT-02-05) | func |  |  |
| TC-CAP-131-04 | HU-CAP-131 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-132-01 | HU-CAP-132 · CA-1: dado efectivo elegido, cuando el cliente dice con cuánto paga → el chat queda «Por aprobar» y la persona lo confirma sin comprobante (RQ-BOT-02-06) | func |  |  |
| TC-CAP-132-02 | HU-CAP-132 · CA-2: dado un mes, cuando el administrador revisa el costo del bot → ve cuántas plantillas se enviaron y su costo estimado (RQ-BOT-02-07) | func |  |  |
| TC-CAP-132-03 | HU-CAP-132 · CA-3: dado un pedido sin respuesta del cliente en 10 minutos, cuando pasa el tiempo → caja recibe un aviso y el pedido sigue en la cola (RQ-BOT-02-08) | func |  |  |
| TC-CAP-133-01 | HU-CAP-133 · CA-1: dado «¿el frappé de Oreo lleva café?», cuando el cliente pregunta → la IA responde según la descripción del producto en la carta (RQ-BOT-03-01) | func |  |  |
| TC-CAP-133-02 | HU-CAP-133 · CA-2: dado un producto agotado, cuando el cliente pide una recomendación → la IA no lo menciona (RQ-BOT-03-02) | func |  |  |
| TC-CAP-133-03 | HU-CAP-133 · CA-3: dado «quiero 2 frappés», cuando lo escribe el cliente → la IA responde con el botón «Hacer pedido» y no arma el carrito (RQ-BOT-03-03) | func |  |  |
| TC-CAP-133-04 | HU-CAP-133 · CA-4: dado una pregunta por una promoción que no existe, cuando el cliente la hace → la IA dice que no hay esa promoción y muestra las vigentes (RQ-BOT-03-04) | func |  |  |
| TC-CAP-134-01 | HU-CAP-134 · CA-1: dado «reserva para 6 a las 8», cuando el cliente confirma → queda una solicitud en el administrativo; al aprobarla, se crea la reserva (FT-SAL-03) y el bot avisa al cliente (RQ-BOT-03-05) | func |  |  |
| TC-CAP-135-01 | HU-CAP-135 · CA-1: dado «hablar con una persona», cuando el cliente lo pide → el administrativo muestra el aviso y el bot deja de responder ese chat (RQ-BOT-03-06) | func |  |  |
| TC-CAP-135-02 | HU-CAP-135 · CA-2: dado un tope mensual, cuando el gasto llega al 80 % → el administrador recibe un aviso; al 100 %, la IA responde con un mensaje fijo y deriva a una persona (RQ-BOT-03-07) | func |  |  |

### EP-CAP-015 Atención por WhatsApp y posventa

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-136-01 | HU-CAP-136 · CA-1: dado 10 chats, cuando el cajero filtra «Validar pago» → ve solo esos, con el último mensaje y la hora (RQ-ATN-01-01) | func |  |  |
| TC-CAP-137-01 | HU-CAP-137 · CA-1: dado un chat del bot, cuando el cajero toca «Tomar» → el chat pasa a su nombre y el bot deja de responder (RQ-ATN-01-02) | func |  |  |
| TC-CAP-137-02 | HU-CAP-137 · CA-2: dado un chat tomado por el cajero, cuando el mozo intenta escribir → ve «Lo atiende … ¿Tomarlo?» y solo con Sí pasa a su nombre (RQ-ATN-01-03) | func |  |  |
| TC-CAP-137-03 | HU-CAP-137 · CA-3: dado un chat tomado, cuando el cajero toca «Soltar el chat» → vuelve al bot; con «Marcar atendido», queda cerrado hasta el próximo mensaje del cliente (RQ-ATN-01-04) | func |  |  |
| TC-CAP-137-04 | HU-CAP-137 · CA-4: dado un chat tomado sin mensajes en 15 minutos, cuando pasa el tiempo → vuelve al bot y se avisa a quien lo tenía (RQ-ATN-01-09) | func |  |  |
| TC-CAP-138-01 | HU-CAP-138 · CA-1: dado un cliente que escribe «urgente», cuando llega el mensaje → el chat pasa a «Urgente», el bot calla y suena un aviso en el administrativo (RQ-ATN-01-05) | func |  |  |
| TC-CAP-138-02 | HU-CAP-138 · CA-2: dado un chat, cuando el cajero elige la respuesta rápida «Datos de Yape» → se escribe en el cuadro para revisarla y enviarla (RQ-ATN-01-06) | func |  |  |
| TC-CAP-138-03 | HU-CAP-138 · CA-3: dado un texto con faltas, cuando el cajero toca «Pulir» → ve la versión mejorada y decide si usarla; no se envía hasta que toque «Enviar» (RQ-ATN-01-07) | func |  |  |
| TC-CAP-138-04 | HU-CAP-138 · CA-4: dado un chat en «Validar pago», cuando el cajero aprueba → el pedido pasa a cocina (FT-BOT-02) (RQ-ATN-01-08) | func |  |  |
| TC-CAP-139-01 | HU-CAP-139 · CA-1: dado un pedido en cocina hace 8 minutos con tiempo prometido de 13, cuando el cliente pregunta → el bot dice «Está en preparación, unos 5 minutos» (RQ-ATN-02-01) | func |  |  |
| TC-CAP-140-01 | HU-CAP-140 · CA-1: dado un pedido por confirmar, cuando el cliente pide cambiar la dirección → el bot dice que un asesor lo revisará y el pedido muestra «Solicitud de cambio» en caja (RQ-ATN-02-02) | func |  |  |
| TC-CAP-140-02 | HU-CAP-140 · CA-2: dado una solicitud de cambio, cuando el bot la recibe → el pedido no cambia hasta que un asesor lo edite (RQ-ATN-02-03) | func |  |  |
| TC-CAP-140-03 | HU-CAP-140 · CA-3: dado un pedido en camino, cuando el cliente pide otra dirección → el bot dice que un asesor lo contactará y el chat pasa a «Urgente» (RQ-ATN-02-04) | func |  |  |
| TC-CAP-140-04 | HU-CAP-140 · CA-4: dado una solicitud, cuando el asesor la acepta y edita el pedido → el bot avisa «Listo, cambiamos tu pedido»; si la rechaza, avisa el motivo (RQ-ATN-02-05) | func |  |  |
| TC-CAP-141-01 | HU-CAP-141 · CA-1: dado un mensaje confuso, cuando el bot no lo entiende por segunda vez → deriva a una persona (RQ-ATN-02-06) | func |  |  |
| TC-CAP-142-01 | HU-CAP-142 · CA-1: dado un pedido entregado a las 15:00, cuando son las 17:00 → el cliente recibe la encuesta con botones de 1 a 5 (RQ-ATN-03-01) | func |  |  |
| TC-CAP-142-02 | HU-CAP-142 · CA-2: dado un 5, cuando el cliente responde → recibe el agradecimiento y el enlace de Google Maps del local (RQ-ATN-03-02) | func |  |  |
| TC-CAP-142-03 | HU-CAP-142 · CA-3: dado un cliente con dos pedidos el mismo día, cuando se entregan → recibe una sola encuesta (RQ-ATN-03-05) | func |  |  |
| TC-CAP-143-01 | HU-CAP-143 · CA-1: dado un 2, cuando el cliente responde → el bot pide el motivo, el chat pasa a una persona y gerencia recibe el aviso (RQ-ATN-03-03) | func |  |  |
| TC-CAP-143-02 | HU-CAP-143 · CA-2: dado la encuesta, cuando el administrador cambia el tiempo a 3 horas → las siguientes se envían a las 3 horas (RQ-ATN-03-04) | func |  |  |

### EP-CAP-016 Administración de la carta y contenidos

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-144-01 | HU-CAP-144 · CA-1: dado la categoría Pizzas (fija), cuando crea «Pizza Americana» a S/ 25 con foto → queda oculta hasta publicar la carta (FT-CON-02) (RQ-CON-01-01) | func |  |  |
| TC-CAP-144-02 | HU-CAP-144 · CA-2: dado la categoría nueva «Hamburguesas» con opciones, cuando se crea un producto en ella → se abre «Opciones y tamaños» (RQ-CON-01-02) | func |  |  |
| TC-CAP-144-03 | HU-CAP-144 · CA-3: dado el producto «Frappé 2×1 de campaña», cuando el administrador activa la marca con Sí/No → ese producto deja de sumar puntos y de aceptar cupones (FT-CLI-02, FT-OFE-03), y el cambio queda en el historial (RQ-CON-01-08) | func |  |  |
| TC-CAP-144-04 | HU-CAP-144 · CA-4: dado un producto, cuando el administrador busca «Eliminar» → solo hay «Ocultar»; sus ventas pasadas se conservan (RQ-CON-01-09) | func |  |  |
| TC-CAP-144-05 | HU-CAP-144 · CA-5: dado un cambio de precio, cuando se publica → el historial muestra precio anterior, nuevo, autor y fecha, y los pedidos pasados mantienen su precio (RQ-CON-01-10) | func |  |  |
| TC-CAP-144-06 | HU-CAP-144 · CA-6: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-145-01 | HU-CAP-145 · CA-1: dado el grupo «Leches», cuando el administrador sube la de almendras de S/ 1,50 a S/ 2 y la asigna a la categoría Frappés → todos los frappés la ofrecen a S/ 2 (RQ-CON-01-03) | func |  |  |
| TC-CAP-145-02 | HU-CAP-145 · CA-2: dado el grupo «Toppings», cuando se define opcional con máximo 3 → la carta lo aplica (FT-CAR-01) (RQ-CON-01-04) | func |  |  |
| TC-CAP-146-01 | HU-CAP-146 · CA-1: dado el combo de tamaños, cuando el administrador escribe «Mediano» que no existe → puede crearlo ahí mismo; «Grande» repetido no se acepta (RQ-CON-01-05) | func |  |  |
| TC-CAP-146-02 | HU-CAP-146 · CA-2: dado la lista «Endulzantes», cuando el administrador oculta «Stevia» → deja de ofrecerse y los pedidos pasados la conservan (RQ-CON-01-06) | func |  |  |
| TC-CAP-147-01 | HU-CAP-147 · CA-1: dado el tipo «Donas», cuando se agrega el sabor «Pistacho» → aparece en la carta y en las promociones que piden donas (RQ-CON-01-07) | func |  |  |
| TC-CAP-148-01 | HU-CAP-148 · CA-1: dado el diseñador, cuando lo abre → ve la carta con su cabecera, categorías y productos como el cliente, con controles de edición (RQ-CON-02-01) | func |  |  |
| TC-CAP-148-02 | HU-CAP-148 · CA-2: dado Postres después de Frappés, cuando arrastra Postres antes → la vista previa cambia al momento (RQ-CON-02-02) | func |  |  |
| TC-CAP-148-03 | HU-CAP-148 · CA-3: dado un producto, cuando cambia su foto y su precio → la vista previa lo muestra y queda pendiente de publicar (RQ-CON-02-03) | func |  |  |
| TC-CAP-149-01 | HU-CAP-149 · CA-1: dado los dos destacados de arriba, cuando el administrador elige otro producto para el segundo → la vista previa lo muestra (RQ-CON-02-04) | func |  |  |
| TC-CAP-149-02 | HU-CAP-149 · CA-2: dado la organización «por secciones», cuando elige «tarjetas grandes» → la vista previa cambia (RQ-CON-02-05) | func |  |  |
| TC-CAP-150-01 | HU-CAP-150 · CA-1: dado la decoración de Navidad, cuando se activa y publica → la carta usa su paleta; al quitarla y publicar, vuelve la paleta de la marca (RQ-CON-02-06) | func |  |  |
| TC-CAP-150-02 | HU-CAP-150 · CA-2: dado cambios pendientes, cuando un cliente abre la carta → ve la versión anterior; al publicar, ve la nueva (RQ-CON-02-07) | func |  |  |
| TC-CAP-150-03 | HU-CAP-150 · CA-3: dado cambios pendientes, cuando el administrador toca «Descartar» con Sí/No → el diseñador vuelve a la versión publicada (RQ-CON-02-08) | func |  |  |
| TC-CAP-150-04 | HU-CAP-150 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-151-01 | HU-CAP-151 · CA-1: dado el tipo «Evento», cuando crea «Noche de jazz» con fecha, lugar, 3 fotos y tema «Aniversario» → queda como borrador (RQ-CON-03-01) | func |  |  |
| TC-CAP-151-02 | HU-CAP-151 · CA-2: dado un enlace de TikTok válido, cuando se pega → la vista previa lo muestra; un enlace de otro sitio no se acepta (RQ-CON-03-02) | func |  |  |
| TC-CAP-151-03 | HU-CAP-151 · CA-3: dado el subtítulo «Lo nuevo en Caprichos», cuando el administrador lo cambia a «¡Feliz Navidad para todos!» y publica → la carta muestra el texto nuevo; no es una imagen (RQ-CON-03-10) | func |  |  |
| TC-CAP-151-04 | HU-CAP-151 · CA-4: dado el espacio activo, cuando el administrador lo desactiva y publica → deja de verse en la carta (RQ-CON-03-11) | func |  |  |
| TC-CAP-152-01 | HU-CAP-152 · CA-1: dado una novedad hasta el 31/10, cuando un cliente abre Novedades el 1/11 → no aparece (RQ-CON-03-03) | func |  |  |
| TC-CAP-152-02 | HU-CAP-152 · CA-2: dado 5 novedades, cuando el administrador arrastra la quinta al inicio y la duplica → la vista previa refleja el orden y la copia queda inactiva (RQ-CON-03-04) | func |  |  |
| TC-CAP-152-03 | HU-CAP-152 · CA-3: dado una novedad publicada, cuando el administrador la desactiva y publica → sale de la carta y sigue en el módulo (RQ-CON-03-06) | func |  |  |
| TC-CAP-152-04 | HU-CAP-152 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-153-01 | HU-CAP-153 · CA-1: dado novedades de varios tipos, cuando el cliente filtra «Eventos» → solo ve eventos; al tocar una con fotos, abre la galería (RQ-CON-03-05) | func |  |  |
| TC-CAP-154-01 | HU-CAP-154 · CA-1: dado el círculo «Equipo» con 4 fotos, cuando el cliente lo toca → ve las 4 fotos en secuencia, puede avanzar o cerrar, y no hay enlaces (RQ-CON-03-07) | func |  |  |
| TC-CAP-154-02 | HU-CAP-154 · CA-2: dado un círculo sin fotos, cuando se publica → no aparece en la carta (RQ-CON-03-08) | func |  |  |
| TC-CAP-154-03 | HU-CAP-154 · CA-3: dado un círculo, cuando el administrador lo archiva → sale de la carta y queda en «Archivadas»; al eliminarlo con Sí/No, desaparece (RQ-CON-03-09) | func |  |  |
| TC-CAP-154-04 | HU-CAP-154 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |

### EP-CAP-017 Configuración del local

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-155-01 | HU-CAP-155 · CA-1: dado el formulario, cuando cambia el WhatsApp con Sí/No → la carta, el chatbot y los mensajes usan el nuevo número (RQ-CFG-01-01) | integ |  |  |
| TC-CAP-155-02 | HU-CAP-155 · CA-2: dado el panel de ubicación, cuando el administrador pega un enlace de Google Maps → se leen latitud y longitud y se ve el pin; con «Usar mi ubicación actual» se toma la del equipo (RQ-CFG-01-02) | func |  |  |
| TC-CAP-155-03 | HU-CAP-155 · CA-3: dado el teléfono cambiado, cuando se revisan Conócenos, el pie, el bot y el comprobante → todos muestran el nuevo (RQ-CFG-01-03) | func |  |  |
| TC-CAP-155-04 | HU-CAP-155 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-155-05 | HU-CAP-155 · CA-5: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-156-01 | HU-CAP-156 · CA-1: dado el lunes cerrado y de martes a domingo de 14:00 a 22:00, cuando un cliente abre la carta un lunes → ve «Cerrado» (RQ-CFG-01-04) | func |  |  |
| TC-CAP-156-02 | HU-CAP-156 · CA-2: dado el 25/12 cerrado, cuando es 25/12 → la carta y el bot no reciben pedidos y Reservas no ofrece horas (RQ-CFG-01-05) | func |  |  |
| TC-CAP-156-03 | HU-CAP-156 · CA-3: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-157-01 | HU-CAP-157 · CA-1: dado un cajero, cuando abre la configuración → no puede tocar las fotos; el administrador quita una con confirmación (RQ-CFG-01-06) | func |  |  |
| TC-CAP-157-02 | HU-CAP-157 · CA-2: dado 4 fotos, cuando el cliente abre Conócenos → las ve en la galería (RQ-CFG-01-07) | func |  |  |
| TC-CAP-157-03 | HU-CAP-157 · CA-3: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-157-04 | HU-CAP-157 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-158-01 | HU-CAP-158 · CA-1: dado Plin desactivado, cuando el cliente elige pago → no lo ve; el número de Yape editado aparece en el mensaje del bot (RQ-CFG-02-01) | func |  |  |
| TC-CAP-158-02 | HU-CAP-158 · CA-2: dado «de 25 a 35 minutos», cuando lo cambia a «de 30 a 40» → la carta y el bot muestran el nuevo rango, y la Alta demanda le suma sus minutos (FT-COC-03) (RQ-CFG-02-02) | func |  |  |
| TC-CAP-158-03 | HU-CAP-158 · CA-3: dado «más de S/ 70», cuando lo cambia a «desde S/ 70» → un pedido de S/ 70 tiene envío gratis (RQ-CFG-02-03) | func |  |  |
| TC-CAP-158-04 | HU-CAP-158 · CA-4: dado un cambio del tiempo prometido, cuando se confirma → el historial muestra el valor anterior, el nuevo, quién y cuándo (RQ-CFG-02-09) | func |  |  |
| TC-CAP-158-05 | HU-CAP-158 · CA-5: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-158-06 | HU-CAP-158 · CA-6: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-159-01 | HU-CAP-159 · CA-1: dado la tolerancia de 15 minutos, cuando la cambia a 20 → las reservas nuevas vencen a los 20 (RQ-CFG-02-04) | func |  |  |
| TC-CAP-159-02 | HU-CAP-159 · CA-2: dado el mensaje de confirmación, cuando el dueño cambia el texto → los siguientes mensajes usan el nuevo (RQ-CFG-02-05) | func |  |  |
| TC-CAP-159-03 | HU-CAP-159 · CA-3: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-160-01 | HU-CAP-160 · CA-1: dado verde hasta 35 y rojo desde 50, cuando el dueño cambia rojo a 45 con Sí/No → el mapa del repartidor usa 45; al cambiar el texto del mensaje «En camino», los siguientes avisos usan el nuevo (RQ-CFG-02-06) | func |  |  |
| TC-CAP-160-02 | HU-CAP-160 · CA-2: dado 2 intentos, cuando cambia a 3 → la recomendación de volver sale al tercero (RQ-CFG-02-07) | func |  |  |
| TC-CAP-160-03 | HU-CAP-160 · CA-3: dado la etiqueta por bebida, cuando se desactiva → deja de imprimirse (RQ-CFG-02-08) | func |  |  |
| TC-CAP-160-04 | HU-CAP-160 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-160-05 | HU-CAP-160 · CA-5: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |

### EP-CAP-018 Informes, indicadores y notificaciones

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-161-01 | HU-CAP-161 · CA-1: dado el informe de ventas, cuando el administrador elige del 01/10 al 15/10 → todos los gráficos usan ese rango (RQ-INF-01-01) | func |  |  |
| TC-CAP-161-02 | HU-CAP-161 · CA-2: dado el rango, cuando filtra canal «Carta» y pago «Yape» → solo cuenta esos pedidos (RQ-INF-01-02) | func |  |  |
| TC-CAP-161-03 | HU-CAP-161 · CA-3: dado un informe filtrado, cuando toca «Exportar a Excel» → descarga un archivo con las filas del filtro y el Historial de acciones registra quién lo exportó y con qué filtro (RQ-INF-01-07) | func |  |  |
| TC-CAP-161-04 | HU-CAP-161 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-162-01 | HU-CAP-162 · CA-1: dado octubre, cuando abre «Ventas» → ve los gráficos y el ticket promedio (RQ-INF-01-03) | func |  |  |
| TC-CAP-162-02 | HU-CAP-162 · CA-2: dado octubre, cuando abre «Tiempos» → ve el tiempo medio y el % de pedidos dentro de la meta por día (RQ-INF-01-04) | func |  |  |
| TC-CAP-162-03 | HU-CAP-162 · CA-3: dado los cierres de octubre, cuando se compara con el informe de octubre → la venta por medio de pago es igual (RQ-INF-01-08) | func |  |  |
| TC-CAP-162-04 | HU-CAP-162 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-163-01 | HU-CAP-163 · CA-1: dado octubre, cuando abre «Rentabilidad» → ve el margen de cada plato con receta y la merma por destino (RQ-INF-01-05) | func |  |  |
| TC-CAP-163-02 | HU-CAP-163 · CA-2: dado octubre, cuando abre «Ofertas» → ve cuántos combos se vendieron y cuánto se descontó por cupón (RQ-INF-01-06) | func |  |  |
| TC-CAP-163-03 | HU-CAP-163 · CA-3: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-164-01 | HU-CAP-164 · CA-1: dado el día, cuando el administrador entra → ve las cuatro cifras con su comparación con el día anterior (RQ-INF-02-01) | func |  |  |
| TC-CAP-164-02 | HU-CAP-164 · CA-2: dado el año 2026, cuando filtra canal «Chatbot» → los gráficos solo cuentan ese canal (RQ-INF-02-02) | func |  |  |
| TC-CAP-164-03 | HU-CAP-164 · CA-3: dado el mismo día, cuando se comparan → son iguales (RQ-INF-02-06) | func |  |  |
| TC-CAP-164-04 | HU-CAP-164 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-165-01 | HU-CAP-165 · CA-1: dado octubre, cuando abre el mapa → ve el calor de los puntos de entrega (RQ-INF-02-03) | func |  |  |
| TC-CAP-165-02 | HU-CAP-165 · CA-2: dado el mapa, cuando activa «Radios» → ve círculos de 1, 2 y 3 km desde la tienda y las ventas de cada zona (RQ-INF-02-04) | func |  |  |
| TC-CAP-165-03 | HU-CAP-165 · CA-3: dado intentos fuera de cobertura, cuando activa la capa → los ve como puntos (RQ-INF-02-05) | func |  |  |
| TC-CAP-165-04 | HU-CAP-165 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-166-01 | HU-CAP-166 · CA-1: dado un pedido nuevo, cuando el cajero toca su aviso → se abre el pedido y el aviso queda leído (RQ-INF-03-01) | func |  |  |
| TC-CAP-166-02 | HU-CAP-166 · CA-2: dado un aviso de stock bajo, cuando entra un mozo → no lo ve; almacén sí (RQ-INF-03-02) | func |  |  |
| TC-CAP-166-03 | HU-CAP-166 · CA-3: dado un pedido nuevo o un urgente, cuando llega → suena; un aviso de stock bajo no suena (RQ-INF-03-03) | func |  |  |
| TC-CAP-166-04 | HU-CAP-166 · CA-4: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |
| TC-CAP-167-01 | HU-CAP-167 · CA-1: dado avisos de una semana, cuando el administrador filtra «Impresión» sin leer → ve solo esos agrupados por día (RQ-INF-03-04) | integ |  |  |
| TC-CAP-167-02 | HU-CAP-167 · CA-2: dado 12 avisos sin leer, cuando toca «Marcar todo leído» → la campanita queda en cero (RQ-INF-03-05) | func |  |  |
| TC-CAP-167-03 | HU-CAP-167 · CA-3: dado un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor), cuando intenta hacerla desde el menú o escribiendo la dirección de la pantalla → se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) | advers |  |  |

### EP-CAP-019 Modo sin internet

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-168-01 | HU-CAP-168 · CA-1: dado internet cortado, cuando el mozo envía un pedido desde su tablet → llega a la pantalla de cocina por la red local y la caja lo ve (RQ-OFF-01-01) | func |  |  |
| TC-CAP-168-02 | HU-CAP-168 · CA-2: dado un cobro sin internet, cuando se registra → queda en la base local con su hora y su número de orden (RQ-OFF-01-02) | func |  |  |
| TC-CAP-168-03 | HU-CAP-168 · CA-3: dado la PC de caja recién encendida y el router sin internet, cuando la tablet abre el administrativo → carga desde el mini servidor sin pedir internet (RQ-OFF-01-03) | advers |  |  |
| TC-CAP-168-04 | HU-CAP-168 · CA-4: dado internet cortado, cuando cualquier usuario mira la cabecera → ve «Sin internet · los pedidos web no llegan», y la carta muestra que no recibe pedidos (RQ-OFF-01-06) | func |  |  |
| TC-CAP-168-05 | HU-CAP-168 · CA-5: dado internet cortado, cuando el administrador intenta cambiar un precio → ve «Esto se puede hacer cuando vuelva el internet» (RQ-OFF-01-07) | func |  |  |
| TC-CAP-169-01 | HU-CAP-169 · CA-1: dado 20 pedidos sin internet, cuando vuelve la conexión → los 20 llegan al sistema en línea en orden, sin duplicados (RQ-OFF-01-04) | func |  |  |
| TC-CAP-169-02 | HU-CAP-169 · CA-2: dado la mesa 3 pedida desde la tablet y desde caja sin conexión al sistema en línea, cuando se sincroniza → queda un solo pedido y se avisa a caja (RQ-OFF-01-05) | func |  |  |

### EP-CAP-020 Comprobantes y obligaciones legales

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-170-01 | HU-CAP-170 · CA-1: dado un cobro sin cambios, cuando se imprime → sale «Nota de venta» con su número correlativo (RQ-LEG-01-01) | func |  |  |
| TC-CAP-170-02 | HU-CAP-170 · CA-2: dado «Factura», cuando el cajero escribe un RUC de 10 dígitos → no se acepta (RQ-LEG-01-02) | func |  |  |
| TC-CAP-170-03 | HU-CAP-170 · CA-3: dado un cobro, cuando el cajero reimprime → sale con «COPIA» y los mismos cupones (RQ-LEG-01-05) | func |  |  |
| TC-CAP-171-01 | HU-CAP-171 · CA-1: dado un cobro con Yape, cuando se imprime → muestra nombre y RUC del local, productos, total, «Yape» y los cupones sorteados (RQ-LEG-01-03) | func |  |  |
| TC-CAP-172-01 | HU-CAP-172 · CA-1: dado un pedido con factura, cuando se cobra → aparece en la lista «Por emitir» con los datos para copiarlos al facturador (RQ-LEG-01-04) | func |  |  |
| TC-CAP-173-01 | HU-CAP-173 · CA-1: dado el formulario, cuando el cliente completa nombre, DNI, domicilio, contacto y detalle → se guarda y recibe la constancia con número (RQ-LEG-02-01) | func |  |  |
| TC-CAP-173-02 | HU-CAP-173 · CA-2: dado un reclamo guardado, cuando termina → ve y puede descargar su constancia (RQ-LEG-02-02) | func |  |  |
| TC-CAP-174-01 | HU-CAP-174 · CA-1: dado un reclamo de hace 12 días hábiles, cuando el administrador abre la lista → lo ve con «Faltan 3 días» y puede registrar la respuesta (RQ-LEG-02-03) | func |  |  |
| TC-CAP-174-02 | HU-CAP-174 · CA-2: dado un reclamo, cuando el administrador lo abre → no hay opción de eliminar (RQ-LEG-02-04) | func |  |  |
| TC-CAP-175-01 | HU-CAP-175 · CA-1: dado el pie de la carta, cuando el cliente toca «Privacidad» → ve el texto vigente (RQ-LEG-02-05) | func |  |  |
| TC-CAP-175-02 | HU-CAP-175 · CA-2: dado un pedido que guarda teléfono y dirección para la próxima vez, cuando el cliente no acepta el aviso → se usan solo para ese pedido (RQ-LEG-02-06) | func |  |  |

### EP-CAP-021 Plataforma, despliegue y operación

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-178-01 | HU-CAP-178 · CA-1: dado un equipo nuevo con Node y Docker, cuando se clona el repositorio y se corre `pnpm install` y `docker compose up` → la API, la web, PostgreSQL y Redis quedan corriendo en local siguiendo solo el README (RQ-PLA-01-01) | func |  |  |
| TC-CAP-178-02 | HU-CAP-178 · CA-2: dado la API en local, cuando arranca → escribe un registro JSON de inicio con la versión y el ambiente, se conecta a la base y a Redis, y un error de prueba aparece en GlitchTip sin DNI ni teléfonos (RQ-PLA-01-02) | func |  |  |
| TC-CAP-178-03 | HU-CAP-178 · CA-3: dado la API en pruebas, cuando se apaga Redis → `/salud` responde 503 indicando qué falló; `/version` devuelve la versión y el commit desplegados (RQ-PLA-01-03) | func |  |  |
| TC-CAP-179-01 | HU-CAP-179 · CA-1: dado un PR que importa una tabla de otro módulo, cuando corre el CI → la regla de dependencias falla y GitHub no permite unirlo a `main` (RQ-PLA-01-04) | func |  |  |
| TC-CAP-179-02 | HU-CAP-179 · CA-2: dado un PR con una prueba rota, cuando termina el CI → el PR muestra en rojo el paso «pruebas» con el nombre de la prueba, y el CI completo tardó menos de 10 minutos (RQ-PLA-01-09) | func |  |  |
| TC-CAP-179-03 | HU-CAP-179 · CA-3: dado un PR del autor, cuando intenta unirlo sin revisión → la protección de la rama `main` lo impide hasta que quede una revisión aprobada (RQ-PLA-01-10) | func |  |  |
| TC-CAP-180-01 | HU-CAP-180 · CA-1: dado un PR aprobado y unido a `main`, cuando termina el flujo → `staging.caprichos.pe/version` muestra el commit nuevo sin pasos manuales (RQ-PLA-01-05) | func |  |  |
| TC-CAP-180-02 | HU-CAP-180 · CA-2: dado un tag `v0.3.0`, cuando se publica → producción muestra `v0.3.0` en `/version` y el historial de Dokploy registra la publicación; un push a `main` sin tag no toca producción (RQ-PLA-01-06) | func |  |  |
| TC-CAP-180-03 | HU-CAP-180 · CA-3: dado `v0.3.0` con un error grave, cuando se sigue RB-CAP-001 → producción vuelve a `v0.2.x` en menos de 10 minutos y las migraciones aplicadas siguen siendo compatibles (expandir antes de contraer) (RQ-PLA-01-07) | func |  |  |
| TC-CAP-180-04 | HU-CAP-180 · CA-4: dado una columna que se renombra, cuando se publica → primero se agrega la nueva y se copian los datos, y la vieja se quita en una versión posterior (RQ-PLA-01-08) | func |  |  |
| TC-CAP-181-01 | HU-CAP-181 · CA-1: dado un VPS recién creado, cuando se corre `ansible-playbook site.yml` dos veces seguidas → la segunda corrida no cambia nada y el servidor no acepta SSH con contraseña ni como root (RQ-PLA-02-01) | advers |  |  |
| TC-CAP-181-02 | HU-CAP-181 · CA-2: dado un servicio nuevo en Dokploy, cuando se publica → aparece en INV-CAP-001 con su ambiente, puerto interno y responsable (RQ-PLA-02-07) | func |  |  |
| TC-CAP-181-03 | HU-CAP-181 · CA-3: dado RB-CAP-004, cuando lo sigue otra persona en un VPS nuevo → deja el servidor listo sin preguntar nada fuera del documento (RQ-PLA-02-08) | advers |  |  |
| TC-CAP-182-01 | HU-CAP-182 · CA-1: dado el VPS, cuando alguien abre `http://IP-del-VPS` directo → no responde; por `https://caprichos.pe` sí (RQ-PLA-02-02) | func |  |  |
| TC-CAP-182-02 | HU-CAP-182 · CA-2: dado los servidores de nombres cambiados en punto.pe, cuando se abren `caprichos.pe`, `admin.`, `api.` y `staging.` → responden con HTTPS válido y la IP del VPS no aparece en el DNS público (RQ-PLA-02-03) | advers |  |  |
| TC-CAP-182-03 | HU-CAP-182 · CA-3: dado `panel.caprichos.pe`, cuando lo abre alguien sin acceso → Cloudflare Access lo bloquea antes de llegar al VPS (RQ-PLA-02-04) | func |  |  |
| TC-CAP-183-01 | HU-CAP-183 · CA-1: dado un pedido de prueba en `staging.`, cuando pasa a cocina → no aparece en producción, el mensaje sale por el número de prueba de Meta y la comanda se genera como PDF (RQ-PLA-02-05) | func |  |  |
| TC-CAP-183-02 | HU-CAP-183 · CA-2: dado un commit que incluye una clave de OpenAI, cuando se intenta → el hook lo rechaza; y `git grep` en el repositorio no encuentra claves reales (RQ-PLA-02-06) | func |  |  |
| TC-CAP-183-03 | HU-CAP-183 · CA-3: dado pruebas encendido, cuando se apaga desde Dokploy a las 23:00 → producción sigue respondiendo y la RAM libre del VPS sube cerca de 1 GB (RQ-PLA-02-09) | func |  |  |
| TC-CAP-184-01 | HU-CAP-184 · CA-1: dado el día 21, cuando son las 03:10 → el repositorio de restic tiene una copia nueva con la base de producción, la de pruebas y las dos carpetas, y su contenido no se puede leer sin la clave (RQ-PLA-03-01) | func |  |  |
| TC-CAP-184-02 | HU-CAP-184 · CA-2: dado 40 copias diarias, cuando corre la limpieza → quedan las 30 últimas diarias y una por mes de los últimos 6 meses (RQ-PLA-03-02) | func |  |  |
| TC-CAP-184-03 | HU-CAP-184 · CA-3: dado un día en que el almacenamiento externo no responde, cuando la copia falla → Uptime Kuma marca el monitor de la copia en rojo y envía el aviso antes de las 04:00 (RQ-PLA-03-03) | func |  |  |
| TC-CAP-184-04 | HU-CAP-184 · CA-4: dado el VPS perdido por completo, cuando hay que restaurar → la clave y el acceso están en el gestor de contraseñas del responsable y no solo en el servidor (RQ-PLA-03-04) | advers |  |  |
| TC-CAP-185-01 | HU-CAP-185 · CA-1: dado RB-CAP-002, cuando lo sigue alguien distinto de quien lo escribió → logra restaurar en pruebas sin pedir ayuda (RQ-PLA-03-05) | func |  |  |
| TC-CAP-185-02 | HU-CAP-185 · CA-2: dado el primer lunes del trimestre, cuando se restaura la copia del día en pruebas → los pedidos y cobros del día anterior aparecen completos y el tiempo total queda anotado (meta: menos de 1 hora) (RQ-PLA-03-06) | func |  |  |
| TC-CAP-185-03 | HU-CAP-185 · CA-3: dado un producto borrado por error ayer, cuando se restaura la copia en una base aparte → se copia solo ese registro a producción y el resto no cambia (RQ-PLA-03-07) | func |  |  |
| TC-CAP-186-01 | HU-CAP-186 · CA-1: dado los 6 monitores, cuando se apaga la API en pruebas → su monitor pasa a rojo en el minuto siguiente (RQ-PLA-04-01) | func |  |  |
| TC-CAP-186-02 | HU-CAP-186 · CA-2: dado la API caída, cuando pasan 2 minutos → llega el aviso al celular configurado; al volver, llega «recuperado» con la duración (RQ-PLA-04-02) | func |  |  |
| TC-CAP-186-03 | HU-CAP-186 · CA-3: dado el fin de mes, cuando se revisa el reporte → se ve el porcentaje de disponibilidad de la carta y de la API (RQ-PLA-04-03) | func |  |  |
| TC-CAP-187-01 | HU-CAP-187 · CA-1: dado un error al cobrar con el DNI 00000012 en la solicitud, cuando se revisa en GlitchTip → el DNI aparece enmascarado y no hay tokens (RQ-PLA-04-04) | func |  |  |
| TC-CAP-187-02 | HU-CAP-187 · CA-2: dado un día de hora punta, cuando se revisa el disco → los registros de Docker no superan el tamaño configurado y se puede buscar por número de pedido (RQ-PLA-04-05) | func |  |  |
| TC-CAP-187-03 | HU-CAP-187 · CA-3: dado la API caída, cuando se sigue RB-CAP-003 → se identifica la causa con los registros y se vuelve a levantar o se vuelve a la versión anterior (RQ-PLA-04-06) | func |  |  |
| TC-CAP-188-01 | HU-CAP-188 · CA-1: dado un parche de seguridad publicado, cuando pasa un día → está instalado y queda en el registro de unattended-upgrades (RQ-PLA-05-01) | func |  |  |
| TC-CAP-188-02 | HU-CAP-188 · CA-2: dado una versión nueva de NestJS, cuando Renovate la detecta → abre un PR que corre todas las pruebas antes de unirse (RQ-PLA-05-02) | func |  |  |
| TC-CAP-188-03 | HU-CAP-188 · CA-3: dado una imagen con una vulnerabilidad crítica conocida, cuando corre el CI → falla y la imagen no se sube a GHCR (RQ-PLA-05-03) | func |  |  |
| TC-CAP-189-01 | HU-CAP-189 · CA-1: dado el piloto H1, cuando se prepara la salida → SEC-CAP-001 tiene cada punto revisado con evidencia o con su pendiente aceptado (RQ-PLA-05-04) | func |  |  |
| TC-CAP-189-02 | HU-CAP-189 · CA-2: dado la clave de OpenAI expuesta, cuando se sigue RB-CAP-005 → se genera una nueva, se cambia en Dokploy, se reinicia el servicio y la vieja se revoca en menos de 30 minutos (RQ-PLA-05-05) | func |  |  |
| TC-CAP-189-03 | HU-CAP-189 · CA-3: dado una sospecha de acceso indebido, cuando se sigue el procedimiento → se revocan sesiones y claves, se revisa el Historial de acciones y se evalúa si hay que avisar a los afectados (Ley 29733) (RQ-PLA-05-06) | func |  |  |

### EP-CAP-022 Iniciativas del equipo

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| TC-CAP-190-01 | HU-CAP-190 · CA-1: dado una cajera con sesión, cuando completa el tipo, el área, el título y el comentario y responde «Sí» en la confirmación → la iniciativa queda con código `IN-NNNN`, estado *Nueva*, su nombre, su rol y la fecha; si responde «No», no se guarda nada (RQ-INI-01-01) | func |  |  |
| TC-CAP-190-02 | HU-CAP-190 · CA-2: dado una captura de 8 MB, cuando se intenta subir → se rechaza con un aviso de tamaño; dada una de 2 MB, se guarda y su dirección directa sin sesión responde 403 (RQ-INI-01-02) | func |  |  |
| TC-CAP-190-03 | HU-CAP-190 · CA-3: dado el cuadro sin título, cuando se pulsa «Subir iniciativa» → aparece «Escribe un título corto» y no se pide confirmación (RQ-INI-01-03) | func |  |  |
| TC-CAP-190-04 | HU-CAP-190 · CA-4: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-191-01 | HU-CAP-191 · CA-1: dado un mozo con sesión, cuando abre Iniciativas → ve las de todos, cada una con «Subida por <nombre> (<rol>)» y su estado, y ninguna pantalla de otro módulo queda abierta por esto (RQ-INI-01-04) | func |  |  |
| TC-CAP-191-02 | HU-CAP-191 · CA-2: dado 30 iniciativas, cuando se filtra «Queja» y «En revisión» → solo aparecen las quejas en revisión y el contador dice cuántas son; con «Solo las mías» solo aparecen las del usuario (RQ-INI-01-05) | func |  |  |
| TC-CAP-191-03 | HU-CAP-191 · CA-3: dado una iniciativa con captura, cuando se pulsa «Ver y comentar» → la captura se muestra ampliada dentro del ancho de un celular de 360 px sin desplazamiento horizontal (RQ-INI-01-06) | func |  |  |
| TC-CAP-192-01 | HU-CAP-192 · CA-1: dado una iniciativa abierta, cuando el cocinero escribe un comentario y pulsa «Comentar» → aparece al final con su nombre y su rol; un comentario vacío muestra «Escribe tu comentario» (RQ-INI-01-07) | func |  |  |
| TC-CAP-193-01 | HU-CAP-193 · CA-1: dado un cajero, cuando intenta cambiar el estado por la API → recibe 403 y el estado no cambia; dado el administrador, cuando responde «Sí» a pasar a *En revisión*, entonces el estado cambia y queda su nombre y la hora (RQ-INI-01-08) | func |  |  |
| TC-CAP-193-02 | HU-CAP-193 · CA-2: dado 3 iniciativas nuevas, cuando el administrador abre el sistema → el menú Iniciativas muestra el número 3; al pasar una a *En revisión*, muestra 2 (RQ-INI-01-09) | func |  |  |
| TC-CAP-193-03 | HU-CAP-193 · CA-3: dado la confirmación Sí/No de la acción, cuando quien la hace responde «No» → no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) | func |  |  |
| TC-CAP-194-01 | HU-CAP-194 · CA-1: dado una iniciativa subida desde la tablet del mozo, cuando el administrador abre el Historial de acciones y filtra el módulo «iniciativas» → ve «Subió la iniciativa IN-NNNN» con el nombre del mozo y su IP (RQ-INI-01-10) | func |  |  |
| TC-CAP-194-02 | HU-CAP-194 · CA-2: dado una falla al escribir en el historial, cuando se sube una iniciativa → no se crea la iniciativa y se muestra un aviso para reintentar (RQ-INI-01-11) | func |  |  |

### Flujos críticos E2E

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| E2E-01 | Pedido de la carta con Yape: carta → por confirmar → bot escribe → captura → caja aprueba → cocina por área → impresión → listo → reparto → entregado → liquidación → cierre (cubre HU-CAP-019, HU-CAP-030, HU-CAP-047, HU-CAP-051, HU-CAP-071, HU-CAP-043, HU-CAP-045) | E2E |  |  |
| E2E-02 | Pedido del mozo en mesa: elegir mesa → directo a cocina → adicional → precuenta → cobro mixto → mesa libre (cubre HU-CAP-061, HU-CAP-062, HU-CAP-063, HU-CAP-034) | E2E |  |  |
| E2E-03 | Delivery por teléfono sin ubicación: Nuevo pedido → ubicar en el mapa → recalcular envío → confirmar con efectivo y vuelto (cubre HU-CAP-038, HU-CAP-031, HU-CAP-033) | E2E |  |  |
| E2E-04 | Combo con un componente agotado: agotar por hoy → elegir otro → cada parte a su área → stock por parte (cubre HU-CAP-055, HU-CAP-108, HU-CAP-047, HU-CAP-085) | E2E |  |  |
| E2E-05 | Entrega fallida: no contesta → corrección → vuelve a la tienda → coordinación → reprogramar (cubre HU-CAP-074, HU-CAP-075, HU-CAP-076) | E2E |  |  |
| E2E-06 | Cierre del día con faltante en Yape y efectivo de repartidor por liquidar (cubre HU-CAP-043, HU-CAP-044, HU-CAP-045) | E2E |  |  |
| E2E-07 | Pedido por WhatsApp completo con botones, descuento automático y pago aprobado (cubre HU-CAP-126, HU-CAP-127, HU-CAP-110, HU-CAP-128, HU-CAP-132) | E2E |  |  |
| E2E-08 | Producción con materia prima de cocina y del almacén, venta y cierre del día con merma (cubre HU-CAP-092, HU-CAP-091, HU-CAP-085, HU-CAP-096) | E2E |  |  |
| E2E-09 | Primer ingreso de un usuario nuevo y acceso solo a sus módulos (cubre HU-CAP-116, HU-CAP-117, HU-CAP-119) | E2E |  |  |
| E2E-10 | Cupón impreso en el comprobante y canjeado en la carta una sola vez (cubre HU-CAP-113, HU-CAP-114, HU-CAP-115) | E2E |  |  |

### Adversariales y de seguridad (Ciclo 0)

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| SEC-01 | Cada rol contra cada endpoint del catálogo ARQ-CAP-002: sin permiso → 403, sin datos (RNF-CAP-006, ADR-008) | advers |  |  |
| SEC-02 | Token vencido, manipulado o de otra audiencia (carta vs admin) → 401 (ADR-008) | advers |  |  |
| SEC-03 | Usuario desactivado: su token de renovación deja de servir al instante (ADR-008) | advers |  |  |
| SEC-04 | Fuerza bruta: 5 contraseñas erradas bloquean; 5 cupones inválidos bloquean 5 minutos (D-17, V11) | advers |  |  |
| SEC-05 | Webhook de WhatsApp con firma inválida → 401 y nada se procesa (ADR-009) | advers |  |  |
| SEC-06 | Captura de pago por URL directa sin sesión → 404/403 (carpeta privada) (ADR-005, ADR-012) | advers |  |  |
| SEC-07 | Inyección SQL y XSS en buscador, notas, mensajes y reclamos (RNF-CAP-006) | advers |  |  |
| SEC-08 | Precio manipulado desde el navegador: la API recalcula y rechaza totales distintos (RNF-CAP-011) | advers |  |  |
| SEC-09 | La IA no recibe DNI, teléfono ni dirección (revisión de solicitudes a OpenAI) (ADR-005, ADR-009) | advers |  |  |
| SEC-10 | GlitchTip y registros sin DNI, teléfonos, contraseñas ni tokens (ADR-012) | advers |  |  |
| SEC-11 | Llave de la TV revocada deja de ver comandas; la TV no ve datos personales (RN-CAP-023) | advers |  |  |
| SEC-12 | Firewall: el VPS solo responde a Cloudflare en 80/443; panel de Dokploy protegido (ADR-011) | advers |  |  |

### Performance y disponibilidad (Ciclo 0)

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| PERF-01 | Carta en celular 4G simulado: primera vista ≤ 3 s (p75) (RNF-CAP-001) | API |  |  |
| PERF-02 | Pedido confirmado visible en cocina ≤ 3 s (p95) con 30 conexiones abiertas (RNF-CAP-002) | API |  |  |
| PERF-03 | Hora punta: 60 pedidos en 30 minutos sin errores y API p95 ≤ 500 ms (RNF-CAP-002, RNF-CAP-003) | API |  |  |
| PERF-04 | Comanda impresa ≤ 5 s; alerta de fallo ≤ 10 s con la ticketera apagada (RNF-CAP-013) | API |  |  |
| PERF-05 | Informe de un mes ≤ 5 s (RNF-CAP-017) | API |  |  |
| PERF-06 | Restaurar la copia del día en el ambiente de pruebas en < 1 hora (ADR-011, ADR-012) | API |  |  |
| PERF-07 | Uso de RAM del VPS ≤ 6 GB en la prueba de hora punta (DT-30) | API |  |  |

### Regresión

| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |
| --- | --- | --- | --- | --- |
| REG-01 | Suite automática de reglas de dominio (precio con opciones, descuentos, cupones, zonas, stock) en cada PR (ADR-001) | regres |  |  |
| REG-02 | Pruebas de API por módulo en cada PR (Postgres y Redis en contenedor) (ADR-003) | regres |  |  |
| REG-03 | Los 10 flujos E2E en pruebas antes de cada versión a producción (DT-41) | regres |  |  |
| REG-04 | Concurrencia: mesa, reparto, confirmación, chat y cupón con dos usuarios a la vez (RNF-CAP-010) | regres |  |  |
| REG-05 | Cierre de caja cuadra con los cobros del día (regla de calidad 1 de DAT-CAP-001) (RNF-CAP-011) | regres |  |  |

### Capa B — Después (sin casos detallados)

No hay HU de capa B en Caprichos. Lo equivalente es el modo sin internet (HU-CAP-168, HU-CAP-169, FT-OFF-01): tiene sus casos arriba y se ejecuta en la segunda meta, con el mini servidor en la caja (DT-52).

## Defectos

| ID | Severidad | Impacto negocio | Estado | Plan (mayores: aprueba PO) |
| --- | --- | --- | --- | --- |
| — |  |  |  |  |

Metas de RNF (valores medidos vacíos hasta ejecutar):

| RNF | Meta | Medido |
| --- | --- | --- |
| RNF-CAP-001 | Primera vista ≤ 3 s (p75) · medición: monitoreo del navegador |  |
| RNF-CAP-002 | Retardo ≤ 3 s (p95) · medición: registro de eventos |  |
| RNF-CAP-003 | ≥ 99,5 % mensual en horario · medición: monitoreo externo |  |
| RNF-CAP-004 | Ancho mínimo 360 px · 0 pantallas con scroll horizontal |  |
| RNF-CAP-005 | Contraste WCAG AA · objetivos táctiles ≥ 44 px |  |
| RNF-CAP-006 | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol |  |
| RNF-CAP-007 | 0 contraseñas en texto · revisión de la base |  |
| RNF-CAP-008 | 0 datos personales sin aceptación · 0 DNI completos en listas |  |
| RNF-CAP-009 | 100 % de cambios con autor y fecha |  |
| RNF-CAP-010 | 0 duplicados en prueba con dos usuarios a la vez |  |
| RNF-CAP-011 | Diferencia 0,00 entre total mostrado, cobrado y registrado |  |
| RNF-CAP-012 | 100 % de acciones de cambio con confirmación |  |
| RNF-CAP-013 | Impresión ≤ 5 s · alerta de fallo ≤ 10 s |  |
| RNF-CAP-014 | 0 borrados físicos fuera de las excepciones del BRD |  |
| RNF-CAP-015 | Costo mensual visible · alerta al 80 % del tope |  |
| RNF-CAP-016 | Respuesta ≤ 5 s (p90) |  |
| RNF-CAP-017 | ≤ 5 s para un mes de datos |  |
| RNF-CAP-018 | 0 registros perdidos · sincronización ≤ 5 min tras volver la conexión |  |
| RNF-CAP-019 | Zona America/Lima · 0 cambios de día fuera de las 00:00 locales |  |
| RNF-CAP-020 | 100 % de cambios de stock con movimiento |  |

Ejecutado por IA: (nada ejecutado; plan generado por IA) - Consolidado y aprobado por: QA José Ángel Espinoza (DT-48)

## Anexo — HU → casos

| HU | Entrega | Criterios en la HU | Casos TC-<HU> | De ellos, complementos |
| --- | --- | --- | --- | --- |
| HU-CAP-001 | H1 | 5 | TC-CAP-001-01 a 05 | 0 |
| HU-CAP-002 | H1 | 6 | TC-CAP-002-01 a 06 | 0 |
| HU-CAP-003 | H1 | 3 | TC-CAP-003-01 a 03 | 0 |
| HU-CAP-004 | H1 | 3 | TC-CAP-004-01 a 03 | 0 |
| HU-CAP-005 | H1 | 3 | TC-CAP-005-01 a 03 | 0 |
| HU-CAP-006 | H1 | 3 | TC-CAP-006-01 a 03 | 0 |
| HU-CAP-007 | H1 | 2 | TC-CAP-007-01 a 02 | 0 |
| HU-CAP-008 | H1 | 1 | TC-CAP-008-01 a 01 | 0 |
| HU-CAP-009 | H1 | 4 | TC-CAP-009-01 a 04 | 0 |
| HU-CAP-010 | H1 | 4 | TC-CAP-010-01 a 04 | 0 |
| HU-CAP-011 | H1 | 4 | TC-CAP-011-01 a 04 | 0 |
| HU-CAP-012 | H1 | 5 | TC-CAP-012-01 a 05 | 0 |
| HU-CAP-013 | H1 | 3 | TC-CAP-013-01 a 03 | 0 |
| HU-CAP-014 | H1 | 4 | TC-CAP-014-01 a 04 | 0 |
| HU-CAP-015 | H1 | 4 | TC-CAP-015-01 a 04 | 0 |
| HU-CAP-016 | H1 | 7 | TC-CAP-016-01 a 07 | 0 |
| HU-CAP-017 | H1 | 4 | TC-CAP-017-01 a 04 | 0 |
| HU-CAP-018 | H1 | 3 | TC-CAP-018-01 a 03 | 0 |
| HU-CAP-019 | H1 | 4 | TC-CAP-019-01 a 04 | 0 |
| HU-CAP-020 | H1 | 2 | TC-CAP-020-01 a 02 | 0 |
| HU-CAP-021 | H1 | 3 | TC-CAP-021-01 a 03 | 0 |
| HU-CAP-022 | H2 | 3 | TC-CAP-022-01 a 03 | 0 |
| HU-CAP-023 | H2 | 3 | TC-CAP-023-01 a 03 | 0 |
| HU-CAP-024 | H2 | 3 | TC-CAP-024-01 a 03 | 0 |
| HU-CAP-025 | H2 | 5 | TC-CAP-025-01 a 05 | 0 |
| HU-CAP-026 | H2 | 7 | TC-CAP-026-01 a 07 | 0 |
| HU-CAP-027 | H2 | 2 | TC-CAP-027-01 a 02 | 0 |
| HU-CAP-028 | H2 | 1 | TC-CAP-028-01 a 01 | 0 |
| HU-CAP-195 | H2 | 4 | TC-CAP-195-01 a 04 | 0 |
| HU-CAP-029 | H1 | 4 | TC-CAP-029-01 a 04 | 0 |
| HU-CAP-030 | H1 | 7 | TC-CAP-030-01 a 07 | 0 |
| HU-CAP-031 | H1 | 5 | TC-CAP-031-01 a 05 | 0 |
| HU-CAP-032 | H1 | 3 | TC-CAP-032-01 a 03 | 0 |
| HU-CAP-033 | H1 | 5 | TC-CAP-033-01 a 05 | 0 |
| HU-CAP-034 | H1 | 2 | TC-CAP-034-01 a 02 | 0 |
| HU-CAP-035 | H1 | 2 | TC-CAP-035-01 a 02 | 0 |
| HU-CAP-036 | H1 | 3 | TC-CAP-036-01 a 03 | 0 |
| HU-CAP-037 | H1 | 5 | TC-CAP-037-01 a 05 | 0 |
| HU-CAP-038 | H1 | 6 | TC-CAP-038-01 a 06 | 0 |
| HU-CAP-039 | H1 | 3 | TC-CAP-039-01 a 03 | 0 |
| HU-CAP-040 | H1 | 2 | TC-CAP-040-01 a 02 | 0 |
| HU-CAP-041 | H1 | 2 | TC-CAP-041-01 a 02 | 0 |
| HU-CAP-042 | H1 | 5 | TC-CAP-042-01 a 05 | 0 |
| HU-CAP-043 | H1 | 2 | TC-CAP-043-01 a 02 | 0 |
| HU-CAP-044 | H1 | 6 | TC-CAP-044-01 a 06 | 0 |
| HU-CAP-045 | H1 | 3 | TC-CAP-045-01 a 03 | 0 |
| HU-CAP-046 | H1 | 5 | TC-CAP-046-01 a 05 | 0 |
| HU-CAP-199 | H1 | 2 | TC-CAP-199-01 a 02 | 0 |
| HU-CAP-047 | H1 | 7 | TC-CAP-047-01 a 07 | 0 |
| HU-CAP-048 | H1 | 5 | TC-CAP-048-01 a 05 | 0 |
| HU-CAP-049 | H1 | 2 | TC-CAP-049-01 a 02 | 0 |
| HU-CAP-050 | H1 | 4 | TC-CAP-050-01 a 04 | 0 |
| HU-CAP-198 | H1 | 3 | TC-CAP-198-01 a 03 | 0 |
| HU-CAP-051 | H1 | 3 | TC-CAP-051-01 a 03 | 0 |
| HU-CAP-052 | H1 | 3 | TC-CAP-052-01 a 03 | 0 |
| HU-CAP-053 | H1 | 1 | TC-CAP-053-01 a 01 | 0 |
| HU-CAP-054 | H1 | 3 | TC-CAP-054-01 a 03 | 0 |
| HU-CAP-055 | H1 | 5 | TC-CAP-055-01 a 05 | 0 |
| HU-CAP-056 | H1 | 1 | TC-CAP-056-01 a 01 | 0 |
| HU-CAP-057 | H1 | 7 | TC-CAP-057-01 a 07 | 0 |
| HU-CAP-058 | H1 | 4 | TC-CAP-058-01 a 04 | 0 |
| HU-CAP-059 | H1 | 5 | TC-CAP-059-01 a 05 | 0 |
| HU-CAP-060 | H1 | 2 | TC-CAP-060-01 a 02 | 0 |
| HU-CAP-061 | H1 | 4 | TC-CAP-061-01 a 04 | 0 |
| HU-CAP-062 | H1 | 4 | TC-CAP-062-01 a 04 | 0 |
| HU-CAP-063 | H1 | 2 | TC-CAP-063-01 a 02 | 0 |
| HU-CAP-064 | H1 | 3 | TC-CAP-064-01 a 03 | 0 |
| HU-CAP-065 | H1 | 3 | TC-CAP-065-01 a 03 | 0 |
| HU-CAP-066 | H1 | 3 | TC-CAP-066-01 a 03 | 0 |
| HU-CAP-067 | H1 | 3 | TC-CAP-067-01 a 03 | 0 |
| HU-CAP-068 | H1 | 2 | TC-CAP-068-01 a 02 | 0 |
| HU-CAP-069 | H1 | 7 | TC-CAP-069-01 a 07 | 0 |
| HU-CAP-070 | H1 | 3 | TC-CAP-070-01 a 03 | 0 |
| HU-CAP-071 | H1 | 5 | TC-CAP-071-01 a 05 | 0 |
| HU-CAP-072 | H1 | 4 | TC-CAP-072-01 a 04 | 0 |
| HU-CAP-073 | H1 | 4 | TC-CAP-073-01 a 04 | 0 |
| HU-CAP-196 | H1 | 8 | TC-CAP-196-01 a 08 | 0 |
| HU-CAP-197 | H1 | 5 | TC-CAP-197-01 a 05 | 0 |
| HU-CAP-074 | H1 | 3 | TC-CAP-074-01 a 03 | 0 |
| HU-CAP-075 | H1 | 2 | TC-CAP-075-01 a 02 | 0 |
| HU-CAP-076 | H1 | 3 | TC-CAP-076-01 a 03 | 0 |
| HU-CAP-077 | H1 | 3 | TC-CAP-077-01 a 03 | 0 |
| HU-CAP-078 | H2 | 5 | TC-CAP-078-01 a 05 | 0 |
| HU-CAP-079 | H2 | 3 | TC-CAP-079-01 a 03 | 0 |
| HU-CAP-080 | H2 | 2 | TC-CAP-080-01 a 02 | 0 |
| HU-CAP-081 | H2 | 5 | TC-CAP-081-01 a 05 | 0 |
| HU-CAP-082 | H2 | 2 | TC-CAP-082-01 a 02 | 0 |
| HU-CAP-083 | H2 | 4 | TC-CAP-083-01 a 04 | 0 |
| HU-CAP-084 | H2 | 2 | TC-CAP-084-01 a 02 | 0 |
| HU-CAP-085 | H2 | 3 | TC-CAP-085-01 a 03 | 0 |
| HU-CAP-086 | H2 | 3 | TC-CAP-086-01 a 03 | 0 |
| HU-CAP-087 | H2 | 2 | TC-CAP-087-01 a 02 | 0 |
| HU-CAP-088 | H2 | 6 | TC-CAP-088-01 a 06 | 0 |
| HU-CAP-089 | H2 | 3 | TC-CAP-089-01 a 03 | 0 |
| HU-CAP-090 | H2 | 4 | TC-CAP-090-01 a 04 | 0 |
| HU-CAP-091 | H2 | 5 | TC-CAP-091-01 a 05 | 0 |
| HU-CAP-092 | H2 | 2 | TC-CAP-092-01 a 02 | 0 |
| HU-CAP-093 | H2 | 2 | TC-CAP-093-01 a 02 | 0 |
| HU-CAP-094 | H2 | 3 | TC-CAP-094-01 a 03 | 0 |
| HU-CAP-095 | H2 | 3 | TC-CAP-095-01 a 03 | 0 |
| HU-CAP-096 | H2 | 5 | TC-CAP-096-01 a 05 | 0 |
| HU-CAP-200 | H2 | 2 | TC-CAP-200-01 a 02 | 0 |
| HU-CAP-097 | H2 | 3 | TC-CAP-097-01 a 03 | 0 |
| HU-CAP-098 | H2 | 2 | TC-CAP-098-01 a 02 | 0 |
| HU-CAP-099 | H2 | 3 | TC-CAP-099-01 a 03 | 0 |
| HU-CAP-100 | H2 | 2 | TC-CAP-100-01 a 02 | 0 |
| HU-CAP-101 | H2 | 2 | TC-CAP-101-01 a 02 | 0 |
| HU-CAP-102 | H2 | 4 | TC-CAP-102-01 a 04 | 0 |
| HU-CAP-103 | H2 | 1 | TC-CAP-103-01 a 01 | 0 |
| HU-CAP-104 | H2 | 3 | TC-CAP-104-01 a 03 | 0 |
| HU-CAP-105 | H2 | 3 | TC-CAP-105-01 a 03 | 0 |
| HU-CAP-106 | H2 | 2 | TC-CAP-106-01 a 02 | 0 |
| HU-CAP-107 | H2 | 4 | TC-CAP-107-01 a 04 | 0 |
| HU-CAP-108 | H2 | 4 | TC-CAP-108-01 a 04 | 0 |
| HU-CAP-109 | H2 | 3 | TC-CAP-109-01 a 03 | 0 |
| HU-CAP-110 | H2 | 2 | TC-CAP-110-01 a 02 | 0 |
| HU-CAP-111 | H2 | 4 | TC-CAP-111-01 a 04 | 0 |
| HU-CAP-112 | H2 | 2 | TC-CAP-112-01 a 02 | 0 |
| HU-CAP-113 | H2 | 3 | TC-CAP-113-01 a 03 | 0 |
| HU-CAP-114 | H2 | 4 | TC-CAP-114-01 a 04 | 0 |
| HU-CAP-115 | H2 | 4 | TC-CAP-115-01 a 04 | 0 |
| HU-CAP-116 | H1 | 7 | TC-CAP-116-01 a 07 | 0 |
| HU-CAP-117 | H1 | 6 | TC-CAP-117-01 a 06 | 0 |
| HU-CAP-118 | H1 | 6 | TC-CAP-118-01 a 06 | 0 |
| HU-CAP-201 | H1 | 5 | TC-CAP-201-01 a 05 | 0 |
| HU-CAP-119 | H1 | 4 | TC-CAP-119-01 a 04 | 0 |
| HU-CAP-120 | H1 | 2 | TC-CAP-120-01 a 02 | 0 |
| HU-CAP-121 | H1 | 5 | TC-CAP-121-01 a 05 | 0 |
| HU-CAP-122 | H1 | 3 | TC-CAP-122-01 a 03 | 0 |
| HU-CAP-123 | H2 | 5 | TC-CAP-123-01 a 05 | 0 |
| HU-CAP-124 | H2 | 5 | TC-CAP-124-01 a 05 | 0 |
| HU-CAP-125 | H2 | 4 | TC-CAP-125-01 a 04 | 0 |
| HU-CAP-176 | H1 | 10 | TC-CAP-176-01 a 10 | 0 |
| HU-CAP-177 | H1 | 5 | TC-CAP-177-01 a 05 | 0 |
| HU-CAP-126 | H2 | 2 | TC-CAP-126-01 a 02 | 0 |
| HU-CAP-127 | H2 | 2 | TC-CAP-127-01 a 02 | 0 |
| HU-CAP-128 | H2 | 3 | TC-CAP-128-01 a 03 | 0 |
| HU-CAP-129 | H2 | 1 | TC-CAP-129-01 a 01 | 0 |
| HU-CAP-130 | H2 | 2 | TC-CAP-130-01 a 02 | 0 |
| HU-CAP-131 | H2 | 4 | TC-CAP-131-01 a 04 | 0 |
| HU-CAP-132 | H2 | 3 | TC-CAP-132-01 a 03 | 0 |
| HU-CAP-133 | H2 | 4 | TC-CAP-133-01 a 04 | 0 |
| HU-CAP-134 | H2 | 1 | TC-CAP-134-01 a 01 | 0 |
| HU-CAP-135 | H2 | 2 | TC-CAP-135-01 a 02 | 0 |
| HU-CAP-136 | H2 | 1 | TC-CAP-136-01 a 01 | 0 |
| HU-CAP-137 | H2 | 4 | TC-CAP-137-01 a 04 | 0 |
| HU-CAP-138 | H2 | 4 | TC-CAP-138-01 a 04 | 0 |
| HU-CAP-139 | H2 | 1 | TC-CAP-139-01 a 01 | 0 |
| HU-CAP-140 | H2 | 4 | TC-CAP-140-01 a 04 | 0 |
| HU-CAP-141 | H2 | 1 | TC-CAP-141-01 a 01 | 0 |
| HU-CAP-142 | H2 | 3 | TC-CAP-142-01 a 03 | 0 |
| HU-CAP-143 | H2 | 2 | TC-CAP-143-01 a 02 | 0 |
| HU-CAP-144 | H2 | 6 | TC-CAP-144-01 a 06 | 0 |
| HU-CAP-145 | H2 | 2 | TC-CAP-145-01 a 02 | 0 |
| HU-CAP-146 | H2 | 2 | TC-CAP-146-01 a 02 | 0 |
| HU-CAP-147 | H2 | 1 | TC-CAP-147-01 a 01 | 0 |
| HU-CAP-148 | H1 | 3 | TC-CAP-148-01 a 03 | 0 |
| HU-CAP-149 | H1 | 2 | TC-CAP-149-01 a 02 | 0 |
| HU-CAP-150 | H1 | 4 | TC-CAP-150-01 a 04 | 0 |
| HU-CAP-151 | H2 | 4 | TC-CAP-151-01 a 04 | 0 |
| HU-CAP-152 | H2 | 4 | TC-CAP-152-01 a 04 | 0 |
| HU-CAP-153 | H2 | 1 | TC-CAP-153-01 a 01 | 0 |
| HU-CAP-154 | H2 | 4 | TC-CAP-154-01 a 04 | 0 |
| HU-CAP-155 | H1 | 5 | TC-CAP-155-01 a 05 | 0 |
| HU-CAP-156 | H1 | 3 | TC-CAP-156-01 a 03 | 0 |
| HU-CAP-157 | H1 | 4 | TC-CAP-157-01 a 04 | 0 |
| HU-CAP-158 | H1 | 6 | TC-CAP-158-01 a 06 | 0 |
| HU-CAP-159 | H1 | 3 | TC-CAP-159-01 a 03 | 0 |
| HU-CAP-160 | H1 | 5 | TC-CAP-160-01 a 05 | 0 |
| HU-CAP-161 | H3 | 4 | TC-CAP-161-01 a 04 | 0 |
| HU-CAP-162 | H3 | 4 | TC-CAP-162-01 a 04 | 0 |
| HU-CAP-163 | H3 | 3 | TC-CAP-163-01 a 03 | 0 |
| HU-CAP-164 | H3 | 4 | TC-CAP-164-01 a 04 | 0 |
| HU-CAP-165 | H3 | 4 | TC-CAP-165-01 a 04 | 0 |
| HU-CAP-166 | H1 | 4 | TC-CAP-166-01 a 04 | 0 |
| HU-CAP-167 | H1 | 3 | TC-CAP-167-01 a 03 | 0 |
| HU-CAP-168 | H2 | 5 | TC-CAP-168-01 a 05 | 0 |
| HU-CAP-169 | H2 | 2 | TC-CAP-169-01 a 02 | 0 |
| HU-CAP-170 | H1 | 3 | TC-CAP-170-01 a 03 | 0 |
| HU-CAP-171 | H1 | 1 | TC-CAP-171-01 a 01 | 0 |
| HU-CAP-172 | H1 | 1 | TC-CAP-172-01 a 01 | 0 |
| HU-CAP-173 | H1 | 2 | TC-CAP-173-01 a 02 | 0 |
| HU-CAP-174 | H1 | 2 | TC-CAP-174-01 a 02 | 0 |
| HU-CAP-175 | H1 | 2 | TC-CAP-175-01 a 02 | 0 |
| HU-CAP-178 | H1 | 3 | TC-CAP-178-01 a 03 | 0 |
| HU-CAP-179 | H1 | 3 | TC-CAP-179-01 a 03 | 0 |
| HU-CAP-180 | H1 | 4 | TC-CAP-180-01 a 04 | 0 |
| HU-CAP-181 | H1 | 3 | TC-CAP-181-01 a 03 | 0 |
| HU-CAP-182 | H1 | 3 | TC-CAP-182-01 a 03 | 0 |
| HU-CAP-183 | H1 | 3 | TC-CAP-183-01 a 03 | 0 |
| HU-CAP-184 | H1 | 4 | TC-CAP-184-01 a 04 | 0 |
| HU-CAP-185 | H1 | 3 | TC-CAP-185-01 a 03 | 0 |
| HU-CAP-186 | H1 | 3 | TC-CAP-186-01 a 03 | 0 |
| HU-CAP-187 | H1 | 3 | TC-CAP-187-01 a 03 | 0 |
| HU-CAP-188 | H1 | 3 | TC-CAP-188-01 a 03 | 0 |
| HU-CAP-189 | H1 | 3 | TC-CAP-189-01 a 03 | 0 |
| HU-CAP-190 | H2 | 4 | TC-CAP-190-01 a 04 | 0 |
| HU-CAP-191 | H2 | 3 | TC-CAP-191-01 a 03 | 0 |
| HU-CAP-192 | H2 | 1 | TC-CAP-192-01 a 01 | 0 |
| HU-CAP-193 | H2 | 3 | TC-CAP-193-01 a 03 | 0 |
| HU-CAP-194 | H2 | 2 | TC-CAP-194-01 a 02 | 0 |

**Totales:** 689 criterios en 201 historias = 689 casos TC (0 complementos) + 10 E2E + 12 SEC + 7 PERF + 5 REG = **723 casos**.
