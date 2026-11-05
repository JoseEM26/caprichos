import { describe, it, expect } from 'vitest';
import { derivarFlujo, alternarGrupo, luzDeEquipo, luzDeMaquina, motivoSalida, ordenarPiezas, subRanura, type PiezaFlujo, type Escenario } from '../flujo';
import type { MapaImpresionDatos } from '../../impresionApi';

const CAJA = '10';
const DELIVERY: Escenario = { modalidad: 'DELIVERY', conBebidas: true };

/** Mapa como lo devuelve el servidor: Caja con etiquetera y ticketera; un equipo en Bebidas; áreas apagadas. */
function mapaBase(over: Partial<MapaImpresionDatos> = {}): MapaImpresionDatos {
  return {
    duplicados: [],
    areas: [
      { id: '1', nombre: 'Bebidas', equiposPorRol: { ETIQUETERA: '11', TICKETERA: null } },
      { id: '2', nombre: 'Salados', equiposPorRol: { ETIQUETERA: null, TICKETERA: null } },
      { id: '3', nombre: 'Postres', equiposPorRol: { ETIQUETERA: null, TICKETERA: null } },
    ],
    equipos: [
      { deviceKeyId: CAJA, nombre: 'PC Caja', areaId: null, maquinas: ['ETIQUETERA', 'TICKETERA'], roles: [{ rol: 'ETIQUETERA', estado: 'lista' }, { rol: 'TICKETERA', estado: 'lista' }], ultimoLatido: null, conectado: true },
      { deviceKeyId: '11', nombre: 'Etiquetera bar', areaId: '1', maquinas: ['ETIQUETERA'], roles: [{ rol: 'ETIQUETERA', estado: 'lista' }, { rol: 'TICKETERA', estado: 'no_configurada' }], ultimoLatido: null, conectado: true },
    ],
    reglas: { generalModalidades: ['LLEVAR', 'RECOGER', 'DELIVERY'], bebidaActivo: true, areaActivo: false, comandaSalonActivo: true, comandaAreaActivo: false },
    ruteo: [
      { tipo: 'ETIQUETA_GENERAL', areaId: null, destinoAreaId: null, destinoEquipoId: CAJA, destinoNombre: 'PC Caja', activo: true },
      { tipo: 'ETIQUETA_BEBIDA', areaId: '1', destinoAreaId: '1', destinoEquipoId: '11', destinoNombre: 'Etiquetera bar', activo: true },
      { tipo: 'ETIQUETA_AREA', areaId: '1', destinoAreaId: '1', destinoEquipoId: '11', destinoNombre: 'Etiquetera bar', activo: false },
      { tipo: 'ETIQUETA_AREA', areaId: '2', destinoAreaId: null, destinoEquipoId: CAJA, destinoNombre: 'PC Caja', activo: false },
      { tipo: 'ETIQUETA_AREA', areaId: '3', destinoAreaId: null, destinoEquipoId: CAJA, destinoNombre: 'PC Caja', activo: false },
      { tipo: 'TICKET_COMANDA_SALON', areaId: null, destinoAreaId: null, destinoEquipoId: CAJA, destinoNombre: 'PC Caja', activo: true },
      { tipo: 'TICKET_COMANDA_AREA', areaId: '1', destinoAreaId: null, destinoEquipoId: CAJA, destinoNombre: 'PC Caja', activo: false },
      { tipo: 'TICKET_COMANDA_AREA', areaId: '2', destinoAreaId: null, destinoEquipoId: CAJA, destinoNombre: 'PC Caja', activo: false },
      { tipo: 'TICKET_COMANDA_AREA', areaId: '3', destinoAreaId: null, destinoEquipoId: CAJA, destinoNombre: 'PC Caja', activo: false },
      { tipo: 'TICKET_PAGO', areaId: null, destinoAreaId: null, destinoEquipoId: CAJA, destinoNombre: 'PC Caja', activo: true },
    ],
    colaPendientePorEquipo: [],
    ...over,
  };
}

const pieza = (f: PiezaFlujo[], clave: string) => f.find((p) => p.clave === clave)!;

describe('derivarFlujo', () => {
  it('en salón no sale el resumen con total; en delivery sí', () => {
    const salon = derivarFlujo(mapaBase(), { modalidad: 'MESA', conBebidas: false });
    expect(pieza(salon, 'RESUMEN').sale).toBe(false);
    expect(pieza(salon, 'RESUMEN').motivo).toContain('No sale en Salón');

    const delivery = derivarFlujo(mapaBase(), DELIVERY);
    expect(pieza(delivery, 'RESUMEN').sale).toBe(true);
  });

  it('bebida apagada no sale, aunque el pedido lleve bebidas', () => {
    const f = derivarFlujo(mapaBase({ reglas: { ...mapaBase().reglas, bebidaActivo: false } }), DELIVERY);
    expect(pieza(f, 'BEBIDA').reglaActiva).toBe(false);
    expect(pieza(f, 'BEBIDA').sale).toBe(false);
  });

  it('bebida encendida pero el pedido no lleva bebidas: no sale', () => {
    const f = derivarFlujo(mapaBase(), { modalidad: 'LLEVAR', conBebidas: false });
    expect(pieza(f, 'BEBIDA').sale).toBe(false);
    expect(pieza(f, 'BEBIDA').reglaActiva).toBe(true);
  });

  it('sticker por área viene apagado por defecto', () => {
    const f = derivarFlujo(mapaBase(), DELIVERY);
    expect(pieza(f, 'AREA').reglaActiva).toBe(false);
    expect(pieza(f, 'AREA').sale).toBe(false);
  });

  it('área con equipo: el sticker va a su equipo, sin espera', () => {
    const mapa = mapaBase({
      reglas: { ...mapaBase().reglas, areaActivo: true },
      equipos: [...mapaBase().equipos, { deviceKeyId: '12', nombre: 'Etiquetera cocina', areaId: '2', maquinas: ['ETIQUETERA'], roles: [{ rol: 'ETIQUETERA', estado: 'lista' }], ultimoLatido: null, conectado: true }],
      ruteo: mapaBase().ruteo.map((x) => (x.tipo === 'ETIQUETA_AREA' && x.areaId === '2' ? { ...x, destinoAreaId: '2', destinoEquipoId: '12', destinoNombre: 'Etiquetera cocina' } : x)),
    });
    const s = pieza(derivarFlujo(mapa, DELIVERY), 'AREA').salidas.find((x) => x.slot === '2')!;
    expect(s.equipoId).toBe('12');
    expect(s.espera).toBe(false);
    expect(s.cae).toBe(false);
  });

  it('área con equipo caído: el trabajo espera en su cola, no vuelve a Caja', () => {
    const mapa = mapaBase({
      equipos: [...mapaBase().equipos, { deviceKeyId: '12', nombre: 'Etiquetera cocina', areaId: '2', maquinas: ['ETIQUETERA'], roles: [{ rol: 'ETIQUETERA', estado: 'desconectada' }], ultimoLatido: null, conectado: false }],
      ruteo: mapaBase().ruteo.map((x) => (x.tipo === 'ETIQUETA_AREA' && x.areaId === '2' ? { ...x, destinoAreaId: '2', destinoEquipoId: '12', destinoNombre: 'Etiquetera cocina' } : x)),
      reglas: { ...mapaBase().reglas, areaActivo: true },
    });
    const s = pieza(derivarFlujo(mapa, DELIVERY), 'AREA').salidas.find((x) => x.slot === '2')!;
    expect(s.slot).toBe('2');
    expect(s.espera).toBe(true);
  });

  it('área sin equipo: el sticker cae en Caja y se marca', () => {
    const f = derivarFlujo(mapaBase({ reglas: { ...mapaBase().reglas, areaActivo: true } }), DELIVERY);
    const s = pieza(f, 'AREA').salidas.find((x) => x.slot === null && x.cae)!;
    expect(s).toBeDefined();
    expect(s.equipoId).toBe(CAJA);
  });

  it('el ticket de pago siempre sale en Caja, en cualquier modalidad', () => {
    for (const modalidad of ['MESA', 'LLEVAR', 'DELIVERY'] as const) {
      const pago = pieza(derivarFlujo(mapaBase(), { modalidad, conBebidas: false }), 'PAGO');
      expect(pago.sale).toBe(true);
      expect(pago.salidas.every((s) => s.slot === null && s.equipoId === CAJA)).toBe(true);
    }
  });

  it('la comanda de salón solo sale en mesa o local, con la regla encendida', () => {
    expect(pieza(derivarFlujo(mapaBase(), { modalidad: 'LLEVAR', conBebidas: false }), 'COMANDA').sale).toBe(false);
    expect(pieza(derivarFlujo(mapaBase(), { modalidad: 'MESA', conBebidas: false }), 'COMANDA').sale).toBe(true);
    const apagada = mapaBase({ reglas: { ...mapaBase().reglas, comandaSalonActivo: false } });
    expect(pieza(derivarFlujo(apagada, { modalidad: 'MESA', conBebidas: false }), 'COMANDA').sale).toBe(false);
  });
});

describe('ayudas de flujo y luces', () => {
  it('alternarGrupo añade las modalidades que faltan o quita el grupo entero', () => {
    expect(alternarGrupo(['LLEVAR', 'RECOGER', 'DELIVERY'], ['MESA', 'LOCAL']).sort()).toEqual(['DELIVERY', 'LLEVAR', 'LOCAL', 'MESA', 'RECOGER']);
    expect(alternarGrupo(['LLEVAR', 'RECOGER', 'DELIVERY'], ['LLEVAR', 'RECOGER'])).toEqual(['DELIVERY']);
  });

  it('la luz sigue el peor estado de sus máquinas', () => {
    const base = mapaBase().equipos[1];
    expect(luzDeEquipo(base)).toBe('verde');
    expect(luzDeEquipo({ ...base, roles: [{ rol: 'ETIQUETERA', estado: 'sin_papel' }] })).toBe('ambar');
    expect(luzDeEquipo({ ...base, roles: [{ rol: 'ETIQUETERA', estado: 'error' }] })).toBe('rojo');
    expect(luzDeEquipo({ ...base, conectado: false })).toBe('rojo');
  });
});

describe('motivo y orden para el detalle', () => {
  it('cada salida explica por qué cae ahí', () => {
    const base = { slot: null, equipoId: CAJA, nombreDestino: 'PC Caja', espera: false, cae: false, sinEquipo: false };
    expect(motivoSalida({ ...base, slot: '1', equipoId: '11', nombreDestino: 'Etiquetera bar' })).toBe('Su equipo está asignado a esa área.');
    expect(motivoSalida({ ...base, cae: true })).toContain('cae en Caja');
    expect(motivoSalida({ ...base, slot: '1', espera: true })).toContain('en espera');
    expect(motivoSalida({ ...base, sinEquipo: true, equipoId: null })).toContain('no sale');
    expect(motivoSalida(base)).toBe('Caja imprime esta pieza.');
  });

  it('las piezas de Caja van primero, luego las de cada área (menos cruces)', () => {
    const f = derivarFlujo(mapaBase(), DELIVERY);
    const orden = ordenarPiezas(f, [null, '1', '2', '3']).map((p) => p.clave);
    expect(orden.indexOf('BEBIDA')).toBeGreaterThan(orden.indexOf('RESUMEN'));
    expect(orden.indexOf('BEBIDA')).toBeGreaterThan(orden.indexOf('PAGO'));
    expect(orden).toHaveLength(6);
  });
});

describe('comanda por área en el flujo', () => {
  it('viene apagada por defecto y no sale con ningún pedido', () => {
    const pieza1 = pieza(derivarFlujo(mapaBase(), DELIVERY), 'COMANDA_AREA');
    expect(pieza1.reglaActiva).toBe(false);
    expect(pieza1.sale).toBe(false);
    expect(pieza1.motivo).toBe('Apagada en las reglas');
  });

  it('encendida sale en cualquier modalidad, con una hoja por área a su ticketera o a Caja', () => {
    const mapa = mapaBase({
      reglas: { ...mapaBase().reglas, comandaAreaActivo: true },
      equipos: [...mapaBase().equipos, { deviceKeyId: '12', nombre: 'Ticketera salados', areaId: '2', maquinas: ['TICKETERA'], roles: [{ rol: 'ETIQUETERA', estado: 'no_configurada' }, { rol: 'TICKETERA', estado: 'lista' }], ultimoLatido: null, conectado: true }],
      ruteo: mapaBase().ruteo.map((x) => (x.tipo === 'TICKET_COMANDA_AREA' && x.areaId === '2' ? { ...x, destinoAreaId: '2', destinoEquipoId: '12', destinoNombre: 'Ticketera salados' } : x)),
    });
    for (const modalidad of ['MESA', 'LLEVAR', 'DELIVERY'] as const) {
      const p = pieza(derivarFlujo(mapa, { modalidad, conBebidas: false }), 'COMANDA_AREA');
      expect(p.sale).toBe(true);
    }
    const salidas = pieza(derivarFlujo(mapa, DELIVERY), 'COMANDA_AREA').salidas;
    expect(salidas.find((s) => s.slot === '2')).toMatchObject({ equipoId: '12', cae: false });
    expect(salidas.find((s) => s.slot === null && s.cae)).toBeDefined();
  });
});

describe('máquinas de un equipo y sub-ranuras de área', () => {
  it('un equipo con solo etiquetera no se ve «en ámbar» por la ticketera que no tiene', () => {
    const eq = mapaBase().equipos[1];
    expect(luzDeEquipo(eq)).toBe('verde');
    expect(luzDeMaquina(eq, 'ETIQUETERA')).toBe('verde');
  });

  it('subRanura distingue equipo con la máquina, equipo sin esa máquina y área sin equipo', () => {
    const mapa = mapaBase();
    expect(subRanura(mapa, '1', 'ETIQUETERA')).toMatchObject({ tipo: 'equipo', equipo: { deviceKeyId: '11' }, estado: 'lista' });
    expect(subRanura(mapa, '1', 'TICKETERA')).toMatchObject({ tipo: 'sin_maquina', equipo: { deviceKeyId: '11' } });
    expect(subRanura(mapa, '2', 'ETIQUETERA')).toEqual({ tipo: 'sin_equipo' });
  });

  it('luz de una máquina: sin conexión o con error es roja; sin papel, ámbar', () => {
    const eq = mapaBase().equipos[1];
    expect(luzDeMaquina({ ...eq, conectado: false }, 'ETIQUETERA')).toBe('rojo');
    expect(luzDeMaquina({ ...eq, roles: [{ rol: 'ETIQUETERA', estado: 'sin_papel' }, { rol: 'TICKETERA', estado: 'no_configurada' }] }, 'ETIQUETERA')).toBe('ambar');
  });
});

