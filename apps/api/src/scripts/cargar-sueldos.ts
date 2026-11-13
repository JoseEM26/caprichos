/**
 * Carga de sueldos del personal YA existente desde la consola del servidor, sin sesión de admin.
 * (importar-personal no sirve para esto: omite a quien ya tiene cuenta.) Nunca crea usuarios.
 *
 * Entrada (una de las dos): --archivo <ruta.csv>  o  --desde-env SUELDOS_CSV_B64 (CSV en base64 dentro de esa variable).
 * Columnas: documento (clave de cruce), sueldo_mensual. Opcionales: dias_mes, horas_dia, pago_celular, pago_medio.
 *           tipo_documento y acuerdo_laboral se aceptan pero se ignoran (el acuerdo vive en el vínculo laboral, que
 *           importar-personal solo crea al dar de alta; aquí no se toca).
 * Por persona: sueldo MENSUAL; el semanal sale de sueldoEquivalente (la misma fórmula de la planilla); método de valor
 * hora DIAS_HORAS en altas nuevas (en cambios conserva el que tenga, salvo que el CSV traiga dias_mes/horas_dia).
 *
 * Por defecto es SIMULACRO: no escribe nada. Una línea por fila con número de línea, resultado y NOMBRE DE PILA;
 * nunca imprime documentos, celulares ni montos. Con --aplicar escribe una transacción por fila (sueldo + auditoría
 * CARGAR_SUELDOS como sistema). Idempotente: repetirlo da «sin cambio». Nunca borra filas de sueldo.
 *
 * Dentro del contenedor de la API (carpeta /app/apps/api):
 *   node dist/scripts/cargar-sueldos.js --archivo /ruta/sueldos.csv [--aplicar]
 *   node dist/scripts/cargar-sueldos.js --desde-env SUELDOS_CSV_B64 [--aplicar]
 *
 * Códigos de salida: 0 corrió; 1 no se pudo leer el archivo o falta el encabezado.
 */
import * as fs from 'fs';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validarEntorno } from '../config/entorno.validacion';
import { PrismaService } from '../comun/prisma/prisma.service';
import { AuditoriaService } from '../modulos/auditoria/auditoria.service';
import { TIPOS_DOCUMENTO, documentoValido } from '../modulos/acceso/roles-usuario';
import { sueldoEquivalente } from '../modulos/asistencia/planilla.calculo';
import { MEDIOS_PAGO } from '../modulos/asistencia/planilla.service';
import { aMonto, leerOpciones, parsearCsv, textoDesdeEnv } from './importar-personal';

export { leerOpciones, textoDesdeEnv };

const USO = 'Uso: node dist/scripts/cargar-sueldos.js (--archivo <ruta.csv> | --desde-env SUELDOS_CSV_B64) [--aplicar]';

type Metodo = 'DIAS_HORAS' | 'TARIFA_HORA' | 'PROGRAMADAS';
interface Pedido {
  linea: number;
  documento: string;
  sueldo: number | null;
  diasMes?: number;
  horasDia?: number;
  pagoCelular?: string;
  pagoMedio?: string;
  error?: string;
}

const normalizarDoc = (v: string) => v.replace(/[\s.\-]/g, '').toUpperCase();

/** CSV -> pedidos validados (un error de formato queda en la fila, no aborta el archivo). */
export function pedidosDesdeCsv(texto: string): { pedidos: Pedido[]; error?: string } {
  const [cabecera, ...datos] = parsearCsv(texto);
  if (!cabecera) return { pedidos: [], error: 'El archivo está vacío.' };
  const claves = cabecera.map((c) => c.trim().toLowerCase());
  const faltan = ['documento', 'sueldo_mensual'].filter((c) => !claves.includes(c));
  if (faltan.length) return { pedidos: [], error: `Faltan columnas en el encabezado: ${faltan.join(', ')}.` };
  const pedidos = datos.map((campos, i): Pedido => {
    const r: Record<string, string> = {};
    claves.forEach((k, j) => (r[k] = (campos[j] ?? '').trim()));
    const p: Pedido = { linea: i + 2, documento: normalizarDoc(r.documento ?? ''), sueldo: null };
    if (r.sueldo_mensual) {
      p.sueldo = aMonto(r.sueldo_mensual);
      if (p.sueldo === null) return { ...p, error: 'sueldo_mensual debe ser un monto' };
    }
    if (r.dias_mes) {
      const d = Number(r.dias_mes);
      if (!Number.isInteger(d) || d < 1 || d > 31) return { ...p, error: 'dias_mes debe ser un entero de 1 a 31' };
      p.diasMes = d;
    }
    if (r.horas_dia) {
      const h = aMonto(r.horas_dia);
      if (h === null || h <= 0 || h > 24) return { ...p, error: 'horas_dia debe estar entre 0 y 24' };
      p.horasDia = Math.round(h * 10) / 10;
    }
    if (r.pago_celular) p.pagoCelular = r.pago_celular.replace(/[^\d+]/g, '');
    if (r.pago_medio) {
      p.pagoMedio = r.pago_medio.toUpperCase();
      if (!(MEDIOS_PAGO as readonly string[]).includes(p.pagoMedio)) return { ...p, error: 'pago_medio no válido' };
    }
    return p;
  });
  return { pedidos };
}

/** Lo que el comando usa de Prisma y de la auditoría (en pruebas se simula). */
export interface DepsSueldos {
  prisma: any;
  auditoria: { registrar: (r: any, db?: any) => Promise<void> };
}

type Resultado = 'CREAR' | 'CAMBIAR' | 'SIN_CAMBIO' | 'SIN_USUARIO' | 'OMITIDA' | 'ERROR';

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Decide qué escribiría la fila y, con aplicar, lo escribe en su propia transacción. */
async function procesar(p: Pedido, aplicar: boolean, { prisma, auditoria }: DepsSueldos): Promise<{ r: Resultado; nombre?: string; motivo?: string }> {
  if (p.error) return { r: 'ERROR', motivo: p.error };
  if (!p.sueldo) return { r: 'OMITIDA', motivo: 'sin sueldo: se omite' };
  if (!p.documento) return { r: 'ERROR', motivo: 'falta el documento' };
  // DNI (8 dígitos) cabe en la regla de los demás tipos (7 a 12 letras o números)
  if (!documentoValido('CE', p.documento)) return { r: 'ERROR', motivo: 'documento con formato no válido' };

  const buscar = (numero: string) => prisma.partyIdentifier.findFirst({ where: { numero, tipo: { in: [...TIPOS_DOCUMENTO] } }, select: { party_id: true } });
  // Excel guarda los DNI como número y se come el cero inicial: 7 dígitos que no existen se reintentan con el cero
  const ident = (await buscar(p.documento)) ?? (/^\d{7}$/.test(p.documento) ? await buscar(`0${p.documento}`) : null);
  const cuenta = ident ? await prisma.userAccount.findUnique({ where: { party_id: ident.party_id }, include: { party: { include: { persona: true } } } }) : null;
  if (!cuenta) return { r: 'SIN_USUARIO' };
  const nombre = String(cuenta.party?.persona?.nombres ?? '').split(/\s+/)[0] || 'sin nombre';
  if (cuenta.rol === 'ADMIN') return { r: 'ERROR', nombre, motivo: 'el administrador no lleva planilla' };

  const partyId: bigint = cuenta.party_id;
  const antes = await prisma.sueldoPersonal.findUnique({ where: { party_id: partyId } });
  const eq = sueldoEquivalente('MENSUAL', p.sueldo);
  const metodo: Metodo = p.diasMes !== undefined || p.horasDia !== undefined ? 'DIAS_HORAS' : ((antes?.metodo_valor_hora as Metodo | undefined) ?? 'DIAS_HORAS');
  const datos: Record<string, unknown> = { modalidad: 'MENSUAL', monto_semanal: eq.semanal, monto_mensual: eq.mensual, metodo_valor_hora: metodo };
  if (p.diasMes !== undefined) datos.dias_mes = p.diasMes;
  if (p.horasDia !== undefined) datos.horas_dia = p.horasDia;
  if (p.pagoCelular !== undefined) datos.pago_celular = p.pagoCelular || null;
  if (p.pagoMedio !== undefined) datos.pago_medio = p.pagoMedio;

  const igual = antes && Object.entries(datos).every(([k, v]) => (typeof v === 'number' ? num((antes as any)[k]) === v : (antes as any)[k] === v));
  if (igual) return { r: 'SIN_CAMBIO', nombre };
  const r: Resultado = antes ? 'CAMBIAR' : 'CREAR';
  if (!aplicar) return { r, nombre };

  try {
    await prisma.$transaction(async (tx: any) => {
      await tx.sueldoPersonal.upsert({
        where: { party_id: partyId },
        create: { party_id: partyId, ...datos, actualizado_en: new Date(), actualizado_por: null },
        update: { ...datos, actualizado_en: new Date(), actualizado_por: null },
      });
      // Como en la planilla: el celular de pago es dato personal, la auditoría solo dice si cambió.
      await auditoria.registrar(
        {
          categoria: 'CAMBIO',
          modulo: 'planilla',
          accion: 'CARGAR_SUELDOS',
          resultado: 'OK',
          entidad: 'party',
          entidadId: Number(partyId),
          antes: antes ? { modalidad: antes.modalidad, semanal: num(antes.monto_semanal), mensual: num(antes.monto_mensual), metodo: antes.metodo_valor_hora } : null,
          despues: { modalidad: 'MENSUAL', ...eq, metodo, diasMes: p.diasMes ?? null, horasDia: p.horasDia ?? null, pagoMedio: p.pagoMedio ?? null, cambioCelular: p.pagoCelular !== undefined },
        },
        tx,
      );
    });
  } catch {
    return { r: 'ERROR', nombre, motivo: 'no se pudo guardar (se deshizo esta fila)' };
  }
  return { r, nombre };
}

/** Corre la carga. Una línea por fila (línea, resultado, nombre de pila); nunca documento, celular ni monto. */
export async function ejecutarCarga(texto: string, aplicar: boolean, deps: DepsSueldos, salida: (l: string) => void = console.log): Promise<number> {
  const { pedidos, error } = pedidosDesdeCsv(texto);
  if (error) {
    salida(error);
    return 1;
  }
  const etiqueta: Record<Resultado, string> = aplicar
    ? { CREAR: 'creado', CAMBIAR: 'cambiado', SIN_CAMBIO: 'sin cambio', SIN_USUARIO: 'sin usuario', OMITIDA: 'omitida', ERROR: 'error' }
    : { CREAR: 'crearía', CAMBIAR: 'cambiaría', SIN_CAMBIO: 'sin cambio', SIN_USUARIO: 'sin usuario', OMITIDA: 'omitida', ERROR: 'error' };
  const cuenta: Record<Resultado, number> = { CREAR: 0, CAMBIAR: 0, SIN_CAMBIO: 0, SIN_USUARIO: 0, OMITIDA: 0, ERROR: 0 };
  const vistos = new Set<string>();
  salida(aplicar ? 'APLICADO: se escriben las filas «creado» y «cambiado».' : 'SIMULACRO: no se escribe nada.');
  for (const p of pedidos) {
    let res: { r: Resultado; nombre?: string; motivo?: string };
    if (p.documento && p.sueldo && vistos.has(p.documento)) res = { r: 'ERROR', motivo: 'documento repetido en el archivo' };
    else {
      if (p.documento && p.sueldo) vistos.add(p.documento); // una fila sin sueldo no bloquea a la repetida con sueldo
      res = await procesar(p, aplicar, deps);
    }
    cuenta[res.r]++;
    salida(`fila ${p.linea}: ${etiqueta[res.r]}${res.motivo ? ` (${res.motivo})` : ''}${res.nombre ? ` — ${res.nombre}` : ''}`);
  }
  salida(
    `Resumen: ${etiqueta.CREAR} ${cuenta.CREAR} · ${etiqueta.CAMBIAR} ${cuenta.CAMBIAR} · sin cambio ${cuenta.SIN_CAMBIO} · sin usuario ${cuenta.SIN_USUARIO} · omitidas ${cuenta.OMITIDA} · error ${cuenta.ERROR}`,
  );
  return 0;
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno })],
  providers: [PrismaService, AuditoriaService],
})
class ModuloConsolaSueldos {}

async function main(argv: string[]): Promise<number> {
  const op = leerOpciones(argv);
  if (Boolean(op.archivo) === Boolean(op.desdeEnv)) {
    console.log(USO);
    return 1;
  }
  let texto: string | null;
  if (op.archivo) texto = fs.readFileSync(op.archivo, 'utf8');
  else {
    texto = textoDesdeEnv(op.desdeEnv!);
    if (texto === null) {
      console.log(`La variable ${op.desdeEnv} no está definida.`);
      return 1;
    }
  }
  const app = await NestFactory.createApplicationContext(ModuloConsolaSueldos, { logger: ['error', 'warn'] });
  try {
    return await ejecutarCarga(texto, op.aplicar, { prisma: app.get(PrismaService), auditoria: app.get(AuditoriaService) });
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((c) => process.exit(c))
    .catch((e) => {
      console.error(`ABORTADO: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    });
}
