import { useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { pedidosApi, montoPorCobrar, Pedido } from './pedidosApi';
import { SubirVoucherMozo } from '../vouchers/SubirVoucherMozo';
import { SeccionVouchersPedido } from './SeccionVouchersPedido';
import { digitalesDelPlan, esDeliveryContraEntrega, medioDigitalVoucher, mediosQueExigenCodigo, mismoMedio } from './mediosPago';
import { CapturasPlanDigital } from './CapturasPlanDigital';
import type { VoucherPagoItem } from '../vouchers/tipos';
import { useConfirmarImpresion } from '../impresion/useConfirmarImpresion';
import { BotonAbrirChatCliente } from '../mensajes/BotonAbrirChatCliente';
import { AvisoDeliverySinUbicacion } from './AvisoDeliverySinUbicacion';
import { MENSAJE_DELIVERY_SIN_UBICACION, deliverySinUbicacion } from './ubicacionDelivery';

export interface ModalConfirmarPagoProps {
  pedido: Pedido;
  alCerrar: () => void;
  alConfirmarExitoso: () => void;
  /** Se ubicó el pedido desde el aviso: la lista vuelve a leerlo (por defecto solo cierra el modal) */
  alActualizarPedido?: () => void;
}

const MEDIOS_PC = ['Yape', 'Plin', 'Efectivo', 'Tarjeta', 'Transferencia'] as const;


export function ModalConfirmarPago({ pedido, alCerrar, alConfirmarExitoso, alActualizarPedido }: ModalConfirmarPagoProps) {
  const { pedir: pedirImpresion, dialogo: dialogoImpresion } = useConfirmarImpresion();
  const [contactado, setContactado] = useState(false);
  // Pasos: 1 Cliente · 2 Pago y comprobante · 3 Revisar y confirmar (los tres quedan montados: no se pierde lo subido al volver)
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  // Delivery en efectivo/tarjeta: se cobra al entregar, no se pide pago ni voucher (sin paso 2)
  const contraEntrega = esDeliveryContraEntrega(pedido);
  const [medio, setMedio] = useState<string>(pedido.pago_metodo || pedido.pago_preferido || (contraEntrega ? 'Efectivo' : 'Yape'));
  const [montoPagaCon, setMontoPagaCon] = useState(pedido.paga_con ? String(pedido.paga_con) : '');
  // Código de operación por medio (MAYÚSCULAS). Sin entrada, el campo muestra el que leyó la IA del voucher.
  const [codigos, setCodigos] = useState<Record<string, string>>({});
  // Vouchers ya enlazados al pedido (cualquier origen) y la foto que acaba de subir esta ventana
  const [vouchersPedido, setVouchersPedido] = useState<VoucherPagoItem[]>([]);
  const [voucherSubido, setVoucherSubido] = useState<string | number | null>(null);
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmandoSiNo, setConfirmandoSiNo] = useState(false);

  const esEfectivo = mismoMedio(medio, 'Efectivo');
  const esTarjeta = mismoMedio(medio, 'Tarjeta');
  const esDigital = !esEfectivo && !esTarjeta;
  const medioVoucher = medioDigitalVoucher(medio);
  // Pago dividido con 2 o más medios digitales: una captura por medio (igual que el servidor)
  const mediosPlanDigital = digitalesDelPlan(pedido.planPago);
  const multiples = mediosPlanDigital.length >= 2;
  // Medios digitales del plan sin captura; hasta que cargue, todos cuentan como faltantes
  const [faltanCapturas, setFaltanCapturas] = useState<string[]>(mediosPlanDigital);
  // Un voucher ilegible no cuenta como comprobante; cualquier otro del pedido sí (la IA solo informa)
  const comprobanteListo = multiples
    ? faltanCapturas.length === 0
    : voucherSubido !== null || vouchersPedido.some((v) => v.semaforo !== 'ILEGIBLE');
  // Medios con código de operación (OPCIONAL): digitales del plan y el medio elegido (el efectivo nunca)
  const codigosRequeridos = mediosQueExigenCodigo(medio, pedido.planPago);
  // Lectura de la IA del voucher vigente de ese medio (el más reciente que no sea ilegible)
  const codigoLeido = (m: string): string => {
    const candidatos = vouchersPedido
      .filter((v) => v.semaforo !== 'ILEGIBLE' && (v.medio == null || mismoMedio(v.medio, m)))
      .filter((v) => (v.operacion || v.extraido?.operacion || '').trim() !== '')
      .sort((x, y) => String(y.creadoEn).localeCompare(String(x.creadoEn)));
    return candidatos[0] ? String(candidatos[0].operacion || candidatos[0].extraido?.operacion).trim() : '';
  };
  const valorCodigo = (m: string): string => codigos[m] ?? codigoLeido(m);
  const codigoCorregido = (m: string): boolean => codigos[m] !== undefined && codigoLeido(m) !== '' && codigos[m].trim() !== codigoLeido(m);
  const esDelivery = (pedido.modalidad || '').toUpperCase() === 'DELIVERY';
  // Sin punto Y zona (envío calculado) no hay confirmación: el servidor lo rechaza igual (DELIVERY_SIN_UBICACION)
  const sinUbicar = deliverySinUbicacion(pedido);

  const handleConfirmar = () => {
    if (!contactado) {
      setPaso(1);
      setMsg('Marca la casilla confirmando que hablaste con el cliente.');
      return;
    }
    if (esDelivery && sinUbicar) {
      setPaso(1);
      setMsg(MENSAJE_DELIVERY_SIN_UBICACION);
      return;
    }
    setMsg('');
    setConfirmandoSiNo(true);
  };

  // La captura es opcional: sin comprobante útil el pago se confirma igual y queda auditado «sin captura»
  const excepcionSinVoucher = (esDigital || multiples) && !comprobanteListo ? { motivo: 'sin captura', sinCaptura: true } : undefined;

  const ejecutarConfirmacion = async () => {
    setEnviando(true);
    setMsg('');
    try {
      await pedidosApi.registrarPago(
        pedido.id,
        medio.toUpperCase(),
        esDigital ? 'PAGADO' : 'COORDINADO',
        excepcionSinVoucher,
        // El código es opcional: solo viajan los escritos (o leídos por la IA)
        codigosRequeridos.some((m) => valorCodigo(m).trim() !== '')
          ? codigosRequeridos.filter((m) => valorCodigo(m).trim() !== '').map((m) => ({ medio: m, codigo: valorCodigo(m).trim() }))
          : undefined,
      );
      if (String(pedido.estado).toUpperCase() === 'NUEVO') {
        await pedidosApi.cambiarEstado(
          pedido.id,
          'COLA',
          contraEntrega ? 'Confirmado con cliente; delivery se cobra al entregar' : 'Confirmado con cliente y pago verificado',
        );
      }
      setConfirmandoSiNo(false);
      alConfirmarExitoso();
    } catch (err: any) {
      setConfirmandoSiNo(false);
      setMsg(err?.message || 'Error al confirmar el pedido');
    } finally {
      setEnviando(false);
    }
  };

  const irASiguiente = () => {
    if (paso === 1 && !contactado) {
      setMsg('Marca la casilla confirmando que hablaste con el cliente.');
      return;
    }
    setMsg('');
    setPaso((p) => (p < 3 ? ((contraEntrega ? 3 : p + 1) as 1 | 2 | 3) : p));
  };

  const PASOS: Array<{ n: 1 | 2 | 3; titulo: string }> = [
    { n: 1, titulo: 'Cliente' },
    ...(contraEntrega ? [] : [{ n: 2 as const, titulo: 'Pago y comprobante' }]),
    { n: 3, titulo: 'Revisar y confirmar' },
  ];

  const tarjeta: React.CSSProperties = {
    border: '1.5px solid var(--cp-line, #E3D6C6)',
    background: 'var(--cp-white, #FFFFFF)',
    borderRadius: 14,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };
  const subtitulo: React.CSSProperties = { fontWeight: 800, fontSize: 15, color: 'var(--cp-navy, #0B2C3E)' };
  const campo: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 44,
    borderRadius: 10,
    border: '1.5px solid var(--cp-line, #E3D6C6)',
    background: 'var(--cp-white, #FFFFFF)',
    padding: '0 12px',
    fontSize: 14,
  };
  const lineasTexto =
    pedido.lineas && pedido.lineas.length > 0
      ? pedido.lineas.map((l) => `${l.cantidad}× ${l.nombre}`).join('\n')
      : `Total a cobrar: S/ ${montoPorCobrar(pedido).toFixed(2)}`;
  const mostrar = (n: number): React.CSSProperties => ({ display: paso === n ? 'flex' : 'none', flexDirection: 'column', gap: 14 });

  return (
    <>
      <div
        onClick={alCerrar}
        style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(11,44,62,0.55)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={contraEntrega ? 'Confirmar pedido' : 'Confirmar pedido y pago'}
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 'min(880px,calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          background: 'var(--cp-cream, #FBF4EC)',
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Cabecera y pasos */}
        <div style={{ padding: '16px 20px 12px', display: 'flex', flexDirection: 'column', gap: 12, borderBottom: '1px solid var(--cp-line, #E3D6C6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--cp-navy, #0B2C3E)' }}>
              Confirmar {pedido.codigo}
            </div>
            <button
              onClick={alCerrar}
              aria-label="Cerrar"
              style={{ width: 44, height: 44, borderRadius: 22, border: '1.5px solid var(--cp-navy, #0B2C3E)', background: 'transparent', color: 'var(--cp-navy, #0B2C3E)', fontSize: 20, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ×
            </button>
          </div>
          {sinUbicar && (
            <AvisoDeliverySinUbicacion
              pedidoId={String(pedido.id)}
              codigo={pedido.codigo}
              direccion={pedido.entrega_direccion}
              alActualizar={alActualizarPedido ?? alCerrar}
            />
          )}
          <ol data-testid="pasos-confirmar" style={{ display: 'flex', gap: 8, listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap' }}>
            {PASOS.map((p, i) => {
              const activo = paso === p.n;
              const hecho = paso > p.n;
              const permitido = p.n === 1 || contactado;
              return (
                <li key={p.n} style={{ flex: '1 1 160px' }}>
                  <button
                    type="button"
                    aria-current={activo ? 'step' : undefined}
                    disabled={!permitido}
                    onClick={() => {
                      setMsg('');
                      setPaso(p.n);
                    }}
                    style={{
                      width: '100%',
                      minHeight: 44,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '0 12px',
                      borderRadius: 12,
                      border: `1.5px solid ${activo ? 'var(--cp-navy, #0B2C3E)' : 'var(--cp-line, #E3D6C6)'}`,
                      background: activo ? 'var(--cp-navy, #0B2C3E)' : 'var(--cp-white, #FFFFFF)',
                      color: activo ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: permitido ? 'pointer' : 'not-allowed',
                      opacity: permitido ? 1 : 0.55,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ width: 24, height: 24, borderRadius: 12, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: activo ? 'var(--cp-orange, #E67929)' : hecho ? 'var(--cp-green, #2F7A45)' : 'var(--cp-sand, #F1E6D6)', color: activo ? 'var(--cp-navy, #0B2C3E)' : hecho ? '#fff' : 'var(--cp-navy, #0B2C3E)' }}>
                      {hecho ? '✓' : i + 1}
                    </span>
                    {p.titulo}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Contenido del paso */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {/* Paso 1 · Cliente */}
          <div style={mostrar(1)}>
            <div style={{ fontSize: 13, lineHeight: '18px', color: 'var(--cp-soft, #2C4C5D)' }}>
              Habla con el cliente por WhatsApp para confirmar que todo esté bien. Solo después de confirmar el pedido pasa a las pantallas de cocina.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              <div style={tarjeta}>
                <div style={subtitulo}>1. Contacto con el cliente</div>
                <div style={{ fontSize: 14 }}>
                  Cliente: <b>{pedido.cliente_nombre || 'Cliente'}</b>
                </div>
                <div style={{ fontSize: 14 }}>Teléfono: <b>{pedido.cliente_telefono || 'Sin teléfono'}</b></div>
                <BotonAbrirChatCliente telefono={pedido.cliente_telefono} />
              </div>
              <div style={tarjeta}>
                <div style={subtitulo}>Pedido</div>
                <div style={{ fontSize: 13, color: 'var(--cp-navy, #0B2C3E)', whiteSpace: 'pre-line', maxHeight: 190, overflowY: 'auto' }}>{lineasTexto}</div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>Total: S/ {montoPorCobrar(pedido).toFixed(2)}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setContactado(!contactado);
                setMsg('');
              }}
              role="checkbox"
              aria-checked={contactado}
              style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', minHeight: 48, padding: '6px 12px', border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: 12, background: contactado ? 'var(--cp-white, #FFFFFF)' : 'transparent', color: 'var(--cp-navy, #0B2C3E)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              <span
                style={{ flex: 'none', width: 24, height: 24, borderRadius: 6, border: '2px solid var(--cp-navy, #0B2C3E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, background: contactado ? 'var(--cp-navy, #0B2C3E)' : 'transparent', color: contactado ? 'var(--cp-cream, #FBF4EC)' : 'transparent' }}
              >
                ✓
              </span>
              <span>Ya hablé con el cliente y el pedido está bien</span>
            </button>
          </div>

          {/* Paso 2 · Pago y comprobante */}
          <div style={mostrar(2)}>
            <div style={tarjeta}>
              <div style={subtitulo}>2. Medio de pago</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {MEDIOS_PC.map((m) => {
                  const activo = mismoMedio(medio, m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMedio(m);
                        setMsg('');
                      }}
                      style={{ minHeight: 44, padding: '0 16px', borderRadius: 9999, border: '1.5px solid var(--cp-navy, #0B2C3E)', background: activo ? 'var(--cp-navy, #0B2C3E)' : 'transparent', color: activo ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
              {esEfectivo && (
                <div>
                  <label htmlFor="pc-m" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                    ¿Con cuánto paga? (para el vuelto, opcional)
                  </label>
                  <input id="pc-m" type="text" value={montoPagaCon} onChange={(e) => setMontoPagaCon(e.target.value)} placeholder="s/" style={campo} />
                  <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)', marginTop: 4 }}>
                    El efectivo se cobra al entregar o al recoger. No hace falta comprobante.
                  </div>
                </div>
              )}
              {esTarjeta && (
                <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                  La tarjeta se cobra al entregar o al recoger. No hace falta comprobante.
                </div>
              )}
            </div>

            {/* Comprobantes ya enlazados al pedido (carta, WhatsApp, mozo): el actual arriba, los anteriores plegados */}
            <SeccionVouchersPedido
              pedidoId={pedido.id}
              recargarClave={voucherSubido}
              total={montoPorCobrar(pedido)}
              medio={medio}
              alCargar={setVouchersPedido}
            />

            {esDigital && !multiples && !comprobanteListo && medioVoucher && (
              <div style={tarjeta}>
                <div style={subtitulo}>Comprobante del pago (opcional)</div>
                {/* Mismo camino que el cobro en caja: la foto se guarda como voucher del pedido y la IA solo informa */}
                <SubirVoucherMozo
                  key={medioVoucher}
                  pedidoId={pedido.id}
                  medio={medioVoucher}
                  ofrecerExcepcion
                  alVoucherValido={(info) => {
                    if (info.legible) setVoucherSubido(info.id);
                  }}
                />
                <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
                  Puedes confirmar sin la captura: queda «Pagado sin captura». Pídesela al cliente con amabilidad; se puede subir después.
                </div>
              </div>
            )}
            {esDigital && comprobanteListo && !multiples && (
              <div data-testid="voucher-listo-confirmar" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green, #2F7A45)' }}>
                Comprobante del pedido listo para confirmar.
              </div>
            )}

            {/* Pago dividido con 2 o más medios digitales: una captura por cada uno (todas opcionales) */}
            {multiples && (
              <div style={tarjeta}>
                <div style={subtitulo}>Comprobantes de los pagos digitales (opcional)</div>
                <CapturasPlanDigital pedidoId={pedido.id} planPago={pedido.planPago ?? []} alCambiar={setFaltanCapturas} />
                {!comprobanteListo && (
                  <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
                    Puedes confirmar sin todas las capturas: queda «Pagado sin captura». Se pueden subir después.
                  </div>
                )}
                {comprobanteListo && (
                  <div data-testid="voucher-listo-confirmar" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green, #2F7A45)' }}>
                    Todas las capturas están subidas. Listo para confirmar.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Paso 3 · Revisar y confirmar */}
          <div style={mostrar(3)}>
            <div style={tarjeta}>
              <div style={subtitulo}>3. Revisa y confirma</div>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 14px', fontSize: 14 }}>
                <dt style={{ color: 'var(--cp-soft, #2C4C5D)' }}>Cliente</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>{pedido.cliente_nombre || 'Cliente'} · {pedido.cliente_telefono || 'Sin teléfono'}</dd>
                <dt style={{ color: 'var(--cp-soft, #2C4C5D)' }}>Pedido</dt>
                <dd style={{ margin: 0, whiteSpace: 'pre-line' }}>{lineasTexto}</dd>
                <dt style={{ color: 'var(--cp-soft, #2C4C5D)' }}>Total</dt>
                <dd style={{ margin: 0, fontWeight: 800 }}>S/ {montoPorCobrar(pedido).toFixed(2)}</dd>
                <dt style={{ color: 'var(--cp-soft, #2C4C5D)' }}>Medio de pago</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>{medio}</dd>
                <dt style={{ color: 'var(--cp-soft, #2C4C5D)' }}>Comprobante</dt>
                <dd style={{ margin: 0, fontWeight: 700, color: !(esDigital || multiples) || comprobanteListo ? 'var(--cp-green, #2F7A45)' : 'var(--cp-soft, #2C4C5D)' }}>
                  {!(esDigital || multiples)
                    ? 'No hace falta (se cobra al entregar o recoger)'
                    : comprobanteListo
                      ? 'Listo'
                      : <span data-testid="info-sin-captura">ⓘ Sin captura (puedes agregarla después)</span>}
                </dd>
              </dl>
            </div>
            {codigosRequeridos.length > 0 && (
              <div style={tarjeta} data-testid="codigos-operacion">
                <div style={subtitulo}>Código de operación{codigosRequeridos.length > 1 ? 'es' : ''} (opcional)</div>
                {codigosRequeridos.map((m) => {
                  const nombre = m.charAt(0) + m.slice(1).toLowerCase();
                  const valor = valorCodigo(m);
                  const leido = codigoLeido(m);
                  const faltaEste = valor.trim() === '';
                  return (
                    <div key={m} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label htmlFor={`pc-r-${m}`} style={{ fontWeight: 700, fontSize: 13 }}>
                        {codigosRequeridos.length > 1 ? `${nombre}: código de operación (opcional)` : 'Código de operación (opcional)'}
                      </label>
                      <input
                        id={`pc-r-${m}`}
                        data-testid={`input-codigo-operacion-${m}`}
                        type="text"
                        value={valor}
                        onChange={(e) => setCodigos((c) => ({ ...c, [m]: e.target.value }))}
                        style={campo}
                      />
                      {faltaEste && (
                        <div data-testid={`info-sin-codigo-${m}`} style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                          ⓘ Sin código de operación. Puedes escribirlo o subirlo después.
                        </div>
                      )}
                      {!faltaEste && codigoCorregido(m) && (
                        <div data-testid={`codigo-corregido-${m}`} style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                          Corregido manualmente (leído por la IA: {leido})
                        </div>
                      )}
                      {!faltaEste && !codigoCorregido(m) && leido !== '' && (
                        <div data-testid={`codigo-leido-${m}`} style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                          Leído del voucher por la IA
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pie con los botones del paso */}
        <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--cp-line, #E3D6C6)', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--cp-cream, #FBF4EC)' }}>
          {msg && (
            <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
              {msg}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {paso === 1 ? (
              <button
                type="button"
                onClick={alCerrar}
                style={{ flex: '1 1 140px', minHeight: 52, border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: 12, background: 'transparent', color: 'var(--cp-navy, #0B2C3E)', fontWeight: 800, cursor: 'pointer' }}
              >
                Cancelar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMsg('');
                  setPaso((p) => (p > 1 ? ((contraEntrega ? 1 : p - 1) as 1 | 2 | 3) : p));
                }}
                style={{ flex: '1 1 140px', minHeight: 52, border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: 12, background: 'transparent', color: 'var(--cp-navy, #0B2C3E)', fontWeight: 800, cursor: 'pointer' }}
              >
                Atrás
              </button>
            )}
            {paso < 3 ? (
              <button
                type="button"
                onClick={irASiguiente}
                style={{ flex: '2 1 220px', minHeight: 52, border: 0, borderRadius: 12, background: 'var(--cp-navy, #0B2C3E)', color: 'var(--cp-cream, #FBF4EC)', fontFamily: 'Montserrat,sans-serif', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}
              >
                Siguiente
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmar}
                disabled={enviando || sinUbicar}
                title={sinUbicar ? MENSAJE_DELIVERY_SIN_UBICACION : undefined}
                style={{ flex: '2 1 220px', minHeight: 52, border: 0, borderRadius: 12, background: 'var(--cp-orange, #E67929)', color: 'var(--cp-navy, #0B2C3E)', fontFamily: 'Montserrat,sans-serif', fontWeight: 800, fontSize: 15, cursor: enviando || sinUbicar ? 'not-allowed' : 'pointer', opacity: sinUbicar ? 0.6 : 1 }}
              >
                {enviando ? 'Confirmando...' : 'Confirmar y enviar a cocina'}
              </button>
            )}
          </div>
        </div>
      </div>

      <Confirmar
        abierto={confirmandoSiNo}
        titulo={`¿Confirmar el pedido ${pedido.codigo} y enviarlo a cocina?`}
        mensaje={contraEntrega ? 'El pedido pasará a las pantallas de cocina. El pago queda pendiente: se cobra en presencial al entregar.' : `Se registrará el medio de pago (${medio}) y el pedido pasará a las pantallas de cocina.${excepcionSinVoucher ? ' Se registra pagado sin captura.' : ''}`}
        textoConfirmar="Sí, confirmar"
        textoNo="No"
        cargando={enviando}
        alConfirmar={() => pedirImpresion(ejecutarConfirmacion)}
        alCancelar={() => setConfirmandoSiNo(false)}
      />
      {dialogoImpresion}
    </>
  );
}
