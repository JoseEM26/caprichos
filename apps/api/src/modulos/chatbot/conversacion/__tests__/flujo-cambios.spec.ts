import { FlujoCambiosSubFlujo } from '../flujos/cambios/flujo-cambios';
import {
  ContextoConversacion,
  EntradaNormalizada,
  FlujoConversacion,
} from '../tipos-conversacion';
import { transicionarEstado } from '../maquina-estados';

describe('Flujo de Cambios después del Pedido y Derivación a Persona (Ola 3, Agente E)', () => {
  let subflujo: FlujoCambiosSubFlujo;

  beforeEach(() => {
    subflujo = new FlujoCambiosSubFlujo();
  });

  const normalizar = (
    texto: string,
    id?: string,
    ubicacion?: { latitud: number; longitud: number; direccion?: string },
  ): EntradaNormalizada => ({
    tipo: id ? 'boton' : ubicacion ? 'ubicacion' : 'texto',
    texto: texto.toLowerCase().trim(),
    textoOriginal: texto,
    id,
    ubicacion,
  });

  const crearFlujo = (parches: Partial<FlujoConversacion> = {}): FlujoConversacion => ({
    version: 2,
    estado: 'MENU',
    repreguntasFallidas: 0,
    ...parches,
  });

  const crearContexto = (parches: Partial<ContextoConversacion> = {}): ContextoConversacion => ({
    nombreCliente: 'María López',
    telefonoCliente: '51987654321',
    pedidoActivo: {
      id: 'ped-101',
      codigo: 'CP-1001',
      estado: 'PREPARANDO',
      tipo_entrega: 'DELIVERY',
      direccion: 'Av. Las Palmeras 123',
      total: 45.0,
      envio: 5.0,
      zona_id: 'z1',
      zona_nombre: 'Zona 1 - Centro',
      cliente_telefono: '51987654321',
      solicitudes_cambio_count: 0,
    },
    solicitudesCambioPendientesTelefono: 0,
    datosLocal: {
      abierta: true,
      abre: '15:00',
      cierra: '23:00',
      direccion: 'Av. Las Palmeras 100',
      enlaceMapa: 'https://maps.google.com',
    },
    ...parches,
  });

  describe('1. Reglas de estado del pedido para cambio de dirección y pedido', () => {
    it('permite iniciar cambio de dirección cuando el pedido está en COLA o PREPARANDO', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        pedidoActivo: {
          id: 'ped-1',
          codigo: 'CP-1001',
          estado: 'PREPARANDO',
          tipo_entrega: 'DELIVERY',
          cliente_telefono: '51987654321',
        },
      });
      const entrada = normalizar('Cambiar mi dirección', 'c_dir');

      expect(subflujo.puedeManejar(flujo, entrada, ctx)).toBe(true);
      const res = subflujo.transicionar(flujo, entrada, ctx);

      expect(res).not.toBeNull();
      expect(res?.nuevoEstado).toBe('CAMBIO_DIR_UBICACION');
      expect(res?.acciones[0].tipo).toBe('enviarTexto');
      expect((res?.acciones[0] as any).texto).toContain('📍 Para cambiar la dirección de tu pedido CP-1001');
      expect(res?.nuevoFlujo.cambios?.datos.tipo).toBe('DIRECCION');
    });

    it('permite iniciar cambio de pedido cuando el pedido está en COLA', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        pedidoActivo: {
          id: 'ped-2',
          codigo: 'CP-1002',
          estado: 'COLA',
          tipo_entrega: 'DELIVERY',
          cliente_telefono: '51987654321',
        },
      });
      const entrada = normalizar('Cambiar o cancelar mi pedido', 'c_ped');

      expect(subflujo.puedeManejar(flujo, entrada, ctx)).toBe(true);
      const res = subflujo.transicionar(flujo, entrada, ctx);

      expect(res?.nuevoEstado).toBe('CAMBIO_PED_DETALLE');
      expect((res?.acciones[0] as any).texto).toContain('📝 Cuéntanos qué productos deseas modificar');
      expect(res?.nuevoFlujo.cambios?.datos.tipo).toBe('PEDIDO');
    });

    it('rechaza cambio si el pedido ya está en LISTO, explicando con honestidad y ofreciendo asesor', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        pedidoActivo: {
          id: 'ped-3',
          codigo: 'CP-1003',
          estado: 'LISTO',
          tipo_entrega: 'DELIVERY',
          cliente_telefono: '51987654321',
        },
      });
      const entrada = normalizar('Cambiar mi dirección', 'c_dir');

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('ATENCION_PERSONA');
      const botonAccion = res?.acciones.find((a) => a.tipo === 'enviarBotones') as any;
      expect(botonAccion.texto).toContain('ya está listo y empaquetado');
      expect(botonAccion.botones).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'persona' })]),
      );
    });

    it('rechaza cambio si el pedido ya está EN_CAMINO con el repartidor', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        pedidoActivo: {
          id: 'ped-4',
          codigo: 'CP-1004',
          estado: 'EN_CAMINO',
          tipo_entrega: 'DELIVERY',
          cliente_telefono: '51987654321',
        },
      });
      const entrada = normalizar('Cambiar o cancelar mi pedido', 'c_ped');

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('ATENCION_PERSONA');
      const botonAccion = res?.acciones.find((a) => a.tipo === 'enviarBotones') as any;
      expect(botonAccion.texto).toContain('ya salió con el repartidor');
    });

    it('rechaza cambio si el pedido ya fue ENTREGADO', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        pedidoActivo: {
          id: 'ped-5',
          codigo: 'CP-1005',
          estado: 'ENTREGADO',
          tipo_entrega: 'DELIVERY',
          cliente_telefono: '51987654321',
        },
      });
      const entrada = normalizar('Cambiar mi dirección', 'c_dir');

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('ATENCION_PERSONA');
      const botonAccion = res?.acciones.find((a) => a.tipo === 'enviarBotones') as any;
      expect(botonAccion.texto).toContain('figura como entregado');
    });
  });

  describe('2. Seguridad y validación de cliente / tipo de entrega', () => {
    it('rechaza pedido de otro cliente si el teléfono no coincide', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        telefonoCliente: '51987654321',
        pedidoActivo: {
          id: 'ped-ajeno',
          codigo: 'CP-9999',
          estado: 'PREPARANDO',
          tipo_entrega: 'DELIVERY',
          cliente_telefono: '51911111111', // Teléfono ajeno
        },
      });
      const entrada = normalizar('Cambiar mi dirección', 'c_dir');

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('MENU');
      expect((res?.acciones[0] as any).texto).toContain('No encontramos un pedido activo');
    });

    it('rechaza cambio de dirección si el pedido es para RECOJO_LOCAL o SALON', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        pedidoActivo: {
          id: 'ped-recojo',
          codigo: 'CP-2001',
          estado: 'PREPARANDO',
          tipo_entrega: 'RECOJO_LOCAL',
          cliente_telefono: '51987654321',
        },
      });
      const entrada = normalizar('Cambiar mi dirección', 'c_dir');

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('MENU');
      expect((res?.acciones[0] as any).texto).toContain('fue solicitado para recojo o en salón');
    });
  });

  describe('3. Límites estrictos de solicitudes', () => {
    it('rechaza cuando el pedido ya alcanzó el máximo de 2 solicitudes de cambio', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        pedidoActivo: {
          id: 'ped-max',
          codigo: 'CP-3001',
          estado: 'PREPARANDO',
          tipo_entrega: 'DELIVERY',
          cliente_telefono: '51987654321',
          solicitudes_cambio_count: 2, // Ya tiene 2 solicitudes
        },
      });
      const entrada = normalizar('Cambiar mi dirección', 'c_dir');

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('ATENCION_PERSONA');
      const botonAccion = res?.acciones.find((a) => a.tipo === 'enviarBotones') as any;
      expect(botonAccion.texto).toContain('máximo permitido de 2 solicitudes');
      expect(botonAccion.botones).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'persona' })]),
      );
    });

    it('rechaza cuando el cliente ya tiene 3 solicitudes abiertas pendientes por teléfono', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        solicitudesCambioPendientesTelefono: 3, // Límite de 3 abiertas
      });
      const entrada = normalizar('Cambiar o cancelar mi pedido', 'c_ped');

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect((res?.acciones[0] as any).texto).toContain('3 solicitudes de cambio pendientes');
    });
  });

  describe('4. Flujo de Dirección: captura, referencia, zona y recargo', () => {
    it('captura dirección compartida por GPS y recalcula recargo con ZonasService', async () => {
      const flujo = crearFlujo({
        cambios: {
          estadoInterno: 'CAMBIO_DIR_UBICACION',
          datos: {
            pedidoId: 'ped-101',
            pedidoCodigo: 'CP-1001',
            tipo: 'DIRECCION',
            modalidad: 'DELIVERY',
            estadoPedido: 'PREPARANDO',
            tarifaActual: 5.0,
          },
        },
      });
      const ctx = crearContexto({
        resultadoEnvio: {
          cubierto: true,
          tarifa: 8.5,
          zona: { id: 2, nombre: 'Zona 2 - San Juan' },
        },
      });
      const entrada = normalizar('', undefined, { latitud: -12.0196, longitud: -76.9632 });

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('CAMBIO_DIR_REFERENCIA');
      expect(res?.nuevoFlujo.cambios?.datos.lat).toBe(-12.0196);
      expect(res?.nuevoFlujo.cambios?.datos.lng).toBe(-76.9632);
      expect(res?.nuevoFlujo.cambios?.datos.zonaNombre).toBe('Zona 2 - San Juan');
      // Tarifa original era 5.0, nueva es 8.5 -> recargo 3.5
      expect(res?.nuevoFlujo.cambios?.datos.recargo).toBe(3.5);
    });

    it('captura referencia y muestra resumen con recargo antes de confirmar', () => {
      const flujo = crearFlujo({
        cambios: {
          estadoInterno: 'CAMBIO_DIR_REFERENCIA',
          datos: {
            pedidoId: 'ped-101',
            pedidoCodigo: 'CP-1001',
            tipo: 'DIRECCION',
            modalidad: 'DELIVERY',
            estadoPedido: 'PREPARANDO',
            direccionNueva: 'Calle Los Robles 543',
            zonaNombre: 'Zona 2 - San Juan',
            tarifaNueva: 8.5,
            recargo: 3.5,
          },
        },
      });
      const ctx = crearContexto();
      const entrada = normalizar('Portón verde frente al parque');

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('CAMBIO_DIR_CONFIRMAR');
      expect((res?.acciones[0] as any).texto).toContain('Resumen de cambio de dirección');
      expect((res?.acciones[0] as any).texto).toContain('+S/ 3.50');
      expect((res?.acciones[0] as any).botones).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'c_dir_si' })]),
      );
    });

    it('al confirmar ("c_dir_si"), emite accion crearSolicitudCambio hacia Caja', () => {
      const flujo = crearFlujo({
        cambios: {
          estadoInterno: 'CAMBIO_DIR_CONFIRMAR',
          datos: {
            pedidoId: 'ped-101',
            pedidoCodigo: 'CP-1001',
            tipo: 'DIRECCION',
            modalidad: 'DELIVERY',
            estadoPedido: 'PREPARANDO',
            direccionNueva: 'Calle Los Robles 543',
            referenciaNueva: 'Portón verde',
            zonaId: 'z2',
            zonaNombre: 'Zona 2 - San Juan',
            tarifaNueva: 8.5,
            recargo: 3.5,
          },
        },
      });
      const ctx = crearContexto();
      const entrada = normalizar('Confirmar cambio', 'c_dir_si');

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('MENU');

      const accionCrear = res?.acciones.find((a) => a.tipo === 'crearSolicitudCambio') as any;
      expect(accionCrear).toBeDefined();
      expect(accionCrear.pedidoId).toBe('ped-101');
      expect(accionCrear.tipoCambio).toBe('DIRECCION');
      expect(accionCrear.recargoEnvio).toBe(3.5);
    });
  });

  describe('5. Flujo de Cambio / Cancelación de Pedido', () => {
    it('captura el texto del detalle de cambio y muestra resumen', () => {
      const flujo = crearFlujo({
        cambios: {
          estadoInterno: 'CAMBIO_PED_DETALLE',
          datos: {
            pedidoId: 'ped-101',
            pedidoCodigo: 'CP-1001',
            tipo: 'PEDIDO',
            modalidad: 'DELIVERY',
            estadoPedido: 'PREPARANDO',
          },
        },
      });
      const ctx = crearContexto();
      const entrada = normalizar('Deseo anular el pedido porque me equivoqué de dirección');

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('CAMBIO_PED_CONFIRMAR');
      expect(res?.nuevoFlujo.cambios?.datos.tipo).toBe('CANCELAR');
      expect((res?.acciones[0] as any).texto).toContain('Resumen de solicitud');
      expect((res?.acciones[0] as any).botones).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'c_ped_si' })]),
      );
    });

    it('al confirmar solicitud de pedido ("c_ped_si"), emite accion crearSolicitudCambio', () => {
      const flujo = crearFlujo({
        cambios: {
          estadoInterno: 'CAMBIO_PED_CONFIRMAR',
          datos: {
            pedidoId: 'ped-101',
            pedidoCodigo: 'CP-1001',
            tipo: 'PEDIDO',
            modalidad: 'DELIVERY',
            estadoPedido: 'PREPARANDO',
            detalleTexto: 'Quiero cambiar la torta por cheesecake',
          },
        },
      });
      const ctx = crearContexto();
      const entrada = normalizar('Confirmar solicitud', 'c_ped_si');

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('MENU');
      const accion = res?.acciones.find((a) => a.tipo === 'crearSolicitudCambio') as any;
      expect(accion).toBeDefined();
      expect(accion.tipoCambio).toBe('PEDIDO');
    });
  });

  describe('6. Protección contra manipulación de IDs de botón', () => {
    it('ignora o reinicia cuando se envía un botón de confirmación sin estar en estado de confirmación', () => {
      const flujo = crearFlujo({
        cambios: {
          estadoInterno: 'CAMBIO_DIR_UBICACION',
          datos: {
            pedidoId: 'ped-101',
            pedidoCodigo: 'CP-1001',
            tipo: 'DIRECCION',
            modalidad: 'DELIVERY',
            estadoPedido: 'PREPARANDO',
          },
        },
      });
      const ctx = crearContexto();
      // Envía c_dir_si maliciosamente antes de enviar dirección
      const entrada = normalizar('Confirmar', 'c_dir_si');

      const res = subflujo.transicionar(flujo, entrada, ctx);
      // No debe crear solicitud de cambio
      const accion = res?.acciones.find((a) => a.tipo === 'crearSolicitudCambio');
      expect(accion).toBeUndefined();
    });
  });

  describe('7. Máquina de Estados: repreguntas, fuera de horario y quejas urgentes', () => {

    it('fuera de horario de atención: bot responde con honestidad e indica hora de apertura', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        datosLocal: {
          abierta: false,
          abre: '16:00',
          cierra: '23:00',
          direccion: 'Av. Las Palmeras 100',
          enlaceMapa: 'https://maps.google.com',
        },
      });
      const entrada = normalizar('quiero hablar con un asesor', 'persona');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('ATENCION_PERSONA');
      const texto = (res.acciones.find((a) => a.tipo === 'enviarTexto') as any).texto;
      expect(texto).toContain('Ahora estamos cerrados');
      expect(texto).toContain('16:00');
      const accion = res.acciones.find((a) => a.tipo === 'pasarAPersona');
      expect((accion as any).motivo).toBe('FUERA_DE_HORARIO');
    });

    it('queja escrita: deriva con urgencia y marca crearQueja para queja_whatsapp', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto();
      const entrada = normalizar('Tengo un reclamo por mala atencion, quiero hablar con el encargado');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('ATENCION_PERSONA');
      const accion = res.acciones.find((a) => a.tipo === 'pasarAPersona') as any;
      expect(accion).toBeDefined();
      expect(accion.esUrgente).toBe(true);
      expect(accion.crearQueja).toBe(true);
      expect(accion.motivo).toBe('QUEJA_ESCRITA_URGENTE');
    });
  });
});
