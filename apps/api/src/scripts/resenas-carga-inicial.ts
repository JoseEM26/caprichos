/**
 * Carga inicial de las reseñas de Google desde la consola del servidor, sin sesión de admin.
 * Busca el local, guarda el negocio (si es uno solo que coincide) y ejecuta la carga inicial.
 * La auditoría queda como «sistema» (sin persona). Nunca imprime la clave de la API.
 *
 * Dentro del contenedor de la API (servicio `api` del compose, carpeta /app/apps/api):
 *   node dist/scripts/resenas-carga-inicial.js --buscar "Caprichos Campoy"
 *   node dist/scripts/resenas-carga-inicial.js --buscar "Caprichos Campoy" --business-id <id>
 *   node dist/scripts/resenas-carga-inicial.js --buscar "Caprichos Campoy" --repetir
 *
 * Códigos de salida: 0 carga hecha; 1 error o carga detenida; 2 no se guardó nada, hay que elegir con --business-id.
 */
import { ConflictException, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validarEntorno } from '../config/entorno.validacion';
import { PrismaService } from '../comun/prisma/prisma.service';
import { RedisService } from '../comun/redis/redis.service';
import { AuditoriaService } from '../modulos/auditoria/auditoria.service';
import { ResenasGoogleService } from '../modulos/resenas/resenas-google.service';

export interface OpcionesCarga {
  buscar?: string;
  businessId?: string;
  repetir: boolean;
}

/** Lo que el comando usa del servicio de reseñas (en pruebas se simula, nunca se llama a la API real). */
export type ServicioResenas = Pick<ResenasGoogleService, 'buscarNegocio' | 'guardarNegocio' | 'cargaInicial' | 'estado'>;

export function leerOpciones(argv: string[]): OpcionesCarga {
  const val = (k: string): string | undefined => {
    const i = argv.indexOf(`--${k}`);
    if (i >= 0) return argv[i + 1];
    return argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  };
  return {
    buscar: val('buscar')?.trim() || undefined,
    businessId: val('business-id')?.trim() || undefined,
    repetir: argv.includes('--repetir'),
  };
}

const USO = 'Uso: node dist/scripts/resenas-carga-inicial.js --buscar "<nombre del local>" [--business-id <id>] [--repetir]';

/** Corre el comando. Devuelve el código de salida; no imprime nada que no sea el resumen. */
export async function ejecutarCargaInicial(
  op: OpcionesCarga,
  servicio: ServicioResenas,
  salida: (linea: string) => void = console.log,
): Promise<number> {
  if (!op.buscar) {
    salida(USO);
    return 1;
  }

  const busqueda = await servicio.buscarNegocio(op.buscar);
  if (!busqueda.ok) {
    salida(`No se pudo buscar el local: ${busqueda.mensaje}`);
    return 1;
  }
  const candidatos = busqueda.candidatos;
  if (candidatos.length === 0) {
    salida(`Google no devolvió ningún local para «${op.buscar}». No se guardó nada. Prueba con otro texto.`);
    return 2;
  }

  salida(`Candidatos para «${op.buscar}»:`);
  for (const c of candidatos) {
    salida(`  ${c.nombre} | ${c.direccion ?? 'sin dirección'} | ${c.rating ?? '-'} estrellas | ${c.total ?? '-'} reseñas | business_id: ${c.businessId}`);
  }

  let elegido: any;
  if (op.businessId) {
    elegido = candidatos.find((c: any) => c.businessId === op.businessId);
    if (!elegido) {
      salida(`El business_id ${op.businessId} no está entre los candidatos. No se guardó nada.`);
      return 2;
    }
  } else {
    const texto = op.buscar.toLowerCase();
    const coinciden = candidatos.filter((c: any) => c.nombre.toLowerCase().includes(texto));
    if (coinciden.length !== 1) {
      const motivo = coinciden.length === 0 ? 'Ninguno tiene ese nombre' : `Hay ${coinciden.length} con ese nombre`;
      salida(`${motivo}. No se guardó nada. Vuelve a correr con --business-id <id> eligiendo uno de la lista.`);
      return 2;
    }
    elegido = coinciden[0];
  }

  try {
    await servicio.guardarNegocio(
      elegido.businessId,
      elegido.nombre,
      undefined,
      undefined,
      elegido.rating ?? undefined,
      elegido.total ?? undefined,
      elegido.enlaceLocal ?? undefined,
    );
  } catch (err) {
    if (err instanceof ConflictException) {
      salida(String((err.getResponse() as any)?.mensaje ?? 'El local ya está configurado.'));
      return 1;
    }
    throw err;
  }
  salida(`Local guardado: ${elegido.nombre} (business_id ${elegido.businessId}).`);

  const carga = await servicio.cargaInicial({ repetir: op.repetir });
  const { consumo, tope } = await servicio.estado();
  salida(
    `Páginas: ${carga.paginas ?? 0} · Recibidas: ${carga.recibidas ?? 0} · Guardadas: ${carga.guardadas ?? 0} · ` +
      `Nuevas: ${carga.nuevas ?? 0} · Consumo del mes: ${consumo} de ${tope}`,
  );
  if (!carga.ok) {
    salida(`La carga se detuvo: ${carga.mensaje ?? carga.motivo}`);
    return 1;
  }
  return 0;
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno })],
  providers: [PrismaService, RedisService, AuditoriaService, ResenasGoogleService],
})
class ModuloConsolaResenas {}

async function main(argv: string[]): Promise<number> {
  const op = leerOpciones(argv);
  if (!op.buscar) {
    console.log(USO);
    return 1;
  }
  // Solo lo que hace falta: sin AppModule, para no arrancar tareas programadas ni WhatsApp desde la consola
  const app = await NestFactory.createApplicationContext(ModuloConsolaResenas, { logger: ['error', 'warn'] });
  try {
    return await ejecutarCargaInicial(op, app.get(ResenasGoogleService));
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((codigo) => process.exit(codigo))
    .catch((e) => {
      console.error(`ABORTADO: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    });
}
