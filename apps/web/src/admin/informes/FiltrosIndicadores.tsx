import { useCallback, useId, useMemo, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ddmm, diasEntre, hoyLima, sumarDias } from '../analisis/comun/fechas';

export type PresetIndicadores = 'hoy' | 'ayer' | '7d' | 'mes' | 'mesAnterior' | 'rango';
export type ClaveFiltro = 'periodo' | 'canal' | 'modalidad' | 'categoria';

export const PRESETS_INDICADORES: ReadonlyArray<{ id: PresetIndicadores; nombre: string }> = [
  { id: 'hoy', nombre: 'Hoy' },
  { id: 'ayer', nombre: 'Ayer' },
  { id: '7d', nombre: 'Últimos 7 días' },
  { id: 'mes', nombre: 'Este mes' },
  { id: 'mesAnterior', nombre: 'Mes anterior' },
  { id: 'rango', nombre: 'Personalizado' },
];

/** Valores reales del esquema (ck_pedido_canal y ck_pedido_modalidad). */
export const CANALES = [
  { id: 'CARTA', nombre: 'Carta web' },
  { id: 'WHATSAPP', nombre: 'WhatsApp' },
  { id: 'BOT', nombre: 'Bot de WhatsApp' },
  { id: 'CAJA', nombre: 'Caja' },
  { id: 'MOZO', nombre: 'Mozo' },
  { id: 'MOSTRADOR', nombre: 'Mostrador' },
  { id: 'TELEFONO', nombre: 'Teléfono' },
];
export const MODALIDADES = [
  { id: 'MESA', nombre: 'En mesa' },
  { id: 'COMER_LOCAL', nombre: 'Comer en local' },
  { id: 'RECOGER', nombre: 'Para recoger' },
  { id: 'LLEVAR', nombre: 'Para llevar' },
  { id: 'DELIVERY', nombre: 'Delivery' },
];

export const MAX_DIAS = 366;
const NOMBRE_FILTRO: Record<ClaveFiltro, string> = {
  periodo: 'periodo',
  canal: 'canal',
  modalidad: 'tipo de pedido',
  categoria: 'categoría',
};

export interface FiltrosIndicadores {
  preset: PresetIndicadores;
  desde: string;
  hasta: string;
  canal: string;
  modalidad: string;
  categoria: string;
}

export function rangoDePreset(preset: PresetIndicadores, hoy: string, desde = '', hasta = ''): { desde: string; hasta: string } {
  switch (preset) {
    case 'hoy':
      return { desde: hoy, hasta: hoy };
    case 'ayer':
      return { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, -1) };
    case '7d':
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case 'mesAnterior': {
      const finMes = sumarDias(`${hoy.slice(0, 8)}01`, -1);
      return { desde: `${finMes.slice(0, 8)}01`, hasta: finMes };
    }
    case 'rango':
      return { desde: desde || hoy, hasta: hasta || desde || hoy };
    default:
      return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  }
}

function errorDeRango(desde: string, hasta: string, hoy: string): string {
  if (desde > hasta) return 'La fecha inicial no puede ser después de la final.';
  if (hasta > hoy) return 'No se puede mirar el futuro.';
  if (diasEntre(desde, hasta) > MAX_DIAS) return `Elige como máximo ${MAX_DIAS} días.`;
  return '';
}

/** Texto «14/11 al 14/11» (con año si no es el actual). */
export function textoPeriodo(f: { desde: string; hasta: string }, hoy: string): string {
  const t = (iso: string) => (iso.slice(0, 4) === hoy.slice(0, 4) ? ddmm(iso) : `${ddmm(iso)}/${iso.slice(0, 4)}`);
  return `${t(f.desde)} al ${t(f.hasta)}`;
}

/** Filtros guardados en la dirección (periodo, desde, hasta, canal, modalidad, categoria). */
export function useFiltrosIndicadores() {
  const [params, setParams] = useSearchParams();
  const hoy = useMemo(() => hoyLima(), []);
  const presetUrl = params.get('periodo');
  const preset = PRESETS_INDICADORES.some((p) => p.id === presetUrl) ? (presetUrl as PresetIndicadores) : 'mes';
  const { desde, hasta } = rangoDePreset(preset, hoy, params.get('desde') ?? '', params.get('hasta') ?? '');
  const filtros: FiltrosIndicadores = {
    preset,
    desde,
    hasta,
    canal: CANALES.some((c) => c.id === params.get('canal')) ? params.get('canal')! : '',
    modalidad: MODALIDADES.some((m) => m.id === params.get('modalidad')) ? params.get('modalidad')! : '',
    categoria: params.get('categoria') ?? '',
  };
  const errorFechas = errorDeRango(desde, hasta, hoy);

  const cambiar = useCallback(
    (cambios: Record<string, string>) =>
      setParams(
        (previo) => {
          const nuevo = new URLSearchParams(previo);
          for (const [k, v] of Object.entries(cambios)) {
            if (v) nuevo.set(k, v);
            else nuevo.delete(k);
          }
          return nuevo;
        },
        { replace: true },
      ),
    [setParams],
  );
  const limpiar = useCallback(() => cambiar({ periodo: '', desde: '', hasta: '', canal: '', modalidad: '', categoria: '' }), [cambiar]);
  const hayFiltros = preset !== 'mes' || !!(filtros.canal || filtros.modalidad || filtros.categoria);
  return { filtros, errorFechas, hoy, cambiar, limpiar, hayFiltros };
}

/** Nota «No aplica el filtro de canal» para los filtros activos que el cuadro no usa (vacío si ninguno). */
export function notaNoAplica(aplica: readonly ClaveFiltro[], f: FiltrosIndicadores): string {
  const activos: ClaveFiltro[] = [];
  if (f.canal) activos.push('canal');
  if (f.modalidad) activos.push('modalidad');
  if (f.categoria) activos.push('categoria');
  if (f.preset !== 'mes') activos.push('periodo');
  const faltan = activos.filter((a) => !aplica.includes(a)).map((a) => NOMBRE_FILTRO[a]);
  if (!faltan.length) return '';
  return `${faltan.length > 1 ? 'No aplican los filtros de' : 'No aplica el filtro de'} ${faltan.join(' y ')}`;
}

const chip = (activo: boolean): CSSProperties => ({
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 9999,
  border: '1.5px solid var(--cp-navy)',
  background: activo ? 'var(--cp-navy)' : 'transparent',
  color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
});
const campo: CSSProperties = {
  minHeight: 44,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid var(--cp-line)',
  background: 'var(--cp-white)',
  font: 'inherit',
  maxWidth: '100%',
};
const grupo: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 };
const etiqueta: CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' };

/** Barra general: un solo juego de filtros para todos los cuadros de Indicadores. */
export function BarraFiltrosIndicadores({
  filtros,
  errorFechas,
  hoy,
  categorias,
  hayFiltros,
  alCambiar,
  alLimpiar,
}: {
  filtros: FiltrosIndicadores;
  errorFechas: string;
  hoy: string;
  categorias: readonly string[];
  hayFiltros: boolean;
  alCambiar: (c: Record<string, string>) => void;
  alLimpiar: () => void;
}) {
  const id = useId();
  const elegir = (p: PresetIndicadores) =>
    alCambiar(p === 'rango' ? { periodo: p, desde: filtros.desde, hasta: filtros.hasta } : { periodo: p === 'mes' ? '' : p, desde: '', hasta: '' });
  const opciones = filtros.categoria && !categorias.includes(filtros.categoria) ? [...categorias, filtros.categoria] : categorias;
  return (
    <div
      role="group"
      aria-label="Filtros generales de indicadores"
      style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={grupo}>
        <span style={etiqueta} id={`${id}-per`}>
          Periodo
        </span>
        <div role="group" aria-labelledby={`${id}-per`} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS_INDICADORES.map((p) => (
            <button key={p.id} type="button" aria-pressed={filtros.preset === p.id} onClick={() => elegir(p.id)} style={chip(filtros.preset === p.id)}>
              {p.nombre}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        {filtros.preset === 'rango' && (
          <>
            <div style={grupo}>
              <label style={etiqueta} htmlFor={`${id}-d`}>
                Desde
              </label>
              <input id={`${id}-d`} type="date" max={hoy} value={filtros.desde} onChange={(e) => alCambiar({ desde: e.target.value })} style={campo} />
            </div>
            <div style={grupo}>
              <label style={etiqueta} htmlFor={`${id}-h`}>
                Hasta
              </label>
              <input id={`${id}-h`} type="date" max={hoy} value={filtros.hasta} onChange={(e) => alCambiar({ hasta: e.target.value })} style={campo} />
            </div>
          </>
        )}
        <div style={grupo}>
          <label style={etiqueta} htmlFor={`${id}-c`}>
            Canal
          </label>
          <select id={`${id}-c`} value={filtros.canal} onChange={(e) => alCambiar({ canal: e.target.value })} style={campo}>
            <option value="">Todos</option>
            {CANALES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div style={grupo}>
          <label style={etiqueta} htmlFor={`${id}-m`}>
            Tipo de pedido
          </label>
          <select id={`${id}-m`} value={filtros.modalidad} onChange={(e) => alCambiar({ modalidad: e.target.value })} style={campo}>
            <option value="">Todos</option>
            {MODALIDADES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
        <div style={grupo}>
          <label style={etiqueta} htmlFor={`${id}-k`}>
            Categoría de producto
          </label>
          <select id={`${id}-k`} value={filtros.categoria} onChange={(e) => alCambiar({ categoria: e.target.value })} style={campo}>
            <option value="">Todas</option>
            {opciones.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={alLimpiar} disabled={!hayFiltros} style={{ ...chip(false), opacity: hayFiltros ? 1 : 0.5, cursor: hayFiltros ? 'pointer' : 'default' }}>
          Limpiar filtros
        </button>
      </div>
      {errorFechas && (
        <p role="alert" style={{ margin: 0, color: 'var(--cp-rust)', fontSize: 13, fontWeight: 700 }}>
          {errorFechas}
        </p>
      )}
    </div>
  );
}
