import { useMemo, useState } from 'react';
import { CuadriculaPlano } from './CuadriculaPlano';
import { ElementoPlano, MesaSalon, PisoPlano, PisoSalon } from '../tipos';

/**
 * Croquis para elegir UNA o VARIAS mesas (reservas, y después pedidos de salón).
 * Es independiente de la API: quien lo usa pasa los pisos, la selección y las mesas ocupadas
 * a esa hora; el componente avisa cada cambio con `onCambio`.
 * - Tocar una mesa libre la suma a la selección; tocarla de nuevo la quita.
 * - Las mesas en `ocupadas` (otra reserva que se cruza) se ven ocupadas y no se pueden elegir.
 * - Resume «Mesas 3 y 4 · capacidad total 8» y avisa si los asientos no alcanzan para `personas`
 *   (solo avisa: quien lo usa decide si lo permite con confirmación).
 */

export interface OcupacionMesa {
  reservaId?: string;
  nombre?: string | null;
  /** Hora de la reserva que ocupa la mesa (HH:mm) */
  hora?: string | null;
}

export interface SelectorMesasCroquisProps {
  pisos: PisoSalon[];
  /** Dibujo del plano (paredes, cocina, barra...) por piso; el endpoint del salón no lo trae. Sin él, solo se ven las mesas. */
  planos?: PisoPlano[];
  seleccionadas: string[];
  onCambio: (ids: string[]) => void;
  /** Personas de la reserva. Sin valor no se avisa de capacidad. */
  personas?: number;
  /** Mesas no elegibles a esa hora, por id de mesa. */
  ocupadas?: Record<string, OcupacionMesa>;
  /** Mesas reservadas a esa hora: se ven marcadas (R) pero siguen siendo elegibles. */
  reservadas?: Record<string, OcupacionMesa>;
  /** Mantener 2 s una mesa ocupada (vista previa). Sin él, no hay vista previa. */
  alMantenerMesa?: (mesa: MesaSalon) => void;
  /** Tocar una mesa ocupada (no se elige): quien lo usa puede avisar por qué. */
  alTocarOcupada?: (mesa: MesaSalon) => void;
  deshabilitado?: boolean;
}

/** Nombres cortos para el resumen: «3 y 4», «3, 4 y 5». */
function unirNombres(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/** «Mesa 3», «Mesas 3 y 4», «Mesas 3, 4 y 5»: cómo se nombran las mesas de una reserva en pantalla. */
export function etiquetaMesas(mesas: Array<{ numero?: number | null; nombre?: string | null }>): string {
  if (mesas.length === 0) return '';
  const etiquetas = mesas.map((m) => String(m.numero ?? m.nombre ?? '?'));
  return `${mesas.length === 1 ? 'Mesa' : 'Mesas'} ${unirNombres(etiquetas)}`;
}

/** Texto del resumen y asientos de una selección de mesas. Función pura: se prueba sola. */
export function resumenMesas(mesas: MesaSalon[], personas?: number) {
  const capacidad = mesas.reduce((suma, m) => suma + (m.asientos ?? 0), 0);
  const texto =
    mesas.length === 0
      ? 'Sin mesas elegidas'
      : `${etiquetaMesas(mesas)} · capacidad total ${capacidad}`;
  const faltan = personas !== undefined ? Math.max(0, personas - capacidad) : 0;
  return { texto, capacidad, faltan };
}

const estiloBoton = (activo: boolean) =>
  ({
    minHeight: '36px',
    padding: '0 12px',
    borderRadius: '10px',
    border: '1.5px solid var(--cp-navy)',
    background: activo ? 'var(--cp-navy)' : 'var(--cp-white)',
    color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
    fontWeight: 800,
    cursor: 'pointer',
  }) as const;

export function SelectorMesasCroquis({
  pisos,
  planos,
  seleccionadas,
  onCambio,
  personas,
  ocupadas = {},
  reservadas = {},
  alMantenerMesa,
  alTocarOcupada,
  deshabilitado = false,
}: SelectorMesasCroquisProps) {
  const pisosActivos = useMemo(() => pisos.filter((p) => p.activo !== false), [pisos]);
  const [pisoElegidoId, setPisoElegidoId] = useState<string | null>(null);
  const pisoActual = pisosActivos.find((p) => p.id === pisoElegidoId) ?? pisosActivos[0];

  const todasLasMesas = useMemo(
    () => pisosActivos.flatMap((p) => (p.mesas || []).filter((m) => m.activo)),
    [pisosActivos],
  );
  const elegidas = useMemo(
    () => todasLasMesas.filter((m) => seleccionadas.includes(m.id)),
    [todasLasMesas, seleccionadas],
  );
  const resumen = resumenMesas(elegidas, personas);

  // Celdas del croquis: las mesas (el endpoint del salón no trae `elementos`) y, si vienen, los
  // elementos que no son mesa (paredes, barra...). Las mesas se dibujan con su posición real.
  const elementosDelPiso: ElementoPlano[] = useMemo(() => {
    const mesasComoElemento: ElementoPlano[] = (pisoActual?.mesas || [])
      .filter((m) => m.activo)
      .map((m) => ({
        id: m.id,
        pisoId: m.pisoId,
        tipo: 'MESA',
        nombre: m.nombre,
        x: m.x,
        y: m.y,
        ancho: m.ancho,
        alto: m.alto,
        numero: m.numero,
        asientos: m.asientos,
        activo: m.activo,
      }));
    const dibujo = planos?.find((pl) => pl.id === pisoActual?.id)?.elementos ?? pisoActual?.elementos ?? [];
    const otros = dibujo.filter((e) => e.tipo !== 'MESA' && e.activo !== false);
    return [...otros, ...mesasComoElemento];
  }, [pisoActual, planos]);

  // Las mesas del piso llevan el estado que pide el croquis: ocupada = otra reserva a esa hora.
  const mesasDelPiso: MesaSalon[] = useMemo(
    () =>
      (pisoActual?.mesas || [])
        .filter((m) => m.activo)
        .map((m) => {
          const ocupada = ocupadas[m.id];
          // Ocupada con su pedido (modal de pedidos): se ve el pedido; sin pedido, la marca de reserva de siempre
          const marca = ocupada && !m.pedido ? ocupada : ocupada ? null : reservadas[m.id];
          return {
            ...m,
            estado: ocupada ? 'OCUPADA' : 'LIBRE',
            pedido: ocupada && m.pedido ? m.pedido : null,
            reserva: marca
              ? { id: marca.reservaId ?? '', hora: marca.hora ?? '', nombre: marca.nombre ?? 'Reserva', personas: 0 }
              : null,
          } as MesaSalon;
        }),
    [pisoActual, ocupadas, reservadas],
  );

  const alTocarMesa = (mesa: MesaSalon) => {
    if (deshabilitado) return;
    if (ocupadas[mesa.id]) {
      alTocarOcupada?.(mesa);
      return;
    }
    onCambio(
      seleccionadas.includes(mesa.id)
        ? seleccionadas.filter((id) => id !== mesa.id)
        : [...seleccionadas, mesa.id],
    );
  };

  if (pisosActivos.length === 0) {
    return <div style={{ fontSize: '13px', color: 'var(--cp-rust)' }}>No hay plano del salón con mesas activas.</div>;
  }

  const columnas = pisoActual?.cuadriculaAncho || pisoActual?.cuadricula_ancho || 20;
  const filas = pisoActual?.cuadriculaAlto || pisoActual?.cuadricula_alto || 12;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} data-testid="selector-mesas-croquis">
      {pisosActivos.length > 1 && (
        <div role="tablist" aria-label="Pisos" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {pisosActivos.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === pisoActual?.id}
              onClick={() => setPisoElegidoId(p.id)}
              style={estiloBoton(p.id === pisoActual?.id)}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      )}

      <div role="group" aria-label="Croquis del piso">
        <CuadriculaPlano
          columnas={columnas}
          filas={filas}
          elementos={elementosDelPiso}
          modoSalon
          mesasSalon={mesasDelPiso}
          mesasSeleccionadasIds={seleccionadas}
          onSeleccionarMesaSalon={alTocarMesa}
          alMantenerMesaSalon={alMantenerMesa}
        />
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--cp-soft)' }}>
        <span>Verde: libre</span>
        <span>Azul: elegida</span>
        <span>Naranja: ocupada o reservada a esa hora</span>
      </div>

      <div role="status" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--cp-navy)' }}>
        {resumen.texto}
      </div>

      {elegidas.length > 0 && resumen.faltan > 0 && (
        <div role="alert" style={{ fontSize: '13px', color: 'var(--cp-rust)', fontWeight: 700 }}>
          Las mesas suman {resumen.capacidad} asientos y son {personas} personas: faltan {resumen.faltan}.
        </div>
      )}
    </div>
  );
}
