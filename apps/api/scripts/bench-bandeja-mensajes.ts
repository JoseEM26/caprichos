/**
 * Benchmark de la bandeja de WhatsApp (lista, detalle y ENVÍO) contra un Postgres DESECHABLE.
 * Datos 100 % inventados. Uso (nunca contra producción; el script se niega si la URL no es local):
 *   DATABASE_URL=<url del Postgres local desechable> ./node_modules/.bin/ts-node --transpile-only scripts/bench-bandeja-mensajes.ts [convs=250] [mensajes=30000] [--sembrar] [--antes]
 * Imprime ms de listar() y detalle() (chat mediano y chat más largo) y cuántas consultas SQL hizo cada uno.
 * Además mide el ENVÍO con un Meta simulado LENTO (2 s): `enviar` síncrono (como era) contra encolado (responde YA), la lista
 * paginada (primera página, página 2, solo contadores, una fila) y comprueba que el trabajador envía UNA sola vez aunque
 * se dispare varias veces y que un reinicio a mitad de envío no reenvía.
 * `--antes`: usa el servicio de la rama anterior (copia temporal src/modulos/mensajes/mensajes.service.antes.ts, sin versionar):
 *   git show lote127:apps/api/src/modulos/mensajes/mensajes.service.ts > src/modulos/mensajes/mensajes.service.antes.ts
 */
import { PrismaClient } from '@prisma/client';
import { NumerosWhatsappService } from '../src/modulos/chatbot/servicios/numeros-whatsapp.service';
import { Ventana24hService } from '../src/modulos/chatbot/servicios/ventana-24h.service';
import { EnvioEncoladoService } from '../src/modulos/mensajes/envio-encolado.service';

const ANTES = process.argv.includes('--antes');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MensajesService } = require(ANTES ? '../src/modulos/mensajes/mensajes.service.antes' : '../src/modulos/mensajes/mensajes.service');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const CONVS = Number(args[0] ?? 250);
const MENSAJES = Number(args[1] ?? 30000);
const sembrar = process.argv.includes('--sembrar');
const META_LENTO_MS = 2000;

if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? '')) throw new Error('Solo contra una base local desechable');

const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
let consultas = 0;
(prisma as any).$on('query', () => consultas++);

async function sembrarDatos() {
  await prisma.$executeRawUnsafe('TRUNCATE mensaje_chat, whatsapp_mensaje, conversacion RESTART IDENTITY CASCADE');
  await prisma.$executeRawUnsafe(
    `INSERT INTO conversacion (telefono, nombre_contacto, ultima_actividad, estado, duenio)
     SELECT '519' || lpad(g::text, 8, '0'), 'Cliente ' || g, now() - (g || ' minutes')::interval, 'ABIERTA', 'BOT'
     FROM generate_series(1, ${CONVS}) g`,
  );
  // el chat 1 concentra el 10 % de los mensajes (el «más largo»); el resto se reparte parejo
  await prisma.$executeRawUnsafe(
    `INSERT INTO whatsapp_mensaje (direccion, wa_message_id, telefono_enmascarado, telefono_hash, tipo, estado, conversacion_id, creado_en)
     SELECT CASE WHEN g % 2 = 0 THEN 'ENTRANTE' ELSE 'SALIENTE' END, 'wamid.' || g, '519***' || (g % 1000), md5(c::text), 'TEXTO', 'ENTREGADO', c,
            now() - ((${MENSAJES} - g) || ' seconds')::interval
     FROM (SELECT g, CASE WHEN g % 10 = 0 THEN 1 ELSE 1 + (g % ${CONVS}) END AS c FROM generate_series(1, ${MENSAJES}) g) t`,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO mensaje_chat (conversacion_id, direccion, autor, tipo, contenido, meta_id, whatsapp_mensaje_id, en)
     SELECT w.conversacion_id, CASE WHEN w.direccion = 'ENTRANTE' THEN 'ENTRA' ELSE 'SALE' END,
            CASE WHEN w.direccion = 'ENTRANTE' THEN 'CLIENTE' WHEN w.id % 3 = 0 THEN 'BOT' ELSE 'PERSONA' END,
            CASE WHEN w.id % 40 = 0 THEN 'IMAGEN' WHEN w.id % 53 = 0 THEN 'AUDIO' WHEN w.id % 67 = 0 THEN 'DOCUMENTO' ELSE 'TEXTO' END,
            jsonb_build_object('texto', 'Mensaje inventado ' || w.id, 'archivoId', w.id::text),
            w.wa_message_id, w.id, w.creado_en
     FROM whatsapp_mensaje w`,
  );
  await prisma.$executeRawUnsafe('ANALYZE');
}

async function medir<T>(nombre: string, fn: () => Promise<T>, veces = 5) {
  await fn(); // calentar
  const tiempos: number[] = [];
  let q = 0;
  for (let i = 0; i < veces; i++) {
    consultas = 0;
    const t = process.hrtime.bigint();
    await fn();
    tiempos.push(Number(process.hrtime.bigint() - t) / 1e6);
    q = consultas;
  }
  tiempos.sort((a, b) => a - b);
  console.log(
    `${nombre.padEnd(46)} mediana ${tiempos[Math.floor(veces / 2)].toFixed(1)} ms · min ${tiempos[0].toFixed(1)} · max ${tiempos[veces - 1].toFixed(1)} · ${q} consultas SQL`,
  );
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Envío con Meta simulado lento. Devuelve cuánto tardó `enviar` en responder y cuánto en quedar ENVIADO en la BD. */
async function medirEnvio(crear: (gateway: any, cola?: EnvioEncoladoService) => any, usuario: any) {
  let llamadasMeta = 0;
  const gateway: any = {
    estaConectado: () => ({ modo: 'meta' }),
    // Meta lento: 2 s por mensaje
    transmitirTexto: async () => {
      llamadasMeta++;
      await dormir(META_LENTO_MS);
      return { id: '', estado: 'ENVIADO', metaId: `wamid.bench${llamadasMeta}`, whatsappMensajeId: null };
    },
    enviarTexto: async (conversacionId: bigint, _t: string, texto: string, autor: string, idCliente?: string) => {
      llamadasMeta++;
      await dormir(META_LENTO_MS);
      const m = await prisma.mensajeChat.create({
        data: { conversacion_id: conversacionId, direccion: 'SALE', autor, tipo: 'TEXTO', contenido: { texto, ...(idCliente ? { idCliente } : {}), estado: 'ENVIADO' }, meta_id: `wamid.bench${llamadasMeta}` },
      });
      return { id: m.id.toString(), estado: 'ENVIADO', metaId: `wamid.bench${llamadasMeta}`, en: m.en, autor, texto };
    },
  };
  const auditoria: any = { registrar: async () => undefined };
  const cola = ANTES ? undefined : new EnvioEncoladoService(prisma as any, auditoria, gateway, undefined);
  const svc = crear(gateway, cola);
  const respuestas: number[] = [];
  const hastaEnviado: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t = process.hrtime.bigint();
    const r = await svc.enviar('7', `Mensaje inventado de prueba ${i}`, usuario, undefined, `tmp-bench-${Date.now()}-${i}`);
    respuestas.push(Number(process.hrtime.bigint() - t) / 1e6);
    if (cola) {
      // espera a que el trabajador termine (solo para medir el total; la respuesta ya salió)
      for (let k = 0; k < 60; k++) {
        const [fila] = await prisma.$queryRawUnsafe<any[]>(`SELECT contenido->>'estado' e FROM mensaje_chat WHERE id = ${r.id}`);
        if (fila?.e === 'ENVIADO') break;
        await dormir(50);
      }
      hastaEnviado.push(Number(process.hrtime.bigint() - t) / 1e6);
    }
  }
  respuestas.sort((a, b) => a - b);
  const mediana = (l: number[]) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)].toFixed(1);
  console.log(`enviar() con Meta de ${META_LENTO_MS} ms (${ANTES ? 'ANTES: síncrono' : 'AHORA: encolado'}): responde en mediana ${mediana(respuestas)} ms (min ${respuestas[0].toFixed(1)}, max ${respuestas[2].toFixed(1)})`);
  if (cola) console.log(`   ...y el mensaje queda ENVIADO en la BD a los ${mediana(hastaEnviado)} ms; llamadas a Meta: ${llamadasMeta} de 3 envíos`);
  return { cola, gateway, llamadas: () => llamadasMeta };
}

async function main() {
  if (sembrar) await sembrarDatos();
  const filas = await prisma.$queryRawUnsafe<{ c: bigint; m: bigint }[]>(
    'SELECT (SELECT count(*) FROM conversacion) c, (SELECT count(*) FROM mensaje_chat) m',
  );
  console.log(`Datos: ${filas[0].c} conversaciones, ${filas[0].m} mensajes · código: ${ANTES ? 'ANTES (lote127)' : 'AHORA (envío encolado + lista paginada)'}`);
  const auditoria: any = { registrar: async () => undefined };
  const gateway: any = { estaConectado: () => ({ modo: 'meta' }) };
  const ventana = new Ventana24hService(prisma as any, gateway);
  const crear = () =>
    new MensajesService(prisma as any, auditoria, gateway, undefined, ventana, undefined, undefined, undefined, undefined, new NumerosWhatsappService(prisma as any, auditoria));
  const svc = crear();
  const usuario: any = { partyId: 1n, rol: 'ADMIN', debeCambiar: false, roles: ['ADMIN'] };
  await medir('listar() bandeja (1.ª página en AHORA)', () => svc.listar('todos', ''));
  // caché de números (TTL 30 s) fría: lo que pasa una vez cada 30 s en producción
  await medir('listar() con caché de números fría', () => crear().listar('todos', ''));
  if (!ANTES) {
    const p1 = await svc.listar('todos', '');
    await medir('listar() página 2 (con cursor)', () => svc.listar('todos', '', undefined, { cursor: p1.siguienteCursor }));
    await medir('listar() pestaña «Por atender» 1.ª página', () => svc.listar('atender', ''));
    await medir('listar() búsqueda en el servidor («Cliente 12»)', () => svc.listar('todos', 'Cliente 12'));
    await medir('conteos() solo contadores', () => svc.conteos());
    await medir('fila(id) una fila en vivo', () => svc.fila('7', 'todos'));
    console.log(`   primera página: ${p1.chats.length} chats, hayMas=${p1.hayMas}, conteos=${JSON.stringify(p1.conteos)}`);
  }
  await medir('detalle() chat mediano (id 7)', () => svc.detalle('7', usuario));
  await medir('detalle() chat más largo (id 1)', () => svc.detalle('1', usuario));

  // --- Envío con Meta lento ---
  const { cola, llamadas } = await medirEnvio(
    (gw, c) => new MensajesService(prisma as any, auditoria, gw, undefined, ventana, undefined, undefined, undefined, undefined, undefined, c),
    usuario,
  );
  if (cola) {
    // Una sola vez: el mismo mensaje disparado 5 veces a la vez habla con Meta una vez
    const m = await prisma.mensajeChat.create({ data: { conversacion_id: 7n, direccion: 'SALE', autor: 'PERSONA', tipo: 'TEXTO', contenido: { texto: 'Mensaje inventado concurrente', estado: 'ENCOLADO', intentos: 0 } } });
    const antes = llamadas();
    await Promise.all([1, 2, 3, 4, 5].map(() => cola.procesar(m.id)));
    console.log(`reclamo atómico: 5 disparos simultáneos del mismo mensaje → ${llamadas() - antes} llamada(s) a Meta (debe ser 1)`);
    // Reinicio a mitad de envío: un ENVIANDO viejo sin rastro de Meta queda REVISAR y NO se reenvía
    const h = await prisma.mensajeChat.create({ data: { conversacion_id: 7n, direccion: 'SALE', autor: 'PERSONA', tipo: 'TEXTO', contenido: { texto: 'Mensaje inventado huérfano', estado: 'ENVIANDO', intentos: 1, inicioEnvio: Date.now() - 10 * 60_000 } } });
    const antes2 = llamadas();
    consultas = 0;
    const t = process.hrtime.bigint();
    await cola.barrer();
    const ms = Number(process.hrtime.bigint() - t) / 1e6;
    const [fh] = await prisma.$queryRawUnsafe<any[]>(`SELECT contenido->>'estado' e FROM mensaje_chat WHERE id = ${h.id}`);
    console.log(`barrido tras reinicio (${consultas} consultas, ${ms.toFixed(1)} ms): huérfano → ${fh.e} (debe ser REVISAR); llamadas a Meta nuevas: ${llamadas() - antes2} (debe ser 0)`);
    const plan = await prisma.$queryRawUnsafe<any[]>(
      `EXPLAIN SELECT id, conversacion_id, contenido FROM mensaje_chat WHERE direccion = 'SALE' AND (contenido->>'estado') IN ('ENCOLADO', 'ENVIANDO') ORDER BY id LIMIT 100`,
    );
    console.log(`plan del barrido: ${plan.map((p) => p['QUERY PLAN']).join(' | ')}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
