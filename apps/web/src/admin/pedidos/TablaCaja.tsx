import { totalDe } from './resumenDia';
import { memo, useMemo } from 'react';
import type { Pedido } from './pedidosApi';
import { COLUMNAS_CAJA } from './columnasCaja';
import { estadoVisual } from './estadosCaja';
import { mediosDePedido, montosPorMedio, nombreMedio, MEDIOS_FILTRO } from './mediosFila';

const soles = (n: number) => `S/ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const anulado = (p: Pedido) => ['ANULADO', 'RECHAZADO'].includes(String(p.estado).toUpperCase());

export interface TotalesTabla {
  filas: number;
  total: number;
  propina: number;
  porMedio: Record<string, number>;
}

/** Totales del filtro (los anulados y rechazados no suman). Por medio: con plan dividido, sus montos. */
export function totalesDeFilas(filas: Pedido[]): TotalesTabla {
  const t: TotalesTabla = { filas: filas.length, total: 0, propina: 0, porMedio: {} };
  for (const p of filas) {
    if (anulado(p)) continue;
    t.total += totalDe(p);
    t.propina += Number(p.propina || 0);
    for (const [m, v] of Object.entries(montosPorMedio(p))) t.porMedio[m] = (t.porMedio[m] ?? 0) + v;
  }
  return t;
}

export interface TablaCajaProps {
  /** Filas de la página actual. */
  filas: Pedido[];
  /** Todas las filas del filtro (para los totales al pie). */
  todas: Pedido[];
  columnas: string[];
  seleccionadoId?: string | null;
  alVerDetalle: (p: Pedido) => void;
}

const Fila = memo(function Fila({ p, columnas, alVerDetalle }: { p: Pedido; columnas: string[]; alVerDetalle: (p: Pedido) => void }) {
  const v = estadoVisual(p);
  return (
    <tr data-estado={v.clave} data-testid="fila-caja">
      {columnas.map((id) => {
        const c = COLUMNAS_CAJA.find((x) => x.id === id)!;
        let contenido: React.ReactNode = c.texto(p);
        if (id === 'estado') contenido = <span className="cj2-tb-chip" style={{ background: v.bg, color: v.fg }}>{v.l}</span>;
        if (id === 'medios') {
          const m = mediosDePedido(p);
          contenido = m.length ? m.map((x) => <span key={x} className="cj2-tb-chip cj2-tb-medio" data-medio={x}>{nombreMedio(x)}</span>) : '';
        }
        return (
          <td key={id} className={c.numerica ? 'cj2-tb-num' : undefined} data-col={id} title={typeof contenido === 'string' ? contenido : undefined}>
            {contenido}
          </td>
        );
      })}
      <td className="cj2-tb-ver">
        <button type="button" className="cj2-btn cj2-tb-btn" aria-label={`Ver detalle (${p.codigo})`} onClick={() => alVerDetalle(p)}>
          Ver detalle
        </button>
      </td>
    </tr>
  );
});

/** Tabla compacta para cuadrar la caja: cabecera fija, scroll horizontal dentro de su cuadro y totales al pie. */
export function TablaCaja({ filas, todas, columnas, alVerDetalle }: TablaCajaProps) {
  const totales = useMemo(() => totalesDeFilas(todas), [todas]);
  const medios = MEDIOS_FILTRO.filter((m) => totales.porMedio[m.id] != null);
  return (
    <div className="cj2-tabla-marco" data-testid="tabla-caja">
      <div className="cj2-tabla-scroll">
        <table className="cj2-tabla">
          <thead>
            <tr>
              {columnas.map((id) => {
                const c = COLUMNAS_CAJA.find((x) => x.id === id)!;
                return <th key={id} scope="col" className={c.numerica ? 'cj2-tb-num' : undefined}>{c.titulo}</th>;
              })}
              <th scope="col" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {filas.map((p) => (
              <Fila key={p.id} p={p} columnas={columnas} alVerDetalle={alVerDetalle} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="cj2-tabla-pie" data-testid="totales-tabla">
        <span><strong>{totales.filas}</strong> {totales.filas === 1 ? 'pedido' : 'pedidos'}</span>
        <span data-testid="total-filtro">Total <strong>{soles(totales.total)}</strong></span>
        {totales.propina > 0 && <span>Propinas <strong>{soles(totales.propina)}</strong></span>}
        {medios.map((m) => (
          <span key={m.id} data-testid={`total-medio-${m.id}`}>{m.n} <strong>{soles(totales.porMedio[m.id])}</strong></span>
        ))}
        <span className="cj2-tabla-nota">Sin anulados ni rechazados</span>
      </div>
    </div>
  );
}
