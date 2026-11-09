import { CLAVES_CONFIG_IMPRESION, ConfigEquipoImpresion, REGLAS_IMPRESION_DEFECTO } from '@caprichos/compartido';
import {
  CONFIG_EQUIPO_NUEVO,
  CONTEXTO_RUTEO_VACIO,
  ContextoRuteo,
  EquipoRuteo,
  aplicaSegunReglas,
  areasParaRuteo,
  destinoDeTrabajo,
  equipoAcepta,
  rolesDeConfig,
  tiposDeRoles,
} from './ruteo-impresion';
import { reglasDesdeValores, valoresDesdeCambio } from './reglas-impresion';
import { estadoPorRol, rolesDeclarados } from './estado-impresion';

const BEBIDAS = '1';
const SALADOS = '2';
const POSTRES = '3';

const cfg = (c: Partial<ConfigEquipoImpresion>): ConfigEquipoImpresion => ({ ...CONFIG_EQUIPO_NUEVO, configurado: true, ...c });
const pc = (id: number, c: Partial<ConfigEquipoImpresion>, conectado = true): EquipoRuteo => ({ id: BigInt(id), areaId: null, conectado, config: cfg(c) });
const ctx = (...equipos: EquipoRuteo[]): ContextoRuteo => ({ equipos, areaBebidasId: 1n });

describe('equipoAcepta: cada PC manda', () => {
  it('una PC nueva (configurado=false) no acepta nada, aunque tenga todo encendido', () => {
    const todo = { ...CONFIG_EQUIPO_NUEVO, ticketera: true, etiquetera: true, ticketPago: true, stickerGeneral: true };
    expect(equipoAcepta(todo, 'TICKET_PAGO', [null])).toBe(false);
    expect(equipoAcepta(CONFIG_EQUIPO_NUEVO, 'ETIQUETA_GENERAL', [null])).toBe(false);
  });

  it('una PC en pausa no acepta', () => {
    expect(equipoAcepta(cfg({ ticketera: true, ticketPago: true, pausado: true }), 'TICKET_PAGO', [null])).toBe(false);
  });

  it('ticket de pago y comanda de salón: ticketera encendida y el interruptor de cada uno', () => {
    expect(equipoAcepta(cfg({ ticketera: true, ticketPago: true }), 'TICKET_PAGO', [null])).toBe(true);
    expect(equipoAcepta(cfg({ ticketera: false, ticketPago: true }), 'TICKET_PAGO', [null])).toBe(false);
    expect(equipoAcepta(cfg({ ticketera: true, ticketPago: true }), 'TICKET_COMANDA_SALON', [null])).toBe(false);
    expect(equipoAcepta(cfg({ ticketera: true, comandaSalon: true }), 'TICKET_COMANDA_SALON', [null])).toBe(true);
  });

  it('comanda de área y sticker por área: solo las áreas elegidas', () => {
    const c = cfg({ ticketera: true, etiquetera: true, comandaAreas: [SALADOS], stickerAreas: [POSTRES] });
    expect(equipoAcepta(c, 'TICKET_COMANDA_AREA', [SALADOS])).toBe(true);
    expect(equipoAcepta(c, 'TICKET_COMANDA_AREA', [POSTRES])).toBe(false);
    expect(equipoAcepta(c, 'TICKET_COMANDA_AREA', [null])).toBe(true);
    expect(equipoAcepta(c, 'ETIQUETA_AREA', [POSTRES])).toBe(true);
    expect(equipoAcepta(c, 'ETIQUETA_AREA', [SALADOS])).toBe(false);
    expect(equipoAcepta(c, 'ETIQUETA_AREA', [null])).toBe(false);
  });

  it('sticker general: interruptor propio; sticker de bebida: por área de la línea o la de Bebidas', () => {
    expect(equipoAcepta(cfg({ etiquetera: true, stickerGeneral: true }), 'ETIQUETA_GENERAL', [null])).toBe(true);
    expect(equipoAcepta(cfg({ etiquetera: true }), 'ETIQUETA_GENERAL', [null])).toBe(false);
    const b = cfg({ etiquetera: true, stickerBebidaAreas: [BEBIDAS] });
    expect(equipoAcepta(b, 'ETIQUETA_BEBIDA', [null, BEBIDAS])).toBe(true);
    expect(equipoAcepta(b, 'ETIQUETA_BEBIDA', [POSTRES, BEBIDAS])).toBe(true);
    expect(equipoAcepta(b, 'ETIQUETA_BEBIDA', [POSTRES, null])).toBe(false);
  });
});

describe('destinoDeTrabajo por configuración de equipo', () => {
  it('sin ninguna PC configurada no hay destino: el trabajo espera en cola con aviso', () => {
    for (const tipo of ['ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA', 'TICKET_PAGO', 'TICKET_COMANDA_SALON']) {
      expect(destinoDeTrabajo(tipo, [SALADOS], CONTEXTO_RUTEO_VACIO)).toBeNull();
    }
    expect(destinoDeTrabajo('TICKET_PAGO', [null], ctx({ id: 5n, areaId: null, conectado: true, config: { ...CONFIG_EQUIPO_NUEVO } }))).toBeNull();
  });

  it('cada sticker de área va a la PC que tiene esa área; la otra PC no lo recibe', () => {
    const a = pc(1, { etiquetera: true, stickerAreas: [SALADOS] });
    const b = pc(2, { etiquetera: true, stickerAreas: [POSTRES] });
    expect(destinoDeTrabajo('ETIQUETA_AREA', [SALADOS], ctx(a, b))?.id).toBe(1n);
    expect(destinoDeTrabajo('ETIQUETA_AREA', [POSTRES], ctx(a, b))?.id).toBe(2n);
  });

  it('con dos PC que lo reciben, prefiere la conectada; si ambas, la de id menor', () => {
    const a = pc(1, { ticketera: true, ticketPago: true }, false);
    const b = pc(2, { ticketera: true, ticketPago: true }, true);
    expect(destinoDeTrabajo('TICKET_PAGO', [null], ctx(a, b))?.id).toBe(2n);
    expect(destinoDeTrabajo('TICKET_PAGO', [null], ctx(pc(3, { ticketera: true, ticketPago: true }), b))?.id).toBe(2n);
  });

  it('areasParaRuteo: el vaso mira su línea y Bebidas', () => {
    expect(areasParaRuteo('ETIQUETA_BEBIDA', null, 1n, '7')).toEqual(['7', '1']);
    expect(areasParaRuteo('ETIQUETA_AREA', 3n, 1n)).toEqual(['3']);
    expect(areasParaRuteo('TICKET_PAGO', null, 1n)).toEqual([null]);
  });
});

describe('roles y tipos', () => {
  it('la ticketera toma pago y comandas; la etiquetera, los stickers', () => {
    expect(tiposDeRoles(['TICKETERA'])).toEqual(['TICKET_PAGO', 'TICKET_CIERRE', 'TICKET_COMANDA_SALON', 'TICKET_COMANDA_AREA']);
    expect(tiposDeRoles(['ETIQUETERA'])).toEqual(['ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA']);
    expect(tiposDeRoles([])).toEqual([]);
  });

  it('rolesDeConfig sigue los interruptores de máquina', () => {
    expect(rolesDeConfig(cfg({ ticketera: true }))).toEqual(['TICKETERA']);
    expect(rolesDeConfig(cfg({ etiquetera: true, ticketera: true }))).toEqual(['ETIQUETERA', 'TICKETERA']);
  });
});

describe('aplicaSegunReglas: las reglas del local solo conservan el CUÁNDO (modalidad)', () => {
  const r = REGLAS_IMPRESION_DEFECTO;

  it('el sticker general, si una PC lo enciende, sale en llevar, recoger y delivery (nunca en mesa)', () => {
    for (const m of ['LLEVAR', 'RECOGER', 'DELIVERY']) expect(aplicaSegunReglas('ETIQUETA_GENERAL', m, r)).toBe(true);
    expect(aplicaSegunReglas('ETIQUETA_GENERAL', 'MESA', r)).toBe(false);
    expect(aplicaSegunReglas('ETIQUETA_GENERAL', 'MESA', { ...r, generalModalidades: ['MESA'] })).toBe(true);
  });

  it('el sticker por vaso y por área salen por defecto solo en llevar, recoger y delivery, y es editable', () => {
    expect(aplicaSegunReglas('ETIQUETA_BEBIDA', 'DELIVERY', r)).toBe(true);
    expect(aplicaSegunReglas('ETIQUETA_BEBIDA', 'MESA', r)).toBe(false);
    expect(aplicaSegunReglas('ETIQUETA_BEBIDA', 'MESA', { ...r, bebidaModalidades: ['MESA'] })).toBe(true);
    expect(aplicaSegunReglas('ETIQUETA_AREA', 'DELIVERY', r)).toBe(true);
    expect(aplicaSegunReglas('ETIQUETA_AREA', 'MESA', r)).toBe(false);
  });

  it('el «sí/no» de cada sticker ya no lo manda la regla del local sino la PC', () => {
    expect(aplicaSegunReglas('ETIQUETA_AREA', 'DELIVERY', { ...r, areaActivo: false })).toBe(true);
    expect(aplicaSegunReglas('TICKET_COMANDA_AREA', 'MESA', r)).toBe(true);
  });

  it('la comanda de salón solo es para mesa/local, nunca llevar ni delivery', () => {
    expect(aplicaSegunReglas('TICKET_COMANDA_SALON', 'MESA', r)).toBe(true);
    expect(aplicaSegunReglas('TICKET_COMANDA_SALON', 'LOCAL', r)).toBe(true);
    expect(aplicaSegunReglas('TICKET_COMANDA_SALON', 'LLEVAR', r)).toBe(false);
    expect(aplicaSegunReglas('TICKET_COMANDA_SALON', 'DELIVERY', r)).toBe(false);
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
    expect(r.areaActivo).toBe(true);
  });

  it('valoresDesdeCambio valida modalidades y booleanos', () => {
    expect(valoresDesdeCambio({ generalModalidades: ['LLEVAR', 'LLEVAR'] })).toEqual({
      [CLAVES_CONFIG_IMPRESION.ETIQUETA_GENERAL_MODALIDADES]: ['LLEVAR'],
    });
    expect(() => valoresDesdeCambio({ generalModalidades: ['PLANETA'] })).toThrow();
    expect(() => valoresDesdeCambio({ bebidaActivo: 'no' as any })).toThrow();
  });

  it('la clave de la regla de comanda por área se lee y se guarda como impresion_ticket_comanda_area_activo', () => {
    expect(CLAVES_CONFIG_IMPRESION.TICKET_COMANDA_AREA_ACTIVO).toBe('impresion_ticket_comanda_area_activo');
    expect(reglasDesdeValores({ impresion_ticket_comanda_area_activo: true }).comandaAreaActivo).toBe(true);
    expect(valoresDesdeCambio({ comandaAreaActivo: true })).toEqual({ impresion_ticket_comanda_area_activo: true });
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
