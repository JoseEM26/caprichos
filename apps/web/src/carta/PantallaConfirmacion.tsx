import { useEffect, useMemo, useRef, useState } from 'react';
import { useCarrito } from './CarritoContext';
import { Icono } from '../comun/Icono';
import { ModalConPestanas } from '../comun/ModalConPestanas';
import { leerPedidosGuardados, useSeguimientoPedido } from './seguimiento';
import type { EstadoSeguimiento, PasoSeguimiento, PedidoGuardado } from './seguimiento';
import { AdjuntarCapturaPago } from './AdjuntarCapturaPago';
import { EstadoVoucherPedido } from './EstadoVoucherPedido';
import { avancePedido, etapaCliente, firmasPestanas, NOMBRE_MEDIO, NOMBRE_MODALIDAD, textoPagoMedio } from './seguimiento-textos';
import type { EtapaCliente } from './seguimiento-textos';
import type { PedidoConfirmado } from './tipos';
import { BannerInstalarApp } from '../pwa/BannerInstalarApp';
import './seguimiento-modal.css';

type IdPestana = 'estado' | 'pedido' | 'pago';
const SOLES = (n: number) => `S/ ${Number(n).toFixed(2)}`;

export function PantallaConfirmacion() {
  const { pedidoConfirmado, setPedidoConfirmado, seguimientoAbierto, setSeguimientoAbierto } = useCarrito();

  // Un pedido recién creado o uno abierto desde «Mi pedido»
  const pedido: PedidoGuardado | null =
    seguimientoAbierto ??
    (pedidoConfirmado
      ? {
          codigo: pedidoConfirmado.codigo,
          token: pedidoConfirmado.seguimientoToken,
          modalidad: pedidoConfirmado.modalidad,
          nombre: pedidoConfirmado.clienteNombre,
          creadoEn: '',
        }
      : null);

  if (!pedido) return null;

  const creacion = pedidoConfirmado?.codigo === pedido.codigo ? pedidoConfirmado : null;
  const otros = leerPedidosGuardados().filter((p) => p.codigo !== pedido.codigo);

  const cerrar = () => {
    setPedidoConfirmado(null);
    setSeguimientoAbierto(null);
  };

  return (
    <TarjetaSeguimiento
      key={pedido.codigo}
      pedido={pedido}
      creacion={creacion}
      otros={otros}
      onElegir={setSeguimientoAbierto}
      onCerrar={cerrar}
    />
  );
}

interface TarjetaSeguimientoProps {
  pedido: PedidoGuardado;
  creacion: PedidoConfirmado | null;
  otros: PedidoGuardado[];
  onElegir: (p: PedidoGuardado) => void;
  onCerrar: () => void;
}

/** Qué pestañas cambiaron mientras el cliente miraba otra: se marcan con un punto hasta que las abre. */
function useCambiosPorPestana(activa: IdPestana, estado: EstadoSeguimiento | null): Set<IdPestana> {
  const firmas = useMemo(() => firmasPestanas(estado), [estado]);
  const base = useRef<Record<IdPestana, string> | null>(null);
  const [, redibujar] = useState(0);

  // La primera respuesta fija la referencia; al abrir una pestaña, su referencia pasa a lo que se ve
  useEffect(() => {
    if (!estado) return;
    if (!base.current) base.current = { ...firmas };
    else if (base.current[activa] !== firmas[activa]) {
      base.current = { ...base.current, [activa]: firmas[activa] };
      redibujar((n) => n + 1);
    }
  }, [activa, estado, firmas]);

  const cambiadas = new Set<IdPestana>();
  if (base.current) {
    for (const id of ['estado', 'pedido', 'pago'] as IdPestana[]) {
      if (id !== activa && base.current[id] !== firmas[id]) cambiadas.add(id);
    }
  }
  return cambiadas;
}

function TarjetaSeguimiento({ pedido, creacion, otros, onElegir, onCerrar }: TarjetaSeguimientoProps) {
  const { estado, error, refrescar } = useSeguimientoPedido(pedido.codigo, pedido.token);
  const [activa, setActiva] = useState<IdPestana>('estado');
  const cambiadas = useCambiosPorPestana(activa, estado);
  const anulado = estado?.anulado === true;
  // Lo que paga el cliente: la venta más la propina (si dejó)
  const total = creacion
    ? Number(creacion.total) + Number(creacion.propina ?? 0)
    : estado
      ? estado.total + (estado.propina ?? 0)
      : undefined;
  const modalidad = estado?.modalidad ?? pedido.modalidad;
  const etapa = etapaCliente(estado, pedido.nombre);

  const marca = (id: IdPestana) => (cambiadas.has(id) ? '●' : null);
  const pestanas = [
    {
      id: 'estado',
      etiqueta: 'Estado',
      insignia: marca('estado'),
      contenido: <PanelEstado pedido={pedido} estado={estado} error={error} etapa={etapa} modalidad={modalidad} total={total} creacion={creacion} />,
    },
    {
      id: 'pedido',
      etiqueta: 'Mi pedido',
      insignia: marca('pedido'),
      contenido: <PanelPedido estado={estado} creacion={creacion} modalidad={modalidad} total={total} anulado={anulado} />,
    },
    {
      id: 'pago',
      etiqueta: 'Pago',
      insignia: marca('pago'),
      contenido: <PanelPago pedido={pedido} estado={estado} total={total} onSubida={refrescar} />,
    },
  ];
  const cambiosTexto = [...cambiadas].map((id) => ({ estado: 'Estado', pedido: 'Mi pedido', pago: 'Pago' })[id]).join(', ');

  return (
    <ModalConPestanas
      titulo="Seguimiento de tu pedido"
      subtitulo={<>Pedido #{pedido.codigo} · {NOMBRE_MODALIDAD[modalidad] ?? modalidad}</>}
      pestanas={pestanas}
      pestanaActiva={activa}
      alCambiarPestana={(id) => setActiva(id as IdPestana)}
      alCerrar={onCerrar}
      ancho={560}
      bajoPestanas={
        <span className="sg-solo-lector" role="status" aria-live="polite">
          {cambiosTexto ? `Novedades en: ${cambiosTexto}` : ''}
        </span>
      }
      pie={
        <div className="sg-pie">
          {otros.length > 0 && (
            <details className="sg-otros">
              <summary>Tus otros pedidos ({otros.length})</summary>
              <div className="sg-otros-lista">
                {otros.map((p) => (
                  <button key={p.codigo} type="button" onClick={() => onElegir(p)}>
                    #{p.codigo} · {p.estadoEtiqueta ?? 'Ver estado'}
                  </button>
                ))}
              </div>
            </details>
          )}
          <BannerInstalarApp />
          <button type="button" onClick={onCerrar}>
            Volver a la carta
          </button>
        </div>
      }
    />
  );
}

function PanelEstado({
  pedido, estado, error, etapa, modalidad, total, creacion,
}: {
  pedido: PedidoGuardado;
  estado: EstadoSeguimiento | null;
  error: 'RED' | 'NO_ENCONTRADO' | null;
  etapa: EtapaCliente;
  modalidad: string;
  total: number | undefined;
  creacion: PedidoConfirmado | null;
}) {
  const anulado = estado?.anulado === true;
  let titulo = etapa.titulo;
  let detalle = etapa.detalle;
  if (error === 'NO_ENCONTRADO') {
    titulo = 'No encontramos este pedido';
    detalle = 'Puede que ya no esté disponible.';
  } else if (!estado && error === 'RED') {
    titulo = 'No pudimos consultar el estado';
    detalle = 'Reintentaremos en unos segundos.';
  } else if (!estado && creacion) {
    titulo = pedido.nombre ? `¡Gracias, ${pedido.nombre}!` : 'Recibimos tu pedido';
    detalle = creacion.mensaje || 'Un asesor te escribirá para coordinar el pago';
  }
  const preparando = etapa.clave === 'recibido' || etapa.clave === 'cocina';
  const nombre = pedido.nombre ? `, ${pedido.nombre}` : '';
  const textoLocal =
    estado?.ubicacion === 'ASIGNADA' && estado.mesa
      ? `Tu mesa es la ${estado.mesa}`
      : estado?.ubicacion === 'EN_ESPERA'
        ? `Estamos buscando tu mesa: te llamaremos${nombre}`
        : preparando
          ? `Estamos preparando tu pedido${nombre}. Te llamaremos por tu nombre`
          : `Te llamaremos por tu nombre${nombre}`;
  const fila = (clave: string, valor: string) => (
    <div>
      <dt>{clave}</dt>
      <dd>{valor}</dd>
    </div>
  );

  return (
    <>
      <section
        className={`sg-estado sg-tono-${etapa.tono}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="seguimiento-estado"
        data-etapa={etapa.clave}
      >
        <span className="sg-icono" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {anulado ? <path d="M6 6l12 12M18 6L6 18" /> : etapa.tono === 'normal' ? <path d="M12 7v5l3 2" /> : <path d="M5 12.5l4.5 4.5L19 7.5" />}
          </svg>
        </span>
        <h3 className="sg-titulo">{titulo}</h3>
        {detalle && <p className="sg-detalle">{detalle}</p>}
        {estado?.progreso?.estimadoMin !== undefined && etapa.clave === 'cocina' && (
          <p className="sg-detalle">Listo en ~{estado.progreso.estimadoMin} min</p>
        )}
        {modalidad === 'COMER_LOCAL' && !anulado && !estado?.terminado && (
          <p className="sg-local" data-testid="texto-comer-local">{textoLocal}.</p>
        )}
      </section>

      <dl className="sg-meta" style={{ margin: 0 }}>
        {fila('Pedido', `#${pedido.codigo}`)}
        {fila('Modalidad', NOMBRE_MODALIDAD[modalidad] ?? modalidad)}
        {fila('Total', total !== undefined ? SOLES(total) : '—')}
      </dl>

      {estado && !anulado && <QueFalta estado={estado} etapa={etapa} />}

      {estado && !anulado && (
        <div className="sg-tarjeta" aria-label="Línea de tiempo del pedido">
          {estado.pasos.map((p, idx) => (
            <PasoPedido key={p.clave} paso={p} numero={idx + 1} />
          ))}
        </div>
      )}
    </>
  );
}

function QueFalta({ estado, etapa }: { estado: EstadoSeguimiento; etapa: EtapaCliente }) {
  const av = avancePedido(estado);
  const pendientes = estado.pasos.filter((p) => !p.hecho).map((p) => p.etiqueta);
  const enCocina = etapa.clave === 'recibido' || etapa.clave === 'cocina';
  if (estado.terminado && pendientes.length === 0) return null;
  return (
    <section className="sg-tarjeta" aria-label="Qué falta" data-testid="que-falta">
      <h3>Qué falta</h3>
      {enCocina && av.total > 0 && (
        <>
          <div className="sg-fila"><span>{av.listos} de {av.total} productos listos</span></div>
          <div className="sg-barra" role="progressbar" aria-label="Productos listos" aria-valuemin={0} aria-valuemax={av.total} aria-valuenow={av.listos}>
            <span style={{ width: `${Math.round((av.listos / av.total) * 100)}%` }} />
          </div>
          <ul className="sg-lista">
            {av.areas.map((a) => (
              <li key={a.area} className="sg-fila">
                <span>{a.area} ({a.listos}/{a.total})</span>
                <span className={`sg-chip${a.faltan.length === 0 ? ' sg-chip-ok' : ''}`}>{a.faltan.length === 0 ? 'Listo' : `Falta: ${a.faltan.join(', ')}`}</span>
              </li>
            ))}
          </ul>
          {estado.progreso?.estimadoMin !== undefined && <div className="sg-detalle">Estimado: listo en ~{estado.progreso.estimadoMin} min</div>}
        </>
      )}
      {pendientes.length > 0 && <div className="sg-detalle">Siguientes pasos: {pendientes.join(' → ')}</div>}
    </section>
  );
}

function PanelPedido({
  estado, creacion, modalidad, total, anulado,
}: {
  estado: EstadoSeguimiento | null;
  creacion: PedidoConfirmado | null;
  modalidad: string;
  total: number | undefined;
  anulado: boolean;
}) {
  const areas = (estado?.progreso?.areas ?? []).filter((a) => (a.productos ?? []).length > 0);
  const detalle = estado?.detalle;
  const notas = (detalle?.lineas ?? []).filter((l) => l.nota);
  const propina = creacion?.propina ?? estado?.propina ?? 0;
  const subtotal = detalle?.subtotal ?? (creacion ? Number(creacion.subtotal) : undefined);
  const envio = detalle ? detalle.envio : creacion ? (creacion.envio === null ? null : Number(creacion.envio)) : undefined;

  return (
    <>
      {areas.length > 0 ? (
        areas.map((a) => (
          <section key={a.nombre} className="sg-tarjeta" aria-label={`Productos de ${a.nombre}`}>
            <div className="sg-fila">
              <h3>{a.nombre}</h3>
              {!anulado && <span className={`sg-chip${a.estado === 'LISTA' ? ' sg-chip-ok' : ''}`}>{a.estado === 'LISTA' ? 'Listo' : a.estado === 'PREPARANDO' ? 'En preparación' : 'Pendiente'}</span>}
            </div>
            <ul className="sg-lista">
              {(a.productos ?? []).map((p, i) => (
                <li key={i} className="sg-fila" data-testid="producto-seguimiento">
                  <span>{p.cantidad} × {p.nombre}</span>
                  {!anulado && <span className="sg-chip">{(p.listas ?? 0) >= p.cantidad ? 'Listo' : (p.listas ?? 0) > 0 ? `${p.listas} de ${p.cantidad} listos` : a.estado === 'PENDIENTE' ? 'Pendiente' : 'En preparación'}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : detalle && detalle.lineas.length > 0 ? (
        <section className="sg-tarjeta" aria-label="Productos del pedido">
          <ul className="sg-lista">
            {detalle.lineas.map((l, i) => (
              <li key={i} className="sg-fila" data-testid="producto-seguimiento">
                <span>{l.cantidad} × {l.nombre}</span>
                {!anulado && <span className="sg-chip">Recibido</span>}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="sg-detalle">{estado ? 'Sin productos para mostrar.' : 'Consultando tu pedido...'}</p>
      )}

      {(notas.length > 0 || detalle?.nota) && (
        <section className="sg-tarjeta" aria-label="Notas del pedido">
          <h3>Tus notas</h3>
          {notas.map((l, i) => (
            <div key={i} className="sg-detalle"><strong>{l.nombre}:</strong> {l.nota}</div>
          ))}
          {detalle?.nota && <div className="sg-detalle">{detalle.nota}</div>}
        </section>
      )}

      <section className="sg-tarjeta" aria-label="Resumen de importes">
        {subtotal !== undefined && <div className="sg-fila"><span>Subtotal</span><span>{SOLES(subtotal)}</span></div>}
        {(detalle?.descuento ?? 0) > 0 && (
          <div className="sg-fila" data-testid="descuento-seguimiento"><span>Descuento</span><span>− {SOLES(detalle!.descuento)}</span></div>
        )}
        {(detalle?.puntosCanjeados ?? 0) > 0 && (
          <div className="sg-fila"><span>Puntos canjeados</span><span>{detalle!.puntosCanjeados}</span></div>
        )}
        {envio === null && modalidad === 'DELIVERY' && (
          <div className="sg-fila" data-testid="envio-por-confirmar"><span>Envío</span><span>Por confirmar: se calcula al recibir tu ubicación</span></div>
        )}
        {typeof envio === 'number' && (modalidad === 'DELIVERY' || envio > 0) && (
          <div className="sg-fila"><span>Envío</span><span>{envio === 0 ? 'GRATIS' : SOLES(envio)}</span></div>
        )}
        {propina > 0 && (
          <div className="sg-fila" data-testid="propina-confirmacion"><span>Propina (para el equipo)</span><span>{SOLES(Number(propina))}</span></div>
        )}
        {total !== undefined && <div className="sg-fila sg-total"><span>Total</span><span>{SOLES(total)}</span></div>}
      </section>
    </>
  );
}

function PanelPago({
  pedido, estado, total, onSubida,
}: {
  pedido: PedidoGuardado;
  estado: EstadoSeguimiento | null;
  total: number | undefined;
  onSubida: () => void;
}) {
  if (!estado) return <p className="sg-detalle">Consultando el pago de tu pedido...</p>;
  const resumen = estado.resumenPago;
  const pagos = resumen?.pagos ?? [];
  const porPagar = pagos.filter((p) => p.digital && (p.estado === 'SIN_VOUCHER' || p.estado === 'RECHAZADO'));
  const pagado = resumen?.pagado ?? 0;
  const totalCobrable = resumen?.total ?? total ?? estado.total;
  const pct = totalCobrable > 0 ? Math.min(100, Math.round((pagado / totalCobrable) * 100)) : 0;
  const puedeAdjuntar = !estado.anulado && !estado.terminado && porPagar.length > 0;
  const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : null);

  return (
    <>
      {resumen && (
        <section className="sg-tarjeta" aria-label="Resumen del pago">
          <div className="sg-fila" data-testid="resumen-pagado">
            <span>Pagado</span>
            <span>{SOLES(pagado)} de {SOLES(totalCobrable)}</span>
          </div>
          <div className="sg-barra" role="progressbar" aria-label="Pago del pedido" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </div>
        </section>
      )}

      {pagos.map((p) => (
        <div key={p.medio} className="sg-medio" data-testid="pago-medio" data-medio={p.medio} data-estado={p.estado}>
          <div className="sg-fila">
            <span>{NOMBRE_MEDIO[p.medio] ?? p.medio}</span>
            <span>{SOLES(p.monto)}</span>
          </div>
          <span className="sg-medio-estado">{textoPagoMedio(p, hora(p.actualizadoEn))}</span>
        </div>
      ))}

      {/* API sin desglose por medio: se conserva la tarjeta única del estado del voucher */}
      {!resumen && !estado.anulado && <EstadoVoucherPedido voucher={estado.voucher} />}

      {puedeAdjuntar && (
        <AdjuntarCapturaPago
          codigo={pedido.codigo}
          token={pedido.token ?? ''}
          pagoDigital
          medios={porPagar.map((p) => ({ medio: p.medio, monto: p.monto }))}
          onSubida={onSubida}
        />
      )}
      {!resumen && !estado.anulado && !estado.terminado && (
        <AdjuntarCapturaPago codigo={pedido.codigo} token={pedido.token ?? ''} pagoDigital={Boolean(estado.pagoDigital)} medio={estado.medioPago} total={estado.montoDigital ?? total} restoAlRecibir={estado.montoContraentrega} onSubida={onSubida} />
      )}
      {resumen && pagos.length > 0 && pagos.every((p) => !p.digital) && (
        <p className="sg-detalle">No necesitas enviar captura: lo pagas al recibir tu pedido.</p>
      )}
    </>
  );
}

export function PasoPedido({ paso, numero }: { paso: PasoSeguimiento; numero: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '10px',
          backgroundColor: paso.hecho
            ? 'var(--cp-green)'
            : paso.actual
            ? 'var(--cp-orange)'
            : 'var(--cp-line)',
          color: '#FFFFFF',
          fontSize: '11px',
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
        }}
      >
        {paso.hecho ? <Icono nombre="check" /> : numero}
      </span>
      <span
        aria-current={paso.actual ? 'step' : undefined}
        style={{
          flex: 1,
          fontSize: '13px',
          fontWeight: paso.actual ? 700 : 500,
          color: paso.actual ? 'var(--cp-navy)' : 'var(--cp-soft)',
        }}
      >
        {paso.etiqueta}
      </span>
      {paso.hora && (
        <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>{formatearHora(paso.hora)}</span>
      )}
    </div>
  );
}

// La hora viene de la API como fecha ISO; si no se puede leer, se muestra tal cual
function formatearHora(hora: string): string {
  const fecha = new Date(hora);
  if (Number.isNaN(fecha.getTime())) return hora;
  return fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}
