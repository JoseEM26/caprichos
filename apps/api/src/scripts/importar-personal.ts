/**
 * Importación de personal desde la consola del servidor, sin sesión de admin. Se corre una vez.
 *
 * Entrada (una de las dos): --archivo <ruta.csv>  o  --desde-env PERSONAL_CSV_B64 (CSV en base64 dentro de esa variable).
 * Columnas: nombres, apellidos, tipo_documento, documento, celular, fecha_nacimiento, fecha_ingreso,
 *           fecha_reingreso, pais_nacimiento, rol_principal, roles_extra (separados por |), activo (si/no).
 *
 * Por defecto es SIMULACRO: no escribe nada. Imprime por fila «crear», «ya existe» o «error: motivo» con nombre y rol.
 * Nunca imprime documentos, celulares ni claves.
 * Con --aplicar crea de verdad, una transacción por fila. La clave inicial es el número de documento (debe_cambiar = true).
 * Los documentos que ya existen se omiten sin tocarlos. La auditoría IMPORTAR_PERSONAL queda como sistema.
 *
 * Dentro del contenedor de la API (carpeta /app/apps/api):
 *   node dist/scripts/importar-personal.js --archivo /ruta/personal.csv
 *   node dist/scripts/importar-personal.js --archivo /ruta/personal.csv --aplicar
 *   node dist/scripts/importar-personal.js --desde-env PERSONAL_CSV_B64 --aplicar
 *
 * Códigos de salida: 0 corrió (simulacro o aplicado); 1 no se pudo leer el archivo o falta el encabezado.
 */
import * as fs from 'fs';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validarEntorno } from '../config/entorno.validacion';
import { PrismaService } from '../comun/prisma/prisma.service';
import { AuditoriaService } from '../modulos/auditoria/auditoria.service';
import { ArchivosService } from '../modulos/archivos/archivos.service';
import { UsuariosService } from '../modulos/usuarios/usuarios.service';

export interface OpcionesImportacion {
  archivo?: string;
  desdeEnv?: string;
  aplicar: boolean;
}

/** Lo que el comando usa del servicio de usuarios (en pruebas se simula). */
export type ServicioUsuarios = Pick<UsuariosService, 'importarPersonal'>;

export function leerOpciones(argv: string[]): OpcionesImportacion {
  const val = (k: string): string | undefined => {
    const i = argv.indexOf(`--${k}`);
    if (i >= 0) return argv[i + 1];
    return argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  };
  return {
    archivo: val('archivo')?.trim() || undefined,
    desdeEnv: val('desde-env')?.trim() || undefined,
    aplicar: argv.includes('--aplicar'),
  };
}

const USO =
  'Uso: node dist/scripts/importar-personal.js (--archivo <ruta.csv> | --desde-env PERSONAL_CSV_B64) [--aplicar]';

/** CSV con coma o punto y coma, comillas y saltos dentro de comillas. Quita el BOM. */
export function parsearCsv(texto: string): string[][] {
  const limpio = texto.replace(/^\uFEFF/, '');
  const primera = limpio.split(/\r?\n/)[0] ?? '';
  const separador = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const ch = limpio[i];
    if (entreComillas) {
      if (ch === '"') {
        if (limpio[i + 1] === '"') {
          campo += '"';
          i++;
        } else entreComillas = false;
      } else campo += ch;
    } else if (ch === '"') entreComillas = true;
    else if (ch === separador) {
      fila.push(campo);
      campo = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += ch;
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((c) => c.trim() !== ''));
}

const COLUMNAS_OBLIGATORIAS = ['nombres', 'apellidos', 'documento', 'rol_principal'];

export interface FilaCsv {
  /** Número de línea en el archivo (la cabecera es la 1). */
  linea: number;
  nombre: string;
  rol: string;
  /** Aviso cuando el archivo traía el rol eliminado Call Center. */
  avisoRol?: string;
  /** Fila para el servicio; null si el formato de la línea no sirve. */
  fila: Record<string, unknown> | null;
  errorFormato?: string;
}

/** «Call Center» / CALLCENTER ya no existe: se importa como MOZO (y se avisa en el simulacro). */
function mapearRolEliminado(rol: string): string {
  return rol.replace(/\s+/g, '').toUpperCase() === 'CALLCENTER' ? 'MOZO' : rol;
}

/** Convierte el CSV en filas para el servicio. Error de cabecera = el archivo no se puede usar. */
export function filasDesdeCsv(texto: string): { filas: FilaCsv[]; error?: string } {
  const [cabecera, ...datos] = parsearCsv(texto);
  if (!cabecera) return { filas: [], error: 'El archivo está vacío.' };
  const claves = cabecera.map((c) => c.trim().toLowerCase());
  const faltan = COLUMNAS_OBLIGATORIAS.filter((c) => !claves.includes(c));
  if (faltan.length) return { filas: [], error: `Faltan columnas en el encabezado: ${faltan.join(', ')}.` };

  const filas: FilaCsv[] = datos.map((campos, i) => {
    const r: Record<string, string> = {};
    claves.forEach((k, j) => (r[k] = (campos[j] ?? '').trim()));
    const opt = (k: string, valor: string) => (valor ? { [k]: valor } : {});
    const activoTexto = r.activo?.toLowerCase() ?? '';
    const nombre = `${r.nombres} ${r.apellidos}`.trim();
    const rolPrincipal = mapearRolEliminado(r.rol_principal ?? '');
    const extras = (r.roles_extra ?? '').split('|').map((x) => mapearRolEliminado(x.trim()).toUpperCase()).filter(Boolean);
    const huboCallCenter = [r.rol_principal ?? '', ...(r.roles_extra ?? '').split('|')].some((x) => mapearRolEliminado(x) !== x);
    const base = {
      linea: i + 2,
      nombre,
      rol: rolPrincipal,
      ...(huboCallCenter ? { avisoRol: 'el rol Call Center ya no existe: se asigna MOZO' } : {}),
    };
    if (activoTexto && activoTexto !== 'si' && activoTexto !== 'no') {
      return { ...base, fila: null, errorFormato: 'activo debe ser si o no' };
    }
    return {
      ...base,
      fila: {
        nombres: r.nombres,
        apellidos: r.apellidos,
        tipoDocumento: r.tipo_documento || 'DNI',
        documento: r.documento,
        rol: rolPrincipal,
        // Si el rol viejo ya estaba como MOZO, no se repite
        otrosRoles: extras.filter((x, k) => x !== rolPrincipal && extras.indexOf(x) === k),
        activo: activoTexto !== 'no',
        ...opt('celular', r.celular),
        ...opt('fechaNacimiento', r.fecha_nacimiento),
        ...opt('fechaIngreso', r.fecha_ingreso),
        ...opt('fechaReingreso', r.fecha_reingreso),
        ...opt('paisNacimiento', r.pais_nacimiento),
      },
    };
  });
  return { filas };
}

/** Texto del CSV desde la variable de entorno (base64). */
export function textoDesdeEnv(nombreVariable: string, entorno: NodeJS.ProcessEnv = process.env): string | null {
  const b64 = entorno[nombreVariable];
  if (!b64) return null;
  return Buffer.from(b64.trim(), 'base64').toString('utf8');
}

/** Corre la importación. Imprime una línea por fila con nombre y rol; nunca documento, celular ni clave. */
export async function ejecutarImportacion(
  texto: string,
  aplicar: boolean,
  servicio: ServicioUsuarios,
  salida: (linea: string) => void = console.log,
): Promise<number> {
  const { filas, error } = filasDesdeCsv(texto);
  if (error) {
    salida(error);
    return 1;
  }

  const enviables = filas.filter((f) => f.fila !== null);
  const resultado: any = enviables.length
    ? await servicio.importarPersonal(enviables.map((f) => f.fila as any), { simular: !aplicar })
    : { resultados: [] };
  const porIndice = new Map<number, { estado: string; motivo?: string; avisos?: string[] }>();
  for (const r of resultado.resultados as Array<{ indice: number; estado: string; motivo?: string; avisos?: string[] }>) {
    porIndice.set(r.indice, r);
  }

  const etiqueta: Record<string, string> = aplicar
    ? { CREADA: 'creada', YA_EXISTE: 'ya existe', DUPLICADO_EN_ARCHIVO: 'repetida en el archivo' }
    : { OK: 'crear', YA_EXISTE: 'ya existe', DUPLICADO_EN_ARCHIVO: 'repetida en el archivo' };
  const cuenta: Record<string, number> = {};
  let indiceEnviado = 0;
  salida(aplicar ? 'APLICADO: se crean las filas marcadas como «creada».' : 'SIMULACRO: no se escribe nada.');
  for (const f of filas) {
    let estado: string;
    let motivo: string | undefined;
    let avisos: string[] = [];
    if (f.fila === null) {
      estado = 'ERROR';
      motivo = f.errorFormato;
    } else {
      const r = porIndice.get(indiceEnviado++);
      estado = r?.estado ?? 'ERROR';
      motivo = r?.motivo;
      avisos = r?.avisos ?? [];
    }
    cuenta[estado] = (cuenta[estado] ?? 0) + 1;
    const descripcion =
      estado === 'ERROR' ? `error: ${motivo ?? 'no se pudo revisar'}` : (etiqueta[estado] ?? estado.toLowerCase());
    const todosAvisos = f.avisoRol ? [f.avisoRol, ...avisos] : avisos;
    const aviso = todosAvisos.length ? ` · aviso: ${todosAvisos.join('; ')}` : '';
    salida(`fila ${f.linea}: ${descripcion} — ${f.nombre} (${f.rol || 'sin rol'})${aviso}`);
  }

  const resumen = [
    `${aplicar ? 'creadas' : 'crear'} ${aplicar ? cuenta.CREADA ?? 0 : cuenta.OK ?? 0}`,
    `ya existe ${cuenta.YA_EXISTE ?? 0}`,
    `repetidas ${cuenta.DUPLICADO_EN_ARCHIVO ?? 0}`,
    `error ${cuenta.ERROR ?? 0}`,
  ];
  salida(`Resumen: ${resumen.join(' · ')}`);
  return 0;
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno })],
  providers: [PrismaService, AuditoriaService, ArchivosService, UsuariosService],
})
class ModuloConsolaPersonal {}

async function main(argv: string[]): Promise<number> {
  const op = leerOpciones(argv);
  if (Boolean(op.archivo) === Boolean(op.desdeEnv)) {
    console.log(USO);
    return 1;
  }
  let texto: string | null;
  if (op.archivo) {
    texto = fs.readFileSync(op.archivo, 'utf8');
  } else {
    texto = textoDesdeEnv(op.desdeEnv!);
    if (texto === null) {
      console.log(`La variable ${op.desdeEnv} no está definida.`);
      return 1;
    }
  }
  const app = await NestFactory.createApplicationContext(ModuloConsolaPersonal, { logger: ['error', 'warn'] });
  try {
    return await ejecutarImportacion(texto, op.aplicar, app.get(UsuariosService));
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
