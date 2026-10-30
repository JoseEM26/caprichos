import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CSSProperties, KeyboardEvent, RefObject } from 'react';
import { useSesion } from '../../comun/sesion';
import { useEventos } from '../../comun/socket';
import { Confirmar } from '../../comun/Confirmar';
import { useEsMovil } from '../../carta/useEsMovil';
import { ModalReportarFalla } from './ModalReportarFalla';
import { MapaRepartos, type PuntoRepartoMapa } from './MapaRepartos';
import { OpcionesRutaSugerida } from './OpcionesRutaSugerida';
import { useRutasSugeridas } from './useRutasSugeridas';
import {
  repartosApi,
  AvisoRepartidor,
  PedidoReparto,
  RespuestaMios,
  PedidoPerdido,
} from './repartosApi';
import {
  clasificarEspera,
  sugerirOrdenRuta,
  calcularMetricasRuta,
  ConfigReparto,
  CONFIG_REPARTO_DEFECTO,
  COORDENADAS_TIENDA_DEFECTO,
  PedidoParaRuta,
} from './calculoRuta';

type PestanaRepartidor = 'mi_ruta' | 'para_elegir' | 'hechos_hoy';
type EtapaId = 'salir' | 'llegue' | 'entregar';
type MetricasRuta = ReturnType<typeof calcularMetricasRuta>;

interface ConfirmarAccionModal {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  accion: () => Promise<void>;
  peligro?: boolean;
}

interface InfoEtapa {
  id: EtapaId;
  texto: string;
  fondo: string;
  color: string;
}

const PESTANAS: Array<{ id: PestanaRepartidor; etiqueta: string; testid: string }> = [
  { id: 'mi_ruta', etiqueta: 'Mi ruta', testid: 'tab-mi-ruta' },
  { id: 'para_elegir', etiqueta: 'Para elegir', testid: 'tab-para-elegir' },
  { id: 'hechos_hoy', etiqueta: 'Hechos hoy', testid: 'tab-hechos-hoy' },
];

// Paleta del proyecto
const C = {
  navy: '#0B2C3E',
  crema: '#FBF4EC',
  fondo: '#FFFDF9',
  blanco: '#FFFFFF',
  naranja: '#E67929',
  dorado: '#D99E39',
  rust: '#B2500F',
  verde: '#2F7A45',
  borde: '#E3D6C6',
  suave: '#F4ECE1',
  gris: '#5A6E78',
} as const;

const FUENTE_TITULOS = 'var(--fuente-titulos), Montserrat, sans-serif';
const FUENTE_TEXTO = 'Montserrat, sans-serif';

// Desde este ancho del contenido (no de la ventana) la vista pasa a dos columnas
const ANCHO_ESCRITORIO = 1024;
// AdminShell pinta su propia barra inferior del repartidor bajo 700 px (76 px de alto)
const ALTO_BARRA_SHELL = 76;
const ALTO_BARRA_PESTANAS = 72;
const ALTO_RESUMEN_CELULAR = 120;

const botonBase: CSSProperties = {
  minHeight: 48,
  padding: '0 14px',
  borderRadius: 12,
  border: 'none',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  textDecoration: 'none',
  fontFamily: FUENTE_TITULOS,
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
};

const tarjetaBase: CSSProperties = {
  background: C.blanco,
  border: `1.5px solid ${C.borde}`,
  borderRadius: 16,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  boxShadow: '0 2px 8px rgba(11, 44, 62, 0.05)',
};

const chip = (fondo: string, color: string): CSSProperties => ({
  fontSize: 12,
  fontWeight: 800,
  background: fondo,
  color,
  padding: '4px 8px',
  borderRadius: 8,
  whiteSpace: 'nowrap',
});

const SIN_RESALTADOS: string[] = [];

const dosColumnas: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 };

function esEfectivoPendiente(p: PedidoReparto): boolean {
  return p.pago_estado !== 'PAGADO' && (p.pago_metodo === 'EFECTIVO' || p.pago_metodo === 'efectivo');
}

const soles = (monto: number | string | null | undefined) => `S/ ${Number(monto || 0).toFixed(2)}`;
const kmTexto = (km: number) => km.toFixed(1).replace('.', ',');
const textoPedidos = (n: number) => (n === 1 ? '1 pedido' : `${n} pedidos`);

export function etapaDe(p: PedidoReparto): InfoEtapa {
  if (p.estado !== 'EN_CAMINO') {
    return { id: 'salir', texto: 'Salir a reparto', fondo: C.naranja, color: C.blanco };
  }
  if (!p.llego_en) {
    return { id: 'llegue', texto: 'Llegué a destino', fondo: C.dorado, color: C.navy };
  }
  return { id: 'entregar', texto: 'Entregar pedido', fondo: C.verde, color: C.blanco };
}

function textoEstado(p: PedidoReparto): string {
  if (p.estado !== 'EN_CAMINO') return 'Listo en tienda';
  return p.llego_en ? 'En destino' : 'En camino';
}

/** Ancho del contenido de la vista (no de la ventana): decide entre dos columnas y una. */
function useAnchoDe(ref: RefObject<HTMLElement | null>): number {
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setAncho(el.getBoundingClientRect().width);
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [ref]);
  return ancho;
}

/* ---------------------------------------------------------------- */
/* Piezas reutilizables de la vista                                  */
/* ---------------------------------------------------------------- */

function CabeceraRepartidor({
  nombre,
  activos,
  tope,
  compacta,
}: {
  nombre: string;
  activos: number;
  tope: number;
  compacta: boolean;
}) {
  return (
    <header
      data-testid="cabecera-repartidor"
      style={{
        background: C.navy,
        color: C.blanco,
        padding: compacta ? '14px 16px' : '16px 20px',
        borderBottom: `3px solid ${C.naranja}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        flexShrink: 0,
      }}
    >
      <div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: C.dorado,
            textTransform: 'uppercase',
          }}
        >
          Panel Repartidor
        </span>
        <h1 style={{ margin: '2px 0 0 0', fontFamily: FUENTE_TITULOS, fontSize: 18, fontWeight: 800, color: C.blanco }}>
          {nombre}
        </h1>
      </div>
      <div
        data-testid="badge-tope-pedidos"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255, 255, 255, 0.12)',
          border: '1.5px solid rgba(255, 255, 255, 0.25)',
          borderRadius: 12,
          padding: '6px 12px',
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        <span style={{ color: C.crema }}>Llevas:</span>
        <span style={{ color: activos >= tope ? C.naranja : C.blanco, fontWeight: 900 }}>
          {activos} / {tope} pedidos
        </span>
      </div>
    </header>
  );
}

function BarraPestanas({
  pestana,
  onCambiar,
  contadores,
  fija,
}: {
  pestana: PestanaRepartidor;
  onCambiar: (p: PestanaRepartidor) => void;
  contadores: Record<PestanaRepartidor, number>;
  fija: boolean;
}) {
  const colorBadge: Record<PestanaRepartidor, { fondo: string; texto: string }> = {
    mi_ruta: { fondo: C.naranja, texto: C.blanco },
    para_elegir: { fondo: C.dorado, texto: C.navy },
    hechos_hoy: { fondo: C.verde, texto: C.blanco },
  };

  return (
    <nav
      role="tablist"
      aria-label="Pestañas de reparto"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 6,
        padding: fija ? '8px 10px' : '10px 14px',
        background: fija ? C.navy : C.crema,
        borderBottom: fija ? 'none' : `1.5px solid ${C.borde}`,
        flexShrink: 0,
      }}
    >
      {PESTANAS.map((t) => {
        const seleccionada = pestana === t.id;
        const n = contadores[t.id];
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`pestana-${t.id}`}
            aria-selected={seleccionada}
            aria-controls="panel-repartidor"
            data-testid={t.testid}
            onClick={() => onCambiar(t.id)}
            style={{
              minHeight: 52,
              borderRadius: 12,
              cursor: 'pointer',
              fontFamily: FUENTE_TITULOS,
              fontWeight: 800,
              fontSize: 14,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: '4px 6px',
              border: seleccionada
                ? `2px solid ${fija ? C.dorado : C.navy}`
                : '1.5px solid transparent',
              background: fija ? (seleccionada ? C.crema : 'transparent') : seleccionada ? C.blanco : 'transparent',
              color: fija && !seleccionada ? C.crema : C.navy,
            }}
          >
            <span>{t.etiqueta}</span>
            {n > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  background: colorBadge[t.id].fondo,
                  color: colorBadge[t.id].texto,
                  borderRadius: 8,
                  padding: '1px 6px',
                }}
              >
                {n}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/** Avisos en pantalla del repartidor: espera agotada en puerta y movilidades retiradas. */
export function BannerAvisosRepartidor({ pedidos, avisos }: { pedidos: PedidoReparto[]; avisos?: AvisoRepartidor[] }) {
  const enEspera = pedidos.filter((p) => p.espera_agotada);
  if (enEspera.length === 0 && (!avisos || avisos.length === 0)) return null;
  return (
    <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 14px 0' }}>
      {enEspera.map((p) => (
        <div key={`espera-${p.id}`} style={{ background: '#FDE8E8', color: '#9B1C1C', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 14 }}>
          Espera agotada en {p.codigo}: el cliente no sale. Si sigue sin salir, la movilidad se retirará y el pedido se reprogramará.
        </div>
      ))}
      {(avisos || []).map((a) => (
        <div key={`retiro-${a.pedido_id}-${a.en}`} style={{ background: '#FEF3C7', color: '#7C2D12', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 14 }}>
          {a.mensaje}
        </div>
      ))}
    </div>
  );
}

export function BotonEtapa({
  pedido,
  etapa,
  grande = false,
  onAccion,
}: {
  pedido: PedidoReparto;
  etapa: InfoEtapa;
  grande?: boolean;
  onAccion: (p: PedidoReparto, etapa: EtapaId) => void;
}) {
  return (
    <button
      type="button"
      data-testid={`btn-${etapa.id}-${pedido.id}`}
      onClick={() => onAccion(pedido, etapa.id)}
      style={{
        ...botonBase,
        width: '100%',
        minHeight: grande ? 56 : 48,
        fontSize: grande ? 17 : 15,
        background: etapa.fondo,
        color: etapa.color,
      }}
    >
      {etapa.texto}
    </button>
  );
}

export function BotonReportar({ pedido, onReportar }: { pedido: PedidoReparto; onReportar: (p: PedidoReparto) => void }) {
  return (
    <button
      type="button"
      data-testid={`btn-reportar-${pedido.id}`}
      onClick={() => onReportar(pedido)}
      style={{
        ...botonBase,
        width: '100%',
        background: 'transparent',
        color: C.rust,
        border: `1.5px solid ${C.rust}`,
        fontSize: 14,
      }}
    >
      Reportar problema
    </button>
  );
}

/** Teléfono, llamada, WhatsApp, cobro, productos y GPS. Solo se usa con pedidos ya tomados. */
function DetalleContacto({ pedido }: { pedido: PedidoReparto }) {
  const enlace: CSSProperties = { ...botonBase, minHeight: 48, fontSize: 13 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          background: C.crema,
          borderRadius: 12,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800 }}>Cliente: {pedido.cliente_nombre || 'Cliente'}</div>
        <div data-testid={`telefono-cliente-${pedido.id}`} style={{ fontSize: 14 }}>
          Teléfono: <strong>{pedido.cliente_telefono ? pedido.cliente_telefono : 'No registrado'}</strong>
        </div>
        {pedido.cliente_telefono && (
          <div style={dosColumnas}>
            <a
              href={`tel:${pedido.cliente_telefono}`}
              style={{ ...enlace, background: C.blanco, border: `1.5px solid ${C.navy}`, color: C.navy }}
            >
              Llamar
            </a>
            <a
              href={`https://wa.me/51${pedido.cliente_telefono.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...enlace, background: C.verde, color: C.blanco }}
            >
              WhatsApp
            </a>
          </div>
        )}
      </div>

      <div
        style={{
          padding: '8px 12px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          background: esEfectivoPendiente(pedido) ? '#FFF4E5' : '#E8F5E9',
          color: esEfectivoPendiente(pedido) ? C.rust : C.verde,
          border: `1px solid ${esEfectivoPendiente(pedido) ? C.naranja : C.verde}`,
        }}
      >
        {esEfectivoPendiente(pedido)
          ? `Cobrar en efectivo: ${soles(pedido.total)}${
              pedido.paga_con ? ` (Paga con ${soles(pedido.paga_con)})` : ''
            }`
          : `Ya pagado con ${pedido.pago_metodo || 'digital'}`}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
        <span>
          Productos: <strong>{pedido.cantidad_productos ?? 1}</strong>
        </span>
        <span>
          Total: <strong style={{ fontSize: 15 }}>{soles(pedido.total)}</strong>
        </span>
      </div>

      {pedido.lat != null && pedido.lng != null && (
        <div style={dosColumnas}>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${pedido.lat},${pedido.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...enlace, background: C.suave, border: `1px solid ${C.borde}`, color: C.navy }}
          >
            Google Maps
          </a>
          <a
            href={`https://waze.com/ul?ll=${pedido.lat},${pedido.lng}&navigate=yes`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...enlace, background: C.suave, border: `1px solid ${C.borde}`, color: C.navy }}
          >
            Waze
          </a>
        </div>
      )}
    </div>
  );
}

interface FilaPedidoProps {
  pedido: PedidoReparto;
  config: ConfigReparto;
  destacado: boolean;
  onAccion: (p: PedidoReparto, etapa: EtapaId) => void;
  onReportar: (p: PedidoReparto) => void;
  onDestacar: (id: string | null) => void;
}

/** Siguiente parada: tarjeta grande con todo a la vista. */
function TarjetaSiguiente({ pedido, config, destacado, onAccion, onReportar, onDestacar }: FilaPedidoProps) {
  const espera = clasificarEspera(pedido.minutosEspera, config);
  return (
    <article
      data-testid={`tarjeta-pedido-${pedido.id}`}
      aria-label={`Siguiente parada ${pedido.codigo}`}
      onMouseEnter={() => onDestacar(pedido.id)}
      onMouseLeave={() => onDestacar(null)}
      style={{
        ...tarjetaBase,
        gap: 14,
        border: `2px solid ${destacado ? C.naranja : C.borde}`,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={chip(C.naranja, C.blanco)}>Siguiente parada</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.gris }}>
          Parada #1 · {textoEstado(pedido)}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ fontFamily: FUENTE_TITULOS, fontSize: 22, color: C.navy }}>{pedido.codigo}</strong>
        <span style={chip(espera.colorHex, C.blanco)}>{pedido.minutosEspera} min</span>
      </div>

      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>
          {pedido.direccion || 'Dirección sin especificar'}
        </div>
        {pedido.referencia && (
          <div style={{ fontSize: 13, color: C.gris, marginTop: 2 }}>Ref: {pedido.referencia}</div>
        )}
        <div style={{ fontSize: 13, fontWeight: 700, color: C.rust, marginTop: 4 }}>
          Zona: {pedido.zona || 'Local / General'}
        </div>
      </div>

      <DetalleContacto pedido={pedido} />
      <BotonEtapa pedido={pedido} etapa={etapaDe(pedido)} grande onAccion={onAccion} />
      <BotonReportar pedido={pedido} onReportar={onReportar} />
    </article>
  );
}

/** Parada siguiente: fila compacta; el detalle se abre con un botón. */
function FilaParada({ pedido, numero, config, destacado, onAccion, onReportar, onDestacar }: FilaPedidoProps & { numero: number }) {
  const [abierta, setAbierta] = useState(false);
  const espera = clasificarEspera(pedido.minutosEspera, config);
  const idDetalle = `detalle-pedido-${pedido.id}`;
  return (
    <article
      data-testid={`tarjeta-pedido-${pedido.id}`}
      onMouseEnter={() => onDestacar(pedido.id)}
      onMouseLeave={() => onDestacar(null)}
      style={{ ...tarjetaBase, gap: 10, border: `1.5px solid ${destacado ? C.naranja : C.borde}`, padding: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={chip(C.navy, C.blanco)}>Parada #{numero}</span>
          <strong style={{ fontSize: 15, color: C.navy }}>{pedido.codigo}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={chip(C.suave, C.gris)}>{textoEstado(pedido)}</span>
          <span style={chip(espera.colorHex, C.blanco)}>{pedido.minutosEspera} min</span>
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>
        {pedido.direccion || 'Dirección sin especificar'}
      </div>

      <div style={dosColumnas}>
        <BotonEtapa pedido={pedido} etapa={etapaDe(pedido)} onAccion={onAccion} />
        <button
          type="button"
          aria-expanded={abierta}
          aria-controls={idDetalle}
          onClick={() => setAbierta((v) => !v)}
          style={{ ...botonBase, background: C.crema, color: C.navy, border: `1px solid ${C.borde}`, fontSize: 14 }}
        >
          {abierta ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
      </div>

      {abierta && (
        <div id={idDetalle} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DetalleContacto pedido={pedido} />
          <BotonReportar pedido={pedido} onReportar={onReportar} />
        </div>
      )}
    </article>
  );
}

interface CandidatoProps {
  pedido: PedidoReparto;
  numero: number;
  config: ConfigReparto;
  seleccionado: boolean;
  destacado: boolean;
  onAlternar: (id: string) => void;
  onDestacar: (id: string | null) => void;
}

/** Pedido sugerido en "Para elegir": casilla grande, se marca tocando la tarjeta. */
function CandidatoPedido({ pedido, numero, config, seleccionado, destacado, onAlternar, onDestacar }: CandidatoProps) {
  const espera = clasificarEspera(pedido.minutosEspera, config);
  const alTeclado = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onAlternar(pedido.id);
    }
  };
  return (
    <article
      data-testid={`candidato-pedido-${pedido.id}`}
      role="checkbox"
      aria-checked={seleccionado}
      aria-label={`Elegir pedido ${pedido.codigo}`}
      tabIndex={0}
      onClick={() => onAlternar(pedido.id)}
      onKeyDown={alTeclado}
      onMouseEnter={() => onDestacar(pedido.id)}
      onMouseLeave={() => onDestacar(null)}
      style={{
        ...tarjetaBase,
        cursor: 'pointer',
        gap: 10,
        padding: 14,
        background: seleccionado ? C.crema : C.blanco,
        border: `2px solid ${seleccionado ? C.naranja : destacado ? C.dorado : C.borde}`,
        boxShadow: seleccionado ? '0 4px 14px rgba(230, 121, 41, 0.15)' : tarjetaBase.boxShadow,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: `2px solid ${seleccionado ? C.naranja : C.navy}`,
              background: seleccionado ? C.naranja : C.blanco,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {seleccionado && (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={C.blanco} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="5 13 10 18 19 7" />
              </svg>
            )}
          </span>
          <strong style={{ fontSize: 16, color: C.navy }}>{pedido.codigo}</strong>
          <span style={chip(C.suave, C.gris)}>Sugerida #{numero}</span>
          {(pedido as { reprogramado?: boolean }).reprogramado && (
            <span style={chip(C.dorado, C.navy)}>Reprogramado</span>
          )}
        </div>
        <span style={chip(espera.colorHex, C.blanco)}>{pedido.minutosEspera} min</span>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>
          {pedido.direccion || 'Dirección aproximada'}
        </div>
        {pedido.referencia && <div style={{ fontSize: 12, color: C.gris, marginTop: 2 }}>Ref: {pedido.referencia}</div>}
        <div style={{ fontSize: 12, fontWeight: 700, color: C.rust, marginTop: 2 }}>
          Zona: {pedido.zona || 'Local / General'}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 13,
          borderTop: `1px solid ${C.suave}`,
          paddingTop: 8,
        }}
      >
        <span>
          Productos: <strong>{pedido.cantidad_productos ?? 1}</strong>
        </span>
        <span>
          Total: <strong style={{ fontSize: 14 }}>{soles(pedido.total)}</strong>
        </span>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: esEfectivoPendiente(pedido) ? C.rust : C.verde }}>
        {esEfectivoPendiente(pedido)
          ? `Cobrar en efectivo al entregar: ${soles(pedido.total)}`
          : 'Ya pagado digitalmente'}
      </div>

      <div data-testid={`telefono-oculto-${pedido.id}`} style={{ fontSize: 12, color: C.gris, fontStyle: 'italic' }}>
        Teléfono oculto hasta tomar
      </div>
    </article>
  );
}

/** Resumen de lo elegido con el botón de tomar. Se usa en la columna (PC) y abajo fijo (celular). */
function ResumenElegidos({
  cantidad,
  metricas,
  onTomar,
}: {
  cantidad: number;
  metricas: MetricasRuta | null;
  onTomar: () => void;
}) {
  return (
    <div
      data-testid="resumen-ruta-elegida"
      role="region"
      aria-label="Resumen de pedidos elegidos"
      style={{
        background: C.navy,
        color: C.blanco,
        borderRadius: 16,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 -4px 20px rgba(11, 44, 62, 0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 14 }}>
        {cantidad === 0 || !metricas ? (
          <span style={{ fontWeight: 700 }}>Marca los pedidos que vas a llevar</span>
        ) : (
          <>
            <strong>Elegidos: {textoPedidos(cantidad)}</strong>
            <span style={{ color: C.crema }}>
              {kmTexto(metricas.distanciaAproxKm)} km · unos {Math.round(metricas.tiempoAproxMin)} min
            </span>
          </>
        )}
      </div>
      <button
        type="button"
        data-testid="btn-tomar-elegidos"
        onClick={onTomar}
        disabled={cantidad === 0}
        style={{
          ...botonBase,
          minHeight: 52,
          fontSize: 16,
          background: cantidad === 0 ? C.gris : C.naranja,
          color: C.blanco,
          cursor: cantidad === 0 ? 'not-allowed' : 'pointer',
        }}
      >
        {cantidad === 0 ? 'Elige pedidos para tomar' : `Tomar ${cantidad} ${cantidad === 1 ? 'pedido' : 'pedidos'}`}
      </button>
    </div>
  );
}

/** Hoja a pantalla completa con el mapa, para el celular. */
function HojaMapa({
  titulo,
  puntos,
  rutaPuntos,
  seleccionadoId,
  resaltadosIds,
  onSeleccionarPunto,
  onCerrar,
}: {
  titulo: string;
  puntos: PuntoRepartoMapa[];
  rutaPuntos: Array<[number, number]>;
  seleccionadoId: string | null;
  resaltadosIds: string[];
  onSeleccionarPunto: (id: string) => void;
  onCerrar: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: C.fondo,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FUENTE_TEXTO,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '10px 14px',
          background: C.navy,
          color: C.blanco,
        }}
      >
        <strong style={{ fontFamily: FUENTE_TITULOS, fontSize: 16 }}>{titulo}</strong>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar mapa"
          style={{
            ...botonBase,
            minWidth: 48,
            background: 'transparent',
            color: C.blanco,
            border: '1.5px solid rgba(255, 255, 255, 0.4)',
          }}
        >
          Cerrar
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 8 }}>
        <MapaRepartos
          esPantallaCompleta
          puntos={puntos}
          rutaPuntos={rutaPuntos}
          seleccionadoId={seleccionadoId}
          resaltadosIds={resaltadosIds}
          onSeleccionarPunto={onSeleccionarPunto}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Vista principal                                                   */
/* ---------------------------------------------------------------- */

export function RepartidorView() {
  const { usuario } = useSesion();
  const raizRef = useRef<HTMLDivElement>(null);
  const anchoContenido = useAnchoDe(raizRef);
  const escritorio = anchoContenido >= ANCHO_ESCRITORIO;
  // AdminShell muestra su barra propia del repartidor bajo 700 px
  const hayBarraShell = useEsMovil();
  const desplazamientoBarra = hayBarraShell ? ALTO_BARRA_SHELL : 0;

  const [pestana, setPestana] = useState<PestanaRepartidor>('mi_ruta');

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [datosMios, setDatosMios] = useState<RespuestaMios>({
    pedidos: [],
    orden: [],
    paso: [],
    ruta: [],
  });
  const [disponibles, setDisponibles] = useState<PedidoReparto[]>([]);
  const [hechosHoy, setHechosHoy] = useState<PedidoReparto[]>([]);
  const [config, setConfig] = useState<ConfigReparto>(CONFIG_REPARTO_DEFECTO);

  // Selección en la pestaña "Para elegir"
  const [seleccionadosIds, setSeleccionadosIds] = useState<Set<string>>(new Set());
  // Pedido resaltado (pasa el mouse por la lista o toca un pin)
  const [destacadoId, setDestacadoId] = useState<string | null>(null);
  const [pedidosPerdidosAviso, setPedidosPerdidosAviso] = useState<PedidoPerdido[]>([]);
  const [hojaMapaAbierta, setHojaMapaAbierta] = useState(false);

  // Modal Confirmar (Sí/No)
  const [confirmacion, setConfirmacion] = useState<ConfirmarAccionModal>({
    abierto: false,
    titulo: '',
    mensaje: '',
    accion: async () => {},
  });
  const [ejecutandoAccion, setEjecutandoAccion] = useState(false);

  // Modal Reportar Falla
  const [pedidoParaFalla, setPedidoParaFalla] = useState<PedidoReparto | null>(null);

  const maxPedidos = config.maxPedidosPorRepartidor || 5;

  // Carga de datos centralizada. Un fallo de «Mi ruta» o «Para elegir» se avisa en pantalla
  // (antes quedaba como lista vacía, sin decir nada).
  const cargarDatos = useCallback(async () => {
    setError(null);
    try {
      const [miosRes, dispRes, entregadosRes, cfgRes] = await Promise.all([
        repartosApi.listarMios().catch((err) => {
          setError(err?.message || 'No se pudo cargar Mi ruta');
          return null;
        }),
        repartosApi.listarDisponibles().catch((err) => {
          setError(err?.message || 'No se pudieron cargar los pedidos para elegir');
          return null;
        }),
        repartosApi.listarTodos({ estado: 'ENTREGADO', historial: 'true' }).catch(() => []),
        repartosApi.obtenerConfig().catch(() => CONFIG_REPARTO_DEFECTO),
      ]);

      if (miosRes) setDatosMios(miosRes);
      if (dispRes) setDisponibles(dispRes);
      setHechosHoy(entregadosRes);
      if (cfgRes) setConfig(cfgRes);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar los pedidos de reparto');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    setCargando(true);
    cargarDatos();
  }, [cargarDatos]);


  // Opciones de ruta del servidor: elegir una la resalta en el mapa; tomarla la deja en «Mi ruta»
  const sugeridas = useRutasSugeridas();
  const [opcionSeleccionadaId, setOpcionSeleccionadaId] = useState<string | null>(null);
  const opcionSeleccionada = sugeridas.datos?.opciones.find((o) => o.id === opcionSeleccionadaId) ?? null;

  // En vivo, como la vista del administrador: un pedido que pasa a LISTO aparece sin recargar
  useEventos('pedido:estado', () => {
    cargarDatos();
    sugeridas.recargar();
  });
  useEventos('reparto:incidente', () => {
    cargarDatos();
  });
  useEventos('reparto:rutas', () => {
    cargarDatos();
  });

  // Pedidos activos del repartidor en orden de ruta sugerida
  const pedidosActivos = useMemo(() => {
    const ordenMap = new Map((datosMios.orden || []).map((id, idx) => [String(id), idx]));
    return [...datosMios.pedidos].sort((a, b) => {
      const idxA = ordenMap.has(String(a.id)) ? ordenMap.get(String(a.id))! : 999;
      const idxB = ordenMap.has(String(b.id)) ? ordenMap.get(String(b.id))! : 999;
      return idxA - idxB;
    });
  }, [datosMios]);

  // Ruta sugerida de pedidos disponibles, en orden de parada (hasta el tope configurable, default 5)
  const rutaSugeridaDisponibles = useMemo(() => {
    const candidatos: PedidoParaRuta[] = disponibles
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({
        id: p.id,
        codigo: p.codigo,
        cliente_nombre: p.cliente_nombre || '',
        lat: p.lat!,
        lng: p.lng!,
        minutosEspera: p.minutosEspera || 0,
        zona: p.zona || undefined,
        total: p.total,
        pago_estado: p.pago_estado,
        pago_metodo: p.pago_metodo,
      }));

    const ordenados = sugerirOrdenRuta(candidatos, COORDENADAS_TIENDA_DEFECTO, config, maxPedidos);

    const filaPorId = new Map(disponibles.map((p) => [p.id, p]));
    const enSugerida = ordenados
      .map((o) => filaPorId.get(o.id))
      .filter((p): p is PedidoReparto => p !== undefined);
    const idsSugeridos = new Set(enSugerida.map((p) => p.id));
    const fueraSugerida = disponibles.filter((p) => !idsSugeridos.has(p.id));
    return [...enSugerida, ...fueraSugerida].slice(0, maxPedidos);
  }, [disponibles, config, maxPedidos]);

  // Recálculo del orden óptimo de SOLO los pedidos elegidos
  const { pedidosElegidosOrdenados, metricasElegidos } = useMemo(() => {
    const elegidos = disponibles.filter((p) => seleccionadosIds.has(p.id));
    if (elegidos.length === 0) {
      return {
        pedidosElegidosOrdenados: [] as PedidoReparto[],
        metricasElegidos: null as MetricasRuta | null,
      };
    }

    const candidatos: PedidoParaRuta[] = elegidos.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      cliente_nombre: p.cliente_nombre || '',
      lat: p.lat ?? COORDENADAS_TIENDA_DEFECTO.lat,
      lng: p.lng ?? COORDENADAS_TIENDA_DEFECTO.lng,
      minutosEspera: p.minutosEspera || 0,
      zona: p.zona || undefined,
      total: p.total,
      pago_estado: p.pago_estado,
      pago_metodo: p.pago_metodo,
    }));

    const ordenados = sugerirOrdenRuta(candidatos, COORDENADAS_TIENDA_DEFECTO, config, elegidos.length);

    const metricas = calcularMetricasRuta(ordenados, COORDENADAS_TIENDA_DEFECTO, config.velocidadMediaKmH);

    const filasMap = new Map(elegidos.map((p) => [String(p.id), p]));
    const enOrden = ordenados.map((o) => filasMap.get(String(o.id))!).filter(Boolean);

    return {
      pedidosElegidosOrdenados: enOrden,
      metricasElegidos: metricas,
    };
  }, [disponibles, seleccionadosIds, config]);

  // Total cobrado en efectivo hoy para liquidar
  const totalEfectivoHoy = useMemo(() => {
    return hechosHoy.reduce((acc, p) => {
      if (p.pago_metodo === 'EFECTIVO' || p.pago_metodo === 'efectivo') {
        return acc + Number(p.total || 0);
      }
      return acc;
    }, 0);
  }, [hechosHoy]);

  // Puntos y rutas para el mapa según la pestaña
  const puntosMiRuta: PuntoRepartoMapa[] = useMemo(
    () =>
      pedidosActivos.flatMap((p, idx) =>
        p.lat == null || p.lng == null
          ? []
          : [
              {
                id: p.id,
                lat: p.lat,
                lng: p.lng,
                etiqueta: p.cliente_nombre,
                codigo: p.codigo,
                detalle: 'en tu ruta',
                color: clasificarEspera(p.minutosEspera, config).color,
                orden: idx + 1,
                minutosEspera: p.minutosEspera,
                enReparto: true,
              },
            ],
      ),
    [pedidosActivos, config],
  );

  const rutaMiRuta: Array<[number, number]> = useMemo(
    () => [
      [COORDENADAS_TIENDA_DEFECTO.lat, COORDENADAS_TIENDA_DEFECTO.lng],
      ...pedidosActivos.flatMap((p): Array<[number, number]> =>
        p.lat == null || p.lng == null ? [] : [[p.lat, p.lng]],
      ),
    ],
    [pedidosActivos],
  );

  const puntosSugeridos: PuntoRepartoMapa[] = useMemo(
    () =>
      rutaSugeridaDisponibles.flatMap((p, idx) =>
        p.lat == null || p.lng == null
          ? []
          : [
              {
                id: p.id,
                lat: p.lat,
                lng: p.lng,
                etiqueta: p.cliente_nombre,
                codigo: p.codigo,
                detalle: 'disponible',
                color: clasificarEspera(p.minutosEspera, config).color,
                orden: idx + 1,
                minutosEspera: p.minutosEspera,
                enReparto: false,
              },
            ],
      ),
    [rutaSugeridaDisponibles, config],
  );

  const rutaElegidos: Array<[number, number]> = useMemo(
    () => [
      [COORDENADAS_TIENDA_DEFECTO.lat, COORDENADAS_TIENDA_DEFECTO.lng],
      ...pedidosElegidosOrdenados.flatMap((p): Array<[number, number]> =>
        p.lat == null || p.lng == null ? [] : [[p.lat, p.lng]],
      ),
    ],
    [pedidosElegidosOrdenados],
  );

  const elegidosArr = useMemo(() => Array.from(seleccionadosIds), [seleccionadosIds]);

  const idsOpcion = useMemo(() => opcionSeleccionada?.pedidos.map((p) => p.id) ?? [], [opcionSeleccionada]);
  const mapa =
    pestana === 'para_elegir'
      ? opcionSeleccionada
        ? { puntos: puntosSugeridos, ruta: opcionSeleccionada.ruta, resaltados: idsOpcion }
        : { puntos: puntosSugeridos, ruta: rutaElegidos, resaltados: elegidosArr }
      : { puntos: puntosMiRuta, ruta: rutaMiRuta, resaltados: SIN_RESALTADOS };

  // Acciones con modal Confirmar
  const pedirConfirmacion = (
    titulo: string,
    mensaje: string,
    accion: () => Promise<void>,
    peligro = false,
  ) => {
    setConfirmacion({
      abierto: true,
      titulo,
      mensaje,
      accion,
      peligro,
    });
  };

  const ejecutarAccionConfirmada = async () => {
    setEjecutandoAccion(true);
    try {
      await confirmacion.accion();
      setConfirmacion((prev) => ({ ...prev, abierto: false }));
      await cargarDatos();
    } catch (err: any) {
      setError(err?.message || 'Error al ejecutar la acción');
    } finally {
      setEjecutandoAccion(false);
    }
  };

  // Alternar selección de un pedido para elegir
  const toggleSeleccion = (id: string) => {
    setSeleccionadosIds((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) {
        nuevo.delete(id);
      } else {
        const cupoDisponible = maxPedidos - pedidosActivos.length;
        if (nuevo.size >= cupoDisponible) {
          setError(`No puedes elegir más de ${cupoDisponible} pedidos (tope máximo: ${maxPedidos})`);
          return prev;
        }
        nuevo.add(id);
      }
      return nuevo;
    });
    setError(null);
  };

  // Tomar pedidos elegidos atómicamente
  const handleTomarElegidos = () => {
    const ids = Array.from(seleccionadosIds);
    if (ids.length === 0) return;

    const cupoDisponible = maxPedidos - pedidosActivos.length;
    if (ids.length > cupoDisponible) {
      setError(`Solo tienes cupo para ${cupoDisponible} pedidos más`);
      return;
    }

    pedirConfirmacion(
      '¿Iniciar ruta con los pedidos elegidos?',
      `Vas a tomar ${ids.length} pedido(s) y salir en ruta. Se calculará el orden óptimo de paradas.`,
      async () => {
        const res = await repartosApi.iniciarRuta({
          pedidoIds: pedidosElegidosOrdenados.map((p) => p.id),
        });

        if (res.perdidos && res.perdidos.length > 0) {
          setPedidosPerdidosAviso(res.perdidos);
        } else {
          setPedidosPerdidosAviso([]);
        }

        setSeleccionadosIds(new Set());
        cambiarPestana('mi_ruta');
      },
    );
  };

  // Acciones individuales de pedidos en ruta
  const handleSalir = (pedido: PedidoReparto) => {
    pedirConfirmacion(
      '¿Salir a reparto?',
      `El pedido ${pedido.codigo} cambiará a estado "En camino" y se registrará la hora de salida.`,
      async () => {
        await repartosApi.salir(pedido.id);
      },
    );
  };

  const handleLlegue = (pedido: PedidoReparto) => {
    pedirConfirmacion(
      '¿Marcar llegada?',
      `Confirmar que has llegado a la dirección del pedido ${pedido.codigo}.`,
      async () => {
        await repartosApi.llegue(pedido.id);
      },
    );
  };

  const handleEntregar = (pedido: PedidoReparto) => {
    const mensajeCobro = esEfectivoPendiente(pedido)
      ? `Recuerda cobrar S/ ${Number(pedido.total).toFixed(2)} en efectivo.`
      : 'Pedido ya pagado previamente.';

    pedirConfirmacion(
      '¿Confirmar entrega?',
      `El pedido ${pedido.codigo} quedará registrado como ENTREGADO. ${mensajeCobro}`,
      async () => {
        await repartosApi.entregar(pedido.id);
      },
    );
  };

  const ejecutarEtapa = (pedido: PedidoReparto, etapa: EtapaId) => {
    if (etapa === 'salir') handleSalir(pedido);
    else if (etapa === 'llegue') handleLlegue(pedido);
    else handleEntregar(pedido);
  };

  const cambiarPestana = (nueva: PestanaRepartidor) => {
    setPestana(nueva);
    setError(null);
    setDestacadoId(null);
  };

  // Pin tocado en el mapa: en "Para elegir" marca o desmarca; en "Mi ruta" resalta la parada
  const tocarPin = (id: string) => {
    if (pestana === 'para_elegir') {
      toggleSeleccion(id);
    } else {
      setDestacadoId((prev) => (prev === id ? null : id));
    }
  };

  const nombreUsuario = usuario?.nombres || 'Repartidor';
  const contadores: Record<PestanaRepartidor, number> = {
    mi_ruta: pedidosActivos.length,
    para_elegir: disponibles.length,
    hechos_hoy: hechosHoy.length,
  };
  const hayElegidos = seleccionadosIds.size > 0;

  /* ---------- Bloques de contenido ---------- */

  const avisos = (
    <>
      {pedidosPerdidosAviso.length > 0 && (
        <div
          role="alert"
          data-testid="alerta-pedidos-perdidos"
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: '#FDE8E8',
            border: `1.5px solid ${C.rust}`,
            color: C.rust,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Aviso de asignación concurrente:</div>
          {pedidosPerdidosAviso.map((p, idx) => (
            <div key={idx} style={{ marginTop: 2 }}>
              • El pedido <strong>{p.codigo}</strong>{' '}
              {p.motivo === 'OTRO_REPARTIDOR'
                ? `fue tomado por ${p.tomadoPor || 'otro repartidor'} un instante antes.`
                : p.motivo === 'LIMITE'
                ? 'supera el límite de pedidos activos simultáneos.'
                : 'ya no está disponible.'}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPedidosPerdidosAviso([])}
            style={{ ...botonBase, marginTop: 8, width: '100%', background: C.blanco, border: `1px solid ${C.rust}`, color: C.rust, fontSize: 13 }}
          >
            Entendido
          </button>
        </div>
      )}
      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: '#FDE8E8',
            border: `1px solid ${C.rust}`,
            color: C.rust,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}
    </>
  );

  const vacioMiRuta = (
    <div
      data-testid="estado-vacio-mi-ruta"
      style={{ ...tarjetaBase, textAlign: 'center', padding: '40px 20px', alignItems: 'center' }}
    >
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.navy }}>No tienes pedidos activos</h3>
      <p style={{ margin: 0, fontSize: 14, color: C.gris }}>
        Elige pedidos de la ruta sugerida para comenzar tus entregas.
      </p>
      <button
        type="button"
        data-testid="btn-ir-a-elegir"
        onClick={() => cambiarPestana('para_elegir')}
        style={{ ...botonBase, background: C.naranja, color: C.blanco, padding: '0 24px' }}
      >
        Ir a Para elegir
      </button>
    </div>
  );

  const botonVerMapa = (texto: string) => (
    <button
      type="button"
      data-testid="btn-ver-mapa"
      onClick={() => setHojaMapaAbierta(true)}
      style={{ ...botonBase, width: '100%', background: C.blanco, color: C.navy, border: `1.5px solid ${C.navy}` }}
    >
      {texto}
    </button>
  );

  const contenidoMiRuta = (
    <div data-testid="contenido-mi-ruta" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!escritorio && pedidosActivos.length > 0 && botonVerMapa('Ver mapa')}
      {pedidosActivos.length === 0 ? (
        vacioMiRuta
      ) : (
        <>
          <TarjetaSiguiente
            pedido={pedidosActivos[0]}
            config={config}
            destacado={destacadoId === pedidosActivos[0].id}
            onAccion={ejecutarEtapa}
            onReportar={setPedidoParaFalla}
            onDestacar={setDestacadoId}
          />
          {pedidosActivos.length > 1 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-label="Paradas siguientes">
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.gris }}>
                Luego ({pedidosActivos.length - 1})
              </h3>
              {pedidosActivos.slice(1).map((pedido, idx) => (
                <FilaParada
                  key={pedido.id}
                  pedido={pedido}
                  numero={idx + 2}
                  config={config}
                  destacado={destacadoId === pedido.id}
                  onAccion={ejecutarEtapa}
                  onReportar={setPedidoParaFalla}
                  onDestacar={setDestacadoId}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );

  const contenidoParaElegir = (
    <div data-testid="contenido-para-elegir" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!escritorio && rutaSugeridaDisponibles.length > 0 && botonVerMapa('Ver en mapa')}
      <OpcionesRutaSugerida
        datos={sugeridas.datos}
        cargando={sugeridas.cargando}
        error={sugeridas.error}
        alReintentar={sugeridas.recargar}
        seleccionadaId={opcionSeleccionadaId}
        alSeleccionar={setOpcionSeleccionadaId}
        alCambiar={() => {
          sugeridas.recargar();
          cargarDatos();
        }}
        alTomada={() => setPestana('mi_ruta')}
      />
      {rutaSugeridaDisponibles.length === 0 ? (
        <div
          data-testid="estado-vacio-para-elegir"
          style={{ ...tarjetaBase, textAlign: 'center', padding: '40px 20px', alignItems: 'center' }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.navy }}>
            No hay pedidos listos para reparto
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: C.gris }}>
            Los pedidos aparecerán aquí tan pronto cocina termine de prepararlos.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, color: C.gris }}>
            <span>Ruta sugerida disponible</span>
            <span>Cupo disponible: {Math.max(0, maxPedidos - pedidosActivos.length)}</span>
          </div>
          {rutaSugeridaDisponibles.map((pedido, idx) => (
            <CandidatoPedido
              key={pedido.id}
              pedido={pedido}
              numero={idx + 1}
              config={config}
              seleccionado={seleccionadosIds.has(pedido.id)}
              destacado={destacadoId === pedido.id}
              onAlternar={toggleSeleccion}
              onDestacar={setDestacadoId}
            />
          ))}
        </>
      )}
    </div>
  );

  const contenidoHechos = (
    <div data-testid="contenido-hechos-hoy" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        data-testid="resumen-liquidacion"
        style={{
          background: C.crema,
          border: `1.5px solid ${C.borde}`,
          borderRadius: 16,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: C.gris }}>Resumen del turno de hoy:</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 14, color: C.navy, fontWeight: 700 }}>Entregas completadas:</span>
          <span data-testid="conteo-hechos-hoy" style={{ fontSize: 18, color: C.navy, fontWeight: 900 }}>
            {hechosHoy.length}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 8,
            borderTop: `1px solid ${C.borde}`,
            paddingTop: 8,
          }}
        >
          <span style={{ fontSize: 14, color: C.rust, fontWeight: 800 }}>Total cobrado en efectivo para liquidar:</span>
          <span data-testid="total-efectivo-liquidar" style={{ fontSize: 20, color: C.rust, fontWeight: 900 }}>
            S/ {totalEfectivoHoy.toFixed(2)}
          </span>
        </div>
      </div>

      {hechosHoy.length === 0 ? (
        <div
          data-testid="estado-vacio-hechos-hoy"
          style={{ ...tarjetaBase, textAlign: 'center', padding: '40px 20px', alignItems: 'center' }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.navy }}>
            Aún no tienes entregas completadas hoy
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: C.gris }}>
            Tus pedidos entregados aparecerán aquí para tu control y rendición en caja.
          </p>
        </div>
      ) : (
        hechosHoy.map((pedido) => (
          <article
            key={pedido.id}
            data-testid={`hecho-pedido-${pedido.id}`}
            style={{ ...tarjetaBase, borderRadius: 14, padding: '12px 14px', gap: 6 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 15, color: C.navy }}>{pedido.codigo}</strong>
              <span style={chip('#E8F5E9', C.verde)}>Entregado</span>
            </div>
            <div style={{ fontSize: 13, color: C.navy }}>
              {pedido.cliente_nombre && <div style={{ fontWeight: 700 }}>{pedido.cliente_nombre}</div>}
              <div>{pedido.direccion || 'Dirección de entrega'}</div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: C.gris,
                borderTop: `1px solid ${C.suave}`,
                paddingTop: 6,
              }}
            >
              <span>
                Pago: <strong>{pedido.pago_metodo || 'EFECTIVO'}</strong>
              </span>
              <strong style={{ color: C.navy, fontSize: 14 }}>{soles(pedido.total)}</strong>
            </div>
          </article>
        ))
      )}
    </div>
  );

  const contenido =
    pestana === 'mi_ruta' ? contenidoMiRuta : pestana === 'para_elegir' ? contenidoParaElegir : contenidoHechos;

  const cargandoBloque = (
    <div role="status" style={{ textAlign: 'center', padding: '48px 16px', color: C.gris, fontWeight: 700 }}>
      Cargando información de reparto...
    </div>
  );

  const panel = (
    <div
      id="panel-repartidor"
      role="tabpanel"
      aria-labelledby={`pestana-${pestana}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      {avisos}
      {cargando ? cargandoBloque : contenido}
    </div>
  );

  const mapaEscritorio = (
    <MapaRepartos
      esPantallaCompleta
      puntos={mapa.puntos}
      rutaPuntos={mapa.ruta}
      seleccionadoId={destacadoId}
      resaltadosIds={mapa.resaltados}
      onSeleccionarPunto={tocarPin}
    />
  );

  const hojaMapa = hojaMapaAbierta && !escritorio && (
    <HojaMapa
      titulo={pestana === 'para_elegir' ? 'Pedidos sugeridos en el mapa' : 'Mi ruta en el mapa'}
      puntos={mapa.puntos}
      rutaPuntos={mapa.ruta}
      seleccionadoId={destacadoId}
      resaltadosIds={mapa.resaltados}
      onSeleccionarPunto={tocarPin}
      onCerrar={() => setHojaMapaAbierta(false)}
    />
  );

  const modales = (
    <>
      <Confirmar
        abierto={confirmacion.abierto}
        titulo={confirmacion.titulo}
        mensaje={confirmacion.mensaje}
        textoSi="Sí, confirmar"
        textoNo="No, cancelar"
        peligro={confirmacion.peligro}
        cargando={ejecutandoAccion}
        alConfirmar={ejecutarAccionConfirmada}
        alCancelar={() => setConfirmacion((prev) => ({ ...prev, abierto: false }))}
      />
      {pedidoParaFalla && (
        <ModalReportarFalla
          pedido={pedidoParaFalla}
          alCerrar={() => setPedidoParaFalla(null)}
          alCompletar={async () => {
            setPedidoParaFalla(null);
            await cargarDatos();
          }}
        />
      )}
    </>
  );

  /* ---------- Escritorio: dos columnas ---------- */
  if (escritorio) {
    return (
      <div
        ref={raizRef}
        data-testid="vista-repartidor"
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '420px minmax(0, 1fr)',
          gridTemplateRows: 'minmax(0, 1fr)',
          background: C.fondo,
          fontFamily: FUENTE_TEXTO,
          color: C.navy,
        }}
      >
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            background: C.blanco,
            borderRight: `1px solid ${C.borde}`,
          }}
        >
          <CabeceraRepartidor nombre={nombreUsuario} activos={pedidosActivos.length} tope={maxPedidos} compacta />
          <BannerAvisosRepartidor pedidos={datosMios.pedidos} avisos={datosMios.avisos} />
          <BarraPestanas pestana={pestana} onCambiar={cambiarPestana} contadores={contadores} fija={false} />
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>{panel}</div>
          {pestana === 'para_elegir' && (
            <div style={{ flexShrink: 0, padding: 12, borderTop: `1px solid ${C.borde}` }}>
              <ResumenElegidos
                cantidad={seleccionadosIds.size}
                metricas={metricasElegidos}
                onTomar={handleTomarElegidos}
              />
            </div>
          )}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0, padding: 16 }}>
          {mapaEscritorio}
        </section>

        {modales}
      </div>
    );
  }

  /* ---------- Celular: una columna, barra inferior de pestañas ---------- */
  const alturaInferior = desplazamientoBarra + ALTO_BARRA_PESTANAS;
  const rellenoInferior =
    alturaInferior + (pestana === 'para_elegir' && hayElegidos ? ALTO_RESUMEN_CELULAR : 0) + 16;

  return (
    <div
      ref={raizRef}
      data-testid="vista-repartidor"
      style={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: C.fondo,
        fontFamily: FUENTE_TEXTO,
        color: C.navy,
      }}
    >
      <CabeceraRepartidor nombre={nombreUsuario} activos={pedidosActivos.length} tope={maxPedidos} compacta />
      <BannerAvisosRepartidor pedidos={datosMios.pedidos} avisos={datosMios.avisos} />

      <div style={{ padding: `14px 14px ${rellenoInferior}px` }}>{panel}</div>

      {pestana === 'para_elegir' && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: alturaInferior,
            zIndex: 940,
            padding: '0 12px 8px',
            pointerEvents: 'none',
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>
            <ResumenElegidos
              cantidad={seleccionadosIds.size}
              metricas={metricasElegidos}
              onTomar={handleTomarElegidos}
            />
          </div>
        </div>
      )}

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: desplazamientoBarra,
          zIndex: 950,
        }}
      >
        <BarraPestanas pestana={pestana} onCambiar={cambiarPestana} contadores={contadores} fija />
      </div>

      {hojaMapa}
      {modales}
    </div>
  );
}
