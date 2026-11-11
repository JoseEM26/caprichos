jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
/**
 * Avisos programados (computadoras de impresión sin conectar y chats sin responder) contra un Postgres REAL:
 * las consultas, el índice parcial y la idempotencia por marca única (también con dos instancias a la vez).
 *
 * Solo corre con una base desechable con TODAS las migraciones aplicadas:
 *   docker run -d --name pg-av -e POSTGRES_PASSWORD=x -e POSTGRES_DB=t -p 55441:5432 postgres:16-alpine
 *   DATABASE_URL=<url de esa base> npx prisma migrate deploy
 *   AVISOS_PG_URL=<url de esa base> npx jest avisos-programados.pg
 * Sin AVISOS_PG_URL se omite (CI normal). Todo es inventado; el reloj es inyectado (nada depende de la hora real).
 */
import { PrismaClient } from '@prisma/client';
import { PcImpresionAvisoService } from './pc-impresion-aviso.service';
import { CHAT_TOPE_POR_HORA, ChatSinResponderAvisoService } from './chat-sin-responder-aviso.service';

const URL_PG = process.env.AVISOS_PG_URL;
const suite = URL_PG ? describe : describe.skip;
const MIN = 60_000;

suite('Avisos programados en Postgres real', () => {
  let prisma: PrismaClient;
  let n = 0;
  // Un día de Lima distinto por prueba: la caja es única por fecha
  const dia = () => {
    n++;
    const d = new Date(Date.UTC(2031, 0, 1 + n));
    return d.toISOString().slice(0, 10);
  };
  /** Instante de Lima (UTC-5) del día a las hh:mm. */
  const lima = (fecha: string, hhmm: string) => new Date(`${fecha}T${hhmm}:00.000-05:00`);

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: URL_PG! } } });
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await prisma.mensajeChat.deleteMany({});
    await prisma.conversacion.deleteMany({});
    await prisma.equipoImpresionConfig.deleteMany({});
    await prisma.deviceKey.deleteMany({});
    await prisma.avisoMarca.deleteMany({});
    await prisma.caja.deleteMany({});
    await prisma.parametro.deleteMany({ where: { clave: { startsWith: 'aviso_' } } });
  });

  const avisosFalso = () => ({ avisar: jest.fn().mockResolvedValue({ enviados: 1, simulados: 0, fallidos: 0, omitidos: 0 }) });

  // ---------------------------------------------------------------- computadoras de impresión
  describe('computadoras de impresión sin conectar', () => {
    const servicio = (avisos = avisosFalso()) => ({ avisos, svc: new PcImpresionAvisoService(prisma as any, {} as any, avisos as any) });

    async function cajaAbierta(fecha: string, aperturaHora = '08:00', estado = 'ABIERTA') {
      const caja = await prisma.caja.create({ data: { fecha: new Date(`${fecha}T00:00:00.000Z`), apertura: 100, estado, abierta_por: 1n } });
      await prisma.auditoria.create({
        data: { categoria: 'CAMBIO', modulo: 'caja', accion: 'ABRIR_CAJA', entidad: 'caja', entidad_id: caja.id, en: lima(fecha, aperturaHora) },
      });
      return caja;
    }
    let k = 0;
    async function pc(nombre: string, ultimoLatido: Date | null, extra: Record<string, unknown> = {}, config?: Record<string, unknown>) {
      const d = await prisma.deviceKey.create({
        data: { tipo: 'AGENTE', nombre, llave_hash: `hash-${Date.now()}-${++k}`, activo: true, ultimo_latido: ultimoLatido, latido_hostname: `PC-${k}`, latido_sistema: 'Windows 11', ...extra } as any,
      });
      if (config) await prisma.equipoImpresionConfig.create({ data: { device_key_id: d.id, configurado: true, ...config } as any });
      return d;
    }

    it('2 de 4 en línea: UN correo con los 2 que faltan, su función y desde cuándo; a los 20 min exactos, no antes', async () => {
      const f = dia();
      await cajaAbierta(f);
      const t20 = new Date(lima(f, '08:00').getTime() + 20 * MIN);
      await pc('PC Caja', new Date(t20.getTime() - 10_000), {}, { etiquetera: true });
      await pc('PC Cocina', new Date(t20.getTime() - 30_000), {}, { ticketera: true });
      await pc('PC Barra', new Date(t20.getTime() - 28 * MIN), {}, { etiquetera: true });
      await pc('PC Almacén', null, {}, { ticketera: true });
      const { svc, avisos } = servicio();

      expect(await svc.revisar(new Date(t20.getTime() - 1000))).toEqual({ accion: 'aun_no' });
      const r = await svc.revisar(t20);
      expect(r).toMatchObject({ accion: 'enviado', numero: 0, enLinea: 2, vinculados: 4 });
      expect(avisos.avisar).toHaveBeenCalledTimes(1);
      const a = avisos.avisar.mock.calls[0][0];
      expect(a.tipo).toBe('PC_IMPRESION');
      expect(a.asunto).toBe('2 de 4 computadoras de impresión en línea');
      expect(a.texto).toContain('PC Barra (etiquetera): sin señal desde las 07:52 (hace 28 min)');
      expect(a.texto).toContain('PC Almacén (ticketera): nunca dio señal');
      expect(a.texto).not.toContain('PC Caja');
      expect(a.texto).toContain('--estado');
      // la misma revisión no se repite
      expect(await svc.revisar(new Date(t20.getTime() + MIN))).toEqual({ accion: 'aun_no' });
      expect(avisos.avisar).toHaveBeenCalledTimes(1);
    });

    it('recordatorio UNA sola vez, 1 hora después de la primera revisión; luego se calla', async () => {
      const f = dia();
      await cajaAbierta(f);
      const t20 = new Date(lima(f, '08:00').getTime() + 20 * MIN);
      await pc('PC Barra', new Date(t20.getTime() - 5 * MIN), {}, { etiquetera: true });
      const { svc, avisos } = servicio();
      await svc.revisar(t20);
      expect(await svc.revisar(new Date(t20.getTime() + 59 * MIN))).toEqual({ accion: 'aun_no' });
      const r = await svc.revisar(new Date(t20.getTime() + 60 * MIN));
      expect(r).toMatchObject({ accion: 'enviado', numero: 1, enLinea: 0, vinculados: 1 });
      expect(avisos.avisar.mock.calls[1][0].asunto).toMatch(/^Recordatorio: /);
      // tercera vez: nada
      expect((await svc.revisar(new Date(t20.getTime() + 180 * MIN))).accion).toBe('otra_instancia');
      expect(avisos.avisar).toHaveBeenCalledTimes(2);
    });

    it('todo en línea: no envía nada, ni recordatorio', async () => {
      const f = dia();
      await cajaAbierta(f);
      const t20 = new Date(lima(f, '08:00').getTime() + 20 * MIN);
      await pc('PC Caja', new Date(t20.getTime() - 60_000), {}, { etiquetera: true }); // 60 s exactos = en línea
      const { svc, avisos } = servicio();
      expect(await svc.revisar(t20)).toEqual({ accion: 'todo_en_linea' });
      expect((await svc.revisar(new Date(t20.getTime() + 61 * MIN))).accion).toBe('sin_recordatorio');
      expect(avisos.avisar).not.toHaveBeenCalled();
    });

    it('61 s sin latido ya es «sin conexión» (misma definición que la pantalla de impresión)', async () => {
      const f = dia();
      await cajaAbierta(f);
      const t20 = new Date(lima(f, '08:00').getTime() + 20 * MIN);
      await pc('PC Caja', new Date(t20.getTime() - 61_000), {}, { etiquetera: true });
      const { svc } = servicio();
      expect((await svc.revisar(t20)).accion).toBe('enviado');
    });

    it('caja sin abrir o ya cerrada: no avisa', async () => {
      const f = dia();
      const t = new Date(lima(f, '09:00').getTime());
      await pc('PC Caja', null);
      const { svc, avisos } = servicio();
      expect(await svc.revisar(t)).toEqual({ accion: 'sin_caja' });
      const g = dia();
      await cajaAbierta(g, '08:00', 'CERRADA');
      expect(await svc.revisar(lima(g, '09:00'))).toEqual({ accion: 'sin_caja' });
      expect(avisos.avisar).not.toHaveBeenCalled();
    });

    it('equipos desvinculados, archivados, con código pendiente o pausados a propósito NO cuentan', async () => {
      const f = dia();
      await cajaAbierta(f);
      const t20 = new Date(lima(f, '08:00').getTime() + 20 * MIN);
      await pc('Activa en línea', new Date(t20.getTime() - 5000), {}, { etiquetera: true });
      await pc('Desactivada', null, { activo: false });
      await pc('Archivada', null, { archivada_en: new Date() });
      await pc('Esperando código', null, { activo: false, codigo_vinculo: `COD${k}` });
      await pc('Pausada', null, {}, { etiquetera: true, pausado: true });
      const { svc, avisos } = servicio();
      expect(await svc.revisar(t20)).toEqual({ accion: 'todo_en_linea' });
      expect(avisos.avisar).not.toHaveBeenCalled();
    });

    it('dos instancias a la vez: un solo correo', async () => {
      const f = dia();
      await cajaAbierta(f);
      const t20 = new Date(lima(f, '08:00').getTime() + 20 * MIN);
      await pc('PC Barra', null, {}, { etiquetera: true });
      const avisos = avisosFalso();
      const a = new PcImpresionAvisoService(prisma as any, {} as any, avisos as any);
      const b = new PcImpresionAvisoService(prisma as any, {} as any, avisos as any);
      const rs = await Promise.all([a.revisar(t20), b.revisar(t20), a.revisar(t20), b.revisar(t20)]);
      expect(rs.filter((r) => r.accion === 'enviado')).toHaveLength(1);
      expect(avisos.avisar).toHaveBeenCalledTimes(1);
    });

    it('reinicio del API pasada la hora (caja abierta desde antes): envía la revisión pendiente una sola vez', async () => {
      const f = dia();
      await cajaAbierta(f, '08:00');
      await pc('PC Barra', null, {}, { etiquetera: true });
      const tarde = lima(f, '11:30'); // el API estuvo caído y vuelve 3 h 30 después de abrir
      const avisos = avisosFalso();
      const tras = new PcImpresionAvisoService(prisma as any, {} as any, avisos as any);
      expect((await tras.revisar(tarde)).accion).toBe('enviado');
      const otroReinicio = new PcImpresionAvisoService(prisma as any, {} as any, avisos as any);
      expect((await otroReinicio.revisar(new Date(tarde.getTime() + MIN))).accion).toBe('aun_no');
      expect(avisos.avisar).toHaveBeenCalledTimes(1);
    });

    it('los parámetros cambian los minutos y el interruptor lo apaga', async () => {
      const f = dia();
      await cajaAbierta(f);
      await pc('PC Barra', null, {}, { etiquetera: true });
      await prisma.parametro.create({ data: { clave: 'aviso_pc_impresion_minutos_tras_abrir', valor: 30 } });
      const { svc, avisos } = servicio();
      expect(await svc.revisar(new Date(lima(f, '08:00').getTime() + 29 * MIN))).toEqual({ accion: 'aun_no' });
      await prisma.parametro.create({ data: { clave: 'aviso_pc_impresion_activo', valor: 'no' } });
      expect(await svc.revisar(new Date(lima(f, '08:00').getTime() + 31 * MIN))).toEqual({ accion: 'apagado' });
      expect(avisos.avisar).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------- chats sin responder
  describe('chat de WhatsApp sin responder', () => {
    const abierto = { abierta: true, motivo: 'OK', abre: '08:00', cierra: '22:00' };
    const servicio = (estado: any = abierto) => {
      const avisos = avisosFalso();
      const local = { obtenerEstadoCartaSeguro: jest.fn().mockResolvedValue(estado) };
      const config = { get: (c: string) => (c === 'DOMINIO_BASE' ? 'demo.prueba.test' : undefined) };
      return { avisos, svc: new ChatSinResponderAvisoService(prisma as any, {} as any, avisos as any, local as any, config as any) };
    };
    let t = 0;
    async function chat(opts: { en: Date; texto?: string; tipo?: string; nombre?: string | null; urgente?: boolean; estado?: string; telefono?: string; motivo?: string; atendidoEn?: Date; ultimo?: { autor: string; direccion: string; en: Date } }) {
      const telefono = opts.telefono ?? `9${String(10000000 + ++t).slice(-8)}`;
      const c = await prisma.conversacion.create({
        data: {
          telefono,
          urgente: opts.urgente ?? true,
          estado: opts.estado ?? 'ABIERTA',
          nombre_contacto: opts.nombre === undefined ? 'Cliente Prueba' : opts.nombre,
          motivo_derivacion: opts.motivo ?? null,
          atendido_en: opts.atendidoEn ?? null,
          ultima_actividad: opts.ultimo?.en ?? opts.en,
        },
      });
      await prisma.mensajeChat.create({
        data: { conversacion_id: c.id, direccion: 'ENTRA', autor: 'CLIENTE', tipo: opts.tipo ?? 'TEXTO', contenido: { texto: opts.texto ?? 'Hola, ¿siguen atendiendo?' }, en: opts.en },
      });
      if (opts.ultimo) {
        await prisma.mensajeChat.create({
          data: { conversacion_id: c.id, direccion: opts.ultimo.direccion, autor: opts.ultimo.autor, tipo: 'TEXTO', contenido: { texto: 'Respuesta' }, en: opts.ultimo.en },
        });
      }
      return c;
    }

    it('a los 14 min no avisa; a los 15 exactos sí, UN correo por chat y sin repetir', async () => {
      const f = dia();
      const msg = lima(f, '12:00');
      await chat({ en: msg, nombre: 'Lucía Prueba' });
      const { svc, avisos } = servicio();
      expect((await svc.revisar(new Date(msg.getTime() + 14 * MIN))).accion).toBe('nada');
      const r = await svc.revisar(new Date(msg.getTime() + 15 * MIN));
      expect(r).toMatchObject({ accion: 'ok', individuales: 1 });
      expect(avisos.avisar).toHaveBeenCalledTimes(1);
      const a = avisos.avisar.mock.calls[0][0];
      expect(a.tipo).toBe('CHAT_SIN_RESPONDER');
      expect(a.asunto).toBe('Chat de WhatsApp sin responder hace 15 min: Lucía Prueba');
      expect(a.texto).toContain('Último mensaje: "Hola, ¿siguen atendiendo?"');
      // sin repetir mientras siga igual
      expect((await svc.revisar(new Date(msg.getTime() + 40 * MIN))).individuales).toBe(0);
      expect(avisos.avisar).toHaveBeenCalledTimes(1);
    });

    it('enlace directo al chat y teléfono ENMASCARADO cuando no hay nombre; el mensaje se recorta a 120', async () => {
      const f = dia();
      const msg = lima(f, '12:00');
      await chat({ en: msg, nombre: null, telefono: '987654321', texto: 'x'.repeat(300) });
      const { svc, avisos } = servicio();
      await svc.revisar(new Date(msg.getTime() + 16 * MIN));
      const a = avisos.avisar.mock.calls[0][0];
      expect(a.asunto).toContain('*** *** 321');
      // el número completo solo viaja dentro del enlace que abre el chat (lo pide el aviso), nunca en el texto
      expect(a.asunto + a.texto.replace(/Abrir el chat: \S+/, '')).not.toContain('987654321');
      expect(a.texto).toContain('https://demo.prueba.test/admin/mensajes?telefono=987654321');
      const linea = a.texto.split('\n').find((l: string) => l.startsWith('Último mensaje'))!;
      expect(linea.length).toBeLessThanOrEqual('Último mensaje: ""'.length + 120);
      expect(linea).toContain('…');
    });

    it('un adjunto no se manda: solo «(envió una imagen)»', async () => {
      const f = dia();
      const msg = lima(f, '12:00');
      await chat({ en: msg, tipo: 'IMAGEN', texto: '[Imagen: https://secreto.prueba.test/foto.jpg]' });
      const { svc, avisos } = servicio();
      await svc.revisar(new Date(msg.getTime() + 20 * MIN));
      const a = avisos.avisar.mock.calls[0][0];
      expect(a.texto).toContain('(envió una imagen)');
      expect(a.texto).not.toContain('secreto');
    });

    it('no cuentan: respondido por persona o bot, ya atendido, bot normal, bloqueado por spam, archivado después', async () => {
      const f = dia();
      const msg = lima(f, '12:00');
      const despues = new Date(msg.getTime() + 5 * MIN);
      await chat({ en: msg, ultimo: { autor: 'PERSONA', direccion: 'SALE', en: despues } });
      await chat({ en: msg, ultimo: { autor: 'BOT', direccion: 'SALE', en: despues } });
      await chat({ en: msg, estado: 'ATENDIDA' });
      await chat({ en: msg, urgente: false });
      await chat({ en: msg, motivo: 'BLOQUEADO_SPAM' });
      await chat({ en: msg, atendidoEn: despues });
      const { svc, avisos } = servicio();
      expect((await svc.revisar(new Date(msg.getTime() + 30 * MIN))).accion).toBe('nada');
      expect(avisos.avisar).not.toHaveBeenCalled();
    });

    it('sí cuentan: «validar pago» y reabierto (el cliente escribió después de archivar)', async () => {
      const f = dia();
      const msg = lima(f, '12:00');
      await chat({ en: msg, urgente: false, estado: 'VALIDAR_PAGO', nombre: 'Pago Prueba' });
      await chat({ en: msg, atendidoEn: new Date(msg.getTime() - 60 * MIN), nombre: 'Reabierto Prueba' });
      const { svc, avisos } = servicio();
      const r = await svc.revisar(new Date(msg.getTime() + 15 * MIN));
      expect(r.individuales).toBe(2);
      expect(avisos.avisar).toHaveBeenCalledTimes(2);
    });

    it('fuera de horario no avisa', async () => {
      const f = dia();
      const msg = lima(f, '12:00');
      await chat({ en: msg });
      const { svc, avisos } = servicio({ abierta: false, motivo: 'HORARIO', abre: '08:00', cierra: '11:00' });
      expect((await svc.revisar(new Date(msg.getTime() + 30 * MIN))).accion).toBe('fuera_de_horario');
      expect(avisos.avisar).not.toHaveBeenCalled();
    });

    it('al abrir: UN correo agrupado con lo que ya esperaba desde antes; luego los nuevos van por separado', async () => {
      const f = dia();
      const aperturaLocal = lima(f, '08:00');
      await chat({ en: new Date(aperturaLocal.getTime() - 600 * MIN), nombre: 'Noche Uno' });
      await chat({ en: new Date(aperturaLocal.getTime() - 90 * MIN), nombre: 'Noche Dos' });
      const { svc, avisos } = servicio();
      const r = await svc.revisar(new Date(aperturaLocal.getTime() + MIN));
      expect(r).toMatchObject({ agrupadoApertura: 2, individuales: 0 });
      expect(avisos.avisar).toHaveBeenCalledTimes(1);
      expect(avisos.avisar.mock.calls[0][0].asunto).toBe('2 chats de WhatsApp esperan respuesta desde antes de abrir');
      // un chat que llega ya abierto sigue la regla normal de 15 min
      const nuevo = new Date(aperturaLocal.getTime() + 30 * MIN);
      await chat({ en: nuevo, nombre: 'Mañana Tres' });
      const r2 = await svc.revisar(new Date(nuevo.getTime() + 15 * MIN));
      expect(r2).toMatchObject({ agrupadoApertura: 0, individuales: 1 });
      expect(avisos.avisar).toHaveBeenCalledTimes(2);
    });

    it('tope por hora: pasados 10 individuales, el resto va en UN correo resumen', async () => {
      const f = dia();
      const msg = lima(f, '12:00');
      for (let i = 0; i < CHAT_TOPE_POR_HORA + 3; i++) await chat({ en: new Date(msg.getTime() + i * 1000), nombre: `Cliente ${i}` });
      const { svc, avisos } = servicio();
      const r = await svc.revisar(new Date(msg.getTime() + 16 * MIN));
      expect(r).toMatchObject({ individuales: CHAT_TOPE_POR_HORA, resumen: 3 });
      expect(avisos.avisar).toHaveBeenCalledTimes(CHAT_TOPE_POR_HORA + 1);
      expect(avisos.avisar.mock.calls[CHAT_TOPE_POR_HORA][0].asunto).toBe('3 chats de WhatsApp esperan respuesta');
      // los del resumen no se vuelven a avisar uno por uno
      const r2 = await svc.revisar(new Date(msg.getTime() + 17 * MIN));
      expect(r2.accion).toBe('nada');
    });

    it('máximo 1 correo por chat cada 6 horas aunque el cliente vuelva a escribir sin respuesta', async () => {
      const f = dia();
      const msg = lima(f, '10:00');
      const c = await chat({ en: msg });
      const { svc, avisos } = servicio();
      await svc.revisar(new Date(msg.getTime() + 15 * MIN));
      const otro = new Date(msg.getTime() + 60 * MIN);
      await prisma.mensajeChat.create({ data: { conversacion_id: c.id, direccion: 'ENTRA', autor: 'CLIENTE', tipo: 'TEXTO', contenido: { texto: '¿Hola?' }, en: otro } });
      await prisma.conversacion.update({ where: { id: c.id }, data: { ultima_actividad: otro } });
      expect((await svc.revisar(new Date(otro.getTime() + 20 * MIN))).accion).toBe('nada');
      expect(avisos.avisar).toHaveBeenCalledTimes(1);
      // pasadas 6 horas, con un mensaje nuevo sin responder, vuelve a avisar
      const tarde = new Date(msg.getTime() + 7 * 3600_000);
      await prisma.mensajeChat.create({ data: { conversacion_id: c.id, direccion: 'ENTRA', autor: 'CLIENTE', tipo: 'TEXTO', contenido: { texto: '¿Alguien?' }, en: tarde } });
      expect((await svc.revisar(new Date(tarde.getTime() + 15 * MIN))).individuales).toBe(1);
      expect(avisos.avisar).toHaveBeenCalledTimes(2);
    });

    it('dos instancias a la vez: un solo correo por chat', async () => {
      const f = dia();
      const msg = lima(f, '12:00');
      await chat({ en: msg });
      const a = servicio();
      const b = servicio();
      const ahora = new Date(msg.getTime() + 20 * MIN);
      await Promise.all([a.svc.revisar(ahora), b.svc.revisar(ahora)]);
      expect(a.avisos.avisar.mock.calls.length + b.avisos.avisar.mock.calls.length).toBe(1);
    });

    it('la consulta usa el índice parcial de la migración', async () => {
      const filas = await prisma.$queryRawUnsafe<any[]>(`SELECT indexdef FROM pg_indexes WHERE indexname = 'conversacion_espera_humana_idx'`);
      expect(filas[0].indexdef).toContain('WHERE');
    });
  });
});
