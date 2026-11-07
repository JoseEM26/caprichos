import { useSesion } from '../../comun/sesion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';
import { useEventos } from '../../comun/socket';
import { salonApi } from './api';
import { ModalNuevoPedidoMesa } from './componentes/ModalNuevoPedidoMesa';
import { ModalVoucherPedido } from './ModalVoucherPedido';
import { HistorialVoucher } from './HistorialVoucher';
import { Confirmar } from '../../comun/Confirmar';
import { ModalAnular } from '../pedidos/ModalAnular';
import { vouchersApi } from '../vouchers/vouchersApi';
import { ProgresoPedido } from './ProgresoPedido';
import { SalonMozo } from './componentes/SalonMozo';
import { medioDigitalVoucher } from '../pedidos/mediosPago';
import type { MiPedido, PisoSalon, RangoMisPedidos, RespuestaMisPedidos } from './tipos';
import { InsigniaDireccionEditada } from '../pedidos/InsigniaDireccionEditada';
import './mis-pedidos.css';
import './mis-pedidos-voucher.css';

type Pestana = 'salon' | 'lista';
const CLAVE_PESTANA = 'caprichos.misPedidos.pestana';

/** Pestaña recordada en este equipo (Salón por defecto). Sin acceso a localStorage, Salón. */
function pestanaGuardada(): Pestana {
  try {
    return localStorage.getItem(CLAVE_PESTANA) === 'lista' ? 'lista' : 'salon';
  } catch {
    return 'salon';
  }
}

const RANGOS: Array<{ valor: RangoMisPedidos; etiqueta: string }> = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'ayer', etiqueta: 'Ayer' },
  { valor: '7dias', etiqueta: 'Últimos 7 días' },
];

type FiltroEstado = 'todos' | 'enCurso' | 'entregados' | 'faltaVoucher';
const FILTROS: Array<{ valor: FiltroEstado; etiqueta: string }> = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'enCurso', etiqueta: 'En curso' },
  { valor: 'entregados', etiqueta: 'Entregados' },
  { valor: 'faltaVoucher', etiqueta: 'Falta voucher' },
];

const ESTADOS_EN_CURSO = ['COLA', 'PREPARANDO', 'LISTO', 'EN_CAMINO'];

/** Con más de 6 productos se ven 5 y un «Ver N más» expande la tarjeta; con 6 o menos, todos. */
const LINEAS_SIN_RECORTE = 6;
const LINEAS_VISIBLES = 5;

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

const RESUMEN_VACIO = { cantidad: 0, total: 0, enCurso: 0, entregados: 0 };

/** Pedidos que tomó el mozo: resumen del rango, filtro por estado y detalle de solo lectura. */
/** Con plan: lo que lleva voucher es la parte digital; sin plan, el medio del pedido (como antes). */
function tieneParteDigital(p: MiPedido): boolean {
  if (p.plan && p.plan.length > 0) return (p.montoDigital ?? 0) > 0;
  return medioDigitalVoucher(p.pagoMetodo) !== null;
}

/** Medios que llevan captura: uno por medio digital del plan (o el medio del pedido sin plan). */
function mediosVoucher(p: MiPedido): Array<{ medio: 'YAPE' | 'PLIN' | 'TRANSFERENCIA'; monto: number; subido: boolean; voucherId?: string | null }> {
  return (p.vouchersPorMedio ?? []).filter((m): m is { medio: 'YAPE' | 'PLIN' | 'TRANSFERENCIA'; monto: number; subido: boolean; voucherId?: string | null } =>
    m.medio === 'YAPE' || m.medio === 'PLIN' || m.medio === 'TRANSFERENCIA',
  );
}

/** Para buscar: sin mayúsculas, tildes, guiones ni espacios ('cp-w021' === 'CP W021'). */
function normalizarBusqueda(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-\s]/g, '');
}

/** Coincide por nombre del cliente, código o nombre de la mesa. Búsqueda vacía: todo coincide. */
function coincideBusqueda(p: MiPedido, busqueda: string): boolean {
  const q = normalizarBusqueda(busqueda);
  if (q === '') return true;
  return [p.clienteNombre, p.codigo, p.mesaNombre].some((campo) => normalizarBusqueda(campo).includes(q));
}

function nombreMedioPlan(medio: string): string {
  return medio === 'EFECTIVO' ? 'Efectivo' : medio === 'YAPE' ? 'Yape' : medio === 'PLIN' ? 'Plin' : medio === 'TARJETA' ? 'Tarjeta' : 'Transferencia';
}

export function MisPedidosView() {
  const { tiene } = useSesion();
  const [rango, setRango] = useState<RangoMisPedidos>('hoy');
  const [filtro, setFiltro] = useState<FiltroEstado>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [datos, setDatos] = useState<RespuestaMisPedidos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [quitarDe, setQuitarDe] = useState<{ voucherId: string; codigo: string } | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [errorQuitar, setErrorQuitar] = useState<string | null>(null);
  const [voucherPedido, setVoucherPedido] = useState<{ pedido: MiPedido; medio: 'YAPE' | 'PLIN' | 'TRANSFERENCIA'; monto: number } | null>(null);
  const [anulando, setAnulando] = useState<MiPedido | null>(null);
  const [pisos, setPisos] = useState<PisoSalon[]>([]);
  const [pestana, setPestanaState] = useState<Pestana>(pestanaGuardada);
  const [itemsAbiertos, setItemsAbiertos] = useState<Set<string>>(() => new Set());
  const ultimaSolicitud = useRef(0);

  const alternarItems = (id: string) =>
    setItemsAbiertos((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  const setPestana = (p: Pestana) => {
    setPestanaState(p);
    try {
      localStorage.setItem(CLAVE_PESTANA, p);
    } catch {
      // Sin almacenamiento: la pestaña vale solo para esta vista
    }
  };

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
  // Cambio de área en cocina (despeje o devolución) y «entregado en mesa»: refrescan el progreso
  useEventos('cocina:comanda', cargar);
  useEventos('pedido:progreso', cargar);

  const pedidos = datos?.pedidos ?? [];
  // Pedidos (no anulados) con al menos un medio digital del plan sin voucher vigente
  const faltanVoucher = (p: MiPedido) => p.estado !== 'ANULADO' && mediosVoucher(p).some((m) => !m.subido);
  const cuantosFaltan = pedidos.filter(faltanVoucher).length;
  const buscando = normalizarBusqueda(busqueda) !== '';
  const visibles = pedidos.filter((p) => {
    if (!coincideBusqueda(p, busqueda)) return false;
    if (filtro === 'todos') return true;
    if (filtro === 'enCurso') return ESTADOS_EN_CURSO.includes(p.estado);
    if (filtro === 'faltaVoucher') return faltanVoucher(p);
    return p.estado === 'ENTREGADO';
  });
  const resumen = datos?.resumen ?? RESUMEN_VACIO;
  const valor = (n: number) => (datos ? String(n) : '—');

  return (
    <div className="mp" aria-busy={cargando}>
      <div role="tablist" aria-label="Vista de mis pedidos" className="mpv-pestanas">
        <button
          type="button"
          role="tab"
          id="mp-tab-salon"
          aria-selected={pestana === 'salon'}
          aria-controls="mp-panel"
          className="mpv-pestana"
          onClick={() => setPestana('salon')}
        >
          Salón
        </button>
        <button
          type="button"
          role="tab"
          id="mp-tab-lista"
          aria-selected={pestana === 'lista'}
          aria-controls="mp-panel"
          className="mpv-pestana"
          onClick={() => setPestana('lista')}
        >
          Lista
        </button>
      </div>

      <button type="button" className="mp-nuevo" onClick={() => setModalAbierto(true)}>
        Nuevo pedido
      </button>

      {pestana === 'salon' && (
        <div id="mp-panel" role="tabpanel" aria-labelledby="mp-tab-salon">
          <SalonMozo puedeForzar={tiene('mesas/liberar')} puedeDespachar={tiene('cocina/despachar')} />
        </div>
      )}

      {pestana === 'lista' && (
      <div id="mp-panel" role="tabpanel" aria-labelledby="mp-tab-lista" style={{ display: 'contents' }}>
      <div className="mpv-buscar">
        <input
          type="search"
          className="mpv-buscar-caja"
          placeholder="Buscar por nombre, código o mesa"
          aria-label="Buscar pedidos por nombre, código o mesa"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {buscando && <span className="mpv-buscar-cuenta">{visibles.length === 1 ? '1 resultado' : `${visibles.length} resultados`}</span>}
      </div>

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

      <BarraFiltros>
        <FiltroCombo
          etiqueta="Periodo"
          valor={rango}
          valorPorDefecto="hoy"
          opciones={RANGOS.map((r) => ({ valor: r.valor, etiqueta: r.etiqueta }))}
          alCambiar={(v) => setRango(v as RangoMisPedidos)}
        />
        <FiltroCombo
          etiqueta="Estado"
          valor={filtro}
          opciones={FILTROS.map((f) =>
            f.valor === 'faltaVoucher'
              ? { valor: f.valor, etiqueta: f.etiqueta, cantidad: cuantosFaltan }
              : { valor: f.valor, etiqueta: f.etiqueta },
          )}
          alCambiar={(v) => setFiltro(v as FiltroEstado)}
        />
      </BarraFiltros>

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

      {datos && pedidos.length > 0 && visibles.length === 0 && buscando && (
        <div className="mpv-vacio">
          <p className="mpv-vacio-texto">Ningún pedido coincide con tu búsqueda</p>
          <button type="button" className="mpv-boton" onClick={() => setBusqueda('')}>
            Limpiar
          </button>
        </div>
      )}

      {datos && pedidos.length > 0 && visibles.length === 0 && !buscando && (
        <EstadoVacio titulo="No hay pedidos con este estado" descripcion="Prueba con Todos para ver el resto." />
      )}

      {visibles.length > 0 && (
        <ul className="mp-lista">
          {visibles.map((p) => {
            const abierto = expandido === p.id;
            const est = ESTADO_VISTO[p.estado] ?? { texto: p.estado, bg: 'var(--cp-sand)', fg: 'var(--cp-navy)' };
            const idDetalle = `mp-detalle-${p.id}`;
            const idItems = `mp-items-${p.id}`;
            const recortar = p.lineas.length > LINEAS_SIN_RECORTE && !itemsAbiertos.has(p.id);
            const lineasVisibles = recortar ? p.lineas.slice(0, LINEAS_VISIBLES) : p.lineas;
            return (
              <li key={p.id} className={faltanVoucher(p) ? 'mp-card mpv-card--falta' : 'mp-card'}>
                <div className="mp-card-cabeza">
                  <span className="mp-card-fila">
                    <strong className="mp-codigo">{p.codigo}</strong>
                    {p.ubicacionEditadaEn && <InsigniaDireccionEditada />}
                    {p.clienteNombre && (
                      <span className="mpv-cliente" title={p.clienteNombre}>
                        · {p.clienteNombre}
                      </span>
                    )}
                    {faltanVoucher(p) && <span className="mpv-insignia-falta">Falta voucher</span>}
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
                </div>

                {/* Lista del pedido siempre visible: cantidad, producto, detalle, nota y subtotal */}
                <ul className="mp-items" id={idItems} aria-label={`Productos del pedido ${p.codigo}`}>
                  {lineasVisibles.map((l, i) => {
                    const detalle = [l.tamano, l.opciones?.join(', ')].filter(Boolean).join(' · ');
                    return (
                      <li key={l.id ?? i} className="mp-item">
                        <span className="mp-item-cant">{l.cantidad}×</span>
                        <span className="mp-item-cuerpo">
                          <span className="mp-item-nombre">
                            <span className="mp-item-texto">{l.nombre}</span>
                            {l.lista && <span className="mp-item-listo">✓ Listo</span>}
                          </span>
                          {detalle && <span className="mp-item-det">{detalle}</span>}
                          {l.nota && (
                            <span className="mp-item-nota">
                              <svg className="mp-item-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              </svg>
                              <span>Nota: {l.nota}</span>
                            </span>
                          )}
                        </span>
                        {l.subtotal != null && <span className="mp-item-sub">{soles(l.subtotal)}</span>}
                      </li>
                    );
                  })}
                </ul>
                {p.lineas.length > LINEAS_SIN_RECORTE && (
                  <button
                    type="button"
                    className="mp-items-mas"
                    aria-expanded={!recortar}
                    aria-controls={idItems}
                    onClick={() => alternarItems(p.id)}
                  >
                    {recortar ? `Ver ${p.lineas.length - LINEAS_VISIBLES} más` : 'Ver menos'}
                  </button>
                )}

                {!abierto && <ProgresoPedido progreso={p.progreso} modalidad={p.modalidad} variante="compacto" />}

                <button
                  type="button"
                  className="mp-mas"
                  aria-expanded={abierto}
                  aria-controls={idDetalle}
                  onClick={() => setExpandido(abierto ? null : p.id)}
                >
                  {abierto ? 'Ocultar detalle' : 'Ver detalle'}
                </button>

                {abierto && (
                  <div id={idDetalle} className="mp-detalle">
                    <ProgresoPedido progreso={p.progreso} modalidad={p.modalidad} variante="completo" />
                    <dl>
                      <dt>Estado</dt>
                      <dd>{est.texto}</dd>
                      <dt>Pago</dt>
                      <dd>{PAGO[p.pagoEstado ?? ''] ?? (p.pagoEstado || 'Sin dato')}</dd>
                      <dt>Total</dt>
                      <dd>{soles(p.total)}</dd>
                      {(p.propina ?? 0) > 0 && (
                        <>
                          <dt>Propina (aparte)</dt>
                          <dd data-testid="mis-pedidos-propina">{soles(p.propina ?? 0)}</dd>
                        </>
                      )}
                    </dl>
                    {((p.historialVouchers ?? 0) >= 2 || (p.historialVouchers ?? 0) > (p.vouchers ?? 0)) && (
                      <HistorialVoucher pedidoId={p.id} total={p.historialVouchers ?? 0} />
                    )}
                    {/* El servidor decide (suyo, en cocina, sin cobro ni voucher aprobado); aquí solo no se ofrece lo evidente */}
                    {tiene('pedidos/anular') && ['COLA', 'PREPARANDO', 'LISTO'].includes(p.estado) && p.pagoEstado !== 'PAGADO' && (
                      <button type="button" className="mpv-boton" onClick={() => setAnulando(p)}>
                        Anular pedido
                      </button>
                    )}
                  </div>
                )}

                {p.plan && p.plan.length > 0 && (
                  <p className="mpv-ayuda">
                    {p.plan.map((f) => `${nombreMedioPlan(f.medio)} ${soles(f.monto)}`).join(' · ')}
                  </p>
                )}

                {tieneParteDigital(p) && p.estado !== 'ANULADO' && (
                  <div className="mpv-medios">
                    {/* Un voucher por medio digital del plan: cada uno subido o falta */}
                    {mediosVoucher(p).map((m) => (
                      <div className="mpv-fila" key={m.medio}>
                        <span className={`mpv-badge ${m.subido ? 'mpv-badge--ok' : 'mpv-badge--falta'}`}>
                          Voucher {nombreMedioPlan(m.medio)}: {m.subido ? 'subido' : 'falta'}
                        </span>
                        {m.subido && p.puedeCambiarVoucher && (
                          <button type="button" className="mpv-boton" onClick={() => setVoucherPedido({ pedido: p, medio: m.medio, monto: m.monto })}>
                            Cambiar voucher
                          </button>
                        )}
                        {m.subido && p.puedeCambiarVoucher && m.voucherId && (
                          <button type="button" className="mpv-boton" onClick={() => setQuitarDe({ voucherId: m.voucherId as string, codigo: p.codigo })}>
                            Quitar voucher
                          </button>
                        )}
                        {!m.subido && p.puedeSubirVoucher && (
                          <button type="button" className="mpv-boton" onClick={() => setVoucherPedido({ pedido: p, medio: m.medio, monto: m.monto })}>
                            Subir voucher
                          </button>
                        )}
                      </div>
                    ))}
                    {mediosVoucher(p).some((m) => m.subido) && p.puedeCambiarVoucher === false && (
                      <p className="mpv-ayuda">Voucher bloqueado: Caja ya aprobó el pago de este pedido. Pide a Caja cualquier cambio.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      </div>
      )}

      {/* Fuera de las pestañas: Nuevo pedido se abre igual desde Salón que desde Lista */}
      {modalAbierto && (
        <ModalNuevoPedidoMesa
          abierto={true}
          pasoInicial="modal"
          canal="MOZO"
          puedeForzarLiberacion={tiene('mesas/liberar')}
          puedeMesa={tiene('mesas/ver') && tiene('mesas/abrir')}
          puedePersonal={tiene('creditos/ver')}
          pisos={pisos}
          alCerrar={() => setModalAbierto(false)}
          alExitoPedido={() => void cargar()}
        />
      )}

      {errorQuitar && (
        <p role="alert" className="mpv-ayuda">{errorQuitar}</p>
      )}
      <Confirmar
        abierto={quitarDe !== null}
        titulo="Quitar el voucher"
        mensaje={quitarDe ? `El voucher del pedido ${quitarDe.codigo} se retira. Queda en el historial como retirado; no se borra.` : ''}
        textoSi="Sí, quitar"
        textoNo="No"
        cargando={quitando}
        alConfirmar={async () => {
          if (!quitarDe) return;
          setQuitando(true);
          setErrorQuitar(null);
          try {
            await vouchersApi.quitarVoucher(quitarDe.voucherId);
            setQuitarDe(null);
            void cargar();
          } catch {
            setQuitarDe(null);
            setErrorQuitar('No se pudo quitar el voucher. Intenta de nuevo.');
          } finally {
            setQuitando(false);
          }
        }}
        alCancelar={() => setQuitarDe(null)}
      />

      {anulando && (
        <ModalAnular
          pedidoId={anulando.id}
          codigoPedido={anulando.codigo}
          alCerrar={() => setAnulando(null)}
          alAnularExitoso={() => {
            setAnulando(null);
            void cargar();
          }}
        />
      )}

      {voucherPedido && (
        <ModalVoucherPedido
          pedido={voucherPedido.pedido}
          medioVoucher={voucherPedido.medio}
          montoMedio={voucherPedido.monto}
          alCerrar={() => setVoucherPedido(null)}
          alGuardado={() => void cargar()}
        />
      )}
    </div>
  );
}
