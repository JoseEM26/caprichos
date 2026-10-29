import { useSesion } from '../../comun/sesion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { useEventos } from '../../comun/socket';
import { salonApi } from './api';
import { ModalNuevoPedidoMesa } from './componentes/ModalNuevoPedidoMesa';
import { ModalVoucherPedido } from './ModalVoucherPedido';
import { ModalPrecuenta } from './componentes/ModalPrecuenta';
import { medioDigitalVoucher } from '../pedidos/mediosPago';
import type { MiPedido, PisoSalon, RangoMisPedidos, RespuestaMisPedidos } from './tipos';
import './mis-pedidos.css';
import './mis-pedidos-voucher.css';

const RANGOS: Array<{ valor: RangoMisPedidos; etiqueta: string }> = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'ayer', etiqueta: 'Ayer' },
  { valor: '7dias', etiqueta: 'Últimos 7 días' },
];

type FiltroEstado = 'todos' | 'enCurso' | 'entregados';
const FILTROS: Array<{ valor: FiltroEstado; etiqueta: string }> = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'enCurso', etiqueta: 'En curso' },
  { valor: 'entregados', etiqueta: 'Entregados' },
];

const ESTADOS_EN_CURSO = ['COLA', 'PREPARANDO', 'LISTO', 'EN_CAMINO'];

const ESTADO_VISTO: Record<string, { texto: string; bg: string; fg: string }> = {
  COLA: { texto: 'En cocina', bg: 'var(--cp-gold)', fg: 'var(--cp-navy)' },
  PREPARANDO: { texto: 'Preparando', bg: 'var(--cp-gold)', fg: 'var(--cp-navy)' },
  LISTO: { texto: 'Listo', bg: 'var(--cp-navy)', fg: 'var(--cp-cream)' },
  EN_CAMINO: { texto: 'En camino', bg: 'var(--cp-soft)', fg: 'var(--cp-cream)' },
  ENTREGADO: { texto: 'Entregado', bg: 'var(--cp-greenbg)', fg: 'var(--cp-green)' },
  ANULADO: { texto: 'Anulado', bg: '#FBEDE9', fg: 'var(--cp-rust)' },
};

const MODALIDAD: Record<string, string> = {
  MESA: 'Mesa',
  LOCAL: 'Local',
  LLEVAR: 'Para llevar',
  RECOGER: 'Para llevar',
  DELIVERY: 'Delivery',
};

const PAGO: Record<string, string> = {
  PAGADO: 'Pagado',
  PENDIENTE: 'Pago pendiente',
  COORDINADO: 'Pago coordinado',
};

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

const horaLima = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });

const lugar = (p: MiPedido) => p.mesaNombre || MODALIDAD[p.modalidad] || p.modalidad;

const resumenLineas = (p: MiPedido) => p.lineas.map((l) => `${l.cantidad} x ${l.nombre}`).join(', ');

/** La cuenta de una mesa se envía a Caja mientras el pedido no esté anulado, entregado ni cobrado. */
const puedeEnviarACaja = (p: MiPedido) =>
  p.modalidad === 'MESA' && p.estado !== 'ANULADO' && p.estado !== 'ENTREGADO' && p.pagoEstado !== 'PAGADO';

const RESUMEN_VACIO = { cantidad: 0, total: 0, enCurso: 0, entregados: 0 };

/** Pedidos que tomó el mozo: resumen del rango, filtro por estado y detalle de solo lectura. */
/** Con plan: lo que lleva voucher es la parte digital; sin plan, el medio del pedido (como antes). */
function tieneParteDigital(p: MiPedido): boolean {
  if (p.plan && p.plan.length > 0) return (p.montoDigital ?? 0) > 0;
  return medioDigitalVoucher(p.pagoMetodo) !== null;
}

function nombreMedioPlan(medio: string): string {
  return medio === 'EFECTIVO' ? 'Efectivo' : medio === 'YAPE' ? 'Yape' : medio === 'PLIN' ? 'Plin' : 'Transferencia';
}

export function MisPedidosView() {
  const { tiene } = useSesion();
  const [rango, setRango] = useState<RangoMisPedidos>('hoy');
  const [filtro, setFiltro] = useState<FiltroEstado>('todos');
  const [datos, setDatos] = useState<RespuestaMisPedidos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [voucherPedido, setVoucherPedido] = useState<MiPedido | null>(null);
  const [cuentaPedido, setCuentaPedido] = useState<MiPedido | null>(null);
  const [pisos, setPisos] = useState<PisoSalon[]>([]);
  const ultimaSolicitud = useRef(0);

  const cargar = useCallback(async () => {
    // Solo cuenta la última respuesta: si cambia el rango mientras llega otra, la vieja se descarta
    const id = ++ultimaSolicitud.current;
    setCargando(true);
    try {
      const res = await salonApi.misPedidos(rango);
      if (id !== ultimaSolicitud.current) return;
      setDatos(res);
      setError(false);
    } catch {
      if (id === ultimaSolicitud.current) setError(true);
    } finally {
      if (id === ultimaSolicitud.current) setCargando(false);
    }
  }, [rango]);

  useEffect(() => {
    void cargar();
    const cada = setInterval(() => void cargar(), 30000);
    return () => clearInterval(cada);
  }, [cargar]);

  useEffect(() => {
    salonApi
      .obtenerMesas()
      .then((r) => setPisos(r.pisos || []))
      .catch(() => setPisos([]));
  }, []);

  useEventos('pedido:nuevo', cargar);
  useEventos('pedido:estado', cargar);
  useEventos('pedido:pago', cargar);

  const pedidos = datos?.pedidos ?? [];
  const visibles = pedidos.filter((p) => {
    if (filtro === 'todos') return true;
    if (filtro === 'enCurso') return ESTADOS_EN_CURSO.includes(p.estado);
    return p.estado === 'ENTREGADO';
  });
  const resumen = datos?.resumen ?? RESUMEN_VACIO;
  const valor = (n: number) => (datos ? String(n) : '—');

  return (
    <div className="mp" aria-busy={cargando}>
      <button type="button" className="mp-nuevo" onClick={() => setModalAbierto(true)}>
        Nuevo pedido
      </button>

      <section className="mp-resumen" aria-label="Resumen del rango elegido">
        <div className="mp-stat">
          <span className="mp-stat-valor">{valor(resumen.cantidad)}</span>
          <span className="mp-stat-etiq">Pedidos</span>
        </div>
        <div className="mp-stat">
          <span className="mp-stat-valor">{datos ? soles(resumen.total) : '—'}</span>
          <span className="mp-stat-etiq">Total vendido</span>
        </div>
        <div className="mp-stat">
          <span className="mp-stat-valor">{valor(resumen.enCurso)}</span>
          <span className="mp-stat-etiq">En curso</span>
        </div>
        <div className="mp-stat">
          <span className="mp-stat-valor">{valor(resumen.entregados)}</span>
          <span className="mp-stat-etiq">Entregados</span>
        </div>
      </section>

      <div className="mp-chips" role="group" aria-label="Rango de fechas">
        {RANGOS.map((r) => (
          <button
            key={r.valor}
            type="button"
            className="mp-chip"
            aria-pressed={rango === r.valor}
            onClick={() => setRango(r.valor)}
          >
            {r.etiqueta}
          </button>
        ))}
      </div>

      <div className="mp-chips" role="group" aria-label="Estado del pedido">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            className="mp-chip"
            aria-pressed={filtro === f.valor}
            onClick={() => setFiltro(f.valor)}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {error && (
        <EstadoError
          mensaje="No pudimos cargar tus pedidos. Revisa la conexión e inténtalo de nuevo."
          alReintentar={() => void cargar()}
        />
      )}

      {!datos && !error && <Cargando mensaje="Cargando tus pedidos" />}

      {datos && pedidos.length === 0 && (
        <EstadoVacio titulo="Aún no tomaste pedidos en este rango" descripcion="Toca Nuevo pedido para registrar el primero." />
      )}

      {datos && pedidos.length > 0 && visibles.length === 0 && (
        <EstadoVacio titulo="No hay pedidos con este estado" descripcion="Prueba con Todos para ver el resto." />
      )}

      {visibles.length > 0 && (
        <ul className="mp-lista">
          {visibles.map((p) => {
            const abierto = expandido === p.id;
            const est = ESTADO_VISTO[p.estado] ?? { texto: p.estado, bg: 'var(--cp-sand)', fg: 'var(--cp-navy)' };
            const idDetalle = `mp-detalle-${p.id}`;
            return (
              <li key={p.id} className="mp-card">
                <button
                  type="button"
                  className="mp-card-cabeza"
                  aria-expanded={abierto}
                  aria-controls={idDetalle}
                  onClick={() => setExpandido(abierto ? null : p.id)}
                >
                  <span className="mp-card-fila">
                    <strong className="mp-codigo">{p.codigo}</strong>
                    <span className="mp-estado" style={{ background: est.bg, color: est.fg }}>
                      {est.texto}
                    </span>
                  </span>
                  <span className="mp-card-fila mp-card-sub">
                    <span>
                      {lugar(p)} · {horaLima(p.creadoEn)}
                    </span>
                    <strong className="mp-total">{soles(p.total)}</strong>
                  </span>
                  <span className="mp-resumen-lineas">{resumenLineas(p)}</span>
                  <span className="mp-mas">{abierto ? 'Ocultar detalle' : 'Ver detalle'}</span>
                </button>

                {abierto && (
                  <div id={idDetalle} className="mp-detalle">
                    <ul>
                      {p.lineas.map((l, i) => (
                        <li key={i}>
                          {l.cantidad} x {l.nombre}
                        </li>
                      ))}
                    </ul>
                    <dl>
                      <dt>Estado</dt>
                      <dd>{est.texto}</dd>
                      <dt>Pago</dt>
                      <dd>{PAGO[p.pagoEstado ?? ''] ?? (p.pagoEstado || 'Sin dato')}</dd>
                      <dt>Total</dt>
                      <dd>{soles(p.total)}</dd>
                    </dl>
                  </div>
                )}

                {puedeEnviarACaja(p) && (
                  <div className="mpv-fila">
                    <button type="button" className="mpv-boton" onClick={() => setCuentaPedido(p)}>
                      Enviar a Caja
                    </button>
                  </div>
                )}

                {p.plan && p.plan.length > 0 && (
                  <p className="mpv-ayuda">
                    {p.plan.map((f) => `${nombreMedioPlan(f.medio)} ${soles(f.monto)}`).join(' · ')}
                  </p>
                )}

                {tieneParteDigital(p) && p.estado !== 'ANULADO' && (
                  <div className="mpv-fila">
                    <span className={`mpv-badge ${p.tieneVoucherLegible ? 'mpv-badge--ok' : 'mpv-badge--falta'}`}>
                      Voucher{p.plan && p.plan.length > 0 ? ' (parte digital)' : ''}: {p.tieneVoucherLegible ? 'subido' : 'falta'}
                    </span>
                    <button type="button" className="mpv-boton" onClick={() => setVoucherPedido(p)}>
                      {p.tieneVoucherLegible ? 'Cambiar voucher' : 'Subir voucher'}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modalAbierto && (
        <ModalNuevoPedidoMesa
          abierto={true}
          pasoInicial="modal"
          canal="MOZO"
          puedeForzarLiberacion={tiene('mesas/liberar')}
          pisos={pisos}
          alCerrar={() => setModalAbierto(false)}
          alExitoPedido={() => void cargar()}
        />
      )}

      {cuentaPedido && (
        <ModalPrecuenta
          abierto={true}
          alCerrar={() => {
            setCuentaPedido(null);
            void cargar();
          }}
          mesa={cuentaPedido.mesaNombre || 'Mesa'}
          lineas={cuentaPedido.lineas.map((l) => ({ cantidad: l.cantidad, nombre: l.nombre, detalle: '' }))}
          total={cuentaPedido.total}
          plan={cuentaPedido.plan}
          pedidoId={cuentaPedido.id}
        />
      )}

      {voucherPedido && (
        <ModalVoucherPedido
          pedido={voucherPedido}
          alCerrar={() => setVoucherPedido(null)}
          alGuardado={() => void cargar()}
        />
      )}
    </div>
  );
}
