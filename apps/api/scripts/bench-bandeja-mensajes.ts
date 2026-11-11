/**
 * Benchmark de la bandeja de WhatsApp (listar + detalle de una conversación) contra un Postgres DESECHABLE.
 * Datos 100 % inventados. Uso (nunca contra producción; el script se niega si la URL no es local):
 *   DATABASE_URL=<url del Postgres local desechable> ./node_modules/.bin/ts-node --transpile-only scripts/bench-bandeja-mensajes.ts [convs=250] [mensajes=30000] [--sembrar]
 * Imprime ms de listar() y detalle() (chat mediano y chat más largo) y cuántas consultas SQL hizo cada uno.
 */
import { PrismaClient } from '@prisma/client';
import { MensajesService } from '../src/modulos/mensajes/mensajes.service';
import { NumerosWhatsappService } from '../src/modulos/chatbot/servicios/numeros-whatsapp.service';
import { Ventana24hService } from '../src/modulos/chatbot/servicios/ventana-24h.service';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const CONVS = Number(args[0] ?? 250);
const MENSAJES = Number(args[1] ?? 30000);
const sembrar = process.argv.includes('--sembrar');

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
    `${nombre.padEnd(36)} mediana ${tiempos[Math.floor(veces / 2)].toFixed(1)} ms · min ${tiempos[0].toFixed(1)} · max ${tiempos[veces - 1].toFixed(1)} · ${q} consultas SQL`,
  );
}

async function main() {
  if (sembrar) await sembrarDatos();
  const filas = await prisma.$queryRawUnsafe<{ c: bigint; m: bigint }[]>(
    'SELECT (SELECT count(*) FROM conversacion) c, (SELECT count(*) FROM mensaje_chat) m',
  );
  console.log(`Datos: ${filas[0].c} conversaciones, ${filas[0].m} mensajes`);
  const auditoria: any = { registrar: async () => undefined };
  const gateway: any = { estaConectado: () => ({ modo: 'meta' }) };
  const ventana = new Ventana24hService(prisma as any, gateway);
  const crear = () =>
    new MensajesService(prisma as any, auditoria, gateway, undefined, ventana, undefined, undefined, undefined, undefined, new NumerosWhatsappService(prisma as any, auditoria));
  const svc = crear();
  const usuario: any = { partyId: 1n, rol: 'ADMIN', debeCambiar: false, roles: ['ADMIN'] };
  await medir('listar() bandeja completa', () => svc.listar('todos', ''));
  // caché de números (TTL 30 s) fría: lo que pasa una vez cada 30 s en producción
  await medir('listar() con caché de números fría', () => crear().listar('todos', ''));
  await medir('detalle() chat mediano (id 7)', () => svc.detalle('7', usuario));
  await medir('detalle() chat más largo (id 1)', () => svc.detalle('1', usuario));
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
