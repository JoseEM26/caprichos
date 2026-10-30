import {
  BOTON_HABLAR_PERSONA,
  BOTON_LISTA_CATEGORIAS,
  BOTON_LISTA_MENU,
  BOTON_LISTA_PREGUNTAS,
  BOTON_LISTA_PRODUCTOS,
  BOTON_OTRAS_PREGUNTAS,
  BOTON_VER_CARTA,
  BOTON_VOLVER_CATEGORIAS,
  BOTON_VOLVER_MENU,
  BOTONES_MENU_PRINCIPAL,
  BOTONES_MI_PEDIDO,
  BOTONES_PEDIDO_ACCION_CARRITO,
  BOTONES_PEDIDO_CANCELAR_CONFIRMAR,
  BOTONES_PEDIDO_CANTIDADES,
  BOTONES_PEDIDO_COMPROBANTE,
  BOTONES_PEDIDO_CONFIRMAR_FINAL,
  BOTONES_PEDIDO_MODALIDAD,
  BOTONES_PEDIDO_NOMBRE_CONFIRMAR,
  BOTONES_PEDIDO_NOTAS,
  BOTONES_PEDIDO_OFERTA_CALIFICA,
  BOTONES_PEDIDO_OFERTA_FALTA,
  BOTONES_PEDIDO_PREGUNTA_CUPON,
  BOTONES_PEDIDO_UBICACION,
  BOTONES_PEDIDO_UBICACION_FALLIDA,
  BOTONES_PEDIDO_VER_CARRITO,
  FILAS_MENU_PRINCIPAL,
  FILAS_PREGUNTAS_FRECUENTES,
  TEXTOS_BOT,
  TITULO_SECCION_CATEGORIAS,
  TITULO_SECCION_MENU,
  TITULO_SECCION_PREGUNTAS,
} from '../textos-bot';

describe('Límites estrictos de WhatsApp en catálogo de textos y botones (FT-BOT-01)', () => {
  const LIMITE_BOTON = 20;
  const LIMITE_TITULO_FILA = 24;
  const LIMITE_DESC_FILA = 72;
  const LIMITE_CUERPO = 1024;
  const MAX_BOTONES = 3;
  const MAX_FILAS_LISTA = 10;

  describe('Validación de botones fijos', () => {
    const todosLosBotones = [
      BOTON_VOLVER_MENU,
      BOTON_HABLAR_PERSONA,
      BOTON_VER_CARTA,
      BOTON_OTRAS_PREGUNTAS,
      BOTON_VOLVER_CATEGORIAS,
      ...BOTONES_MENU_PRINCIPAL,
      ...BOTONES_MI_PEDIDO,
      ...BOTONES_PEDIDO_MODALIDAD,
      ...BOTONES_PEDIDO_UBICACION,
      ...BOTONES_PEDIDO_UBICACION_FALLIDA,
      ...BOTONES_PEDIDO_ACCION_CARRITO,
      ...BOTONES_PEDIDO_VER_CARRITO,
      ...BOTONES_PEDIDO_OFERTA_CALIFICA,
      ...BOTONES_PEDIDO_OFERTA_FALTA,
      ...BOTONES_PEDIDO_PREGUNTA_CUPON,
      ...BOTONES_PEDIDO_NOMBRE_CONFIRMAR,
      ...BOTONES_PEDIDO_COMPROBANTE,
      ...BOTONES_PEDIDO_CONFIRMAR_FINAL,
      ...BOTONES_PEDIDO_CANCELAR_CONFIRMAR,
      ...BOTONES_PEDIDO_NOTAS,
      ...BOTONES_PEDIDO_CANTIDADES,
    ];

    it('ningún botón supera 20 caracteres de título', () => {
      for (const btn of todosLosBotones) {
        expect(btn.titulo.length).toBeLessThanOrEqual(LIMITE_BOTON);
      }
    });

    it('todos los botones tienen id no vacío', () => {
      for (const btn of todosLosBotones) {
        expect(btn.id.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('Validación de listas fijas y títulos de sección', () => {
    it('textos de botones que abren listas no superan 20 caracteres', () => {
      const botonesLista = [
        BOTON_LISTA_MENU,
        BOTON_LISTA_CATEGORIAS,
        BOTON_LISTA_PRODUCTOS,
        BOTON_LISTA_PREGUNTAS,
      ];
      for (const b of botonesLista) {
        expect(b.length).toBeLessThanOrEqual(LIMITE_BOTON);
      }
    });

    it('títulos de sección no superan 24 caracteres', () => {
      const titulos = [
        TITULO_SECCION_MENU,
        TITULO_SECCION_CATEGORIAS,
        TITULO_SECCION_PREGUNTAS,
      ];
      for (const t of titulos) {
        expect(t.length).toBeLessThanOrEqual(LIMITE_TITULO_FILA);
      }
    });

    it('filas del menú principal respetan límites de WhatsApp', () => {
      expect(FILAS_MENU_PRINCIPAL.length).toBeLessThanOrEqual(MAX_FILAS_LISTA);
      for (const f of FILAS_MENU_PRINCIPAL) {
        expect(f.titulo.length).toBeLessThanOrEqual(LIMITE_TITULO_FILA);
        if (f.descripcion) {
          expect(f.descripcion.length).toBeLessThanOrEqual(LIMITE_DESC_FILA);
        }
      }
    });

    it('filas de preguntas frecuentes respetan límites de WhatsApp', () => {
      expect(FILAS_PREGUNTAS_FRECUENTES.length).toBeLessThanOrEqual(MAX_FILAS_LISTA);
      for (const f of FILAS_PREGUNTAS_FRECUENTES) {
        expect(f.titulo.length).toBeLessThanOrEqual(LIMITE_TITULO_FILA);
        if (f.descripcion) {
          expect(f.descripcion.length).toBeLessThanOrEqual(LIMITE_DESC_FILA);
        }
      }
    });
  });

  describe('Validación de longitudes de grupos de botones por mensaje', () => {
    const gruposBotones = [
      BOTONES_MENU_PRINCIPAL,
      BOTONES_MI_PEDIDO,
      BOTONES_PEDIDO_MODALIDAD,
      BOTONES_PEDIDO_UBICACION,
      BOTONES_PEDIDO_UBICACION_FALLIDA,
      BOTONES_PEDIDO_ACCION_CARRITO,
      BOTONES_PEDIDO_VER_CARRITO,
      BOTONES_PEDIDO_OFERTA_CALIFICA,
      BOTONES_PEDIDO_OFERTA_FALTA,
      BOTONES_PEDIDO_PREGUNTA_CUPON,
      BOTONES_PEDIDO_NOMBRE_CONFIRMAR,
      BOTONES_PEDIDO_COMPROBANTE,
      BOTONES_PEDIDO_CONFIRMAR_FINAL,
      BOTONES_PEDIDO_CANCELAR_CONFIRMAR,
      BOTONES_PEDIDO_NOTAS,
      BOTONES_PEDIDO_CANTIDADES,
    ];

    it('ningún grupo de botones supera el máximo de 3 botones permitido por WhatsApp', () => {
      for (const grupo of gruposBotones) {
        expect(grupo.length).toBeLessThanOrEqual(MAX_BOTONES);
      }
    });
  });

  describe('Validación de cuerpos de texto generados por TEXTOS_BOT (<= 1024 caracteres)', () => {
    it('saludo bienvenida y menús', () => {
      expect(TEXTOS_BOT.saludoBienvenida('Carlos', null).length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.saludoBienvenida(null, null).length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.cuerpoCategorias(true).length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.preguntasCuerpo().length).toBeLessThanOrEqual(LIMITE_CUERPO);
    });

    it('textos del flujo de pedido', () => {
      expect(TEXTOS_BOT.pedidoModalidad().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoPedirUbicacion().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoUbicacionClipAyuda().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoFueraDeCobertura().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoUbicacionExitosa(5.0, false, 70).length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoUbicacionExitosa(0, true).length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoEscribirDireccionPrompt().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoPedirReferencia().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoRecojoConfirmado().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoCategoriasPrompt().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoCategoriaSeleccionada('Hamburguesas').length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoProductoAgotado('Hamburguesa Clásica', ['Hamburguesa Royal', 'Hamburguesa BBQ']).length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoCategoriaVacia().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoPreguntarTamano('Hamburguesa').length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoPreguntarGrupo('Salsas', true).length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoPreguntarGrupo('Toppings', false).length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoOpcionObligatoriaFaltante('Salsas').length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoPreguntarSabor().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoPreguntarNotas('Hamburguesa Clásica').length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoPreguntarCantidad('Hamburguesa Clásica').length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoProductoAgregado('1x Hamburguesa Clásica', 25.0).length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoVerCarrito('1x Hamburguesa S/ 25.00', 25.0).length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoProductoEliminado('Hamburguesa Clásica').length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoCarritoVacio().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoOfertaCalifica('2x1 Hamburguesas', 15.0).length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoOfertaFaltaPoco(1, ['1x Hamburguesa'], 'Combo Dúo', 35.0).length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoPreguntaCupon().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoIngresarCuponPrompt().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoCuponAplicado('DESCUENTO10', 5.0).length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoCuponInvalido().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoMinimoNoAlcanzado(20, 5).length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoConfirmarNombre('Carlos').length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoIngresarNombre().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoIngresarTelefono().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoTelefonoInvalido().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoMedioPago().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoMontoEfectivo().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoPagaConMenorQueTotal(45.0).length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoComprobanteTipo().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoComprobanteDni().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoComprobanteRuc().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoComprobanteRazon().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoConfirmarCancelar().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoCancelado().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoExpiradoInactividad().length).toBeLessThanOrEqual(LIMITE_CUERPO);
      expect(TEXTOS_BOT.pedidoLimiteDiarioAlcanzado().length).toBeLessThanOrEqual(LIMITE_CUERPO);
    });

    it('resumen final y confirmación exitosa con tiempo estimado y datos de pago', () => {
      const resumenTexto = TEXTOS_BOT.pedidoResumenFinal({
        modalidad: 'DELIVERY',
        direccionTexto: 'Av. Las Flores 123 (Ref: Portón azul)',
        lineasTexto: '• 2x Hamburguesa Clásica S/ 50.00\n  - Papas nativas (S/ 0.00)\n• 1x Chicha Morada 500ml S/ 8.00',
        descuentoTexto: 'Cupón DESCUENTO10 (-S/ 5.00)',
        envioTexto: 'S/ 6.00',
        total: 59.0,
        pagoTexto: 'Yape / Plin',
        tiempoMin: 35,
        tiempoMax: 45,
      });
      expect(resumenTexto.length).toBeLessThanOrEqual(LIMITE_CUERPO);

      const exitoTexto = TEXTOS_BOT.pedidoConfirmadoExito({
        codigo: 'CP-0110',
        tiempoMin: 35,
        tiempoMax: 45,
        esPagoDigital: true,
        datosPago: 'Yape: 999 888 777 a nombre de Caprichos SAC\nBCP: 191-1234567-0-12',
      });
      expect(exitoTexto.length).toBeLessThanOrEqual(LIMITE_CUERPO);
    });
  });
});
