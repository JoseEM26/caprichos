jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { visibleA } from './notificaciones.service';
import { PERMISOS_POR_TIPO, permisosDeTipo, tipoVisible } from './permisos-por-tipo';
import { TIPO_CAJA_CERRADA_APERTURA } from '../caja/caja-aviso-apertura.service';

const cumple = (fila: any, where: any): boolean => {
  if (!where) return true;
  for (const [k, cond] of Object.entries(where)) {
    if (k === 'AND') {
      if (!(cond as any[]).every((c) => cumple(fila, c))) return false;
      continue;
    }
    if (k === 'OR') {
      if (!(cond as any[]).some((c) => cumple(fila, c))) return false;
      continue;
    }
    const v = fila[k];
    if (cond === null) {
      if (v !== null && v !== undefined) return false;
      continue;
    }
    if (typeof cond === 'object' && typeof cond !== 'bigint') {
      if ('startsWith' in (cond as any) && !String(v).startsWith((cond as any).startsWith)) return false;
      if ('in' in (cond as any) && !(cond as any).in.includes(v)) return false;
      continue;
    }
    if (v !== cond) return false;
  }
  return true;
};

// Permisos inventados por rol (suficientes para la matriz)
const PERMISOS: Record<string, string[]> = {
  ADMIN: [],
  SUPERVISOR: ['caja/ver', 'pedidos/ver', 'reservas/ver', 'mensajes/ver', 'repartos/ver', 'vouchers/ver'],
  CAJERO: ['caja/ver', 'pedidos/ver', 'comprobantes/ver', 'reservas/ver', 'mensajes/ver', 'vouchers/ver'],
  MOZO: ['mesas/ver'],
  COCINA: ['cocina/ver'],
  REPARTIDOR: ['repartos/ver'],
  APOYO_DELIVERY: [],
};
const usuario = (rol: string, partyId: bigint) => ({ partyId, rol, roles: [rol], debeCambiar: false });
const ve = (rol: string, fila: any, partyId = 100n): boolean => {
  const puede = (p: string) => rol === 'ADMIN' || PERMISOS[rol].includes(p);
  return cumple({ party_destino: null, rol_destino: null, ...fila }, visibleA(usuario(rol, partyId), puede));
};

describe('avisos: quién ve qué (denegar por defecto)', () => {
  it('sin rol_destino cada rol ve solo los tipos de sus permisos; ADMIN ve todos', () => {
    const matriz: Record<string, string[]> = {};
    for (const rol of Object.keys(PERMISOS)) {
      matriz[rol] = Object.keys(PERMISOS_POR_TIPO).filter((tipo) => ve(rol, { tipo }));
    }
    expect(matriz.ADMIN).toHaveLength(Object.keys(PERMISOS_POR_TIPO).length);
    expect(matriz.COCINA).toEqual(['MENSAJE_INTERNO']);
    expect(matriz.APOYO_DELIVERY).toEqual(['MENSAJE_INTERNO']);
    expect(matriz.MOZO).toEqual(['MESA_LISTA', 'MENSAJE_INTERNO']);
    expect(matriz.REPARTIDOR).toEqual(
      expect.arrayContaining(['DELIVERY_POR_CONFIRMAR', 'REPROGRAMACION_DELIVERY', 'MENSAJE_INTERNO']),
    );
    expect(matriz.REPARTIDOR).not.toContain('PEDIDO_NUEVO');
    expect(matriz.CAJERO).toEqual(expect.arrayContaining(['PEDIDO_NUEVO', 'VOUCHER_PENDIENTE_MOZO', 'ATENCION_WHATSAPP']));
    expect(matriz.CAJERO).not.toEqual(expect.arrayContaining(['WHATSAPP_CONSUMO']));
    expect(matriz.CAJERO).not.toContain('MESA_LISTA');
    expect(matriz.CAJERO).not.toContain('STOCK_BAJO');
  });

  it('un tipo desconocido solo lo ve el ADMIN', () => {
    expect(ve('ADMIN', { tipo: 'TIPO_NUEVO_SIN_MAPA' })).toBe(true);
    for (const rol of ['SUPERVISOR', 'CAJERO', 'MOZO', 'COCINA', 'REPARTIDOR', 'APOYO_DELIVERY']) {
      expect(ve(rol, { tipo: 'TIPO_NUEVO_SIN_MAPA' })).toBe(false);
    }
  });

  it('rol_destino: respeta el rol y el SUPERVISOR hereda lo del CAJERO', () => {
    expect(ve('CAJERO', { tipo: 'PEDIDO_NUEVO', rol_destino: 'ADMIN' })).toBe(false);
    expect(ve('CAJERO', { tipo: 'PEDIDO_NUEVO', rol_destino: 'CAJERO' })).toBe(true);
    expect(ve('SUPERVISOR', { tipo: 'PEDIDO_NUEVO', rol_destino: 'CAJERO' })).toBe(true);
    expect(ve('MOZO', { tipo: 'MENSAJE_INTERNO', rol_destino: 'CAJERO' })).toBe(false);
  });

  it('party_destino: solo esa persona, aunque el tipo o el rol dejarían verlo a otros (ADMIN incluido)', () => {
    const fila = { tipo: 'MESA_LISTA', party_destino: 55n };
    expect(ve('MOZO', fila, 55n)).toBe(true);
    expect(ve('MOZO', fila, 56n)).toBe(false);
    expect(ve('ADMIN', fila, 1n)).toBe(false);
    expect(ve('CAJERO', { tipo: 'ALERTA_INTERNA', rol_destino: 'ADMIN', party_destino: 77n }, 77n)).toBe(true);
    expect(ve('ADMIN', { tipo: 'ALERTA_INTERNA', rol_destino: 'ADMIN', party_destino: 77n }, 1n)).toBe(false);
    // un repartidor recibe su aviso aunque su tipo no figure en sus permisos
    expect(ve('REPARTIDOR', { tipo: 'CAMBIO_COBRO_RESUELTO', party_destino: 9n }, 9n)).toBe(true);
  });

  it('FACTURACION:* se resuelve por prefijo', () => {
    expect(permisosDeTipo('FACTURACION:cert_vence')).toEqual(['comprobantes/ver']);
    expect(ve('CAJERO', { tipo: 'FACTURACION:cert_vence' })).toBe(true);
    expect(ve('MOZO', { tipo: 'FACTURACION:cert_vence' })).toBe(false);
    expect(tipoVisible('FACTURACION:x', () => false)).toBe(false);
  });
});

/** Recorre el código del api y exige que cada tipo creado con `notificacion.create` tenga entrada en el mapa. */
describe('todo tipo de aviso creado en el código está en PERMISOS_POR_TIPO', () => {
  const raiz = join(__dirname, '..');
  const archivos: string[] = [];
  const recorrer = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (ruta.endsWith('.ts') && !/\.spec\.ts$/.test(ruta)) archivos.push(ruta);
    }
  };
  recorrer(raiz);

  const encontrados = new Set<string>();
  for (const f of archivos) {
    const txt = readFileSync(f, 'utf8');
    // literales: notificacion.create({ data: { tipo: 'X'
    for (const m of txt.matchAll(/notificacion\.create\(\{\s*data:\s*\{[^}]{0,200}?tipo:\s*'([A-Z_]+)'/g)) encontrados.add(m[1]);
    // auxiliares que reciben el tipo como argumento
    for (const m of txt.matchAll(
      /(?:notificarEquipo|notificarCaja|avisarAdmin|avisarAdminsRedis)\(\s*(?:[^'()]*?,\s*)*?'([A-Z]{3,}(?:_[A-Z]+)+)'/g,
    )) {
      encontrados.add(m[1]);
    }
  }
  encontrados.add(TIPO_CAJA_CERRADA_APERTURA);

  it('encuentra tipos (el escaneo funciona)', () => {
    expect(encontrados.size).toBeGreaterThan(15);
  });

  it.each([...encontrados].sort())('%s tiene permiso asignado', (tipo) => {
    expect(permisosDeTipo(tipo)).toBeDefined();
  });
});
