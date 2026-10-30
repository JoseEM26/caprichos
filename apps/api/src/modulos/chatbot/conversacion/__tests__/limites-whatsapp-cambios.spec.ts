import {
  BOTONES_CAMBIO_CONFIRMAR_DIR,
  BOTONES_CAMBIO_CONFIRMAR_PED,
  BOTONES_CAMBIO_NO_PERMITIDO,
  BOTONES_CAMBIO_UBICACION_FALLIDA,
  TEXTOS_CAMBIOS,
} from '../flujos/cambios/textos-cambios';

describe('Límites estrictos de WhatsApp Meta Cloud API para catálogo de cambios y derivación (Ola 3, Agente E)', () => {
  const LIMITE_BOTON_TITULO = 20;
  const LIMITE_CUERPO_TEXTO = 1024;
  const LIMITE_MAX_BOTONES = 3;

  const gruposDeBotones = [
    { nombre: 'BOTONES_CAMBIO_CONFIRMAR_DIR', botones: BOTONES_CAMBIO_CONFIRMAR_DIR },
    { nombre: 'BOTONES_CAMBIO_CONFIRMAR_PED', botones: BOTONES_CAMBIO_CONFIRMAR_PED },
    { nombre: 'BOTONES_CAMBIO_NO_PERMITIDO', botones: BOTONES_CAMBIO_NO_PERMITIDO },
    { nombre: 'BOTONES_CAMBIO_UBICACION_FALLIDA', botones: BOTONES_CAMBIO_UBICACION_FALLIDA },
  ];

  it('todos los botones individuales deben tener títulos <= 20 caracteres y un id no vacío', () => {
    gruposDeBotones.forEach(({ nombre, botones }) => {
      expect(botones.length).toBeLessThanOrEqual(LIMITE_MAX_BOTONES);
      botones.forEach((b) => {
        expect(b.id.length).toBeGreaterThan(0);
        expect(b.titulo.length).toBeLessThanOrEqual(LIMITE_BOTON_TITULO);
      });
    });
  });

  it('recorre y valida el 100% de los textos en TEXTOS_CAMBIOS contra el límite de 1024 caracteres', () => {
    const casos = [
      TEXTOS_CAMBIOS.pedirNuevaUbicacion('PED-101'),
      TEXTOS_CAMBIOS.pedirReferencia(),
      TEXTOS_CAMBIOS.ubicacionFueraDeCobertura(),
      TEXTOS_CAMBIOS.resumenCambioDireccion({
        codigo: 'PED-101',
        direccion: 'Av. Larco 1234, Dpto 502, Miraflores, Lima, Perú',
        referencia: 'Frente al parque Kennedy, edificio blanco con rejas negras',
        zonaNombre: 'Miraflores Centro',
        tarifaActual: 5.0,
        tarifaNueva: 8.5,
        recargo: 3.5,
      }),
      TEXTOS_CAMBIOS.resumenCambioDireccion({
        codigo: 'PED-102',
        direccion: 'Calle Los Pinos 456',
        recargo: -2.0,
      }),
      TEXTOS_CAMBIOS.resumenCambioDireccion({
        codigo: 'PED-103',
        direccion: 'Calle Los Pinos 456',
        recargo: 0,
      }),
      TEXTOS_CAMBIOS.solicitudDireccionEnviada('PED-101', true),
      TEXTOS_CAMBIOS.solicitudDireccionEnviada('PED-101', false),
      TEXTOS_CAMBIOS.pedirDetalleCambioPedido('PED-101'),
      TEXTOS_CAMBIOS.resumenCambioPedido('PED-101', 'Deseo quitar la torta de chocolate y cambiar por pie de limón'),
      TEXTOS_CAMBIOS.solicitudPedidoEnviada('PED-101'),
      TEXTOS_CAMBIOS.solicitudCancelacionEnviada('PED-101'),
      TEXTOS_CAMBIOS.cambioNoPermitidoEstado('PED-101', 'EN_CAMINO', true),
      TEXTOS_CAMBIOS.cambioNoPermitidoEstado('PED-101', 'LISTO', false),
      TEXTOS_CAMBIOS.cambioNoPermitidoEstado('PED-101', 'ENTREGADO', false),
      TEXTOS_CAMBIOS.cambioNoPermitidoEstado('PED-101', 'CANCELADO', false),
      TEXTOS_CAMBIOS.cambioNoEsDelivery('PED-101'),
      TEXTOS_CAMBIOS.limiteCambiosPorPedido('PED-101'),
      TEXTOS_CAMBIOS.limiteSolicitudesAbiertasTelefono(),
      TEXTOS_CAMBIOS.fueraDeHorario('08:00', '22:00', '08:00'),
      TEXTOS_CAMBIOS.quejaUrgenteRecibida(),
      TEXTOS_CAMBIOS.botRetomaAtencion(),
      TEXTOS_CAMBIOS.cambioDireccionAplicadoCliente('PED-101', 'Av. Benavides 789'),
      TEXTOS_CAMBIOS.cambioPedidoAplicadoCliente('PED-101'),
      TEXTOS_CAMBIOS.cancelacionAplicadaCliente('PED-101'),
      TEXTOS_CAMBIOS.cambioRechazadoCliente('PED-101', 'El pedido ya fue preparado en cocina y no es posible alterarlo'),
    ];

    casos.forEach((txt) => {
      expect(typeof txt).toBe('string');
      expect(txt.length).toBeGreaterThan(0);
      expect(txt.length).toBeLessThanOrEqual(LIMITE_CUERPO_TEXTO);
    });
  });

  it('verifica que los textos de WhatsApp conserven los emojis amigables del mockup', () => {
    expect(TEXTOS_CAMBIOS.pedirNuevaUbicacion('PED-1')).toContain('📍');
    expect(TEXTOS_CAMBIOS.pedirReferencia()).toContain('🏠');
    expect(TEXTOS_CAMBIOS.pedirDetalleCambioPedido('PED-1')).toContain('📝');
    expect(TEXTOS_CAMBIOS.fueraDeHorario('08:00', '22:00', '08:00')).toContain('☕');
    expect(TEXTOS_CAMBIOS.quejaUrgenteRecibida()).toContain('😔');
    expect(TEXTOS_CAMBIOS.botRetomaAtencion()).toContain('🧁');
    expect(TEXTOS_CAMBIOS.cambioDireccionAplicadoCliente('PED-1', 'Calle 1')).toContain('✅');
  });
});
