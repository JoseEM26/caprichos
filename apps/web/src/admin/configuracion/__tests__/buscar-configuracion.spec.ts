import { describe, it, expect } from 'vitest';
import { CATALOGO } from '../catalogo';
import { buscar, normaliza, cercana, rangosResaltado } from '../catalogo/buscar';

const ids = (q: string, op = {}) => buscar(CATALOGO, q, op).map((r) => r.entrada.id);

describe('Búsqueda de configuración', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(normaliza('Envío GRATIS ñandú')).toBe('envio gratis nandu');
    expect(ids('ENVIO gratis')).toEqual(ids('envío gratis'));
    expect(ids('envio gratis').length).toBeGreaterThan(0);
  });

  it('tolera un error de tipeo en términos de 5+ letras', () => {
    expect(cercana('horaro', 'horario')).toBe(true);
    expect(cercana('impreosra', 'impresora')).toBe(true); // transposición
    expect(ids('impresroa')).toContain('impresion-agente');
    expect(ids('horaro')).toContain('horario-semanal');
    expect(ids('cat')).not.toContain('horario-semanal');
  });

  it('exige todas las palabras (AND) y cae a cualquiera (OR) si nadie las cumple', () => {
    expect(ids('spam minuto')).toContain('chatbot-limite-spam');
    expect(ids('spam minuto')).not.toContain('impresion-agente');
    const or = ids('spam impresora');
    expect(or).toContain('chatbot-limite-spam');
    expect(or).toContain('impresion-agente');
  });

  it('ordena: título > palabras clave > descripción', () => {
    const r = ids('wifi');
    expect(r[0]).toBe('operacion-wifi-nombre');
    const lista = [
      { id: 'a', tab: 't', seccion: 's', titulo: 'Otra cosa', descripcion: 'menciona zebra aquí', palabras: [] },
      { id: 'b', tab: 't', seccion: 's', titulo: 'Otra cosa 2', descripcion: 'nada', palabras: ['zebra'] },
      { id: 'c', tab: 't', seccion: 's', titulo: 'Zebra grande', descripcion: 'nada', palabras: [] },
    ];
    expect(buscar(lista, 'zebra').map((x) => x.entrada.id)).toEqual(['c', 'b', 'a']);
  });

  it('filtra por permiso', () => {
    expect(ids('pausar pedidos')).toContain('demanda-pausa-pedidos');
    expect(ids('pausar pedidos', { visible: (e: any) => !e.permiso })).not.toContain('demanda-pausa-pedidos');
  });

  it('encuentra por clave técnica y por sinónimo del dueño', () => {
    expect(ids('tiempo_prometido_min')).toContain('parametros-tiempo-prometido-min');
    expect(ids('delivery gratis')[0]).toMatch(/envio-gratis/);
  });

  it('calcula rangos de resaltado sobre el texto original con tildes', () => {
    expect(rangosResaltado('Envío gratis', 'envio')).toEqual([[0, 5]]);
  });
});
