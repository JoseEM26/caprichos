import { describe, it, expect } from 'vitest';
import { NOMBRES_EJEMPLO, contadorEquipos, equiposDelListado, nombreAleatorio, resumenConfig } from '../logicaListado';

const AREAS = [{ id: '1', nombre: 'Bebidas' }, { id: '2', nombre: 'Salados' }];
const CFG: any = { ticketera: false, etiquetera: false, ticketPago: false, comandaSalon: false, comandaAreas: [], stickerGeneral: false, stickerAreas: [], stickerBebidaAreas: [], tamanoGeneral: null, tamanoBebida: null, pausado: false, configurado: true };
const eq = (id: string, over: any = {}): any => ({ deviceKeyId: id, nombre: `PC ${id}`, conectado: true, hostname: 'CAJA-PC', ipLocal: ['192.168.1.5'], ultimoLatido: new Date().toISOString(), ...over });

describe('listado de computadoras', () => {
  it('oculta las antiguas/archivadas y cuenta cuántas', () => {
    const r = equiposDelListado([eq('1', { antigua: true, conectado: false }), eq('2')]);
    expect(r.items.map((i) => i.equipo.deviceKeyId)).toEqual(['2']);
    expect(r.ocultas).toBe(1);
  });

  it('misma computadora e IP sin marca del servidor: la menos viva lleva «posible duplicado» de la conectada', () => {
    const r = equiposDelListado([eq('1'), eq('2', { conectado: false, ultimoLatido: new Date(Date.now() - 3600000).toISOString() })]);
    expect(r.items.find((i) => i.equipo.deviceKeyId === '1')!.duplicadoDe).toBeNull();
    expect(r.items.find((i) => i.equipo.deviceKeyId === '2')!.duplicadoDe).toEqual({ deviceKeyId: '1', nombre: 'PC 1' });
  });

  it('respeta lo que marca el servidor (repetidaDe) y no inventa duplicados con otro nombre de computadora', () => {
    const r = equiposDelListado([eq('1'), eq('2', { hostname: 'OTRA-PC', repetidaDe: { deviceKeyId: '1', nombre: 'PC 1' } }), eq('3', { hostname: 'COCINA' })]);
    expect(r.items.map((i) => i.duplicadoDe?.deviceKeyId ?? null)).toEqual([null, '1', null]);
  });

  it('contador: «3 computadoras · 2 conectadas»', () => {
    expect(contadorEquipos([eq('1'), eq('2'), eq('3', { conectado: false })])).toBe('3 computadoras · 2 conectadas');
    expect(contadorEquipos([eq('1')])).toBe('1 computadora · 1 conectada');
  });

  it('resumen de configuración en chips cortos', () => {
    expect(resumenConfig({ ...CFG, configurado: false }, AREAS)).toEqual([]);
    expect(resumenConfig({ ...CFG, ticketera: true, ticketPago: true, comandaAreas: ['1'], etiquetera: true, stickerBebidaAreas: ['1'], stickerGeneral: true }, AREAS)).toEqual([
      '🎫 Ticket de pago',
      '🎫 Comandas: Bebidas',
      '🏷️ Sticker bebida: Bebidas',
      '🏷️ General',
    ]);
  });

  it('nombre aleatorio: sale de la lista y no repite el anterior', () => {
    for (let i = 0; i < 20; i++) expect(nombreAleatorio('María')).not.toBe('María');
    expect(NOMBRES_EJEMPLO).toContain(nombreAleatorio());
    expect(NOMBRES_EJEMPLO.some((n) => n.length > 25)).toBe(true);
  });
});
