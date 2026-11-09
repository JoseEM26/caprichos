import { useEffect, useMemo, useRef, useState } from 'react';
import { lineasTicketComandaSalon, lineasTicketPago, maquetarEtiqueta, type TamanoEtiquetaPc } from '@caprichos/compartido';
import { EtiquetaSvg } from '../../pedidos/EtiquetaPrevia';
import { CANTIDAD_EJEMPLOS, comoPrecuenta, ejemploPrevia } from './ejemplosPrevia';
import { nombreAleatorio } from './logicaListado';
import './panel-previa.css';

export type PiezaPrevia = 'bebida' | 'area' | 'general' | 'pago' | 'precuenta' | 'comanda';

const PIEZAS: { id: PiezaPrevia; texto: string; titulo: string }[] = [
  { id: 'bebida', texto: 'Sticker de bebida', titulo: 'sticker de bebida' },
  { id: 'area', texto: 'Sticker de área', titulo: 'sticker de área' },
  { id: 'general', texto: 'Sticker general', titulo: 'sticker general (llevar y delivery, con bloque PAGO)' },
  { id: 'pago', texto: 'Ticket de pago', titulo: 'ticket de pago (voucher o comprobante)' },
  { id: 'precuenta', texto: 'Precuenta', titulo: 'precuenta' },
  { id: 'comanda', texto: 'Comanda de cocina', titulo: 'comanda de cocina' },
];

export interface PcPrevia {
  id: string;
  nombre: string;
  bebida: TamanoEtiquetaPc;
  general: TamanoEtiquetaPc;
}

const FUENTE_MONO = "'DejaVu Sans Mono','Liberation Mono',Menlo,Consolas,monospace";
const mm = (n: number) => String(n).replace('.', ',');

/** Papel térmico: renglones monoespaciados al ancho del rollo (80 mm = 48 columnas, 58 mm = 32), tal como los arma el programa de la PC. */
function PapelTermico({ lineas, columnas, zoom, etiqueta }: { lineas: { texto: string; centrado?: boolean; negrita?: boolean; qr?: string }[]; columnas: 48 | 32; zoom: number; etiqueta: string }) {
  return (
    <div
      role="img"
      aria-label={etiqueta}
      className="pv-papel"
      data-testid="pv-ticket"
      data-columnas={columnas}
      style={{ width: `${columnas}ch`, fontFamily: FUENTE_MONO, fontSize: `calc(var(--pv-fs) * ${zoom})`, lineHeight: 1.35 }}
    >
      {lineas.map((l, i) =>
        l.qr ? (
          <div key={i} className="pv-qr" aria-hidden="true" data-testid="pv-qr"><span>QR</span></div>
        ) : (
          <div key={i} style={{ fontWeight: l.negrita ? 800 : 400, whiteSpace: 'pre', textAlign: 'left' }}>
            {(l.centrado ? ' '.repeat(Math.max(0, Math.floor((columnas - l.texto.length) / 2))) : '') + l.texto || ' '}
          </div>
        ),
      )}
    </div>
  );
}

/**
 * «Vista previa de lo que se imprime»: las 6 hojas del local con un pedido de ejemplo, dibujadas con el MISMO código que usa
 * el programa de la PC (maqueta de stickers y renglones de ticket de @caprichos/compartido). Plegable, abierta por defecto.
 * `pcId` + `abrir` permiten que la tarjeta de una PC abra el panel con los tamaños de ESA PC.
 */
export function PanelVistaPrevia({ pcs, pcId, abrir = 0 }: { pcs: PcPrevia[]; pcId?: string | null; abrir?: number }) {
  const [pieza, setPieza] = useState<PiezaPrevia>('bebida');
  const [pcSel, setPcSel] = useState<string | null>(pcId ?? null);
  const [indice, setIndice] = useState(0);
  const [nombre, setNombre] = useState(() => nombreAleatorio());
  const [zoom, setZoom] = useState<1 | 2>(1);
  const [columnas, setColumnas] = useState<48 | 32>(48);
  const [anulado, setAnulado] = useState(false);
  const raiz = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!abrir) return;
    if (raiz.current) raiz.current.open = true;
    if (pcId) setPcSel(pcId);
    raiz.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [abrir, pcId]);

  const pc = pcs.find((p) => p.id === pcSel) ?? pcs[0] ?? null;
  const ej = useMemo(() => ejemploPrevia(indice, nombre), [indice, nombre]);
  const otro = () => {
    setIndice((i) => (i + 1) % CANTIDAD_EJEMPLOS);
    setNombre((n) => nombreAleatorio(n));
  };

  const esSticker = pieza === 'bebida' || pieza === 'area' || pieza === 'general';
  const tam = pieza === 'bebida' ? pc?.bebida : pc?.general;
  const maqueta = useMemo(() => {
    if (pieza === 'bebida') return maquetarEtiqueta('ETIQUETA_BEBIDA', ej.bebida, pc?.bebida ?? {});
    if (pieza === 'general') return maquetarEtiqueta('ETIQUETA_GENERAL', ej.general, pc?.general ?? {});
    if (pieza === 'area') return maquetarEtiqueta('ETIQUETA_AREA', ej.area);
    return null;
  }, [pieza, ej, pc]);
  const lineas = useMemo(() => {
    if (pieza === 'pago') return lineasTicketPago(anulado ? { ...ej.pago, marca: 'ANULADO' } : ej.pago, columnas);
    if (pieza === 'precuenta') return lineasTicketPago(comoPrecuenta(ej.pago), columnas);
    if (pieza === 'comanda') return lineasTicketComandaSalon(ej.comanda, columnas);
    return null;
  }, [pieza, ej, columnas, anulado]);

  const info = PIEZAS.find((p) => p.id === pieza)!;
  const medida = esSticker && pieza !== 'area' && tam ? ` · ${mm(tam.anchoMm)} × ${mm(tam.altoMm)} mm${pc ? ` (${pc.nombre})` : ''}` : !esSticker ? ` · papel ${columnas === 48 ? '80' : '58'} mm` : '';
  const descripcion = `Ejemplo de ${info.titulo}: ${ej.descripcion}`;

  return (
    <section className="if-paso pv" aria-labelledby="pv-t" data-testid="panel-previa" data-cfg-id="impresion-vista-previa" tabIndex={-1}>
      <details ref={raiz} open>
        <summary className="pv-resumen">
          <h3 id="pv-t">Vista previa de lo que se imprime</h3>
          <span className="if-sub">Así salen tus papeles, con un pedido de ejemplo (no es un pedido real)</span>
        </summary>

        <div className="pv-pestanas" role="tablist" aria-label="Qué papel ver">
          {PIEZAS.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={pieza === p.id} className="ie-chip pv-tab" data-testid={`pv-tab-${p.id}`} onClick={() => setPieza(p.id)}>
              {p.texto}
            </button>
          ))}
        </div>

        <div className="pv-barra">
          {esSticker && pcs.length > 0 && (
            <label className="pv-campo">
              <span>Tamaño de la PC</span>
              <select value={pc?.id ?? ''} data-testid="pv-pc" onChange={(e) => setPcSel(e.target.value)}>
                {pcs.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </label>
          )}
          {!esSticker && (
            <span role="group" aria-label="Ancho del papel" className="ie-vp-zoom">
              {([48, 32] as const).map((c) => (
                <button key={c} type="button" className="ie-chip" aria-pressed={columnas === c} data-testid={`pv-papel-${c}`} onClick={() => setColumnas(c)}>
                  Papel {c === 48 ? '80' : '58'} mm
                </button>
              ))}
            </span>
          )}
          {pieza === 'pago' && (
            <button type="button" className="ie-chip" aria-pressed={anulado} data-testid="pv-anulado" onClick={() => setAnulado((a) => !a)}>
              Ver marca de reimpresión anulada
            </button>
          )}
          <span role="group" aria-label="Zoom" className="ie-vp-zoom">
            {([1, 2] as const).map((z) => (
              <button key={z} type="button" className="ie-chip" aria-pressed={zoom === z} data-testid={`pv-zoom-${z}`} onClick={() => setZoom(z)}>
                {z}×
              </button>
            ))}
          </span>
          <button type="button" className="ie-chip" data-testid="pv-otro" onClick={otro}>🔀 Otro ejemplo</button>
        </div>
        <p className="if-sub" data-testid="pv-texto" aria-live="polite">{ej.descripcion}{medida}</p>

        <div className="ie-vp-papel" data-testid={`pv-pieza-${pieza}`}>
          {maqueta ? <EtiquetaSvg maqueta={maqueta} etiqueta={descripcion} zoom={zoom} /> : lineas && <PapelTermico lineas={lineas} columnas={columnas} zoom={zoom} etiqueta={descripcion} />}
        </div>
      </details>
    </section>
  );
}
