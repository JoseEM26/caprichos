import { transicionarEstado } from '../maquina-estados';
import {
  ContextoConversacion,
  EntradaNormalizada,
  FlujoConversacion,
} from '../tipos-conversacion';
import {
  BOTONES_MODO_ASISTIDO,
  TEXTO_ASISTIDO_FRASE_FIJA,
} from '../textos-bot';

function normalizar(texto: string, id?: string): EntradaNormalizada {
  return {
    tipo: id ? 'boton' : 'texto',
    texto: texto.toLowerCase().trim(),
    textoOriginal: texto,
    id,
  };
}

function crearFlujo(parcial: Partial<FlujoConversacion> = {}): FlujoConversacion {
  return {
    version: 2,
    estado: 'ATENCION_PERSONA',
    repreguntasFallidas: 0,
    ...parcial,
  };
}

function crearContexto(parcial: Partial<ContextoConversacion> = {}): ContextoConversacion {
  return {
    conversacionId: 'conv-test-123',
    nombreCliente: 'María',
    telefonoCliente: '51999888777',
    cartaUrlPublica: 'https://caprichos.pe/carta',
    categoriasCarta: [
      { id: 'cat-1', nombre: 'Tortas', disponible: true, productos: [] },
      { id: 'cat-2', nombre: 'Frappes', disponible: true, productos: [] },
    ],
    datosLocal: {
      abierta: true,
      abre: '12:00',
      cierra: '23:00',
      textoEstado: 'Lunes a Domingo',
      direccion: 'Campoy, SJL, Lima',
      referencia: 'Frente al parque',
      enlaceMapa: 'https://maps.google.com/?q=caprichos',
      telefono: '999888777',
    },
    modoAsistido: true,
    humanoHabloReciente: false,
    chatTomado: false,
    asistidoEsperaMin: 3,
    minutosSinHumano: 5,
    modoAsistidoFraseReciente: false,
    chatbotIaActivo: false,
    ...parcial,
  };
}

describe('Contrato: MODO ASISTIDO DEL BOT (Caprichos, 27/10/2026)', () => {
  describe('Regla 1: Reacción inmediata a menú, carta y pedir en ATENCION_PERSONA sin humano', () => {
    it('responde de inmediato al menú interactivo en ATENCION_PERSONA aunque hayan pasado < 3 min', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({ modoAsistido: false, minutosSinHumano: 1 });
      const entrada = normalizar('menu', 'btn_menu');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(res.acciones).toHaveLength(1);
      const acc = res.acciones[0] as any;
      expect(acc.tipo).toBe('enviarBotones');
      expect(acc.texto).toContain('Mientras te atiende nuestro equipo');
      expect(acc.botones).toEqual(BOTONES_MODO_ASISTIDO);
    });

    it('responde de inmediato a "carta" mostrando lista navegable de categorías', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({ modoAsistido: false, minutosSinHumano: 1 });
      const entrada = normalizar('carta', 'btn_asi_carta');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('ATENCION_PERSONA');
      const acc = res.acciones[0] as any;
      expect(acc.tipo).toBe('enviarLista');
      expect(acc.botonTexto).toBe('Ver categorías');
    });

    it('responde de inmediato a "pedir" iniciando flujo de nuevo pedido (modalidad delivery/recojo)', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({ modoAsistido: false, minutosSinHumano: 1 });
      const entrada = normalizar('quiero pedir', 'pedir');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('PEDIDO_MODALIDAD');
      expect(res.nuevoFlujo.pedido).toBeDefined();
      expect(res.acciones.some((a) => a.tipo === 'enviarBotones')).toBe(true);
    });

    it('responde a la consulta de estado de pedido con pedido activo', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        pedidoActivo: {
          codigo: 'CP-0110',
          estado: 'PREPARANDO',
          pago_estado: 'CONFIRMADO',
        },
      });
      const entrada = normalizar('estado de mi pedido CP-0110');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('ATENCION_PERSONA');
      const acc = res.acciones[0] as any;
      expect(acc.texto).toContain('CP-0110');
      expect(acc.texto).toContain('PREPARANDO');
    });

    it('responde a consultas de horario y ubicación con datos del local', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto();
      const entrada = normalizar('a que hora abren y donde estan');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('ATENCION_PERSONA');
      const acc = res.acciones[0] as any;
      expect(acc.texto).toContain('Campoy');
      expect(acc.texto).toContain('Abierto hoy hasta las 23:00');
    });

    it('al pulsar "Hablar con persona" reitera aviso sin romper estado', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto();
      const entrada = normalizar('hablar con persona', 'btn_asi_persona');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('ATENCION_PERSONA');
      const acc = res.acciones[0] as any;
      expect(acc.tipo).toBe('enviarTexto');
      expect(acc.texto).toContain('Ya avisé a una persona');
    });
  });

  describe('Regla 5: Silencio si humano escribió hace < 3 min o si el chat está tomado', () => {
    it('permanece en silencio total si una persona escribió hace menos de 3 minutos', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({ humanoHabloReciente: true });
      const entrada = normalizar('hola me pueden atender?');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(res.acciones).toHaveLength(0);
    });

    it('permanece en silencio total si el chat está tomado por un asesor activo', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({ chatTomado: true });
      const entrada = normalizar('hola alguien ahi?');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(res.acciones).toHaveLength(0);
    });
  });

  describe('Regla 4: No repetir la frase fija antes de 3 minutos', () => {
    it('envía la frase fija y los 3 botones ante la primera pregunta libre con IA apagada', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        modoAsistido: true,
        chatbotIaActivo: false,
        modoAsistidoFraseReciente: false,
      });
      const entrada = normalizar('tienen torta selva negra para mañana?');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(res.acciones).toHaveLength(1);
      const acc = res.acciones[0] as any;
      expect(acc.tipo).toBe('enviarBotones');
      expect(acc.texto).toBe(TEXTO_ASISTIDO_FRASE_FIJA);
      expect(acc.botones).toEqual(BOTONES_MODO_ASISTIDO);
      // Validar longitud máxima de 20 caracteres por botón WhatsApp
      for (const b of acc.botones) {
        expect(b.titulo.length).toBeLessThanOrEqual(20);
      }
    });

    it('calla y NO repite la frase fija si ya fue enviada en los últimos 3 minutos', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        modoAsistido: true,
        chatbotIaActivo: false,
        modoAsistidoFraseReciente: true,
      });
      const entrada = normalizar('hola siguen ahi?');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(res.acciones).toHaveLength(0);
    });
  });

  describe('Regla 2 y 7: Cancelación crea solicitud para Caja y NO cancela el pedido', () => {
    it('crea solicitud de cancelación para Caja sin modificar estado del pedido', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        pedidoActivo: {
          id: 'ped-555',
          codigo: 'CP-0110',
          estado: 'COLA',
        },
      });
      const entrada = normalizar('quiero cancelar mi pedido por favor');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('ATENCION_PERSONA');
      const accionCrear = res.acciones.find((a) => a.tipo === 'crearSolicitudCambio') as any;
      expect(accionCrear).toBeDefined();
      expect(accionCrear.tipoCambio).toBe('CANCELAR');
      expect(accionCrear.pedidoCodigo).toBe('CP-0110');

      const accionBotones = res.acciones.find((a) => a.tipo === 'enviarBotones') as any;
      expect(accionBotones.texto).toContain('Registre tu solicitud de cancelacion; una persona de Caja la confirma');
    });

    it('pedido ya en PREPARANDO/LISTO/EN_CAMINO registra igualmente solicitud con aviso de que puede no ser posible', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        pedidoActivo: {
          id: 'ped-777',
          codigo: 'CP-0777',
          estado: 'PREPARANDO',
        },
      });
      const entrada = normalizar('deseo anular mi pedido urgente');

      const res = transicionarEstado(flujo, entrada, ctx);
      const accionCrear = res.acciones.find((a) => a.tipo === 'crearSolicitudCambio') as any;
      expect(accionCrear).toBeDefined();
      expect(accionCrear.tipoCambio).toBe('CANCELAR');

      const accionBotones = res.acciones.find((a) => a.tipo === 'enviarBotones') as any;
      expect(accionBotones.texto).toContain('preparando y puede no ser posible');
      expect(accionBotones.texto).toContain('una persona de Caja la confirma');
    });
  });

  describe('Regla 3: Preguntas libres con IA encendida vs apagada', () => {
    it('con IA encendida y disponible emite acción consultarIa', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        modoAsistido: true,
        chatbotIaActivo: true,
      });
      const entrada = normalizar('¿Cuáles son los ingredientes del frozen strawberry?');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('ATENCION_PERSONA');
      const acc = res.acciones[0] as any;
      expect(acc.tipo).toBe('consultarIa');
      expect(acc.pregunta).toBe('¿Cuáles son los ingredientes del frozen strawberry?');
    });

    it('con IA apagada responde con frase fija y botones delimitados', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        modoAsistido: true,
        chatbotIaActivo: false,
        modoAsistidoFraseReciente: false,
      });
      const entrada = normalizar('¿Hacen envíos a San Juan de Lurigancho?');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('ATENCION_PERSONA');
      const acc = res.acciones[0] as any;
      expect(acc.tipo).toBe('enviarBotones');
      expect(acc.texto).toBe(TEXTO_ASISTIDO_FRASE_FIJA);
    });
  });

  describe('Regla 1 y 7: Nuevo pedido en modo asistido no toca el pedido en curso', () => {
    it('un pedido nuevo en modo asistido inicializa carrito separado manteniendo el pedido en curso intacto', () => {
      const flujo = crearFlujo();
      const ctx = crearContexto({
        pedidoActivo: {
          id: 'ped-previo-123',
          codigo: 'CP-0110',
          estado: 'PREPARANDO',
          total: 45.0,
        },
      });
      const entrada = normalizar('hacer un pedido', 'pedir');

      const res = transicionarEstado(flujo, entrada, ctx);
      expect(res.nuevoEstado).toBe('PEDIDO_MODALIDAD');
      expect(res.nuevoFlujo.pedido).toBeDefined();
      expect(res.nuevoFlujo.pedido?.items).toEqual([]);

      // El pedido activo del contexto no sufre modificaciones
      expect(ctx.pedidoActivo.id).toBe('ped-previo-123');
      expect(ctx.pedidoActivo.codigo).toBe('CP-0110');
      expect(ctx.pedidoActivo.estado).toBe('PREPARANDO');
    });
  });
});
