import { transicionarEstado } from '../maquina-estados';
import {
  ContextoConversacion,
  EntradaNormalizada,
  FlujoConversacion,
} from '../tipos-conversacion';
import {
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

  describe('Decisión 22/11: «Perdona la espera» al retomar un chat que nadie atendió', () => {
    const acciones = (ctx: Partial<ContextoConversacion>, flujo = crearFlujo()) =>
      transicionarEstado(flujo, normalizar('hola'), crearContexto(ctx)).acciones as any[];

    it('con espera cumplida y local abierto: texto corto con el menú corto, y el chat sigue en atención de persona', () => {
      const res = transicionarEstado(crearFlujo(), normalizar('hola'), crearContexto());
      expect(res.nuevoEstado).toBe('ATENCION_PERSONA');
      expect((res.acciones as any[])[0]).toMatchObject({ tipo: 'enviarBotones', texto: 'Perdona la espera 🙏 ¿te ayudo yo mientras tanto?' });
    });
    it('una sola vez: con la marca puesta ya no se repite', () => {
      expect(acciones({}, crearFlujo({ perdona_espera_ts: Date.now() } as any))[0]?.texto).not.toContain('Perdona la espera');
    });
    it('con el local cerrado no se dice', () => {
      const cerrado = crearContexto().datosLocal!;
      expect(acciones({ datosLocal: { ...cerrado, abierta: false } })[0]?.texto ?? '').not.toContain('Perdona la espera');
    });
  });
});
