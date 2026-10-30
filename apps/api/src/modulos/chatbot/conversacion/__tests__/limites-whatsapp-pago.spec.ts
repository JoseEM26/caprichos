import {
  BOTON_PAGO_CAMBIAR_MEDIO,
  BOTON_PAGO_HABLAR_PERSONA,
  BOTON_PAGO_MEDIO_EFECTIVO,
  BOTON_PAGO_MEDIO_TARJETA,
  BOTON_PAGO_MEDIO_YAPE_PLIN,
  BOTON_PAGO_REENVIAR,
  BOTON_PAGO_VOLVER_MENU,
  BOTONES_PAGO_MEDIOS_CAMBIO,
  BOTONES_PAGO_RECHAZADO,
  TEXTOS_PAGO,
} from '../flujos/pago/textos-pago';

describe('Límites estrictos de WhatsApp en catálogo de textos y botones de Pago (FT-BOT-02)', () => {
  const LIMITE_BOTON = 20;
  const LIMITE_CUERPO = 1024;
  const MAX_BOTONES = 3;

  describe('Validación de botones de Pago', () => {
    const todosLosBotones = [
      BOTON_PAGO_REENVIAR,
      BOTON_PAGO_CAMBIAR_MEDIO,
      BOTON_PAGO_HABLAR_PERSONA,
      BOTON_PAGO_VOLVER_MENU,
      BOTON_PAGO_MEDIO_EFECTIVO,
      BOTON_PAGO_MEDIO_YAPE_PLIN,
      BOTON_PAGO_MEDIO_TARJETA,
      ...BOTONES_PAGO_RECHAZADO,
      ...BOTONES_PAGO_MEDIOS_CAMBIO,
    ];

    it.each(todosLosBotones)(
      'el botón "$titulo" (id: $id) no debe superar 20 caracteres',
      (btn) => {
        expect(btn.titulo.length).toBeLessThanOrEqual(LIMITE_BOTON);
      },
    );

    it('los grupos de botones interactivos no deben superar 3 botones', () => {
      expect(BOTONES_PAGO_RECHAZADO.length).toBeLessThanOrEqual(MAX_BOTONES);
      expect(BOTONES_PAGO_MEDIOS_CAMBIO.length).toBeLessThanOrEqual(MAX_BOTONES);
    });
  });

  describe('Validación de cuerpos de texto de Pago', () => {
    const escenariosTexto: [string, () => string][] = [
      [
        'datosPagoMensaje (Yape)',
        () =>
          TEXTOS_PAGO.datosPagoMensaje({
            codigo: 'CP-1234',
            total: 55.5,
            metodo: 'YAPE',
            datosLocalPagos: {
              yape: { activo: true, numero: '987654321', titular: 'Caprichos SAC' },
            },
          }),
      ],
      [
        'datosPagoMensaje (Plin)',
        () =>
          TEXTOS_PAGO.datosPagoMensaje({
            codigo: 'CP-1234',
            total: 72.0,
            metodo: 'PLIN',
            datosLocalPagos: {
              plin: { activo: true, numero: '987654321', titular: 'Caprichos SAC' },
            },
          }),
      ],
      [
        'datosPagoMensaje (Transferencia)',
        () =>
          TEXTOS_PAGO.datosPagoMensaje({
            codigo: 'CP-1234',
            total: 120.0,
            metodo: 'TRANSFERENCIA',
            datosLocalPagos: {
              transferencia: {
                activo: true,
                banco: 'BCP',
                cuenta: '191-12345678-0-99',
                cci: '002-191-0012345678099-55',
                titular: 'Caprichos SAC',
              },
            },
          }),
      ],
      ['voucherRecibido', () => TEXTOS_PAGO.voucherRecibido()],
      ['recordarEnviarImagen', () => TEXTOS_PAGO.recordarEnviarImagen()],
      ['voucherLimiteSuperado', () => TEXTOS_PAGO.voucherLimiteSuperado()],
      [
        'pagoAprobadoCliente con tiempo prometido',
        () => TEXTOS_PAGO.pagoAprobadoCliente('CP-1234', 25),
      ],
      [
        'pagoAprobadoCliente sin tiempo prometido',
        () => TEXTOS_PAGO.pagoAprobadoCliente('CP-1234'),
      ],
      [
        'pagoRechazadoCliente con motivo',
        () => TEXTOS_PAGO.pagoRechazadoCliente('Monto ilegible en la captura'),
      ],
      [
        'pagoRechazadoCliente sin motivo',
        () => TEXTOS_PAGO.pagoRechazadoCliente(),
      ],
      ['pagoRechazadoLimiteSuperado', () => TEXTOS_PAGO.pagoRechazadoLimiteSuperado()],
      [
        'pagoRecordatorioCliente',
        () => TEXTOS_PAGO.pagoRecordatorioCliente('Ana Pérez', 'CP-1234', 45.0, 'Yape'),
      ],
      [
        'confirmarEfectivo delivery con vuelto',
        () => TEXTOS_PAGO.confirmarEfectivo(35.0, 50.0, 'DELIVERY'),
      ],
      [
        'confirmarEfectivo recojo exacto',
        () => TEXTOS_PAGO.confirmarEfectivo(35.0, 35.0, 'RECOGER'),
      ],
      [
        'confirmarTarjeta delivery',
        () => TEXTOS_PAGO.confirmarTarjeta(48.0, 'DELIVERY'),
      ],
      [
        'confirmarTarjeta recojo',
        () => TEXTOS_PAGO.confirmarTarjeta(48.0, 'RECOGER'),
      ],
      ['elegirNuevoMedio', () => TEXTOS_PAGO.elegirNuevoMedio()],
      [
        'seguimiento esperando_pago',
        () =>
          TEXTOS_PAGO.seguimientoEstadoPago({
            codigo: 'CP-1234',
            estado: 'esperando_pago',
            medio: 'Yape',
          }),
      ],
      [
        'seguimiento validando_pago',
        () =>
          TEXTOS_PAGO.seguimientoEstadoPago({
            codigo: 'CP-1234',
            estado: 'validando_pago',
          }),
      ],
      [
        'seguimiento en_preparacion',
        () =>
          TEXTOS_PAGO.seguimientoEstadoPago({
            codigo: 'CP-1234',
            estado: 'en_preparacion',
            tiempoEstimadoMin: 20,
          }),
      ],
      [
        'seguimiento listo',
        () =>
          TEXTOS_PAGO.seguimientoEstadoPago({
            codigo: 'CP-1234',
            estado: 'listo',
          }),
      ],
      [
        'seguimiento en_camino',
        () =>
          TEXTOS_PAGO.seguimientoEstadoPago({
            codigo: 'CP-1234',
            estado: 'en_camino',
            repartidorNombre: 'Carlos',
            tiempoEstimadoMin: 12,
          }),
      ],
      [
        'seguimiento entregado',
        () =>
          TEXTOS_PAGO.seguimientoEstadoPago({
            codigo: 'CP-1234',
            estado: 'entregado',
          }),
      ],
    ];

    it.each(escenariosTexto)(
      'el texto "%s" no debe superar 1024 caracteres',
      (_nombre, generador) => {
        const cuerpo = generador();
        expect(cuerpo.length).toBeLessThanOrEqual(LIMITE_CUERPO);
        expect(cuerpo.length).toBeGreaterThan(0);
      },
    );
  });
});
