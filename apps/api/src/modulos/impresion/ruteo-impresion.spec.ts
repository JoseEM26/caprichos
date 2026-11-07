import { CLAVES_CONFIG_IMPRESION, REGLAS_IMPRESION_DEFECTO } from '@caprichos/compartido';
import { CONTEXTO_RUTEO_VACIO, ContextoRuteo, aplicaSegunReglas, destinoDeTrabajo, tiposDeRoles } from './ruteo-impresion';
import { reglasDesdeValores, valoresDesdeCambio } from './reglas-impresion';
import { estadoPorRol, rolesDeclarados } from './estado-impresion';

const BEBIDAS = 1n;
const SALADOS = 2n;
const POSTRES = 3n;

const ctxCompleto: ContextoRuteo = {
  areaBebidasId: BEBIDAS,
  equipos: [
    { areaId: BEBIDAS, roles: ['ETIQUETERA'] },
    { areaId: SALADOS, roles: ['TICKETERA'] },
    { areaId: POSTRES, roles: ['ETIQUETERA', 'TICKETERA'] },
  ],
};

describe('destinoDeTrabajo', () => {
  it('sin ningún equipo de área todo va a Caja (NULL), como hoy', () => {
    for (const tipo of ['ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA', 'TICKET_PAGO', 'TICKET_COMANDA_SALON']) {
      expect(destinoDeTrabajo(tipo, SALADOS, CONTEXTO_RUTEO_VACIO)).toBeNull();
    }
  });

  it('ETIQUETA_AREA va a su área solo si esa área tiene etiquetera asignada', () => {
    expect(destinoDeTrabajo('ETIQUETA_AREA', BEBIDAS, ctxCompleto)).toBe(BEBIDAS);
    expect(destinoDeTrabajo('ETIQUETA_AREA', POSTRES, ctxCompleto)).toBe(POSTRES);
    // Salados tiene solo ticketera: su sticker cae en Caja
    expect(destinoDeTrabajo('ETIQUETA_AREA', SALADOS, ctxCompleto)).toBeNull();
    expect(destinoDeTrabajo('ETIQUETA_AREA', null, ctxCompleto)).toBeNull();
  });

  it('ETIQUETA_BEBIDA (vaso) va a Bebidas si Bebidas tiene etiquetera; si no, a Caja', () => {
    expect(destinoDeTrabajo('ETIQUETA_BEBIDA', null, ctxCompleto)).toBe(BEBIDAS);
    expect(destinoDeTrabajo('ETIQUETA_BEBIDA', null, { ...ctxCompleto, equipos: [] })).toBeNull();
    expect(destinoDeTrabajo('ETIQUETA_BEBIDA', null, { ...ctxCompleto, areaBebidasId: null })).toBeNull();
  });

  it('el general y la ticketera (pago y comanda de salón) son siempre de Caja', () => {
    expect(destinoDeTrabajo('ETIQUETA_GENERAL', null, ctxCompleto)).toBeNull();
    expect(destinoDeTrabajo('TICKET_PAGO', null, ctxCompleto)).toBeNull();
    expect(destinoDeTrabajo('TICKET_COMANDA_SALON', null, ctxCompleto)).toBeNull();
  });

  it('TICKET_COMANDA_AREA va a su área solo si esa área tiene ticketera; si no, a Caja', () => {
    expect(destinoDeTrabajo('TICKET_COMANDA_AREA', SALADOS, ctxCompleto)).toBe(SALADOS);
    expect(destinoDeTrabajo('TICKET_COMANDA_AREA', BEBIDAS, ctxCompleto)).toBeNull();
    expect(destinoDeTrabajo('TICKET_COMANDA_AREA', null, ctxCompleto)).toBeNull();
    expect(destinoDeTrabajo('TICKET_COMANDA_AREA', POSTRES, { ...ctxCompleto, equipos: [] })).toBeNull();
  });

  it('un área con equipo solo ticketera no recibe stickers de área', () => {
    expect(destinoDeTrabajo('ETIQUETA_AREA', SALADOS, { ...ctxCompleto, equipos: [{ areaId: SALADOS, roles: ['TICKETERA'] }] })).toBeNull();
  });
});

describe('tiposDeRoles', () => {
  it('la ticketera toma pago y comanda de salón; la etiquetera, los stickers', () => {
    expect(tiposDeRoles(['TICKETERA'])).toEqual(['TICKET_PAGO', 'TICKET_COMANDA_SALON', 'TICKET_COMANDA_AREA']);
    expect(tiposDeRoles(['ETIQUETERA'])).toEqual(['ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA']);
    expect(tiposDeRoles([])).toEqual([]);
  });
});

describe('aplicaSegunReglas (modalidad y activos)', () => {
  const r = REGLAS_IMPRESION_DEFECTO;

  it('el sticker general solo sale en llevar, recoger y delivery por defecto', () => {
    expect(aplicaSegunReglas('ETIQUETA_GENERAL', 'LLEVAR', r)).toBe(true);
    expect(aplicaSegunReglas('ETIQUETA_GENERAL', 'RECOGER', r)).toBe(true);
    expect(aplicaSegunReglas('ETIQUETA_GENERAL', 'DELIVERY', r)).toBe(true);
    expect(aplicaSegunReglas('ETIQUETA_GENERAL', 'MESA', r)).toBe(false);
    expect(aplicaSegunReglas('ETIQUETA_GENERAL', 'LOCAL', r)).toBe(false);
  });

  it('el sticker por vaso va en delivery y recoger (no en mesa) mientras esté activo', () => {
    expect(aplicaSegunReglas('ETIQUETA_BEBIDA', 'MESA', r)).toBe(false);
    expect(aplicaSegunReglas('ETIQUETA_BEBIDA', 'DELIVERY', r)).toBe(true);
    expect(aplicaSegunReglas('ETIQUETA_BEBIDA', 'RECOGER', r)).toBe(true);
    expect(aplicaSegunReglas('ETIQUETA_BEBIDA', 'DELIVERY', { ...r, bebidaActivo: false })).toBe(false);
  });

  it('el sticker por área está apagado por defecto', () => {
    expect(aplicaSegunReglas('ETIQUETA_AREA', 'DELIVERY', r)).toBe(false);
    expect(aplicaSegunReglas('ETIQUETA_AREA', 'DELIVERY', { ...r, areaActivo: true })).toBe(true);
    expect(aplicaSegunReglas('ETIQUETA_AREA', 'MESA', { ...r, areaActivo: true })).toBe(false);
  });

  it('la comanda de salón solo es para mesa/local, nunca llevar ni delivery', () => {
    expect(aplicaSegunReglas('TICKET_COMANDA_SALON', 'MESA', r)).toBe(true);
    expect(aplicaSegunReglas('TICKET_COMANDA_SALON', 'LOCAL', r)).toBe(true);
    expect(aplicaSegunReglas('TICKET_COMANDA_SALON', 'LLEVAR', r)).toBe(false);
    expect(aplicaSegunReglas('TICKET_COMANDA_SALON', 'DELIVERY', r)).toBe(false);
    expect(aplicaSegunReglas('TICKET_COMANDA_SALON', 'MESA', { ...r, comandaSalonActivo: false })).toBe(false);
  });
});

describe('reglas desde parametro y cambios', () => {
  it('sin valores guardados usa los defectos', () => {
    expect(reglasDesdeValores({})).toEqual(REGLAS_IMPRESION_DEFECTO);
  });

  it('ignora valores inválidos y mantiene los válidos', () => {
    const r = reglasDesdeValores({
      [CLAVES_CONFIG_IMPRESION.ETIQUETA_GENERAL_MODALIDADES]: ['DELIVERY', 'PLANETA'],
      [CLAVES_CONFIG_IMPRESION.ETIQUETA_AREA_ACTIVO]: 'si',
    });
    expect(r.generalModalidades).toEqual(['DELIVERY']);
    expect(r.areaActivo).toBe(false);
  });

  it('valoresDesdeCambio valida modalidades y booleanos', () => {
    expect(valoresDesdeCambio({ generalModalidades: ['LLEVAR', 'LLEVAR'] })).toEqual({
      [CLAVES_CONFIG_IMPRESION.ETIQUETA_GENERAL_MODALIDADES]: ['LLEVAR'],
    });
    expect(() => valoresDesdeCambio({ generalModalidades: ['PLANETA'] })).toThrow();
    expect(() => valoresDesdeCambio({ bebidaActivo: 'no' as any })).toThrow();
  });
});

describe('equipos: roles declarados y estado por rol', () => {
  it('usa la lista del latido; sin lista, solo etiquetera (latido viejo)', () => {
    expect(rolesDeclarados({ latido_detalle: JSON.stringify({ detalle: null, impresoras: [{ rol: 'TICKETERA', estado: 'lista' }] }) })).toEqual(['TICKETERA']);
    expect(rolesDeclarados({ latido_impresora: 'lista', latido_detalle: null })).toEqual(['ETIQUETERA']);
    expect(rolesDeclarados(null)).toEqual([]);
  });

  it('un equipo sin latido vigente figura como sin programa', () => {
    expect(estadoPorRol(null).ETIQUETERA.estado).toBe('sin_programa');
  });
});

describe('comanda por área: regla y modalidad', () => {
  it('apagada por defecto y sin modalidad: se encola en cualquier pedido solo si la regla está encendida', () => {
    expect(REGLAS_IMPRESION_DEFECTO.comandaAreaActivo).toBe(false);
    const apagada = { ...REGLAS_IMPRESION_DEFECTO };
    expect(aplicaSegunReglas('TICKET_COMANDA_AREA', 'MESA', apagada)).toBe(false);
    expect(aplicaSegunReglas('TICKET_COMANDA_AREA', 'DELIVERY', apagada)).toBe(false);
    const encendida = { ...REGLAS_IMPRESION_DEFECTO, comandaAreaActivo: true };
    expect(aplicaSegunReglas('TICKET_COMANDA_AREA', 'MESA', encendida)).toBe(true);
    expect(aplicaSegunReglas('TICKET_COMANDA_AREA', 'DELIVERY', encendida)).toBe(true);
  });

  it('la clave de la regla se lee y se guarda como impresion_ticket_comanda_area_activo', () => {
    expect(CLAVES_CONFIG_IMPRESION.TICKET_COMANDA_AREA_ACTIVO).toBe('impresion_ticket_comanda_area_activo');
    expect(reglasDesdeValores({ impresion_ticket_comanda_area_activo: true }).comandaAreaActivo).toBe(true);
    expect(reglasDesdeValores({}).comandaAreaActivo).toBe(false);
    expect(valoresDesdeCambio({ comandaAreaActivo: true })).toEqual({ impresion_ticket_comanda_area_activo: true });
    expect(() => valoresDesdeCambio({ comandaAreaActivo: 'si' as any })).toThrow();
  });
});

