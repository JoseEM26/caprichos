import { Prisma } from '@prisma/client';
import {
  COLUMNAS_SECRETAS, MIGRAR, NO_MIGRAR, TABLAS_SENSIBLES, parametroMigrable,
} from '../clasificacion';
import { ESPECIFICACION } from '../especificacion';
import { camposEscalares } from '../motor';

const TABLAS = Prisma.dmmf.datamodel.models.map((m) => m.dbName ?? m.name);

describe('clasificación de tablas de la migración de datos', () => {
  it('cada tabla del esquema está en exactamente un grupo (MIGRAR o NO_MIGRAR)', () => {
    const sinClasificar = TABLAS.filter((t) => !MIGRAR.includes(t) && !(t in NO_MIGRAR));
    const doble = TABLAS.filter((t) => MIGRAR.includes(t) && t in NO_MIGRAR);
    const inexistentes = [...MIGRAR, ...Object.keys(NO_MIGRAR)].filter((t) => !TABLAS.includes(t));
    expect({ sinClasificar, doble, inexistentes }).toEqual({ sinClasificar: [], doble: [], inexistentes: [] });
  });

  it('ninguna tabla migrable aparece repetida', () => {
    expect(MIGRAR.filter((t, i) => MIGRAR.indexOf(t) !== i)).toEqual([]);
  });

  it('las tablas sensibles no están en MIGRAR', () => {
    expect(MIGRAR.filter((t) => TABLAS_SENSIBLES.includes(t))).toEqual([]);
    for (const t of TABLAS_SENSIBLES) expect(t in NO_MIGRAR).toBe(true);
  });

  it('pedidos, cobros, cajas, vouchers, clientes, conversaciones, salientes, notificaciones, reclamos, encuestas, sesiones, llaves, idempotencia... no migran', () => {
    for (const t of ['pedido', 'cobro', 'caja', 'voucher_pago', 'customer_account', 'conversacion', 'saliente_whatsapp',
      'notificacion', 'reclamo', 'encuesta', 'sesion', 'device_key', 'print_job', 'supervisor_secreto', 'auditoria',
      'movimiento_stock', 'ia_consumo', 'data_request', 'cupon_emitido', 'reserva']) {
      expect(MIGRAR).not.toContain(t);
    }
  });

  it('el personal, la carta, el local y el contenido sí migran', () => {
    for (const t of ['user_account', 'person', 'party', 'horario_trabajo', 'reemplazo_dia', 'producto', 'categoria',
      'oferta', 'combo_parte', 'cupon', 'parametro', 'foto_local', 'archivo', 'novedad', 'destacada', 'version_carta',
      'respuesta_rapida', 'area_cocina', 'insumo', 'receta', 'zona_reparto', 'elemento_plano']) {
      expect(MIGRAR).toContain(t);
    }
  });

  it('cada tabla migrable tiene su especificación y las referencias apuntan a tablas anteriores', () => {
    MIGRAR.forEach((t, i) => {
      expect(ESPECIFICACION[t]).toBeDefined();
      const e = ESPECIFICACION[t];
      const refs = [...Object.values(e.refs ?? {}), ...Object.values(e.listas ?? {})];
      for (const r of refs) {
        const j = MIGRAR.indexOf(r.tabla);
        expect(j).toBeGreaterThanOrEqual(0);
        expect(j).toBeLessThan(i);
      }
    });
  });

  it('ninguna columna secreta sale en el paquete (hash, pin_hash, secretos de supervisor, llaves)', () => {
    for (const t of MIGRAR) {
      const cols = ESPECIFICACION[t]?.hook ? [] : camposEscalares(t);
      expect(cols.filter((c) => COLUMNAS_SECRETAS.includes(c))).toEqual([]);
    }
    expect(camposEscalares('user_account')).not.toContain('hash');
    expect(camposEscalares('user_account')).not.toContain('pin_hash');
  });

  it('las claves naturales son columnas (o referencias) de la tabla', () => {
    for (const t of MIGRAR) {
      const e = ESPECIFICACION[t];
      if (e.hook) continue;
      const cols = new Set([...camposEscalares(t), ...Object.keys(e.refs ?? {}), ...Object.keys(e.listas ?? {}), 'documento', 'sha256']);
      for (const p of e.clave) expect([t, p, cols.has(p)]).toEqual([t, p, true]);
    }
  });

  it('reseñas: resena_google migra con su clave natural; de los parámetros resenas_ solo migran negocio, resumen y carga inicial', () => {
    expect(MIGRAR).toContain('resena_google');
    expect(ESPECIFICACION.resena_google.clave).toEqual(['google_review_id']);
    expect(parametroMigrable('resenas_negocio')).toBe(true);
    expect(parametroMigrable('resenas_resumen')).toBe(true);
    expect(parametroMigrable('resenas_carga_inicial')).toBe(true);
    expect(parametroMigrable('resenas_consumo_202610')).toBe(false);
    expect(parametroMigrable('resenas_ultima_manual')).toBe(false);
    expect(parametroMigrable('resenas_ultima_actualizacion')).toBe(false);
  });

  it('parámetros de caché, contadores, borradores y el marcador de entorno no migran; la configuración sí', () => {
    expect(parametroMigrable('wa_media:12:abc123')).toBe(false);
    expect(parametroMigrable('wa_aviso_consumo:2026-10:bot')).toBe(false);
    expect(parametroMigrable('contenido_conocenos_borrador')).toBe(false);
    expect(parametroMigrable('entorno')).toBe(false);
    expect(parametroMigrable('local_datos')).toBe(true);
    expect(parametroMigrable('chatbot_texto_bienvenida')).toBe(true);
    expect(parametroMigrable('voucher_yape_numero')).toBe(true);
  });
});
