import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exportar } from '../exportar';
import { importar, resumenTexto } from '../importar';
import { huellaGlobal, leerPaquete, sha256Texto } from '../motor';
import { FakeDb } from './fake-db';

const HASH_ORIGEN = '$argon2id$v=19$SECRETO-DEL-ORIGEN';
const FECHA = new Date('2026-10-30T15:00:00Z');
const CONTENIDO_FOTO = 'foto-publica';

/** Base de origen con datos mezclados: activos, inactivos, personal, cliente y archivos públicos y privados. */
function origen(): FakeDb {
  return new FakeDb({
    rol: [{ codigo: 'ADMIN', nombre: 'Administrador' }],
    parametro: [
      { clave: 'local_datos', valor: { nombre: 'Caprichos', ruc: '20123456789' } },
      { clave: 'voucher_ia_activo', valor: true },
      { clave: 'wa_media:12:abc', valor: 'media-id' },
      { clave: 'contenido_conocenos_borrador', valor: { titulo: 'borrador' } },
      { clave: 'entorno', valor: 'DEMO' },
      { clave: 'resenas_negocio', valor: { businessId: 'biz-1', nombre: 'Caprichos Campoy' } },
      { clave: 'resenas_carga_inicial', valor: { fecha: '2026-10-31', paginas: 3, guardadas: 2, total: 2 } },
      { clave: 'resenas_consumo_202610', valor: 7 },
      { clave: 'resenas_ultima_manual', valor: '2026-10-31' },
    ],
    resena_google: [
      { id: 1, google_review_id: 'rv-1', autor_nombre: 'Ana', autor_foto_url: null, autor_enlace: null, calificacion: 5, texto: 'Excelente café y la atención fue muy amable.', idioma: 'es', publicada_en: new Date('2026-10-01'), enlace_resena: null, visible: true, creado_en: FECHA, actualizado_en: FECHA },
      { id: 2, google_review_id: 'rv-2', autor_nombre: 'Luis', autor_foto_url: null, autor_enlace: null, calificacion: 4, texto: 'Buen lugar, volveremos pronto con la familia.', idioma: 'es', publicada_en: new Date('2026-10-02'), enlace_resena: null, visible: false, creado_en: FECHA, actualizado_en: FECHA },
    ],
    area_cocina: [{ id: 1, nombre: 'Barra', propia: true, impresora: '', etiquetera: '', activo: true }],
    categoria: [
      { id: 1, nombre: 'Bebidas', lleva_opciones: false, area_id: 1, orden: 1, oculta: false },
      { id: 2, nombre: 'Escondida', lleva_opciones: false, area_id: 1, orden: 2, oculta: true },
    ],
    archivo: [
      { id: 1, ruta: 'publico/2026/10/foto.webp', tipo_mime: 'image/webp', bytes: CONTENIDO_FOTO.length, privado: false },
      { id: 2, ruta: 'privado/2026/10/voucher.jpg', tipo_mime: 'image/jpeg', bytes: 3, privado: true },
    ],
    producto: [
      { id: 1, categoria_id: 1, nombre: 'Chicha', descripcion: '', foto_archivo_id: 1, precio: '5.00', por_lote: false, vida_util_horas: null, orden: 1, oculto: false, agotado_hasta: null, no_suma_beneficios: false },
      { id: 2, categoria_id: 1, nombre: 'Oculto', descripcion: '', foto_archivo_id: null, precio: '1.00', por_lote: false, vida_util_horas: null, orden: 2, oculto: true, agotado_hasta: null, no_suma_beneficios: false },
      { id: 3, categoria_id: 2, nombre: 'Secreto', descripcion: '', foto_archivo_id: null, precio: '2.00', por_lote: false, vida_util_horas: null, orden: 3, oculto: false, agotado_hasta: null, no_suma_beneficios: false },
    ],
    party: [{ id: 10, tipo: 'PERSONA', estado: 'ACTIVO' }, { id: 11, tipo: 'PERSONA', estado: 'ACTIVO' }],
    party_identifier: [
      { id: 1, party_id: 10, tipo: 'DNI', numero: '12345678' },
      { id: 2, party_id: 11, tipo: 'DNI', numero: '87654321' },
    ],
    person: [
      { party_id: 10, nombres: 'Ana', apellidos: 'Pérez', cumple_dia: 1, cumple_mes: 2, correo: 'ana@x.pe', foto_archivo_id: null },
      { party_id: 11, nombres: 'Cliente', apellidos: 'Final', cumple_dia: null, cumple_mes: null, correo: null, foto_archivo_id: null },
    ],
    user_account: [
      { id: 1, party_id: 10, rol: 'ADMIN', hash: HASH_ORIGEN, debe_cambiar: false, pin_hash: null, activo: true, alta_en: new Date('2026-01-01'), alertas_whatsapp: false, alertas_whatsapp_confirmado_en: null },
    ],
    version_carta: [
      { id: 5, estado: 'PUBLICADA', organizacion: 'SECCIONES', decoracion: 'NINGUNO', contenido: { banner: { imagen: '/archivos/publico/2026/10/foto.webp' } }, publicada_en: new Date('2026-10-01'), publicada_por: 10 },
    ],
  });
}

function escribirFotoOrigen(uploads: string): void {
  fs.mkdirSync(path.join(uploads, 'publico/2026/10'), { recursive: true });
  fs.writeFileSync(path.join(uploads, 'publico/2026/10/foto.webp'), CONTENIDO_FOTO);
}

describe('exportar e importar el paquete de la empresa (base en memoria)', () => {
  let tmp: string;
  let uploadsOrigen: string;
  let uploadsDestino: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'migracion-datos-'));
    uploadsOrigen = path.join(tmp, 'uploads-origen');
    uploadsDestino = path.join(tmp, 'uploads-destino');
    escribirFotoOrigen(uploadsOrigen);
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  async function exportarDesde(db: FakeDb, nombre = 'paquete') {
    const salida = path.join(tmp, nombre);
    const r = await exportar(db.proxy(), { salida, uploadsDir: uploadsOrigen, entorno: 'demo', ahora: FECHA });
    return { salida, r };
  }

  it('exporta solo lo activo, con claves naturales, sin hashes ni clientes ni archivos privados', async () => {
    const { salida, r } = await exportarDesde(origen());
    const datos = fs.readFileSync(path.join(salida, 'datos.json'), 'utf8');

    expect(datos).not.toContain(HASH_ORIGEN);
    expect(datos).not.toContain('"hash"');
    expect(datos).not.toContain('87654321');
    expect(datos).not.toContain('privado/2026');
    expect(datos).not.toContain('wa_media');
    expect(datos).not.toContain('contenido_conocenos_borrador');

    const d = JSON.parse(datos).tablas;
    expect(d.producto.map((p: any) => p.nombre)).toEqual(['Chicha']);
    expect(d.categoria.map((c: any) => c.nombre)).toEqual(['Bebidas']);
    expect(d.party.map((p: any) => p.documento)).toEqual(['DNI:12345678']);
    expect(d.producto[0].categoria).toEqual({ nombre: 'Bebidas' });
    expect(d.producto[0].foto).toEqual({ sha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(d.parametro.map((p: any) => p.clave).sort()).toEqual(['local_datos', 'resenas_carga_inicial', 'resenas_negocio', 'voucher_ia_activo']);
    expect(d.resena_google.map((r: any) => [r.google_review_id, r.visible])).toEqual([['rv-1', true], ['rv-2', false]]);
    expect(r.conteos.producto).toBe(1);
    expect(r.reporte).toContain('Chicha');
    expect(r.reporte).toContain('Escondida');
  });

  it('excluye productos por nombre y no exporta las cuentas del personal cuando se pide', async () => {
    const salida = path.join(tmp, 'sin-personal');
    const r = await exportar(origen().proxy(), {
      salida, uploadsDir: uploadsOrigen, entorno: 'demo', ahora: FECHA, excluirProductos: ['chicha'], sinPersonal: true,
    });
    const d = JSON.parse(fs.readFileSync(path.join(salida, 'datos.json'), 'utf8')).tablas;
    expect(d.producto).toEqual([]);
    expect(d.user_account).toEqual([]);
    expect(d.party).toEqual([]);
    expect(r.reporte).toContain('excluido a pedido');
  });

  it('enmascara DNI en el reporte y lista lo que no sale con su motivo', async () => {
    const { r } = await exportarDesde(origen());
    expect(r.reporte).toContain('DNI:12345***');
    expect(r.reporte).not.toContain('12345678');
    expect(r.reporte).toMatch(/Secreto.*depende de categoria/);
    expect(r.reporte).toMatch(/Oculto.*inactiva/);
  });

  it('pasa la imagen de la carta a su sha256 y el manifiesto lleva huella y conteos', async () => {
    const { salida } = await exportarDesde(origen());
    const paquete = leerPaquete(salida);
    expect(paquete.manifiesto.archivos).toHaveLength(1);
    expect(paquete.manifiesto.ultima_migracion).toBe('20261118100000_desactivar_extras_bebidas');
    const vc = paquete.datos.tablas.version_carta[0];
    expect(JSON.stringify(vc.contenido)).toMatch(/archivo:\/\/[0-9a-f]{64}/);
    expect(JSON.stringify(vc.contenido)).not.toContain('/archivos/');
  });

  it('el paquete alterado no se acepta (datos y archivos)', async () => {
    const { salida } = await exportarDesde(origen());
    fs.appendFileSync(path.join(salida, 'datos.json'), ' ');
    expect(() => leerPaquete(salida)).toThrow(/datos.json/);
    fs.writeFileSync(path.join(salida, 'datos.json'), fs.readFileSync(path.join(salida, 'datos.json'), 'utf8').trimEnd());
    const archivo = fs.readdirSync(path.join(salida, 'archivos'))[0];
    fs.writeFileSync(path.join(salida, 'archivos', archivo), 'otro contenido');
    expect(() => leerPaquete(salida)).toThrow(/alterado|huella/);
  });

  it('simulacro: no escribe ni una fila', async () => {
    const { salida } = await exportarDesde(origen());
    const destino = new FakeDb({});
    const r = await importar(destino.proxy(), salida, { uploadsDir: uploadsDestino, entorno: 'local', ejecutar: false, sobrescribir: false });
    expect(r.ejecutado).toBe(false);
    expect(destino.escrituras).toBe(0);
    expect(fs.existsSync(uploadsDestino)).toBe(false);
    expect(r.conteos.producto.crear).toBe(1);
    expect(resumenTexto(r)).toContain('SIMULACRO');
  });

  it('importación real: crea todo, con cuentas sin la clave original y que deben cambiarla', async () => {
    const { salida } = await exportarDesde(origen());
    const destino = new FakeDb({});
    const r = await importar(destino.proxy(), salida, {
      uploadsDir: uploadsDestino, entorno: 'local', ejecutar: true, sobrescribir: false, hashClave: async () => 'HASH_NUEVO',
    });
    expect(r.ejecutado).toBe(true);
    expect(destino.tablas.producto.map((p) => p.nombre)).toEqual(['Chicha']);
    expect(destino.tablas.parametro.length).toBe(4);
    const cuenta = destino.tablas.user_account[0];
    expect(cuenta.hash).toBe('HASH_NUEVO');
    expect(cuenta.debe_cambiar).toBe(true);
    expect(destino.tablas.party_identifier[0]).toMatchObject({ tipo: 'DNI', numero: '12345678' });
    expect(destino.tablas.auditoria.map((a) => a.accion)).toContain('IMPORTAR_DATOS_EMPRESA');
    // la foto va a publico/importados con su sha256 y su fila archivo apunta a ella
    const ruta = destino.tablas.archivo[0].ruta as string;
    expect(ruta).toMatch(/^publico\/importados\/[0-9a-f]{64}\.webp$/);
    expect(fs.readFileSync(path.join(uploadsDestino, ruta), 'utf8')).toBe(CONTENIDO_FOTO);
    expect(destino.tablas.producto[0].foto_archivo_id).toBe(destino.tablas.archivo[0].id);
    expect(destino.tablas.version_carta[0].contenido.banner.imagen).toBe(`/archivos/${ruta}`);
  });

  it('reseñas: viajan con su visibilidad y la carga ya hecha; el cupo del mes y la última actualización se quedan', async () => {
    const { salida } = await exportarDesde(origen());
    const destino = new FakeDb({});
    await importar(destino.proxy(), salida, { uploadsDir: uploadsDestino, entorno: 'local', ejecutar: true, sobrescribir: false, hashClave: async () => 'H' });
    expect(destino.tablas.resena_google.map((r) => [r.google_review_id, r.visible])).toEqual([['rv-1', true], ['rv-2', false]]);
    const claves = destino.tablas.parametro.map((p) => p.clave);
    expect(claves).toEqual(expect.arrayContaining(['resenas_negocio', 'resenas_carga_inicial']));
    expect(claves.filter((c) => c.startsWith('resenas_consumo_') || c === 'resenas_ultima_manual')).toEqual([]);
  });

  it('idempotente: una segunda importación no crea, no duplica y no audita de nuevo', async () => {
    const { salida } = await exportarDesde(origen());
    const destino = new FakeDb({});
    const opciones = { uploadsDir: uploadsDestino, entorno: 'local' as const, ejecutar: true, sobrescribir: false, hashClave: async () => 'H' };
    await importar(destino.proxy(), salida, opciones);
    const r2 = await importar(destino.proxy(), salida, opciones);
    const creadas = Object.values(r2.conteos).reduce((n, c) => n + c.crear + c.actualizar, 0);
    expect(creadas).toBe(0);
    expect(destino.tablas.producto).toHaveLength(1);
    expect(destino.tablas.archivo).toHaveLength(1);
    expect(destino.tablas.auditoria).toHaveLength(1);
  });

  it('lo que ya existe y es distinto se omite; con --sobrescribir se actualiza', async () => {
    const { salida } = await exportarDesde(origen());
    const destino = new FakeDb({});
    await importar(destino.proxy(), salida, { uploadsDir: uploadsDestino, entorno: 'local', ejecutar: true, sobrescribir: false, hashClave: async () => 'H' });
    destino.tablas.parametro.find((p) => p.clave === 'local_datos')!.valor = { nombre: 'Otro nombre' };

    const sinSobrescribir = await importar(destino.proxy(), salida, { uploadsDir: uploadsDestino, entorno: 'local', ejecutar: true, sobrescribir: false, hashClave: async () => 'H' });
    expect(sinSobrescribir.conteos.parametro.omitido_distinto).toBe(1);
    expect(destino.tablas.parametro.find((p) => p.clave === 'local_datos')!.valor).toEqual({ nombre: 'Otro nombre' });

    const conSobrescribir = await importar(destino.proxy(), salida, { uploadsDir: uploadsDestino, entorno: 'local', ejecutar: true, sobrescribir: true, hashClave: async () => 'H' });
    expect(conSobrescribir.conteos.parametro.actualizar).toBe(1);
    expect(destino.tablas.parametro.find((p) => p.clave === 'local_datos')!.valor).toEqual({ nombre: 'Caprichos', ruc: '20123456789' });
  });

  it('nunca borra lo que hay en destino', async () => {
    const { salida } = await exportarDesde(origen());
    const destino = new FakeDb({ producto: [{ id: 99, categoria_id: null, nombre: 'Solo en destino', foto_archivo_id: null }] });
    await importar(destino.proxy(), salida, { uploadsDir: uploadsDestino, entorno: 'local', ejecutar: true, sobrescribir: true, hashClave: async () => 'H' });
    expect(destino.tablas.producto.map((p) => p.nombre)).toContain('Solo en destino');
  });

  it('un paquete con una tabla que no es migrable se rechaza sin escribir', async () => {
    const { salida } = await exportarDesde(origen());
    const datos = JSON.parse(fs.readFileSync(path.join(salida, 'datos.json'), 'utf8'));
    datos.tablas.pedido = [{ total: 1 }];
    const texto = JSON.stringify(datos, null, 2);
    fs.writeFileSync(path.join(salida, 'datos.json'), texto);
    const manifiesto = JSON.parse(fs.readFileSync(path.join(salida, 'manifiesto.json'), 'utf8'));
    manifiesto.datos_sha256 = sha256Texto(texto);
    manifiesto.huella = huellaGlobal(manifiesto.datos_sha256, manifiesto.archivos);
    fs.writeFileSync(path.join(salida, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2));

    const destino = new FakeDb({});
    const r = await importar(destino.proxy(), salida, { uploadsDir: uploadsDestino, entorno: 'local', ejecutar: false, sobrescribir: false });
    expect(r.errores.join(' ')).toMatch(/pedido/);
    await expect(importar(destino.proxy(), salida, { uploadsDir: uploadsDestino, entorno: 'local', ejecutar: true, sobrescribir: false, hashClave: async () => 'H' })).rejects.toThrow(/No se escribe nada/);
    expect(destino.escrituras).toBe(0);
  });
});
