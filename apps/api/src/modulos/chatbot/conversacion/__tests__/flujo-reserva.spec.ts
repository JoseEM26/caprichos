import { FlujoReservaSubFlujo, obtenerFechaLimaActual } from '../flujos/reserva/flujo-reserva';
import {
  FlujoConversacion,
  EntradaNormalizada,
  ContextoConversacion,
} from '../tipos-conversacion';

describe('FlujoReservaSubFlujo (Ola 3, Agente F — Reservar mesa por WhatsApp)', () => {
  let subflujo: FlujoReservaSubFlujo;

  beforeEach(() => {
    subflujo = new FlujoReservaSubFlujo();
  });

  const crearFlujoBase = (estado: any = 'MENU', reserva: any = null): FlujoConversacion => ({
    version: 2,
    estado,
    repreguntasFallidas: 0,
    reserva,
  });

  const crearContextoBase = (parches: Partial<ContextoConversacion> = {}): ContextoConversacion => ({
    conversacionId: '101',
    nombreCliente: 'Ana Torres',
    telefonoCliente: '987654321',
    franjasDisponiblesReserva: ['15:00', '15:30', '16:00', '16:30', '17:00'],
    solicitudesPendientesTelefono: 0,
    datosLocal: {
      abierta: true,
      abre: '14:00',
      cierra: '23:00',
      direccion: 'Av. Campoy 123',
      enlaceMapa: 'https://maps.google.com',
    },
    ...parches,
  });

  const normalizar = (texto: string, id?: string): EntradaNormalizada => ({
    tipo: id ? 'boton' : 'texto',
    texto: texto.toLowerCase().trim(),
    textoOriginal: texto,
    id,
  });

  describe('1. Inicio del flujo e intención de reserva', () => {
    it('detecta entrada por botón del menú interactivo (id="reservar")', () => {
      const flujo = crearFlujoBase();
      const entrada = normalizar('Reservar mesa', 'reservar');
      const ctx = crearContextoBase();

      expect(subflujo.puedeManejar(flujo, entrada, ctx)).toBe(true);
      const res = subflujo.transicionar(flujo, entrada, ctx);

      expect(res).not.toBeNull();
      expect(res?.nuevoEstado).toBe('RESERVA_PERSONAS');
      expect(res?.acciones[0].tipo).toBe('enviarBotones');
      expect(res?.nuevoFlujo.reserva?.estadoInterno).toBe('RESERVA_PERSONAS');
    });

    it('detecta intención de reserva por texto ("quiero reservar una mesa")', () => {
      const flujo = crearFlujoBase();
      const entrada = normalizar('hola quiero reservar una mesa para cenar');
      const ctx = crearContextoBase();

      expect(subflujo.puedeManejar(flujo, entrada, ctx)).toBe(true);
      const res = subflujo.transicionar(flujo, entrada, ctx);

      expect(res?.nuevoEstado).toBe('RESERVA_PERSONAS');
    });

    it('rechaza iniciar reserva si el teléfono ya tiene 3 solicitudes pendientes', () => {
      const flujo = crearFlujoBase();
      const entrada = normalizar('Reservar mesa', 'reservar');
      const ctx = crearContextoBase({ solicitudesPendientesTelefono: 3 });

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('MENU');
      expect((res?.acciones[0] as any).texto).toContain('Ya tienes 3 solicitudes de reserva pendientes');
    });
  });

  describe('2. Selección de personas (RESERVA_PERSONAS)', () => {
    it('selecciona 1-2 personas mediante botón res_p_1_2', () => {
      const flujo = crearFlujoBase('RESERVA_PERSONAS', { estadoInterno: 'RESERVA_PERSONAS', datos: {} });
      const entrada = normalizar('1 a 2', 'res_p_1_2');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_FECHA');
      expect(res?.nuevoFlujo.reserva?.datos.personas).toBe(2);
      expect((res?.acciones[0] as any).texto).toContain('¿Para qué fecha deseas tu reserva?');
    });

    it('selecciona 3-4 personas mediante botón res_p_3_4', () => {
      const flujo = crearFlujoBase('RESERVA_PERSONAS', { estadoInterno: 'RESERVA_PERSONAS', datos: {} });
      const entrada = normalizar('3 a 4', 'res_p_3_4');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_FECHA');
      expect(res?.nuevoFlujo.reserva?.datos.personas).toBe(4);
    });

    it('selecciona 5-6 personas mediante botón res_p_5_6', () => {
      const flujo = crearFlujoBase('RESERVA_PERSONAS', { estadoInterno: 'RESERVA_PERSONAS', datos: {} });
      const entrada = normalizar('5 a 6', 'res_p_5_6');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_FECHA');
      expect(res?.nuevoFlujo.reserva?.datos.personas).toBe(6);
    });

    it('acepta cantidad escrita numérica ("8 personas")', () => {
      const flujo = crearFlujoBase('RESERVA_PERSONAS', { estadoInterno: 'RESERVA_PERSONAS', datos: {} });
      const entrada = normalizar('somos 8 personas');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_FECHA');
      expect(res?.nuevoFlujo.reserva?.datos.personas).toBe(8);
    });

    it('acepta reservas de hasta 20 personas por WhatsApp', () => {
      const flujo = crearFlujoBase('RESERVA_PERSONAS', { estadoInterno: 'RESERVA_PERSONAS', datos: {} });
      const ctx = crearContextoBase();

      for (const n of [12, 15, 20]) {
        const res = subflujo.transicionar(flujo, normalizar(`somos ${n} personas`), ctx);
        expect(res?.nuevoEstado).toBe('RESERVA_FECHA');
        expect(res?.nuevoFlujo.reserva?.datos.personas).toBe(n);
      }
    });

    it('para grupos mayores a 20 personas deriva a persona (seguridad)', () => {
      const flujo = crearFlujoBase('RESERVA_PERSONAS', { estadoInterno: 'RESERVA_PERSONAS', datos: {} });
      const entrada = normalizar('somos 21 personas');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('ATENCION_PERSONA');
      const accionPersona = res?.acciones.find((a) => a.tipo === 'pasarAPersona');
      expect(accionPersona).toBeDefined();
      expect((res?.acciones[0] as any).texto).toContain('Para grupos de más de 20 personas');
    });

    it('repregunta si el usuario ingresa 0 o texto no numérico', () => {
      const flujo = crearFlujoBase('RESERVA_PERSONAS', { estadoInterno: 'RESERVA_PERSONAS', datos: {} });
      const entrada = normalizar('no sé cuántos somos');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_PERSONAS');
      expect((res?.acciones[0] as any).texto).toContain('Por favor elige una opción o escribe la cantidad de personas');
    });
  });

  describe('3. Selección de fecha (RESERVA_FECHA y RESERVA_FECHA_OTRA)', () => {
    it('selecciona "Hoy" mediante botón res_f_hoy', () => {
      const flujo = crearFlujoBase('RESERVA_FECHA', { estadoInterno: 'RESERVA_FECHA', datos: { personas: 4 } });
      const entrada = normalizar('Hoy', 'res_f_hoy');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_HORA');
      expect(res?.nuevoFlujo.reserva?.datos.fechaTexto).toBe('Hoy');
      expect(res?.acciones[0].tipo).toBe('enviarLista');
    });

    it('selecciona "Mañana" mediante botón res_f_manana', () => {
      const flujo = crearFlujoBase('RESERVA_FECHA', { estadoInterno: 'RESERVA_FECHA', datos: { personas: 4 } });
      const entrada = normalizar('Mañana', 'res_f_manana');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_HORA');
      expect(res?.nuevoFlujo.reserva?.datos.fechaTexto).toBe('Mañana');
    });

    it('toca "Otra fecha" y solicita ingreso escrito', () => {
      const flujo = crearFlujoBase('RESERVA_FECHA', { estadoInterno: 'RESERVA_FECHA', datos: { personas: 4 } });
      const entrada = normalizar('Otra fecha', 'res_f_otra');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_FECHA_OTRA');
      expect((res?.acciones[0] as any).texto).toContain('escribe la fecha para tu reserva');
    });

    it('acepta fecha escrita futura válida en formato DD/MM', () => {
      const flujo = crearFlujoBase('RESERVA_FECHA_OTRA', { estadoInterno: 'RESERVA_FECHA_OTRA', datos: { personas: 4 } });
      const hoyLima = obtenerFechaLimaActual(2); // pasado mañana
      const entrada = normalizar(hoyLima.fechaIso);
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_HORA');
      expect(res?.nuevoFlujo.reserva?.datos.fechaIso).toBe(hoyLima.fechaIso);
    });

    it('rechaza fecha en el pasado', () => {
      const flujo = crearFlujoBase('RESERVA_FECHA', { estadoInterno: 'RESERVA_FECHA', datos: { personas: 4 } });
      const entrada = normalizar('2020-01-01');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect((res?.acciones[0] as any).texto).toContain('La fecha indicada ya pasó');
    });

    it('informa si no hay disponibilidad en la fecha seleccionada', () => {
      const flujo = crearFlujoBase('RESERVA_FECHA', { estadoInterno: 'RESERVA_FECHA', datos: { personas: 4 } });
      const entrada = normalizar('Hoy', 'res_f_hoy');
      const ctx = crearContextoBase({ franjasDisponiblesReserva: [] });

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect((res?.acciones[0] as any).texto).toContain('No encontramos mesas disponibles para 4 personas');
    });
  });

  describe('4. Selección de hora (RESERVA_HORA)', () => {
    it('selecciona una hora de la lista interactiva (id="res_h_1530")', () => {
      const flujo = crearFlujoBase('RESERVA_HORA', {
        estadoInterno: 'RESERVA_HORA',
        datos: { personas: 4, fechaIso: '2026-10-28', fechaTexto: '2026-10-28' },
        franjasDisponibles: ['15:00', '15:30', '16:00'],
      });
      const entrada = normalizar('15:30', 'res_h_1530');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_CONFIRMAR_NOMBRE');
      expect(res?.nuevoFlujo.reserva?.datos.hora).toBe('15:30');
      expect((res?.acciones[0] as any).texto).toContain('¿Confirmas tu nombre para la reserva: *Ana Torres*?');
    });

    it('rechaza hora fuera de las franjas disponibles', () => {
      const flujo = crearFlujoBase('RESERVA_HORA', {
        estadoInterno: 'RESERVA_HORA',
        datos: { personas: 4, fechaIso: '2026-10-28', fechaTexto: '2026-10-28' },
        franjasDisponibles: ['15:00', '15:30'],
      });
      const entrada = normalizar('22:00', 'res_h_2200');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect((res?.acciones[0] as any).texto).toContain('Por favor selecciona una hora válida');
    });
  });

  describe('5. Nombre y Teléfono (RESERVA_CONFIRMAR_NOMBRE e INGRESAR_TELEFONO)', () => {
    it('confirma nombre sugerido con "Sí, es correcto" y pasa a nota si teléfono es válido', () => {
      const flujo = crearFlujoBase('RESERVA_CONFIRMAR_NOMBRE', {
        estadoInterno: 'RESERVA_CONFIRMAR_NOMBRE',
        datos: { personas: 2, fechaIso: '2026-10-28', fechaTexto: 'Hoy', hora: '16:00' },
      });
      const entrada = normalizar('Sí, es correcto', 'res_nom_si');
      const ctx = crearContextoBase({ nombreCliente: 'Ana Torres', telefonoCliente: '987654321' });

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_PREGUNTAR_NOTA');
      expect(res?.nuevoFlujo.reserva?.datos.nombre).toBe('Ana Torres');
      expect(res?.nuevoFlujo.reserva?.datos.telefono).toBe('987654321');
    });

    it('permite cambiar nombre con "Escribir otro"', () => {
      const flujo = crearFlujoBase('RESERVA_CONFIRMAR_NOMBRE', {
        estadoInterno: 'RESERVA_CONFIRMAR_NOMBRE',
        datos: { personas: 2, fechaIso: '2026-10-28', fechaTexto: 'Hoy', hora: '16:00' },
      });
      const entrada = normalizar('Escribir otro', 'res_nom_no');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_INGRESAR_NOMBRE');
      expect((res?.acciones[0] as any).texto).toContain('escribe el nombre completo');
    });

    it('pide teléfono si el cliente es BSUID o no tiene teléfono de 9 dígitos', () => {
      const flujo = crearFlujoBase('RESERVA_CONFIRMAR_NOMBRE', {
        estadoInterno: 'RESERVA_CONFIRMAR_NOMBRE',
        datos: { personas: 2, fechaIso: '2026-10-28', fechaTexto: 'Hoy', hora: '16:00' },
      });
      const entrada = normalizar('Sí, es correcto', 'res_nom_si');
      const ctx = crearContextoBase({ telefonoCliente: 'bsuid:user123' });

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_INGRESAR_TELEFONO');
      expect((res?.acciones[0] as any).texto).toContain('escribe tu número de celular (9 dígitos)');
    });

    it('valida que el teléfono ingresado tenga 9 dígitos y empiece con 9', () => {
      const flujo = crearFlujoBase('RESERVA_INGRESAR_TELEFONO', {
        estadoInterno: 'RESERVA_INGRESAR_TELEFONO',
        datos: { personas: 2, fechaIso: '2026-10-28', fechaTexto: 'Hoy', hora: '16:00', nombre: 'Carlos' },
      });
      const entradaInvalida = normalizar('123456');
      const ctx = crearContextoBase();

      const resInvalido = subflujo.transicionar(flujo, entradaInvalida, ctx);
      expect(resInvalido?.nuevoEstado).toBe('RESERVA_INGRESAR_TELEFONO');
      expect((resInvalido?.acciones[0] as any).texto).toContain('El número debe tener 9 dígitos');

      const entradaValida = normalizar('998877665');
      const resValido = subflujo.transicionar(flujo, entradaValida, ctx);
      expect(resValido?.nuevoEstado).toBe('RESERVA_PREGUNTAR_NOTA');
      expect(resValido?.nuevoFlujo.reserva?.datos.telefono).toBe('998877665');
    });
  });

  describe('6. Nota opcional y Resumen final (RESERVA_RESUMEN_CONFIRMAR)', () => {
    it('permite omitir nota con botón "Sin nota"', () => {
      const flujo = crearFlujoBase('RESERVA_PREGUNTAR_NOTA', {
        estadoInterno: 'RESERVA_PREGUNTAR_NOTA',
        datos: {
          personas: 2,
          fechaIso: '2026-10-28',
          fechaTexto: 'Hoy',
          hora: '16:00',
          nombre: 'Ana Torres',
          telefono: '987654321',
        },
      });
      const entrada = normalizar('Sin nota', 'res_nota_sin');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_RESUMEN_CONFIRMAR');
      expect(res?.nuevoFlujo.reserva?.datos.nota).toBeUndefined();
      expect((res?.acciones[0] as any).texto).toContain('Resumen de tu solicitud de reserva');
    });

    it('guarda indicación escrita (cumpleaños / silla bebé)', () => {
      const flujo = crearFlujoBase('RESERVA_PREGUNTAR_NOTA', {
        estadoInterno: 'RESERVA_PREGUNTAR_NOTA',
        datos: {
          personas: 4,
          fechaIso: '2026-10-28',
          fechaTexto: 'Hoy',
          hora: '16:00',
          nombre: 'Ana Torres',
          telefono: '987654321',
        },
      });
      const entrada = normalizar('Cumpleaños de mi mamá 🎂 y silla de bebé');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_RESUMEN_CONFIRMAR');
      expect(res?.nuevoFlujo.reserva?.datos.nota).toContain('Cumpleaños de mi mamá');
    });

    it('al confirmar solicitud emite acción transaccional crearSolicitudReserva y vuelve a MENU', () => {
      const flujo = crearFlujoBase('RESERVA_RESUMEN_CONFIRMAR', {
        estadoInterno: 'RESERVA_RESUMEN_CONFIRMAR',
        datos: {
          personas: 4,
          fechaIso: '2026-10-28',
          fechaTexto: 'Hoy',
          hora: '16:00',
          nombre: 'Ana Torres',
          telefono: '987654321',
          nota: 'Silla de bebé',
        },
      });
      const entrada = normalizar('Confirmar solicitud', 'res_conf_si');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('MENU');
      expect(res?.nuevoFlujo.reserva).toBeNull();

      const accionCrear = res?.acciones.find((a) => a.tipo === 'crearSolicitudReserva');
      expect(accionCrear).toBeDefined();
      expect((accionCrear as any).personas).toBe(4);
      expect((accionCrear as any).nombre).toBe('Ana Torres');
      expect((accionCrear as any).telefono).toBe('987654321');

      // Texto de éxito idéntico al mockup
      const accionMsg = res?.acciones.find((a) => a.tipo === 'enviarBotones');
      expect((accionMsg as any).texto).toContain('Recibí tu solicitud de reserva para 4 personas el Hoy a las 16:00');
      expect((accionMsg as any).texto).toContain('guardamos la mesa 15 minutos de tolerancia');
    });

    it('permite cambiar algo y reinicia el flujo al paso de personas', () => {
      const flujo = crearFlujoBase('RESERVA_RESUMEN_CONFIRMAR', {
        estadoInterno: 'RESERVA_RESUMEN_CONFIRMAR',
        datos: { personas: 4, fechaIso: '2026-10-28', hora: '16:00' },
      });
      const entrada = normalizar('Cambiar algo', 'res_conf_cambiar');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('RESERVA_PERSONAS');
    });
  });

  describe('7. Cancelación y Cambio de Reservas existentes', () => {
    it('permite cancelar reserva activa tras confirmación Sí/No', () => {
      const reservasCliente = [
        { id: '55', fecha: '2026-10-29', hora: '19:00', personas: 4, mesas: ['Mesa 1'] },
      ];
      const ctx = crearContextoBase({ reservasActivasCliente: reservasCliente });

      // Inicia cancelación
      const flujo1 = crearFlujoBase();
      const entrada1 = normalizar('cancelar mi reserva');
      const res1 = subflujo.transicionar(flujo1, entrada1, ctx);

      expect(res1?.nuevoEstado).toBe('RESERVA_CANCELAR_CONFIRMAR');
      expect((res1?.acciones[0] as any).texto).toContain('¿Estás seguro de que deseas cancelar tu reserva del 2026-10-29 a las 19:00');

      // Confirma con "Sí, cancelar"
      const flujo2 = res1!.nuevoFlujo;
      const entrada2 = normalizar('Sí, cancelar', 'res_canc_si');
      const res2 = subflujo.transicionar(flujo2, entrada2, ctx);

      expect(res2?.nuevoEstado).toBe('MENU');
      const accionCanc = res2?.acciones.find((a) => a.tipo === 'cancelarReservaCliente');
      expect(accionCanc).toBeDefined();
      expect((accionCanc as any).reservaId).toBe('55');
    });

    it('permite solicitar cambio de reserva activa y emite acción cambiarReservaCliente', () => {
      const reservasCliente = [
        { id: '55', fecha: '2026-10-29', hora: '19:00', personas: 4, mesas: ['Mesa 1'] },
      ];
      const ctx = crearContextoBase({ reservasActivasCliente: reservasCliente });

      // Inicia cambio
      const flujo1 = crearFlujoBase();
      const entrada1 = normalizar('cambiar mi reserva');
      const res1 = subflujo.transicionar(flujo1, entrada1, ctx);

      expect(res1?.nuevoEstado).toBe('RESERVA_CAMBIAR_DETALLE');
      expect((res1?.acciones[0] as any).texto).toContain('escribe qué cambio necesitas');

      // Envía detalle del cambio
      const flujo2 = res1!.nuevoFlujo;
      const entrada2 = normalizar('Por favor cambiar a las 20:30 seremos 6 personas');
      const res2 = subflujo.transicionar(flujo2, entrada2, ctx);

      expect(res2?.nuevoEstado).toBe('MENU');
      const accionCambio = res2?.acciones.find((a) => a.tipo === 'cambiarReservaCliente');
      expect(accionCambio).toBeDefined();
      expect((accionCambio as any).reservaId).toBe('55');
      expect((accionCambio as any).detalle).toContain('20:30');
    });
  });

  describe('8. Navegación global y derivación', () => {
    it('vuelve al menú con "menu" o botón "menu"', () => {
      const flujo = crearFlujoBase('RESERVA_HORA', { estadoInterno: 'RESERVA_HORA', datos: {} });
      const entrada = normalizar('Volver al menú', 'menu');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('MENU');
      expect(res?.nuevoFlujo.reserva).toBeNull();
    });

    it('deriva a persona con botón "persona" o palabra "asesor"', () => {
      const flujo = crearFlujoBase('RESERVA_PERSONAS', { estadoInterno: 'RESERVA_PERSONAS', datos: {} });
      const entrada = normalizar('Hablar con persona', 'persona');
      const ctx = crearContextoBase();

      const res = subflujo.transicionar(flujo, entrada, ctx);
      expect(res?.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(res?.acciones.some((a) => a.tipo === 'pasarAPersona')).toBe(true);
    });
  });
});
