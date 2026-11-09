import { useState } from 'react';
import { juntarProgresos, progresoDePiezas, type ProgresoPiezas } from '../progresoMesa';
import type { MesaSalon, MiPedido } from '../tipos';
import { nombreMesaSalon } from './CambioDeMesa';
import './salon-mesas.css';

/** Pedido de una mesa (el original o un extra) listo para pintar. */
interface FilaPedido {
  id: string;
  codigo: string;
  esExtra: boolean;
  estado: string;
  hora: string;
  total: number;
  progreso: ProgresoPiezas;
  lineas: Array<{ cantidad: number; nombre: string }>;
}

const hora = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
};
const estadoTexto = (e: string) => (e ? e.charAt(0) + e.slice(1).toLowerCase().replace(/_/g, ' ') : '');
const activo = (e?: string | null) => e !== 'ANULADO' && e !== 'RECHAZADO';

/** Filas (original + extras vivos) de una mesa, en orden de toma. */
export function filasDeMesa(mesa: MesaSalon, extras: MiPedido[]): FilaPedido[] {
  const p = mesa.pedido;
  if (!p) return [];
  const filas: FilaPedido[] = [
    {
      id: p.id,
      codigo: p.codigo,
      esExtra: false,
      estado: p.estado ?? '',
      hora: hora(p.creadoEn),
      total: Number(p.total ?? 0),
      progreso: progresoDePiezas(p.progreso, p.estado),
      lineas: (p.lineas ?? []).map((l) => ({ cantidad: l.cantidad, nombre: l.nombre })),
    },
  ];
  for (const e of extras.filter((x) => x.pedidoOrigenId === p.id && activo(x.estado))) {
    filas.push({
      id: e.id,
      codigo: e.codigo,
      esExtra: true,
      estado: e.estado,
      hora: hora(e.creadoEn),
      total: Number(e.total ?? 0),
      progreso: progresoDePiezas(e.progreso, e.estado),
      lineas: (e.lineas ?? []).map((l) => ({ cantidad: l.cantidad, nombre: l.nombre })),
    });
  }
  return filas;
}

/** Progreso de toda la mesa: original + extras, todas las áreas. */
export const progresoDeMesa = (mesa: MesaSalon, extras: MiPedido[]): ProgresoPiezas =>
  juntarProgresos(filasDeMesa(mesa, extras).map((f) => f.progreso));

const textoPct = (p: ProgresoPiezas) => (p.total === 0 ? '' : p.porcentaje >= 100 ? 'Todo listo' : `${p.porcentaje}%`);

function BarraMini({ progreso, nombre }: { progreso: ProgresoPiezas; nombre: string }) {
  if (progreso.total === 0) return null;
  return (
    <span className="mo-barra-caja">
      <span
        className={`mo-barra${progreso.porcentaje >= 100 ? ' mo-barra--listo' : ''}`}
        role="progressbar"
        aria-label={`Avance de ${nombre}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progreso.porcentaje}
        aria-valuetext={textoPct(progreso)}
      >
        <span className="mo-barra-nivel" style={{ width: `${progreso.porcentaje}%` }} />
      </span>
      <span className="mo-pct">{textoPct(progreso)}</span>
    </span>
  );
}

function Areas({ progreso }: { progreso: ProgresoPiezas }) {
  const areas = progreso.porArea.filter((a) => a.total > 0);
  if (areas.length === 0) return null;
  return (
    <ul className="mo-areas" aria-label="Avance por área">
      {areas.map((a) => (
        <li key={a.nombre} className={a.listas >= a.total ? 'mo-area mo-area--lista' : 'mo-area'}>
          {a.nombre} {a.listas}/{a.total}
        </li>
      ))}
    </ul>
  );
}

function Fila({ fila, ultima, pocas }: { fila: FilaPedido; ultima: boolean; pocas: boolean }) {
  // Con 1-2 pedidos queda abierta la última o la que tiene algo pendiente; con más, todas plegadas (una línea) para no estirar la mesa
  const [abierta, setAbierta] = useState(pocas && (ultima || (fila.progreso.total > 0 && fila.progreso.porcentaje < 100)));
  const nombre = fila.esExtra ? `extra ${fila.codigo}` : `pedido ${fila.codigo}`;
  return (
    <li className="mo-fila">
      <button type="button" className="mo-fila-cab" aria-expanded={abierta} onClick={() => setAbierta((a) => !a)}>
        <span className="mo-fila-titulo">{fila.esExtra ? 'Extra' : 'Pedido'} {fila.codigo}</span>
        <span className="mo-fila-meta">
          {[fila.hora, estadoTexto(fila.estado), `S/ ${fila.total.toFixed(2)}`, textoPct(fila.progreso)].filter(Boolean).join(' · ')}
        </span>
        <span aria-hidden="true" className="mo-flecha">{abierta ? '▲' : '▼'}</span>
      </button>
      {abierta && (
        <div className="mo-fila-cuerpo">
          <BarraMini progreso={fila.progreso} nombre={nombre} />
          <Areas progreso={fila.progreso} />
          <ul className="mo-lineas">
            {fila.lineas.map((l, i) => (
              <li key={i}>{l.cantidad} × {l.nombre}</li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

export interface MesasOcupadasProps {
  mesas: MesaSalon[];
  extras: MiPedido[];
  /** Permiso pedidos/extra: sin él no hay botón «+ Pedido extra» */
  alAgregarExtra?: (mesa: MesaSalon) => void;
  alAbrirCuenta: (mesa: MesaSalon) => void;
}

/** Lista de mesas ocupadas: avance de toda la mesa y un pedido plegable por cada extra. Una tarjeta por pedido (mesas juntas, una sola). */
export function MesasOcupadas({ mesas, extras, alAgregarExtra, alAbrirCuenta }: MesasOcupadasProps) {
  const vistos = new Set<string>();
  const unicas = mesas.filter((m) => {
    if (m.estado !== 'OCUPADA' || !m.pedido || !activo(m.pedido.estado) || vistos.has(m.pedido.id)) return false;
    vistos.add(m.pedido.id);
    return true;
  });
  if (unicas.length === 0) return null;
  return (
    <section className="mo" aria-label="Mesas ocupadas">
      <h3 className="mo-titulo">Mesas ocupadas</h3>
      <ul className="mo-lista">
        {unicas.map((m) => (
          <TarjetaMesa key={m.id} mesa={m} extras={extras} alAgregarExtra={alAgregarExtra} alAbrirCuenta={alAbrirCuenta} />
        ))}
      </ul>
    </section>
  );
}

function TarjetaMesa({ mesa: m, extras, alAgregarExtra, alAbrirCuenta }: { mesa: MesaSalon } & Omit<MesasOcupadasProps, 'mesas'>) {
  const filas = filasDeMesa(m, extras);
  const nExtras = filas.length - 1;
  const prog = progresoDeMesa(m, extras);
  // Con 2 o más extras el grupo arranca plegado; el contador «N extras» lo abre y cierra completo
  const [manual, setManual] = useState<boolean | null>(null);
  const grupo = manual ?? nExtras < 2;
  const idGrupo = `mo-grupo-${m.id}`;
  return (
    <li className="mo-tarjeta">
      <div className="mo-cab">
        <button type="button" className="mo-nombre" onClick={() => alAbrirCuenta(m)}>
          {nombreMesaSalon(m)}
          {m.pedido?.cliente ? ` · ${m.pedido.cliente}` : ''}
        </button>
        {nExtras > 0 && (
          <button type="button" className="mo-chip" aria-expanded={grupo} aria-controls={idGrupo} onClick={() => setManual(!grupo)}>
            {nExtras} {nExtras === 1 ? 'extra' : 'extras'} <span aria-hidden="true">{grupo ? '▲' : '▼'}</span>
          </button>
        )}
      </div>
      <BarraMini progreso={prog} nombre={nombreMesaSalon(m)} />
      <Areas progreso={prog} />
      <ul className="mo-filas" id={idGrupo} hidden={!grupo}>
        {filas.map((f, i) => (
          <Fila key={f.id} fila={f} ultima={i === filas.length - 1} pocas={filas.length <= 2} />
        ))}
      </ul>
      {alAgregarExtra && (
        <button type="button" className="mo-extra" onClick={() => alAgregarExtra(m)}>
          + Pedido extra
        </button>
      )}
    </li>
  );
}
