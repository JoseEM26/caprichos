/**
 * EXPORTAR la configuración y el contenido de la empresa (solo lo activo) a un paquete:
 *   datos.json       filas por tabla con claves naturales (sin ids numéricos)
 *   archivos/        fotos públicas referenciadas, nombradas por sha256
 *   manifiesto.json  fecha, ambiente de origen, última migración, conteos, huella
 *   reporte.md       qué sale, por tipo, para revisarlo antes de importar (DNI enmascarados)
 *
 * Uso (desde apps/api, con DATABASE_URL en el entorno; nunca lee .env):
 *   ENTORNO_DATOS=local DATABASE_URL=... pnpm datos:exportar --salida=<carpeta> [--solo-reporte]
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { MIGRAR, NO_MIGRAR } from './clasificacion';
import { ESPECIFICACION, JSON_FIELDS } from './especificacion';
import {
  Cliente, Contexto, Fila, FORMATO_PAQUETE, Manifiesto, ManifiestoArchivo, PREFIJO_ARCHIVO, cargarFilas,
  claveDe, construirDocs, etiquetaDe, extension, forma, huellaGlobal, reescribirCadenas, rutasReferenciadas,
  sha256Texto, shaDeArchivo, esEstatica, sustituirRutas, ultimaMigracion, enmascarar,
} from './motor';
import { leerEntornoDatos, parsearExportar, validarDestinoDatos } from './guardas';

export interface ResultadoExport {
  carpeta: string;
  tarball?: string;
  conteos: Record<string, number>;
  reporte: string;
}

interface Opciones {
  salida: string;
  uploadsDir: string;
  entorno: string;
  soloReporte?: boolean;
  ahora?: Date;
}

const TITULOS: Record<string, string> = {
  parametro: 'Parámetros de configuración',
  lista: 'Listas', lista_valor: 'Valores de listas', horario_dia: 'Horario semanal',
  fecha_especial: 'Fechas especiales', area_cocina: 'Áreas de cocina', categoria: 'Categorías de la carta',
  lugar_stock: 'Lugares de stock (catálogo)', producto: 'Productos', producto_tamano: 'Tamaños por producto',
  grupo_opciones: 'Grupos de opciones', opcion: 'Opciones', producto_grupo: 'Grupos asignados a productos',
  sabor: 'Sabores', zona_reparto: 'Zonas de reparto', piso: 'Pisos del plano', elemento_plano: 'Mesas y elementos del plano',
  oferta: 'Ofertas', combo_precio: 'Precios de combo', combo_parte: 'Partes de combo',
  combo_parte_reemplazo: 'Reemplazos de partes de combo', cupon: 'Cupones fijos',
  insumo: 'Insumos (catálogo)', receta: 'Recetas', receta_linea: 'Líneas de receta', ajuste_opcion: 'Ajustes de opción',
  novedad: 'Novedades', novedad_foto: 'Fotos de novedades', destacada: 'Destacadas', destacada_foto: 'Fotos de destacadas',
  respuesta_rapida: 'Respuestas rápidas', version_carta: 'Versión publicada de la carta', foto_local: 'Fotos del local',
  rol: 'Roles', permiso: 'Permisos', rol_permiso: 'Permisos por rol', regla_acumulacion: 'Regla de puntos',
  archivo: 'Archivos públicos',
};

const LIMITE_LISTA = 300;
/** Tablas de personas y cuentas: sus filas no vigentes no se listan (pueden ser clientes). */
const SIN_DETALLE = new Set(['party', 'person', 'party_role', 'user_account', 'organization', 'employee_detail', 'supplier_detail', 'horario_trabajo', 'reemplazo_dia', 'cobertura_turno']);

/** Hoy en hora de Lima (UTC-5), a medianoche UTC, para comparar con campos @db.Date. */
function inicioHoyLima(ahora: Date): Date {
  const lima = new Date(ahora.getTime() - 5 * 3600 * 1000);
  return new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate()));
}

export async function exportar(db: Cliente, o: Opciones): Promise<ResultadoExport> {
  const ahora = o.ahora ?? new Date();
  const filas = await cargarFilas(db, MIGRAR);
  const docs = construirDocs([...filas.party_identifier.values()]);
  const rutaAId = new Map<string, string>();
  for (const [id, a] of filas.archivo) rutaAId.set(String(a.ruta), id);

  // --- sha256 de archivos públicos (perezoso, con caché) ---
  const cacheSha = new Map<string, string | null>();
  const sha = (id: string): string | null => {
    if (cacheSha.has(id)) return cacheSha.get(id)!;
    const a = filas.archivo.get(id);
    let s: string | null = null;
    if (a && !a.privado) s = shaDeArchivo(String(a.ruta), path.join(o.uploadsDir, String(a.ruta)));
    cacheSha.set(id, s);
    return s;
  };

  const inicioHoy = inicioHoyLima(ahora);
  const ctx: Contexto = { filas, vigentes: new Set(), docs, sha, inicioHoy, ahora, ultimaPublicada: null };

  // --- personal y proveedores que salen: cuenta activa, rol TRABAJADOR vigente o proveedor activo ---
  const roles = [...filas.party_role.values()];
  const proveedoresActivos = new Set<string>();
  for (const s of filas.supplier_detail.values()) if (s.activo) proveedoresActivos.add(String(s.party_role_id));
  for (const r of roles) {
    const vigente = !r.hasta || new Date(r.hasta) >= inicioHoy;
    if ((r.rol === 'TRABAJADOR' && vigente) || (r.rol === 'PROVEEDOR' && proveedoresActivos.has(String(r.id)))) {
      ctx.vigentes.add(String(r.party_id));
    }
  }
  for (const u of filas.user_account.values()) if (u.activo) ctx.vigentes.add(String(u.party_id));
  // sin documento no hay clave natural: esa persona no puede viajar
  for (const id of [...ctx.vigentes]) if (!docs.has(id)) ctx.vigentes.delete(id);

  // --- última versión publicada de la carta ---
  let mejor: bigint | null = null;
  for (const [id, v] of filas.version_carta) {
    if (v.estado !== 'PUBLICADA') continue;
    const n = BigInt(id);
    if (mejor === null || n > mejor) mejor = n;
  }
  ctx.ultimaPublicada = mejor === null ? null : mejor.toString();

  // --- selección por tabla, en orden de dependencias ---
  const incluidos: Record<string, Set<string>> = {};
  const salida: Record<string, Fila[]> = {};
  const omitidos: Record<string, string[]> = {};
  const avisos: string[] = [];
  const archivos = new Map<string, { id: string; ruta: string; tipo_mime: string; bytes: number; sha: string }>();
  const estaticos = (ruta: string) => esEstatica(ruta);

  const archivoSale = (id: string): boolean => {
    const a = filas.archivo.get(id);
    if (!a || a.privado) return false;
    const s = sha(id);
    if (!s) return false;
    if (!archivos.has(s)) archivos.set(s, { id, ruta: String(a.ruta), tipo_mime: String(a.tipo_mime), bytes: Number(a.bytes), sha: s });
    return true;
  };

  const sale = (tabla: string, id: string): boolean => {
    if (tabla === 'archivo') return archivoSale(id);
    return incluidos[tabla]?.has(id) ?? false;
  };

  for (const t of MIGRAR) {
    const e = ESPECIFICACION[t];
    if (e.hook) continue;
    incluidos[t] = new Set();
    salida[t] = [];
    omitidos[t] = [];
    const vistos = new Set<string>();
    for (const [id, row] of filas[t]) {
      const etiqueta = (): string => {
        try { return etiquetaDe(t, forma(t, row, ctx)); } catch { return `#${id}`; }
      };
      if (e.activo && !e.activo(row, ctx)) {
        // Personas y cuentas que no salen: solo se cuentan (no se listan nombres de clientes)
        omitidos[t].push(SIN_DETALLE.has(t) ? 'registro no vigente (sin detalle)' : `${etiqueta()}: inactiva o no visible`);
        continue;
      }

      let motivo: string | null = null;
      const nulos = new Set<string>();
      for (const [p, r] of Object.entries(e.refs ?? {})) {
        const v = row[r.col];
        if (v === null || v === undefined) continue;
        if (!sale(r.tabla, String(v))) {
          if (r.opcional) {
            nulos.add(p);
            avisos.push(`${t} "${etiqueta()}": ${p} queda vacío (${r.tabla} no sale del paquete)`);
          } else {
            motivo = `depende de ${r.tabla} que no sale (${p})`;
            break;
          }
        }
      }
      if (!motivo) {
        for (const [p, l] of Object.entries(e.listas ?? {})) {
          const faltan = (row[l.col] ?? []).filter((x: unknown) => !sale(l.tabla, String(x)));
          if (faltan.length) { motivo = `${p} apunta a ${l.tabla} que no sale`; break; }
        }
      }
      if (motivo) { omitidos[t].push(SIN_DETALLE.has(t) ? `sin detalle: ${motivo}` : `${etiqueta()}: ${motivo}`); continue; }

      const shape = forma(t, row, ctx);
      for (const p of nulos) shape[p] = null;
      if (JSON_FIELDS[t]) {
        for (const campo of JSON_FIELDS[t]) {
          shape[campo] = reescribirCadenas(shape[campo], (s) => sustituirRutas(s, (ruta) => {
            const idArchivo = rutaAId.get(ruta);
            if (idArchivo && archivoSale(idArchivo)) return `${PREFIJO_ARCHIVO}${sha(idArchivo)}`;
            avisos.push(`${t} "${etiqueta()}": la imagen /archivos/${ruta} no sale (privada, falta o no existe) y queda sin enlazar`);
            return `/archivos/${ruta}`;
          }));
        }
      }
      const clave = claveDe(t, shape);
      if (vistos.has(clave)) { omitidos[t].push(`${etiqueta()}: duplicada en origen`); continue; }
      vistos.add(clave);
      incluidos[t].add(id);
      salida[t].push(shape);
    }
    salida[t].sort((a, b) => claveDe(t, a).localeCompare(claveDe(t, b)));
  }

  // --- paquete ---
  const datos = { formato: FORMATO_PAQUETE, tablas: salida };
  const datosTexto = JSON.stringify(datos, null, 2);
  const listaArchivos: ManifiestoArchivo[] = [...archivos.values()]
    .map((a): ManifiestoArchivo => estaticos(a.ruta)
      ? { sha256: a.sha, ext: '', tipo_mime: a.tipo_mime, bytes: a.bytes, estatico: true, ruta: a.ruta }
      : { sha256: a.sha, ext: extension(a.ruta), tipo_mime: a.tipo_mime, bytes: a.bytes, ruta: a.ruta })
    .sort((x, y) => x.sha256.localeCompare(y.sha256));
  const conteos: Record<string, number> = {};
  for (const t of Object.keys(salida)) conteos[t] = salida[t].length;
  conteos.archivo = listaArchivos.length;

  const datosSha = sha256Texto(datosTexto);
  const manifiesto: Manifiesto = {
    formato: FORMATO_PAQUETE,
    fecha: ahora.toISOString(),
    ambiente_origen: o.entorno,
    ultima_migracion: await ultimaMigracion(db),
    conteos,
    archivos: listaArchivos,
    datos_sha256: datosSha,
    huella: huellaGlobal(datosSha, listaArchivos),
  };

  const reporte = construirReporte(manifiesto, salida, omitidos, avisos, o.soloReporte === true);

  fs.mkdirSync(o.salida, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(o.salida, 'reporte.md'), reporte, { mode: 0o600 });
  let tarball: string | undefined;
  if (!o.soloReporte) {
    fs.writeFileSync(path.join(o.salida, 'datos.json'), datosTexto, { mode: 0o600 });
    fs.writeFileSync(path.join(o.salida, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2), { mode: 0o600 });
    fs.mkdirSync(path.join(o.salida, 'archivos'), { recursive: true, mode: 0o700 });
    for (const a of [...archivos.values()].filter((x) => !estaticos(x.ruta))) {
      const destino = path.join(o.salida, 'archivos', `${a.sha}${extension(a.ruta)}`);
      fs.copyFileSync(path.join(o.uploadsDir, a.ruta), destino);
      fs.chmodSync(destino, 0o600);
    }
    tarball = `${o.salida}.tar.gz`;
    const r = spawnSync('tar', ['-czf', tarball, '-C', path.dirname(o.salida), path.basename(o.salida)], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`No se pudo comprimir el paquete: ${r.stderr}`);
    fs.chmodSync(tarball, 0o600);
  }
  return { carpeta: o.salida, tarball, conteos, reporte };
}

function construirReporte(
  m: Manifiesto,
  salida: Record<string, Fila[]>,
  omitidos: Record<string, string[]>,
  avisos: string[],
  soloReporte: boolean,
): string {
  const L: string[] = [];
  L.push('# Migración de datos de la empresa: reporte de exportación', '');
  L.push(`- Fecha de exportación: ${m.fecha}`);
  L.push(`- Ambiente de origen: ${m.ambiente_origen}`);
  L.push(`- Última migración de la base: ${m.ultima_migracion ?? '(ninguna)'}`);
  L.push(`- Huella del paquete: \`${m.huella}\``);
  L.push(`- Modo: ${soloReporte ? 'SIMULACRO (solo reporte, sin datos ni archivos)' : 'paquete completo'}`);
  L.push('', 'Revise esta lista antes de importar. Lo que aparece aquí es lo que se llevaría a producción.', '');

  L.push('## Resumen por tipo', '', '| Tipo | Filas | Omitidas |', '|---|---:|---:|');
  for (const t of Object.keys(salida)) {
    if (!salida[t].length && !omitidos[t]?.length) continue;
    L.push(`| ${TITULOS[t] ?? t} (\`${t}\`) | ${salida[t].length} | ${omitidos[t]?.length ?? 0} |`);
  }
  L.push(`| Archivos públicos | ${m.archivos.length} | |`, '');

  const personas = new Map<string, string>();
  for (const p of salida.person ?? []) personas.set(stableKey(p.party), `${p.nombres ?? ''} ${p.apellidos ?? ''}`.trim());
  if (salida.user_account?.length || salida.party?.length) {
    L.push('## Personal (sin contraseñas: cada cuenta entra con clave temporal y debe cambiarla)', '');
    for (const p of salida.party ?? []) {
      const k = stableKey({ documento: p.documento });
      const cuenta = (salida.user_account ?? []).find((u) => stableKey(u.party) === k);
      const roles = (salida.party_role ?? []).filter((r) => stableKey(r.party) === k).map((r) => r.rol);
      const horarios = (salida.horario_trabajo ?? []).filter((h) => stableKey(h.party) === k).length;
      const rolTxt = cuenta ? `cuenta ${cuenta.rol}` : `sin cuenta (${roles.join(', ') || 'sin rol'})`;
      L.push(`- ${enmascarar(String(p.documento))} · ${personas.get(k) || '(sin nombre)'} · ${rolTxt} · horarios: ${horarios}`);
    }
    L.push('');
  }

  for (const t of Object.keys(salida)) {
    if (t === 'person' || t === 'user_account' || t === 'party_role' || t === 'employee_detail' || t === 'supplier_detail' || t === 'horario_trabajo' || t === 'reemplazo_dia' || t === 'cobertura_turno' || t === 'organization' || t === 'party') continue;
    if (!salida[t].length) continue;
    L.push(`## ${TITULOS[t] ?? t} (${salida[t].length})`, '');
    const lista = salida[t].slice(0, LIMITE_LISTA);
    for (const s of lista) L.push(`- ${enmascarar(etiquetaDe(t, s))}`);
    if (salida[t].length > LIMITE_LISTA) L.push(`- ... y ${salida[t].length - LIMITE_LISTA} más`);
    L.push('');
  }

  const conOmitidas = Object.keys(omitidos).filter((t) => omitidos[t].length);
  L.push('## Omitidas (no salen y el motivo)', '');
  if (!conOmitidas.length) L.push('Ninguna.', '');
  for (const t of conOmitidas) {
    L.push(`### ${TITULOS[t] ?? t}`, '');
    for (const o of omitidos[t].slice(0, 100)) L.push(`- ${enmascarar(o)}`);
    L.push('');
  }
  L.push('## Avisos', '');
  if (!avisos.length) L.push('Ninguno.', '');
  for (const a of [...new Set(avisos)].slice(0, 200)) L.push(`- ${enmascarar(a)}`);
  L.push('');

  L.push('## Lo que NO sale', '');
  const motivos = new Map<string, number>();
  for (const motivo of Object.values(NO_MIGRAR)) motivos.set(motivo, (motivos.get(motivo) ?? 0) + 1);
  for (const [motivo, n] of motivos) L.push(`- ${motivo} (${n} tablas)`);
  L.push('- Contraseñas, hashes, PIN, llaves de dispositivos y secretos: nunca salen.');
  L.push('- Parámetros de caché o contador (`wa_media:*`, `wa_aviso_consumo:*`), borradores (`*_borrador`) y el marcador `entorno`.', '');
  return L.join('\n');
}

function stableKey(v: unknown): string {
  return JSON.stringify(v);
}

async function main(argv: string[], env: NodeJS.ProcessEnv): Promise<void> {
  const o = parsearExportar(argv);
  const entorno = leerEntornoDatos(env.ENTORNO_DATOS, 'exportar', env);
  validarDestinoDatos(entorno, env.DATABASE_URL);
  if (!o.salida) throw new Error('Falta --salida=<carpeta>.');
  const salida = path.resolve(o.salida);
  if (fs.existsSync(salida) && fs.readdirSync(salida).length) {
    throw new Error(`La carpeta ${salida} ya existe y no está vacía. Elija otra.`);
  }
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();
  try {
    const r = await exportar(db, {
      salida,
      uploadsDir: path.resolve(env.UPLOADS_DIR ?? './data/uploads'),
      entorno,
      soloReporte: o.soloReporte,
    });
    console.log(`Exportado en ${r.carpeta}${r.tarball ? ` y ${r.tarball}` : ''}`);
    console.log(`Conteos: ${JSON.stringify(r.conteos)}`);
    console.log('--- reporte.md ---');
    console.log(r.reporte);
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main(process.argv.slice(2), process.env).catch((e) => {
    console.error(`ABORTADO: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
}
