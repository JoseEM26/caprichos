import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BotonProponerUbicacion } from './BotonProponerUbicacion';
import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSesion } from '../../comun/sesion';
import { useEventos } from '../../comun/socket';
import { Confirmar } from '../../comun/Confirmar';
import { ErrorApi } from '../../comun/api';
import { Icono } from '../../comun/Icono';
import { ModalReportarFalla } from './ModalReportarFalla';
import { InsigniaDireccionEditada } from '../pedidos/InsigniaDireccionEditada';
import { BotonCancelarEspera } from './EsperaEntrega';
import { MapaRepartidor, type PuntoRepartidor, type PosicionMarcador } from './MapaRepartidor';
import { HojaInferior } from './HojaInferior';
import { ChatPedidoReparto, chatVigente } from './ChatPedidoReparto';
import { SaltarPedidoModal } from './SaltarPedidoModal';
import { colorOpcion } from './OpcionesRutaSugerida';
import { HojaRutasSugeridas, ALTO_PLEGADA_PX, FRACCION_MEDIA, type AlturaRutas } from './HojaRutasSugeridas';
import { useRutasSugeridas } from './useRutasSugeridas';
import { useAccionesReparto } from './useAccionesReparto';
import { MisRutas, fechaLima } from './MisRutas';
import { horaLima, TEXTO_ESTADO_FINAL } from './ListaRutas';
import {
  repartosApi,
  AvisoRepartidor,
  PedidoDeRuta,
  RutaHistorial,
  PedidoProximo,
  PedidoReparto,
  MotivoSalto,
  RespuestaMios,
  ResumenRepartidor,
} from './repartosApi';
import { clasificarEspera, ConfigReparto, CONFIG_REPARTO_DEFECTO, COORDENADAS_TIENDA_DEFECTO } from './calculoRuta';

type VistaRepartidor = 'pedidos' | 'mios';
type EtapaId = 'salir' | 'llegue' | 'entregar';

type Hoja =
  | { tipo: 'detalle'; id: string }
  | { tipo: 'hechos' }
  | { tipo: 'misRutas' }
  | { tipo: 'rutas' }
  | { tipo: 'falla' }
  | null;

interface ConfirmarAccionModal {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  accion: () => Promise<void>;
}

interface InfoEtapa {
  id: EtapaId;
  texto: string;
  fondo: string;
  color: string;
}

interface AvisoPantalla {
  tipo: 'ok' | 'error';
  texto: string;
}

const FUENTE_TITULOS = 'var(--fuente-titulos), Montserrat, sans-serif';
const FUENTE_TEXTO = 'Montserrat, sans-serif';

// Barra inferior fija: 64 px más el área segura del celular
const ALTO_BARRA = 64;
const BARRA_TOTAL = `calc(${ALTO_BARRA}px + env(safe-area-inset-bottom, 0px))`;
const SEDE: [number, number] = [COORDENADAS_TIENDA_DEFECTO.lat, COORDENADAS_TIENDA_DEFECTO.lng];

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

const chip = (fondo: string, color: string): CSSProperties => ({
  fontSize: 12,
  fontWeight: 800,
  background: fondo,
  color,
  padding: '4px 8px',
  borderRadius: 8,
  whiteSpace: 'nowrap',
});

const dosColumnas: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 };

const soles = (monto: number | string | null | undefined) => `S/ ${Number(monto || 0).toFixed(2)}`;

function esEfectivoPendiente(p: PedidoReparto): boolean {
  return p.pago_estado !== 'PAGADO' && (p.pago_metodo === 'EFECTIVO' || p.pago_metodo === 'efectivo');
}

export function etapaDe(p: PedidoReparto): InfoEtapa {
  if (p.estado !== 'EN_CAMINO') {
    return { id: 'salir', texto: 'Salir a reparto', fondo: 'var(--cp-orange)', color: 'var(--cp-white)' };
  }
  if (!p.llego_en) {
    return { id: 'llegue', texto: 'Llegué a destino', fondo: 'var(--cp-gold)', color: 'var(--cp-navy)' };
  }
  return { id: 'entregar', texto: 'Entregar pedido', fondo: 'var(--cp-green)', color: 'var(--cp-white)' };
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
  bloqueadoPor,
}: {
  pedido: PedidoReparto;
  etapa: InfoEtapa;
  grande?: boolean;
  onAccion: (p: PedidoReparto, etapa: EtapaId) => void;
  /** Motivo por el que no se puede avanzar todavía (orden de entrega); deshabilita el botón. */
  bloqueadoPor?: string;
}) {
  return (
    <>
      <button
        type="button"
        data-testid={`btn-${etapa.id}-${pedido.id}`}
        disabled={!!bloqueadoPor}
        aria-describedby={bloqueadoPor ? `motivo-${pedido.id}` : undefined}
        onClick={() => onAccion(pedido, etapa.id)}
        style={{
          ...botonBase,
          width: '100%',
          minHeight: grande ? 56 : 48,
          fontSize: grande ? 17 : 15,
          background: etapa.fondo,
          color: etapa.color,
          opacity: bloqueadoPor ? 0.45 : 1,
          cursor: bloqueadoPor ? 'not-allowed' : 'pointer',
        }}
      >
        {etapa.texto}
      </button>
      {bloqueadoPor && (
        <div id={`motivo-${pedido.id}`} data-testid={`motivo-bloqueo-${pedido.id}`} style={{ fontSize: 13, fontWeight: 800, color: 'var(--cp-rust)' }}>
          {bloqueadoPor}
        </div>
      )}
    </>
  );
}

export function BotonReportar({ pedido, onReportar }: { pedido: PedidoReparto; onReportar: (p: PedidoReparto) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <BotonCancelarEspera pedido={pedido} onCancelar={onReportar} />
      <button
        type="button"
        data-testid={`btn-reportar-${pedido.id}`}
        onClick={() => onReportar(pedido)}
        style={{
          ...botonBase,
          width: '100%',
          background: 'transparent',
          color: 'var(--cp-rust)',
          border: '1.5px solid var(--cp-rust)',
          fontSize: 14,
        }}
      >
        Reportar problema
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Piezas de la pantalla                                             */
/* ---------------------------------------------------------------- */

function BarraInferior({
  vista,
  masAbierto,
  alVista,
  alMas,
}: {
  vista: VistaRepartidor;
  masAbierto: boolean;
  alVista: (v: VistaRepartidor) => void;
  alMas: () => void;
}) {
  const boton = (activo: boolean): CSSProperties => ({
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    border: 'none',
    background: activo ? 'var(--cp-orange)' : 'rgba(255, 255, 255, 0.12)',
    color: activo ? 'var(--cp-navy)' : 'var(--cp-cream)',
    fontFamily: FUENTE_TITULOS,
    fontWeight: 800,
    fontSize: 13,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    cursor: 'pointer',
  });
  return (
    <nav
      aria-label="Navegación del repartidor"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: BARRA_TOTAL,
        zIndex: 1000,
        boxSizing: 'border-box',
        background: 'var(--cp-navy)',
        borderTop: '1.5px solid rgba(255, 255, 255, 0.15)',
        padding: '8px 12px',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
        display: 'flex',
        gap: 8,
        alignItems: 'stretch',
      }}
    >
      <button type="button" data-testid="btn-ver-pedidos" aria-current={vista === 'pedidos' ? 'page' : undefined} onClick={() => alVista('pedidos')} style={boton(vista === 'pedidos')}>
        <Icono nombre="mapa" tamano={20} />
        <span>Pedidos</span>
      </button>
      <button type="button" data-testid="btn-ver-mis-pedidos" aria-current={vista === 'mios' ? 'page' : undefined} onClick={() => alVista('mios')} style={boton(vista === 'mios')}>
        <Icono nombre="repartos" tamano={20} />
        <span>Mis pedidos</span>
      </button>
      <button type="button" data-testid="btn-mas" aria-haspopup="menu" aria-expanded={masAbierto} onClick={alMas} style={boton(masAbierto)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2.5" />
          <circle cx="12" cy="12" r="2.5" />
          <circle cx="19" cy="12" r="2.5" />
        </svg>
        <span>Más</span>
      </button>
    </nav>
  );
}

const itemMenu: CSSProperties = {
  minHeight: 48,
  width: '100%',
  border: 'none',
  borderBottom: '1px solid var(--cp-line)',
  background: 'transparent',
  color: 'var(--cp-navy)',
  fontFamily: FUENTE_TEXTO,
  fontWeight: 700,
  fontSize: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '0 14px',
  textAlign: 'left',
  cursor: 'pointer',
};

/** Capa transparente que cierra un menú al tocar fuera y con Escape. */
function CapaMenu({ alCerrar, children }: { alCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    document.addEventListener('keydown', alTecla);
    return () => document.removeEventListener('keydown', alTecla);
  }, [alCerrar]);
  return (
    <div data-testid="capa-menu" onClick={alCerrar} style={{ position: 'absolute', inset: 0, zIndex: 1100 }}>
      {children}
    </div>
  );
}

const cajaMenu: CSSProperties = {
  position: 'absolute',
  background: 'var(--cp-white)',
  border: '1.5px solid var(--cp-line)',
  borderRadius: 14,
  boxShadow: '0 8px 24px rgba(11, 44, 62, 0.3)',
  overflow: 'hidden',
};

/** Chat de WhatsApp, llamada y navegación. Solo de pedidos ya tomados por este repartidor. */
function ContactoPedido({ pedido, alChatear }: { pedido: PedidoReparto; alChatear?: () => void }) {
  const enlace: CSSProperties = { ...botonBase, fontSize: 13 };
  const telefono = pedido.cliente_telefono;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {telefono && alChatear && (
        <button
          type="button"
          data-testid={`btn-chatear-${pedido.id}`}
          onClick={alChatear}
          style={{ ...enlace, width: '100%', background: 'var(--cp-green)', color: 'var(--cp-white)', border: 'none' }}
        >
          Chatear por WhatsApp
        </button>
      )}
      {telefono && (
        <div style={dosColumnas}>
          <a href={`tel:${telefono}`} style={{ ...enlace, background: 'var(--cp-white)', border: '1.5px solid var(--cp-navy)', color: 'var(--cp-navy)' }}>
            Llamar
          </a>
        </div>
      )}
      {pedido.lat != null && pedido.lng != null && (
        <div style={dosColumnas}>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${pedido.lat},${pedido.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...enlace, background: 'var(--cp-sand)', border: '1px solid var(--cp-line)', color: 'var(--cp-navy)' }}
          >
            Google Maps
          </a>
          <a
            href={`https://waze.com/ul?ll=${pedido.lat},${pedido.lng}&navigate=yes`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...enlace, background: 'var(--cp-sand)', border: '1px solid var(--cp-line)', color: 'var(--cp-navy)' }}
          >
            Waze
          </a>
        </div>
      )}
    </div>
  );
}

interface DetalleProps {
  id: string;
  /** Si el pedido es suyo: trae dirección, teléfono, cobro y las acciones de su etapa. */
  mio?: PedidoReparto;
  /** Si está disponible para tomar. */
  disponible?: PedidoReparto;
  proximo?: PedidoProximo;
  enRuta: boolean;
  /** Cambia cuando se recargan los datos, para pedir otra vez el detalle. */
  recarga: number;
  alAlternarRuta: (id: string) => void;
  alTomar: (p: PedidoReparto) => void;
  alEtapa: (p: PedidoReparto, etapa: EtapaId) => void;
  alReportar: (p: PedidoReparto) => void;
  /** Orden de entrega de la ruta (solo con pedidos que ya tienen orden). */
  orden?: { siguiente: PedidoReparto | null; pendientes: number; enCurso: boolean };
  alEmpezarPor?: (p: PedidoReparto) => void;
  alSaltar?: (p: PedidoReparto) => void;
  /** Abre el chat de WhatsApp de este pedido (solo mientras sigue vigente). */
  alChatear?: (p: PedidoReparto) => void;
}

/** Contenido de la hoja de un pedido: lo que dice el servidor y las acciones que le tocan según su estado. */
function DetallePedido({ id, mio, disponible, proximo, enRuta, recarga, alAlternarRuta, alTomar, alEtapa, alReportar, orden, alEmpezarPor, alSaltar, alChatear }: DetalleProps) {
  const [resumen, setResumen] = useState<ResumenRepartidor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    repartosApi
      .obtenerResumenRepartidor(id)
      .then((r) => {
        if (!vivo) return;
        setResumen(r);
        setError(null);
      })
      .catch((err) => vivo && setError(err?.message || 'No se pudo cargar el detalle del pedido'));
    return () => {
      vivo = false;
    };
  }, [id, recarga]);

  if (error) return <div role="alert" style={{ color: 'var(--cp-rust)', fontWeight: 700 }}>{error}</div>;
  if (!resumen) return <div role="status" style={{ color: 'var(--cp-soft)', fontWeight: 700 }}>Cargando detalle...</div>;

  const direccion = mio?.direccion ?? resumen.direccion;
  const telefono = mio?.cliente_telefono ?? resumen.telefono;
  const fila: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14 };
  const conOrden = !!mio && mio.ordenRuta != null && !!orden?.siguiente;
  const noLeToca = conOrden && orden!.siguiente!.id !== mio!.id;
  const botonOrden: CSSProperties = { ...botonBase, width: '100%', minHeight: 48, background: 'var(--cp-white)', color: 'var(--cp-navy)', border: '1.5px solid var(--cp-navy)', fontSize: 14 };

  return (
    <div data-testid="detalle-pedido" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: FUENTE_TEXTO, color: 'var(--cp-navy)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <strong style={{ fontFamily: FUENTE_TITULOS, fontSize: 18 }}>{resumen.codigo}</strong>
        {mio?.ubicacion_editada_en && <InsigniaDireccionEditada />}
        <span style={chip('var(--cp-sand)', 'var(--cp-soft)')}>{resumen.estadoTexto}</span>
        <span style={chip(clasificarEspera(resumen.minutosEspera).colorHex, '#fff')}>{resumen.minutosEspera} min de espera</span>
      </div>
      <div style={fila}>
        <span>Cliente</span>
        <strong>{resumen.clienteNombre}</strong>
      </div>
      <div style={fila}>
        <span>Zona</span>
        <strong>{resumen.zona || 'Local / General'}</strong>
      </div>
      {direccion && (
        <div style={fila}>
          <span>Dirección</span>
          <strong style={{ textAlign: 'right' }}>{direccion}</strong>
        </div>
      )}
      {telefono && (
        <div style={fila}>
          <span>Teléfono</span>
          <strong>{telefono}</strong>
        </div>
      )}
      {mio && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            background: esEfectivoPendiente(mio) ? '#FFF4E5' : '#E8F5E9',
            color: esEfectivoPendiente(mio) ? 'var(--cp-rust)' : 'var(--cp-green)',
          }}
        >
          {esEfectivoPendiente(mio)
            ? `Cobrar en efectivo: ${soles(mio.total)}${mio.paga_con ? ` (paga con ${soles(mio.paga_con)})` : ''}`
            : `Ya pagado con ${mio.pago_metodo || 'digital'}`}
        </div>
      )}
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--cp-soft)', marginBottom: 2 }}>Productos</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
          {resumen.productos.map((p, i) => (
            <li key={`${p.nombre}-${i}`}>
              {p.cantidad} x {p.nombre}
            </li>
          ))}
        </ul>
      </div>
      {resumen.nota && (
        <div style={{ fontSize: 14 }}>
          <strong>Nota: </strong>
          {resumen.nota}
        </div>
      )}

      {mio ? (
        <>
          <ContactoPedido
            pedido={mio}
            alChatear={alChatear && chatVigente(mio.estado, mio.entregado_en) ? () => alChatear(mio) : undefined}
          />
          <BotonEtapa
            pedido={mio}
            etapa={etapaDe(mio)}
            grande
            onAccion={alEtapa}
            bloqueadoPor={noLeToca ? `Siguiente: ${orden!.siguiente!.codigo}` : undefined}
          />
          {conOrden && !orden!.enCurso && orden!.pendientes > 1 && alEmpezarPor && mio.estado === 'LISTO' && (
            <button type="button" data-testid={`btn-empezar-por-${mio.id}`} onClick={() => alEmpezarPor(mio)} style={botonOrden}>
              Empezar por este
            </button>
          )}
          {conOrden && !noLeToca && orden!.pendientes > 1 && alSaltar && (
            <button type="button" data-testid={`btn-saltar-${mio.id}`} onClick={() => alSaltar(mio)} style={botonOrden}>
              Saltar este pedido
            </button>
          )}
          <BotonReportar pedido={mio} onReportar={alReportar} />
          {/* El repartidor propone el punto real del cliente (Caja lo aprueba antes de recalcular el pago) */}
          <BotonProponerUbicacion
            pedidoId={mio.id}
            codigo={mio.codigo}
            estado={mio.estado}
            puntoActual={mio.lat != null && mio.lng != null ? { lat: mio.lat, lng: mio.lng } : null}
            alChatear={alChatear && chatVigente(mio.estado, mio.entregado_en) ? () => alChatear(mio) : undefined}
          />
        </>
      ) : disponible ? (
        <>
          {resumen.puedeTomar ? (
            <>
              <button
                type="button"
                data-testid={`btn-ruta-${id}`}
                onClick={() => alAlternarRuta(id)}
                style={{ ...botonBase, minHeight: 48, background: enRuta ? 'var(--cp-white)' : 'var(--cp-orange)', color: enRuta ? 'var(--cp-rust)' : 'var(--cp-white)', border: enRuta ? '1.5px solid var(--cp-rust)' : 'none' }}
              >
                {enRuta ? 'Quitar de mi ruta' : 'Agregar a mi ruta'}
              </button>
              <button
                type="button"
                data-testid={`btn-tomar-${id}`}
                onClick={() => alTomar(disponible)}
                style={{ ...botonBase, minHeight: 48, background: 'var(--cp-navy)', color: 'var(--cp-white)' }}
              >
                Tomar solo este pedido
              </button>
            </>
          ) : (
            <div role="status" style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--cp-sand)', fontWeight: 700, fontSize: 13 }}>
              {resumen.motivoNoTomar || 'No se puede tomar ahora'}
            </div>
          )}
        </>
      ) : proximo ? (
        <div role="status" data-testid="aviso-no-disponible" style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--cp-sand)', fontWeight: 800, fontSize: 14 }}>
          Aún no disponible: {resumen.estadoTexto}
        </div>
      ) : null}
    </div>
  );
}

/** Punto gris de un pedido terminado: check si se entregó, X si no; con la hora de cierre. */
function puntoTerminado(p: { id: string; lat: number; lng: number; cliente: string | null; codigo: string; estadoFinal: NonNullable<PedidoDeRuta['estadoFinal']>; horaFinal: string | null; numeroRuta?: number | null }): PuntoRepartidor {
  return {
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    cliente: p.cliente || 'Cliente',
    codigo: p.codigo,
    color: 'verde',
    disponible: false,
    estadoFinal: p.estadoFinal,
    numeroParada: p.numeroRuta ?? undefined,
    estadoTexto: `${TEXTO_ESTADO_FINAL[p.estadoFinal]}${p.horaFinal ? ` ${horaLima(p.horaFinal)}` : ''}`,
  };
}

/** Detalle de solo lectura de un pedido ya terminado de la ruta en curso (sin acciones). */
function DetalleTerminado({ p, alChatear }: { p: PedidoDeRuta; alChatear?: (p: PedidoDeRuta) => void }) {
  const fila: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14 };
  const bien = p.estadoFinal === 'ENTREGADO';
  return (
    <div data-testid="detalle-terminado" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: FUENTE_TEXTO, color: 'var(--cp-navy)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <strong style={{ fontFamily: FUENTE_TITULOS, fontSize: 18 }}>{p.codigo}</strong>
        <span style={chip(bien ? '#E8F5E9' : '#FDE8E8', bien ? 'var(--cp-green)' : 'var(--cp-rust)')}>
          {p.estadoFinal ? TEXTO_ESTADO_FINAL[p.estadoFinal] : ''}
          {p.horaFinal ? ` ${horaLima(p.horaFinal)}` : ''}
        </span>
      </div>
      <div style={fila}><span>Cliente</span><strong>{p.cliente_nombre}</strong></div>
      {p.direccion && <div style={fila}><span>Dirección</span><strong style={{ textAlign: 'right' }}>{p.direccion}</strong></div>}
      {p.motivo_falla && <div style={fila}><span>Motivo</span><strong>{p.motivo_falla}</strong></div>}
      <div style={{ color: 'var(--cp-soft)', fontSize: 13, fontWeight: 700 }}>Este pedido ya terminó: solo lectura.</div>
      {alChatear && p.cliente_telefono && p.estadoFinal === 'ENTREGADO' && chatVigente('ENTREGADO', p.horaFinal) && (
        <button
          type="button"
          data-testid={`btn-chatear-${p.id}`}
          onClick={() => alChatear(p)}
          style={{ ...botonBase, width: '100%', background: 'var(--cp-green)', color: 'var(--cp-white)', border: 'none', fontSize: 14 }}
        >
          Chatear por WhatsApp
        </button>
      )}
    </div>
  );
}

/** Entregas del día y total en efectivo a liquidar (lo que antes era la pestaña Hechos hoy). */
function HechosHoy({ hechos }: { hechos: PedidoReparto[] }) {
  const totalEfectivo = hechos.reduce(
    (acc, p) => (p.pago_metodo === 'EFECTIVO' || p.pago_metodo === 'efectivo' ? acc + Number(p.total || 0) : acc),
    0,
  );
  return (
    <div data-testid="contenido-hechos-hoy" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: FUENTE_TEXTO, color: 'var(--cp-navy)' }}>
      <div data-testid="resumen-liquidacion" style={{ background: 'var(--cp-cream)', border: '1.5px solid var(--cp-line)', borderRadius: 14, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <span>Entregas completadas</span>
          <strong data-testid="conteo-hechos-hoy">{hechos.length}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, color: 'var(--cp-rust)', fontWeight: 800 }}>
          <span>Efectivo para liquidar</span>
          <strong data-testid="total-efectivo-liquidar">S/ {totalEfectivo.toFixed(2)}</strong>
        </div>
      </div>
      {hechos.length === 0 ? (
        <div data-testid="estado-vacio-hechos-hoy" style={{ color: 'var(--cp-soft)', fontWeight: 700 }}>
          Aún no tienes entregas completadas hoy.
        </div>
      ) : (
        hechos.map((p) => (
          <article key={p.id} data-testid={`hecho-pedido-${p.id}`} style={{ border: '1.5px solid var(--cp-line)', borderRadius: 12, padding: '8px 12px', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{p.codigo}</strong>
              <span style={chip('#E8F5E9', 'var(--cp-green)')}>Entregado</span>
            </div>
            <div>{p.cliente_nombre}</div>
            <div style={{ color: 'var(--cp-soft)' }}>
              {p.pago_metodo || 'EFECTIVO'} · {soles(p.total)}
            </div>
          </article>
        ))
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Vista principal                                                   */
/* ---------------------------------------------------------------- */

export function RepartidorView() {
  const { salir } = useSesion();
  const navigate = useNavigate();

  const [vista, setVista] = useState<VistaRepartidor>('pedidos');
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<AvisoPantalla | null>(null);

  const [datosMios, setDatosMios] = useState<RespuestaMios>({ pedidos: [], orden: [], paso: [], ruta: [] });
  const [disponibles, setDisponibles] = useState<PedidoReparto[]>([]);
  const [proximos, setProximos] = useState<PedidoProximo[]>([]);
  const [hechosHoy, setHechosHoy] = useState<PedidoReparto[]>([]);
  const [config, setConfig] = useState<ConfigReparto>(CONFIG_REPARTO_DEFECTO);
  const [recarga, setRecarga] = useState(0);
  // Ruta ya hecha que se está viendo dibujada en el mapa (solo lectura)
  const [rutaDibujada, setRutaDibujada] = useState<RutaHistorial | null>(null);
  // Id de la ruta en curso de la carga anterior: si desaparece, la ruta terminó
  const rutaPrevRef = useRef<string | null>(null);

  // Ruta que arma el repartidor tocando puntos: ids en el orden en que los eligió
  const [miRuta, setMiRuta] = useState<string[]>([]);
  const codigosRef = useRef(new Map<string, string>());

  const [hoja, setHoja] = useState<Hoja>(null);
  const [menuMarcador, setMenuMarcador] = useState<{ id: string; pos: PosicionMarcador } | null>(null);
  const [masAbierto, setMasAbierto] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [confirmacion, setConfirmacion] = useState<ConfirmarAccionModal>({ abierto: false, titulo: '', mensaje: '', accion: async () => {} });
  const [ejecutando, setEjecutando] = useState(false);
  const [pedidoParaFalla, setPedidoParaFalla] = useState<PedidoReparto | null>(null);
  const [chatPedido, setChatPedido] = useState<{ id: string; codigo: string } | null>(null);
  const [pedidoParaSaltar, setPedidoParaSaltar] = useState<PedidoReparto | null>(null);
  const [saltando, setSaltando] = useState(false);
  const [opcionSugeridaId, setOpcionSugeridaId] = useState<string | null>(null);
  const [alturaRutas, setAlturaRutas] = useState<AlturaRutas>('plegada');
  const [verTodoRutas, setVerTodoRutas] = useState(0);
  const raizRef = useRef<HTMLDivElement>(null);

  const maxPedidos = config.maxPedidosPorRepartidor || CONFIG_REPARTO_DEFECTO.maxPedidosPorRepartidor;

  // La ruta en curso se cerró (todos sus pedidos terminaron): aviso con el resumen y el mapa vuelve a Pedidos
  const avisarRutaTerminada = useCallback((rutaId: string) => {
    repartosApi
      .listarMisRutas({ desde: fechaLima(2), hasta: fechaLima(0) })
      .then((r) => {
        const x = r.rutas.find((q) => q.id === rutaId);
        if (!x || x.estado !== 'TERMINADA') return;
        const entregados = `${x.entregados} ${x.entregados === 1 ? 'entregado' : 'entregados'}`;
        const no = x.fallidos > 0 ? `, ${x.fallidos} no ${x.fallidos === 1 ? 'entregado' : 'entregados'}` : '';
        setAviso({ tipo: 'ok', texto: `Ruta terminada: ${entregados}${no}` });
        setVista('pedidos');
        setMenuMarcador(null);
      })
      .catch(() => {});
  }, []);

  // Carga centralizada. Un fallo de «Mis pedidos» o «Pedidos» se avisa en pantalla (no queda en silencio).
  const cargarDatos = useCallback(async () => {
    try {
      const [miosRes, dispRes, proxRes, entregadosRes, cfgRes] = await Promise.all([
        repartosApi.listarMios().catch((err) => {
          setAviso({ tipo: 'error', texto: err?.message || 'No se pudieron cargar tus pedidos' });
          return null;
        }),
        repartosApi.listarDisponibles().catch((err) => {
          setAviso({ tipo: 'error', texto: err?.message || 'No se pudieron cargar los pedidos disponibles' });
          return null;
        }),
        repartosApi.listarProximos().catch(() => [] as PedidoProximo[]),
        repartosApi.listarTodos({ estado: 'ENTREGADO', historial: 'true' }).catch(() => [] as PedidoReparto[]),
        repartosApi.obtenerConfig().catch(() => CONFIG_REPARTO_DEFECTO),
      ]);
      if (miosRes) {
        setDatosMios(miosRes);
        const rutaId = miosRes.rutaReparto?.id ?? null;
        const previa = rutaPrevRef.current;
        rutaPrevRef.current = rutaId;
        if (previa && previa !== rutaId) avisarRutaTerminada(previa);
      }
      if (dispRes) setDisponibles(dispRes);
      setProximos(Array.isArray(proxRes) ? proxRes : []);
      setHechosHoy(entregadosRes);
      if (cfgRes) setConfig(cfgRes);
      setRecarga((n) => n + 1);
    } finally {
      setCargando(false);
    }
  }, [avisarRutaTerminada]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const sugeridas = useRutasSugeridas();
  const opcionSugerida = sugeridas.datos?.opciones.find((o) => o.id === opcionSugeridaId) ?? null;

  // En vivo: un pedido que cambia de estado aparece, pasa a gris o desaparece sin recargar
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

  const acciones = useAccionesReparto({ alActualizar: cargarDatos });

  // Mis pedidos en el orden de la ruta que dice el servidor
  const pedidosActivos = useMemo(() => {
    const ordenMap = new Map((datosMios.orden || []).map((id, idx) => [String(id), idx]));
    const clave = (p: PedidoReparto) => p.ordenRuta ?? (ordenMap.has(String(p.id)) ? ordenMap.get(String(p.id))! + 1 : 999);
    return [...datosMios.pedidos].sort((a, b) => clave(a) - clave(b));
  }, [datosMios]);

  const cupo = Math.max(0, maxPedidos - pedidosActivos.length);

  // Pedidos ya terminados de la ruta en curso: se quedan en el mapa en gris; no cuentan para el orden ni el límite
  const rutaActual = datosMios.rutaReparto ?? null;
  const terminados = useMemo(
    () => (rutaActual?.pedidos ?? []).filter((p) => p.estadoFinal != null).sort((a, b) => a.orden - b.orden),
    [rutaActual],
  );
  const entregadosRuta = terminados.filter((p) => p.estadoFinal === 'ENTREGADO').length;

  // Orden de entrega vigente: le toca el de menor orden aún pendiente (los sin orden no cuentan)
  const ordenRuta = useMemo(() => {
    const conOrden = pedidosActivos
      .filter((p) => p.ordenRuta != null && (p.estado === 'LISTO' || p.estado === 'EN_CAMINO'))
      .sort((a, b) => a.ordenRuta! - b.ordenRuta!);
    return { siguiente: conOrden[0] ?? null, pendientes: conOrden.length, enCurso: conOrden.some((p) => p.estado === 'EN_CAMINO') };
  }, [pedidosActivos]);

  const empezarPor = async (p: PedidoReparto) => {
    setHoja(null);
    try {
      await repartosApi.empezarPor(p.id);
      setAviso({ tipo: 'ok', texto: `Empiezas por ${p.codigo}; el resto quedó por cercanía` });
    } catch (err: any) {
      setAviso({ tipo: 'error', texto: err?.message || 'No se pudo cambiar el orden' });
    }
    await cargarDatos();
  };

  const saltarPedido = async (motivo: MotivoSalto, detalle?: string) => {
    if (!pedidoParaSaltar) return;
    setSaltando(true);
    try {
      const r = await repartosApi.saltar(pedidoParaSaltar.id, { motivo, detalle });
      setAviso({
        tipo: 'ok',
        texto: r?.numeroRuta != null && r.siguienteNumeroRuta != null
          ? `Saltaste el #${r.numeroRuta}; sigue el #${r.siguienteNumeroRuta}`
          : `${pedidoParaSaltar.codigo} pasó al final de tu ruta`,
      });
      setHoja(null);
    } catch (err: any) {
      setAviso({ tipo: 'error', texto: err?.message || 'No se pudo saltar el pedido' });
    } finally {
      setSaltando(false);
      setPedidoParaSaltar(null);
    }
    await cargarDatos();
  };
  const dispPorId = useMemo(() => new Map(disponibles.map((p) => [p.id, p])), [disponibles]);

  // Un pedido de la ruta armada que deja de estar disponible se quita y se avisa
  useEffect(() => {
    disponibles.forEach((p) => codigosRef.current.set(p.id, p.codigo));
    if (cargando) return;
    const quitados = miRuta.filter((id) => !dispPorId.has(id));
    if (quitados.length === 0) return;
    setMiRuta((r) => r.filter((id) => dispPorId.has(id)));
    const codigos = quitados.map((id) => codigosRef.current.get(id) ?? id).join(', ');
    setAviso({ tipo: 'error', texto: `${codigos} ya no está disponible y se quitó de tu ruta` });
  }, [dispPorId, miRuta, cargando, disponibles]);

  const alternarRuta = (id: string) => {
    if (miRuta.includes(id)) {
      setMiRuta((r) => r.filter((x) => x !== id));
      setAviso(null);
      return;
    }
    if (miRuta.length >= cupo) {
      setAviso({
        tipo: 'error',
        texto:
          cupo === 0
            ? `Ya llevas el máximo de ${maxPedidos} pedidos: entrega alguno antes de tomar otro`
            : `Tu ruta ya tiene el máximo de ${cupo} ${cupo === 1 ? 'pedido' : 'pedidos'}`,
      });
      return;
    }
    setMiRuta((r) => [...r, id]);
    setAviso(null);
  };

  /* ---------- Puntos y líneas del mapa ---------- */

  const puntos: PuntoRepartidor[] = useMemo(() => {
    if (rutaDibujada) {
      return rutaDibujada.pedidos.flatMap((p): PuntoRepartidor[] =>
        p.lat == null || p.lng == null || !p.estadoFinal
          ? []
          : [puntoTerminado({ id: p.id, lat: p.lat, lng: p.lng, cliente: p.clienteNombre, codigo: p.codigo, estadoFinal: p.estadoFinal, horaFinal: p.horaFinal, numeroRuta: p.numeroRuta })],
      );
    }
    if (vista === 'mios') {
      const pendientes = pedidosActivos.flatMap((p, idx) =>
        p.lat == null || p.lng == null
          ? []
          : [{
              id: p.id,
              lat: p.lat,
              lng: p.lng,
              cliente: p.cliente_nombre || 'Cliente',
              codigo: p.codigo,
              color: clasificarEspera(p.minutosEspera, config).color,
              numero: p.numeroRuta ?? idx + 1,
              disponible: true,
              siguiente: ordenRuta.siguiente?.id === p.id,
            }],
      );
      const hechos = terminados.flatMap((p): PuntoRepartidor[] =>
        p.lat == null || p.lng == null || !p.estadoFinal
          ? []
          : [puntoTerminado({ id: p.id, lat: p.lat, lng: p.lng, cliente: p.cliente_nombre, codigo: p.codigo, estadoFinal: p.estadoFinal, horaFinal: p.horaFinal, numeroRuta: p.numeroRuta })],
      );
      return [...pendientes, ...hechos];
    }
    const libres: PuntoRepartidor[] = disponibles.flatMap((p) =>
      p.lat == null || p.lng == null
        ? []
        : [{
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            cliente: p.cliente_nombre || 'Cliente',
            codigo: p.codigo,
            color: clasificarEspera(p.minutosEspera, config).color,
            numero: miRuta.indexOf(p.id) >= 0 ? miRuta.indexOf(p.id) + 1 : undefined,
            disponible: true,
          }],
    );
    const grises: PuntoRepartidor[] = proximos.flatMap((p) =>
      p.lat == null || p.lng == null
        ? []
        : [{
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            cliente: p.clienteNombre || 'Cliente',
            codigo: p.codigo,
            color: clasificarEspera(p.minutosEspera, config).color,
            disponible: false,
            estadoTexto: p.estadoTexto,
          }],
    );
    return [...libres, ...grises];
  }, [vista, pedidosActivos, disponibles, proximos, miRuta, config, ordenRuta, terminados, rutaDibujada]);

  // Tramo recorrido (sede y paradas terminadas): se mantiene más tenue; la línea viva sigue desde la última terminada
  const lineaTenue: Array<[number, number]> = useMemo(() => {
    if (rutaDibujada || vista !== 'mios') return [];
    const hechos = terminados.filter((p) => p.lat != null && p.lng != null).map((p): [number, number] => [p.lat!, p.lng!]);
    return hechos.length ? [SEDE, ...hechos] : [];
  }, [terminados, vista, rutaDibujada]);

  const linea: Array<[number, number]> = useMemo(() => {
    if (rutaDibujada) {
      const coords = rutaDibujada.pedidos.filter((p) => p.lat != null && p.lng != null).map((p): [number, number] => [p.lat!, p.lng!]);
      return coords.length ? [SEDE, ...coords] : [];
    }
    // En 'mios' los puntos ya vienen en el orden de entrega (un saltado conserva su número pero va al final)
    const conNumero = puntos.filter((p) => p.numero != null);
    const paradas = (vista === 'mios' ? conNumero : conNumero.sort((a, b) => a.numero! - b.numero!))
      .map((p): [number, number] => [p.lat, p.lng]);
    const desde = lineaTenue.length ? lineaTenue[lineaTenue.length - 1] : SEDE;
    return paradas.length ? [desde, ...paradas] : [];
  }, [puntos, lineaTenue, rutaDibujada, vista]);

  /* Rutas sugeridas sobre el mapa: la ruta propia (miRuta y su línea) no se toca, solo se muestran encima */
  const hojaRutas = hoja?.tipo === 'rutas';
  const opcionesSug = sugeridas.datos?.opciones;
  const lineasSugeridas = useMemo(
    () => (hojaRutas && opcionesSug ? opcionesSug.map((o, i) => ({ id: o.id, color: colorOpcion(i), coords: o.ruta, elegida: o.id === opcionSugeridaId })) : undefined),
    [hojaRutas, opcionesSug, opcionSugeridaId],
  );
  // Con una ruta elegida sus pedidos salen numerados en el orden de la ruta (aunque no estén en la pestaña)
  const puntosMapa = useMemo(() => {
    if (!hojaRutas || !opcionSugerida) return puntos;
    const orden = new Map(opcionSugerida.pedidos.map((p) => [p.id, p.orden]));
    const base = puntos.map((p) => ({ ...p, numero: orden.get(p.id) }));
    const faltan = opcionSugerida.pedidos
      .filter((p) => !puntos.some((q) => q.id === p.id))
      .map((p): PuntoRepartidor => ({ id: p.id, lat: p.lat, lng: p.lng, cliente: p.cliente, codigo: p.codigo, color: 'verde', numero: p.orden, disponible: true }));
    return [...base, ...faltan];
  }, [hojaRutas, opcionSugerida, puntos]);
  const encuadreRutas = useMemo(() => {
    if (!hojaRutas || !opcionesSug || opcionesSug.length === 0) return undefined;
    const alto = raizRef.current?.clientHeight ?? 0;
    return {
      clave: `${opcionSugeridaId ?? 'todas'}|${verTodoRutas}`,
      coords: (opcionSugerida ? [opcionSugerida] : opcionesSug).flatMap((o) => o.ruta),
      margenInferior: alturaRutas === 'media' ? Math.round(alto * FRACCION_MEDIA) : ALTO_PLEGADA_PX,
    };
    // La altura solo cuenta al encuadrar: no debe provocar otro encuadre al plegar la hoja
  }, [hojaRutas, opcionesSug, opcionSugerida, opcionSugeridaId, verTodoRutas]);

  /* ---------- Acciones ---------- */

  const pedirConfirmacion = (titulo: string, mensaje: string, accion: () => Promise<void>) =>
    setConfirmacion({ abierto: true, titulo, mensaje, accion });

  const ejecutarConfirmada = async () => {
    setEjecutando(true);
    try {
      await confirmacion.accion();
      setConfirmacion((prev) => ({ ...prev, abierto: false }));
      await cargarDatos();
    } catch (err: any) {
      // Un 409 trae el motivo (otro repartidor ganó el pedido, límite...): se muestra tal cual y se refresca
      setConfirmacion((prev) => ({ ...prev, abierto: false }));
      setAviso({ tipo: 'error', texto: err instanceof ErrorApi || err?.message ? err.message : 'Error al ejecutar la acción' });
      await cargarDatos();
    } finally {
      setEjecutando(false);
    }
  };

  const tomarRuta = () => {
    if (miRuta.length === 0) return;
    const codigos = miRuta.map((id) => codigosRef.current.get(id) ?? id).join(' → ');
    pedirConfirmacion(
      '¿Tomar esta ruta?',
      `Vas a tomar ${miRuta.length} ${miRuta.length === 1 ? 'pedido' : 'pedidos'} en este orden: ${codigos}.`,
      async () => {
        await repartosApi.tomarRuta(miRuta);
        setMiRuta([]);
        setVista('mios');
        setAviso({ tipo: 'ok', texto: 'Ruta tomada' });
      },
    );
  };

  const ejecutarEtapa = (pedido: PedidoReparto, etapa: EtapaId) => {
    if (etapa === 'salir') acciones.salir(pedido);
    else if (etapa === 'llegue') acciones.llegue(pedido);
    else acciones.entregar(pedido);
  };

  const cambiarVista = (v: VistaRepartidor) => {
    setVista(v);
    setRutaDibujada(null);
    setAviso(null);
    setMenuMarcador(null);
    setMasAbierto(false);
  };

  const tocarMarcador = (id: string) => {
    setMenuMarcador(null);
    if (rutaDibujada) return; // ruta ya hecha: solo se mira
    if (vista === 'mios') {
      setHoja({ tipo: 'detalle', id });
      return;
    }
    if (dispPorId.has(id)) {
      alternarRuta(id);
      return;
    }
    const prox = proximos.find((p) => p.id === id);
    if (prox) setAviso({ tipo: 'error', texto: `${prox.codigo} aún no está disponible: ${prox.estadoTexto}` });
  };

  const alSalir = async () => {
    setSaliendo(true);
    try {
      await salir();
      setConfirmarSalida(false);
      navigate('/admin/ingresar', { replace: true });
    } finally {
      setSaliendo(false);
    }
  };

  const abrirHoja = (h: Hoja) => {
    setHoja(h);
    if (h?.tipo === 'rutas') {
      setAlturaRutas('plegada');
      setOpcionSugeridaId(null);
    }
    setMasAbierto(false);
    setMenuMarcador(null);
  };

  /* ---------- Render ---------- */

  const idMenu = menuMarcador?.id ?? null;
  const menuEsDisponible = idMenu != null && vista === 'pedidos' && dispPorId.has(idMenu);
  const codigoDe = (id: string) =>
    pedidosActivos.find((p) => p.id === id)?.codigo ??
    terminados.find((p) => p.id === id)?.codigo ?? dispPorId.get(id)?.codigo ?? proximos.find((p) => p.id === id)?.codigo ?? '';

  const tituloHoja =
    hoja?.tipo === 'detalle'
      ? `Pedido ${codigoDe(hoja.id)}`.trim()
      : hoja?.tipo === 'hechos'
      ? 'Hechos hoy'
      : hoja?.tipo === 'misRutas'
      ? 'Mis rutas'
      : hoja?.tipo === 'rutas'
      ? 'Rutas sugeridas'
      : 'Reportar falla';

  const chipRuta = (
    <div
      data-testid="chip-ruta"
      style={{
        pointerEvents: 'auto',
        alignSelf: 'center',
        maxWidth: '100%',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '6px 8px 6px 14px',
        borderRadius: 24,
        background: 'var(--cp-navy)',
        color: 'var(--cp-white)',
        fontFamily: FUENTE_TITULOS,
        fontWeight: 800,
        fontSize: 14,
        boxShadow: '0 4px 14px rgba(11, 44, 62, 0.35)',
      }}
    >
      {rutaDibujada ? (
        <>
          <span data-testid="chip-ruta-dibujada">
            Ruta de {horaLima(rutaDibujada.iniciadaEn)}: solo lectura
          </span>
          <button
            type="button"
            data-testid="btn-cerrar-ruta-dibujada"
            onClick={() => setRutaDibujada(null)}
            style={{ ...botonBase, minHeight: 44, fontSize: 13, background: 'rgba(255,255,255,.14)', color: 'var(--cp-cream)' }}
          >
            Cerrar
          </button>
        </>
      ) : vista === 'pedidos' ? (
        <>
          <span>
            Mi ruta: {miRuta.length} de {cupo}
          </span>
          <button
            type="button"
            data-testid="btn-limpiar-ruta"
            onClick={() => setMiRuta([])}
            disabled={miRuta.length === 0}
            style={{ ...botonBase, minHeight: 44, fontSize: 13, background: 'rgba(255,255,255,.14)', color: 'var(--cp-cream)', opacity: miRuta.length === 0 ? 0.5 : 1 }}
          >
            Limpiar
          </button>
          <button
            type="button"
            data-testid="btn-tomar-ruta"
            onClick={tomarRuta}
            disabled={miRuta.length === 0}
            style={{ ...botonBase, minHeight: 44, fontSize: 13, background: 'var(--cp-orange)', color: 'var(--cp-white)', opacity: miRuta.length === 0 ? 0.5 : 1 }}
          >
            Tomar ruta
          </button>
        </>
      ) : (
        <span style={{ paddingRight: 6 }}>
          Llevas {pedidosActivos.length} / {maxPedidos} pedidos
          {pedidosActivos.length === 0 ? ': arma tu ruta en Pedidos' : ''}
          {rutaActual && (
            <span data-testid="chip-progreso-ruta">
              {' · '}Ruta en curso: {entregadosRuta} de {rutaActual.pedidos.length} {entregadosRuta === 1 ? 'entregado' : 'entregados'}
            </span>
          )}
        </span>
      )}
    </div>
  );

  const avisoPantalla = (mensaje: string, tipo: 'ok' | 'error', alCerrar: () => void, testid: string) => (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      data-testid={testid}
      style={{
        pointerEvents: 'auto',
        alignSelf: 'center',
        maxWidth: 520,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 6px 6px 14px',
        borderRadius: 12,
        background: tipo === 'error' ? '#FDE8E8' : 'var(--cp-greenbg)',
        border: `1px solid ${tipo === 'error' ? 'var(--cp-rust)' : 'var(--cp-green)'}`,
        color: tipo === 'error' ? 'var(--cp-rust)' : 'var(--cp-green)',
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      <span style={{ flex: 1 }}>{mensaje}</span>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={alCerrar}
        style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer' }}
      >
        <Icono nombre="cerrar" tamano={16} />
      </button>
    </div>
  );

  return (
    <div
      ref={raizRef}
      data-testid="vista-repartidor"
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        width: '100%',
        overflow: 'hidden',
        background: 'var(--cp-cream)',
        fontFamily: FUENTE_TEXTO,
        color: 'var(--cp-navy)',
      }}
    >
      {/* Mapa: todo el espacio menos la barra inferior */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: BARRA_TOTAL }}>
        <MapaRepartidor
          puntos={puntosMapa}
          linea={linea}
          lineaTenue={lineaTenue}
          sugeridas={lineasSugeridas}
          alElegirSugerida={(id) => {
            setOpcionSugeridaId(id);
            setAlturaRutas('media');
          }}
          alTocarMapa={() => setAlturaRutas('plegada')}
          encuadre={encuadreRutas}
          vistaClave={vista}
          alTocar={tocarMarcador}
          alAbrirOpciones={(id, pos) => setMenuMarcador({ id, pos })}
        />

        {/* Chip de ruta y avisos flotando arriba, sin tapar el mapa entero */}
        <div style={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 800, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none' }}>
          {chipRuta}
          <div style={{ pointerEvents: 'auto' }}>
            <BannerAvisosRepartidor pedidos={datosMios.pedidos} avisos={datosMios.avisos} />
          </div>
          {aviso && avisoPantalla(aviso.texto, aviso.tipo, () => setAviso(null), 'aviso-pantalla')}
          {acciones.errorAccion && avisoPantalla(acciones.errorAccion, 'error', () => acciones.setErrorAccion(null), 'aviso-accion')}
        </div>

        {cargando && (
          <div role="status" style={{ position: 'absolute', inset: 0, zIndex: 850, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(251,244,236,.7)', fontWeight: 800, color: 'var(--cp-soft)' }}>
            Cargando información de reparto...
          </div>
        )}
      </div>

      {/* Menú contextual del marcador (presión larga) */}
      {menuMarcador && idMenu && (
        <CapaMenu alCerrar={() => setMenuMarcador(null)}>
          <div
            role="menu"
            aria-label={`Opciones del pedido ${codigoDe(idMenu)}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              ...cajaMenu,
              width: 190,
              left: `min(max(8px, ${menuMarcador.pos.x - 95}px), calc(100% - 198px))`,
              top: `min(${menuMarcador.pos.y + 28}px, calc(100% - ${ALTO_BARRA + 150}px))`,
            }}
          >
            <button type="button" role="menuitem" style={itemMenu} onClick={() => abrirHoja({ tipo: 'detalle', id: idMenu })}>
              Ver detalles
            </button>
            {menuEsDisponible && (
              <button
                type="button"
                role="menuitem"
                style={itemMenu}
                onClick={() => {
                  alternarRuta(idMenu);
                  setMenuMarcador(null);
                }}
              >
                {miRuta.includes(idMenu) ? 'Quitar de mi ruta' : 'Agregar a mi ruta'}
              </button>
            )}
          </div>
        </CapaMenu>
      )}

      {/* Menú Más */}
      {masAbierto && (
        <CapaMenu alCerrar={() => setMasAbierto(false)}>
          <div
            role="menu"
            aria-label="Más opciones"
            onClick={(e) => e.stopPropagation()}
            style={{ ...cajaMenu, right: 8, bottom: `calc(${BARRA_TOTAL} + 8px)`, width: 240, maxWidth: 'calc(100% - 16px)' }}
          >
            <button type="button" role="menuitem" style={itemMenu} onClick={() => navigate('/admin/perfil')}>
              <Icono nombre="usuarios" tamano={18} />
              Mi perfil
            </button>
            <button type="button" role="menuitem" style={itemMenu} onClick={() => navigate('/admin/notificaciones')}>
              <Icono nombre="notificaciones" tamano={18} />
              Notificaciones
            </button>
            <button type="button" role="menuitem" style={itemMenu} onClick={() => abrirHoja({ tipo: 'hechos' })}>
              <Icono nombre="historial" tamano={18} />
              Hechos hoy ({hechosHoy.length})
            </button>
            <button type="button" role="menuitem" style={itemMenu} onClick={() => abrirHoja({ tipo: 'misRutas' })}>
              <Icono nombre="mapa" tamano={18} />
              Mis rutas
            </button>
            {pedidosActivos.length > 0 && (
              <button type="button" role="menuitem" style={itemMenu} onClick={() => abrirHoja({ tipo: 'falla' })}>
                <Icono nombre="alerta" tamano={18} />
                Reportar falla
              </button>
            )}
            {(sugeridas.datos?.opciones.length ?? 0) > 0 && (
              <button type="button" role="menuitem" style={itemMenu} onClick={() => abrirHoja({ tipo: 'rutas' })}>
                <Icono nombre="mapa" tamano={18} />
                Rutas sugeridas
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              style={{ ...itemMenu, color: 'var(--cp-rust)', borderBottom: 'none' }}
              onClick={() => {
                setMasAbierto(false);
                setConfirmarSalida(true);
              }}
            >
              <Icono nombre="salir" tamano={18} />
              Cerrar sesión
            </button>
          </div>
        </CapaMenu>
      )}

      {/* Hoja inferior: detalle de un pedido u otras secciones */}
      {hoja && hoja.tipo !== 'rutas' && (
        <HojaInferior titulo={tituloHoja} desdeAbajo={BARRA_TOTAL} alCerrar={() => setHoja(null)}>
          {hoja.tipo === 'detalle' && terminados.some((p) => p.id === hoja.id) && (
            <DetalleTerminado
              p={terminados.find((p) => p.id === hoja.id)!}
              alChatear={(p) => {
                setHoja(null);
                setChatPedido({ id: p.id, codigo: p.codigo });
              }}
            />
          )}
          {hoja.tipo === 'misRutas' && (
            <MisRutas
              alDibujar={(r) => {
                setRutaDibujada(r);
                setHoja(null);
                setMenuMarcador(null);
              }}
            />
          )}
          {hoja.tipo === 'detalle' && !terminados.some((p) => p.id === hoja.id) && (
            <DetallePedido
              id={hoja.id}
              mio={pedidosActivos.find((p) => p.id === hoja.id)}
              disponible={dispPorId.get(hoja.id)}
              proximo={proximos.find((p) => p.id === hoja.id)}
              enRuta={miRuta.includes(hoja.id)}
              recarga={recarga}
              alAlternarRuta={alternarRuta}
              alTomar={acciones.tomar}
              alEtapa={ejecutarEtapa}
              alReportar={setPedidoParaFalla}
              orden={ordenRuta}
              alEmpezarPor={empezarPor}
              alSaltar={setPedidoParaSaltar}
              alChatear={(p) => {
                setHoja(null);
                setMenuMarcador(null);
                setChatPedido({ id: p.id, codigo: p.codigo });
              }}
            />
          )}
          {hoja.tipo === 'hechos' && <HechosHoy hechos={hechosHoy} />}
          {hoja.tipo === 'falla' &&
            (pedidosActivos.length === 0 ? (
              <div style={{ color: 'var(--cp-soft)', fontWeight: 700 }}>No tienes pedidos en ruta.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pedidosActivos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    data-testid={`btn-falla-${p.id}`}
                    onClick={() => {
                      setHoja(null);
                      setPedidoParaFalla(p);
                    }}
                    style={{ ...botonBase, justifyContent: 'space-between', background: 'var(--cp-white)', border: '1.5px solid var(--cp-rust)', color: 'var(--cp-rust)' }}
                  >
                    <span>{p.codigo}</span>
                    <span style={{ fontSize: 13 }}>{p.cliente_nombre}</span>
                  </button>
                ))}
              </div>
            ))}
        </HojaInferior>
      )}

      {hoja?.tipo === 'rutas' && (
        <HojaRutasSugeridas
          datos={sugeridas.datos}
          cargando={sugeridas.cargando}
          error={sugeridas.error}
          alReintentar={sugeridas.recargar}
          seleccionadaId={opcionSugeridaId}
          alSeleccionar={setOpcionSugeridaId}
          altura={alturaRutas}
          alCambiarAltura={setAlturaRutas}
          alCerrar={() => setHoja(null)}
          alVerTodo={() => {
            setOpcionSugeridaId(null);
            setVerTodoRutas((n) => n + 1);
          }}
          alCambiar={() => {
            sugeridas.recargar();
            cargarDatos();
          }}
          alTomada={() => {
            setHoja(null);
            setVista('mios');
          }}
          desdeAbajo={BARRA_TOTAL}
        />
      )}

      <BarraInferior vista={vista} masAbierto={masAbierto} alVista={cambiarVista} alMas={() => setMasAbierto((v) => !v)} />

      <Confirmar
        abierto={confirmacion.abierto}
        titulo={confirmacion.titulo}
        mensaje={confirmacion.mensaje}
        textoSi="Sí, confirmar"
        textoNo="No, cancelar"
        cargando={ejecutando}
        alConfirmar={ejecutarConfirmada}
        alCancelar={() => setConfirmacion((prev) => ({ ...prev, abierto: false }))}
      />
      <Confirmar
        abierto={acciones.confirmarAccion.abierto}
        titulo={acciones.confirmarAccion.titulo}
        mensaje={acciones.confirmarAccion.mensaje}
        textoSi="Sí, confirmar"
        textoNo="No, cancelar"
        cargando={acciones.cargandoAccion}
        alConfirmar={acciones.confirmarAccion.ejecutar}
        alCancelar={acciones.cerrarConfirmacion}
      />
      <Confirmar
        abierto={confirmarSalida}
        titulo="Cerrar sesión"
        mensaje="¿Seguro que quieres cerrar tu sesión en el panel de Caprichos?"
        textoSi="Sí, cerrar sesión"
        textoNo="No, quedarme"
        cargando={saliendo}
        alConfirmar={alSalir}
        alCancelar={() => setConfirmarSalida(false)}
      />
      {chatPedido && <ChatPedidoReparto pedidoId={chatPedido.id} codigo={chatPedido.codigo} alCerrar={() => setChatPedido(null)} />}
      {pedidoParaSaltar && (
        <SaltarPedidoModal
          codigo={pedidoParaSaltar.codigo}
          cargando={saltando}
          alConfirmar={saltarPedido}
          alCancelar={() => setPedidoParaSaltar(null)}
        />
      )}
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
    </div>
  );
}
