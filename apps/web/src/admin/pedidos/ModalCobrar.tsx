import { useState, useMemo, useEffect } from 'react';
import { AvisoDeliverySinUbicacion } from './AvisoDeliverySinUbicacion';
import { MENSAJE_DELIVERY_SIN_UBICACION, deliverySinUbicacion } from './ubicacionDelivery';
import { useConfirmarImpresion } from '../impresion/useConfirmarImpresion';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { pedidosApi, Pedido, PagoItem, CobrarDto } from './pedidosApi';
import { ErrorApi } from '../../comun/api';
import { SubirVoucherMozo } from '../vouchers/SubirVoucherMozo';
import { TarjetaLecturaVoucher } from '../vouchers/TarjetaLecturaVoucher';
import { FotoAmpliable } from '../vouchers/FotoAmpliable';
import { vouchersApi } from '../vouchers/vouchersApi';
import type { RespuestaSubirVoucherAdmin, VoucherExtraido } from '../vouchers/tipos';
import { digitalesDelPlan, esPedidoLocal, medioDigitalVoucher, mismoMedio } from './mediosPago';
import { CapturasPlanDigital, ExcepcionSinVoucher } from './CapturasPlanDigital';
import { nombreMedio } from './planPago';
import { usePideCodigo } from '../../comun/usePideCodigo';

const MEDIOS_PAGO = [
  'Efectivo',
  'Yape',
  'Plin',
  'Tarjeta',
  'Transferencia',
] as const;

const MOTIVO_MINIMO = 5;


export interface ModalCobrarProps {
  pedido: Pedido;
  alCerrar: () => void;
  alCobrarExitoso: () => void;
  /** Cobro por otro endpoint (p. ej. un pedido de otro día desde el cierre). Por defecto, la caja de hoy. */
  cobrar?: (dto: CobrarDto) => Promise<unknown>;
  /** Se ubicó el pedido desde el aviso (por defecto solo cierra) */
  alActualizarPedido?: () => void;
}

interface FilaPago {
  medio: string;
  monto: string;
  recibido: string;
}

export function ModalCobrar({
  pedido,
  alCerrar,
  alCobrarExitoso,
  cobrar = pedidosApi.cobrar,
  alActualizarPedido,
}: ModalCobrarProps) {
  const sinUbicar = deliverySinUbicacion(pedido);
  const { pedir: pedirImpresion, dialogo: dialogoImpresion } = useConfirmarImpresion();
  // Lo que se cobra: la venta más la propina (la propina va aparte: no es venta ni comprobante)
  const propinaPedido = Number(pedido.propina) || 0;
  const totalPedido = (Number(pedido.total) || 0) + propinaPedido;

  // Con plan de pago (pago dividido) se precargan sus filas por medio; sin plan, una fila como antes
  const [pagos, setPagos] = useState<FilaPago[]>(() =>
    pedido.planPago && pedido.planPago.length > 0
      ? pedido.planPago.map((f) => ({
          medio: f.medio,
          monto: Number(f.monto).toFixed(2),
          recibido: f.medio === 'EFECTIVO' && pedido.paga_con ? String(pedido.paga_con) : '',
        }))
      : [
          {
            medio: (pedido.pago_metodo || pedido.pago_preferido || 'Efectivo'),
            monto: totalPedido.toFixed(2),
            recibido: pedido.paga_con ? String(pedido.paga_con) : '',
          },
        ],
  );

  const [errorMensaje, setErrorMensaje] = useState<string>('');
  const [enviando, setEnviando] = useState<boolean>(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState<boolean>(false);

  // Comprobante del pago digital: la foto subida (id) y su lectura informativa
  const [voucher, setVoucher] = useState<{ id: string | number } | null>(null);
  const [lectura, setLectura] = useState<RespuestaSubirVoucherAdmin | null>(null);
  const [fotoArchivoId, setFotoArchivoId] = useState<string | number | null>(null);
  // La última foto no se lee: no cuenta como comprobante (pide otra o la excepción)
  const [ilegible, setIlegible] = useState<boolean>(false);
  // Excepción «Registrar sin voucher»: motivo escrito + código rotativo del supervisor
  const [sinVoucher, setSinVoucher] = useState<boolean>(false);
  const [motivoSinVoucher, setMotivoSinVoucher] = useState<string>('');
  const [pinSupervisor, setPinSupervisor] = useState<string>('');
  const local = esPedidoLocal(pedido);
  // En el local no hay supervisor: una sola casilla de consentimiento
  const pideCodigo = usePideCodigo() && !local;

  // Pago dividido con 2 o más medios digitales: una captura por medio (CapturasPlanDigital), como el servidor
  const mediosPlanDigital = digitalesDelPlan(pedido.planPago);
  const multiples = mediosPlanDigital.length >= 2;
  // Medios digitales del plan sin captura; hasta que cargue, todos cuentan como faltantes
  const [faltanCapturas, setFaltanCapturas] = useState<string[]>(mediosPlanDigital);

  // Foto que ya subió el mozo, el cliente o la carta: Caja la ve y cobra con ella, sin subir otra
  useEffect(() => {
    if (mediosPlanDigital.length >= 2) return;
    let vigente = true;
    vouchersApi
      .listarVouchers({ pedidoId: pedido.id, estado: 'todos' })
      .then((items) => {
        if (!vigente || items.length === 0) return;
        const recientes = [...items].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
        const legible = recientes.find((v) => v.semaforo !== 'ILEGIBLE');
        if (!legible) {
          // Solo hay fotos ilegibles: no cuentan como comprobante, Caja pide otra
          setIlegible(true);
          return;
        }
        setVoucher({ id: legible.id });
        setFotoArchivoId(legible.archivoId);
        setLectura({
          id: legible.id,
          legible: true,
          semaforo: legible.semaforo,
          motivos: legible.motivos,
          extraido: legible.extraido as VoucherExtraido,
          medio: legible.medio ?? undefined,
        });
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [pedido.id]);

  // Normalizar medio de pago para la API (en mayúsculas: EFECTIVO, YAPE, etc.)
  const normalizarMedio = (m: string) => m.toUpperCase();

  // Medio digital con foto obligatoria (YAPE, PLIN, TRANSFERENCIA); la IA solo informa
  const medioDigital = pagos
    .map((p) => medioDigitalVoucher(p.medio))
    .find((m) => m !== null) ?? undefined;
  const hayDigital = medioDigital !== undefined;
  const excepcionLista =
    sinVoucher &&
    motivoSinVoucher.trim().length >= MOTIVO_MINIMO &&
    (!pideCodigo || pinSupervisor.length === 6);
  const comprobanteListo = multiples
    ? faltanCapturas.length === 0 || excepcionLista
    : !hayDigital || voucher !== null || excepcionLista;

  // Calcular suma actual de los pagos
  const sumaPagos = useMemo(() => {
    return pagos.reduce((acc, p) => {
      const val = parseFloat(p.monto);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }, [pagos]);

  // Diferencia contra el total
  const diferencia = useMemo(() => {
    return Number((sumaPagos - totalPedido).toFixed(2));
  }, [sumaPagos, totalPedido]);

  const cuadra = Math.abs(diferencia) < 0.005;

  const cambiarFila = (index: number, parche: Partial<FilaPago>) => {
    setErrorMensaje('');
    setPagos((prev) =>
      prev.map((fila, i) => (i === index ? { ...fila, ...parche } : fila)),
    );
  };

  const agregarFila = () => {
    setErrorMensaje('');
    const falta = Math.max(0, Number((totalPedido - sumaPagos).toFixed(2)));
    setPagos((prev) => [
      ...prev,
      {
        medio: 'Yape',
        monto: falta > 0 ? falta.toFixed(2) : '',
        recibido: '',
      },
    ]);
  };

  const quitarFila = (index: number) => {
    setErrorMensaje('');
    if (pagos.length <= 1) return;
    setPagos((prev) => prev.filter((_, i) => i !== index));
  };

  const validarAntesDeConfirmar = (): boolean => {
    setErrorMensaje('');

    for (let i = 0; i < pagos.length; i++) {
      const p = pagos[i];
      const m = parseFloat(p.monto);
      if (isNaN(m) || m <= 0) {
        setErrorMensaje('Escribe un monto válido mayor a 0 para cada medio de pago.');
        return false;
      }

      if (mismoMedio(p.medio, 'Efectivo') && p.recibido.trim() !== '') {
        const r = parseFloat(p.recibido);
        if (isNaN(r) || r < m) {
          setErrorMensaje('El efectivo recibido es menor al monto en efectivo.');
          return false;
        }
      }
    }

    if (!cuadra) {
      if (diferencia < 0) {
        setErrorMensaje(`Falta cobrar S/ ${Math.abs(diferencia).toFixed(2)}.`);
      } else {
        setErrorMensaje(`La suma se pasa por S/ ${diferencia.toFixed(2)}.`);
      }
      return false;
    }

    if (!comprobanteListo) {
      setErrorMensaje(
        multiples
          ? `Falta la captura de ${faltanCapturas.map(nombreMedio).join(', ')}. Súbela, o registra el cobro sin voucher con motivo${pideCodigo ? ' y código del supervisor' : ''}.`
          : ilegible
            ? `No se lee: sube otra foto o confirma sin comprobante${pideCodigo ? ' con código del supervisor' : ''}.`
            : `Falta la foto del comprobante del pago digital. Súbela, o registra el cobro sin voucher con motivo${pideCodigo ? ' y código del supervisor' : ''}.`,
      );
      return false;
    }

    return true;
  };

  const iniciarCobro = () => {
    if (validarAntesDeConfirmar()) {
      setMostrarConfirmar(true);
    }
  };

  const ejecutarCobro = async () => {
    setMostrarConfirmar(false);
    setEnviando(true);
    setErrorMensaje('');

    const itemsDto: PagoItem[] = pagos.map((p) => {
      const item: PagoItem = {
        medio: normalizarMedio(p.medio),
        monto: parseFloat(p.monto),
      };
      if (mismoMedio(p.medio, 'Efectivo') && p.recibido.trim() !== '') {
        item.recibido = parseFloat(p.recibido);
      }
      return item;
    });

    // Con foto, va el voucherId; sin foto (excepción), el motivo y el código del supervisor
    // Pago dividido: las capturas ya van enlazadas al pedido; solo la excepción viaja en el cobro
    const sinVoucherPayload: Partial<CobrarDto> = local
      ? { confirmaSinCaptura: true }
      : { sinVoucher: { motivo: motivoSinVoucher.trim(), pinSupervisor: pideCodigo ? pinSupervisor : undefined } };
    const comprobante: Partial<CobrarDto> = multiples
      ? faltanCapturas.length > 0 && sinVoucher
        ? sinVoucherPayload
        : {}
      : !hayDigital
        ? {}
        : voucher
          ? { voucherId: voucher.id }
          : sinVoucher
            ? sinVoucherPayload
            : {};

    try {
      await cobrar({
        pedidoId: pedido.id,
        pagos: itemsDto,
        ...comprobante,
      });
      alCobrarExitoso();
    } catch (err: any) {
      if (err instanceof ErrorApi) {
        setErrorMensaje(err.message || 'Error al procesar el cobro');
      } else {
        setErrorMensaje(err?.message || 'Error al conectar con la caja');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div
        onClick={alCerrar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'rgba(11, 44, 62, 0.55)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cobrar el pedido"
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(670px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream, #FBF4EC)',
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: 20,
              color: 'var(--cp-navy, #0B2C3E)',
            }}
          >
            Cobrar {pedido.codigo}
          </div>
          <button
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              background: 'transparent',
              color: 'var(--cp-navy, #0B2C3E)',
              fontSize: 20,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            X
          </button>
        </div>

        {/* Resumen Total */}
        <div
          style={{
            background: 'var(--cp-white, #FFFFFF)',
            border: '1px solid var(--cp-line, #E3D6C6)',
            borderRadius: 12,
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: 20,
            color: 'var(--cp-navy, #0B2C3E)',
          }}
        >
          <span>Total a cobrar</span>
          <span>S/ {totalPedido.toFixed(2)}</span>
        </div>

        {propinaPedido > 0 && (
          <div data-testid="cobro-propina" style={{ fontSize: 13, color: 'var(--cp-navy, #0B2C3E)', marginTop: -6, marginBottom: 6 }}>
            Venta S/ {(totalPedido - propinaPedido).toFixed(2)} + propina S/ {propinaPedido.toFixed(2)} (va aparte, no es venta)
          </div>
        )}

        {/* Cambio de dirección con ajuste sin resolver: saldo por cobrar o devolución pendiente (solo si aplica) */}
        {pedido.ajusteUbicacionPendiente && (
          <div data-testid="cobro-ajuste-ubicacion" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-navy, #0B2C3E)', marginTop: -6, marginBottom: 6 }}>
            {pedido.ajusteUbicacionPendiente.tipo === 'SALDO'
              ? `Ajuste por cambio de dirección: +S/ ${pedido.ajusteUbicacionPendiente.monto.toFixed(2)}`
              : `Devolución pendiente S/ ${pedido.ajusteUbicacionPendiente.monto.toFixed(2)}`}
          </div>
        )}

        {/* Filas de pagos */}
        {pagos.map((fila, idx) => {
          const esEfectivo = mismoMedio(fila.medio, 'Efectivo');
          const recNum = parseFloat(fila.recibido);
          const montoNum = parseFloat(fila.monto);
          const vuelto =
            esEfectivo && !isNaN(recNum) && !isNaN(montoNum) && recNum >= montoNum
              ? Number((recNum - montoNum).toFixed(2))
              : null;

          return (
            <div
              key={idx}
              style={{
                border: '1.5px solid var(--cp-navy, #0B2C3E)',
                borderRadius: 12,
                padding: 12,
                background: 'var(--cp-white, #FFFFFF)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 14 }}>
                  Pago {idx + 1}
                </span>
                {pagos.length > 1 && (
                  <button
                    onClick={() => quitarFila(idx)}
                    style={{
                      minHeight: 36,
                      padding: '0 10px',
                      border: '1.5px solid var(--cp-rust, #B2500F)',
                      borderRadius: 10,
                      background: 'transparent',
                      color: 'var(--cp-rust, #B2500F)',
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    Quitar
                  </button>
                )}
              </div>

              {/* Botones de medio de pago */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MEDIOS_PAGO.map((m) => {
                  const seleccionado = mismoMedio(fila.medio, m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => cambiarFila(idx, { medio: m })}
                      style={{
                        minHeight: 44,
                        padding: '0 12px',
                        borderRadius: 9999,
                        border: '1.5px solid var(--cp-navy, #0B2C3E)',
                        background: seleccionado
                          ? 'var(--cp-navy, #0B2C3E)'
                          : 'transparent',
                        color: seleccionado
                          ? 'var(--cp-cream, #FBF4EC)'
                          : 'var(--cp-navy, #0B2C3E)',
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>

              {/* Monto del medio */}
              <div>
                <label
                  htmlFor={`pago-monto-${idx}`}
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Monto (S/)
                </label>
                <input
                  id={`pago-monto-${idx}`}
                  type="text"
                  inputMode="decimal"
                  value={fila.monto}
                  onChange={(e) => cambiarFila(idx, { monto: e.target.value })}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: 44,
                    borderRadius: 10,
                    border: '1.5px solid var(--cp-line, #E3D6C6)',
                    background: 'var(--cp-white, #FFFFFF)',
                    padding: '0 12px',
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Si es efectivo: recibido y cálculo de vuelto */}
              {esEfectivo && (
                <div>
                  <label
                    htmlFor={`pago-recibido-${idx}`}
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Con cuánto paga el cliente (para el vuelto, opcional)
                  </label>
                  <input
                    id={`pago-recibido-${idx}`}
                    type="text"
                    inputMode="decimal"
                    value={fila.recibido}
                    placeholder="S/"
                    onChange={(e) =>
                      cambiarFila(idx, { recibido: e.target.value })
                    }
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: 44,
                      borderRadius: 10,
                      border: '1.5px solid var(--cp-line, #E3D6C6)',
                      background: 'var(--cp-white, #FFFFFF)',
                      padding: '0 12px',
                      fontSize: 14,
                    }}
                  />
                  {vuelto !== null && (
                    <div
                      style={{
                        marginTop: 6,
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: 18,
                        color: 'var(--cp-green, #2F7A45)',
                      }}
                    >
                      Vuelto: S/ {vuelto.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Botón agregar otro medio de pago */}
        {pagos.length < 5 && (
          <button
            type="button"
            onClick={agregarFila}
            style={{
              alignSelf: 'flex-start',
              minHeight: 44,
              padding: '0 14px',
              border: '1.5px dashed var(--cp-navy, #0B2C3E)',
              borderRadius: 10,
              background: 'transparent',
              color: 'var(--cp-navy, #0B2C3E)',
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            + Pagar parte con otro medio
          </button>
        )}

        {/* Pago dividido con 2 o más medios digitales: una captura por cada uno (el servidor exige cada una) */}
        {multiples && (
          <div
            data-testid="seccion-comprobante-cobro"
            style={{
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              borderRadius: 12,
              padding: 12,
              background: 'var(--cp-white, #FFFFFF)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 14 }}>Comprobantes de los pagos digitales</div>
            <CapturasPlanDigital pedidoId={pedido.id} planPago={pedido.planPago ?? []} alCambiar={setFaltanCapturas} />
            {faltanCapturas.length > 0 && !sinVoucher && (
              <button
                type="button"
                data-testid="btn-sin-voucher"
                onClick={() => setSinVoucher(true)}
                style={{
                  minHeight: 44,
                  border: '1.5px dashed var(--cp-rust, #B2500F)',
                  borderRadius: 10,
                  background: 'transparent',
                  color: 'var(--cp-rust, #B2500F)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {local ? 'Sin captura: el cliente ya pagó' : 'No hay foto: registrar sin voucher (con supervisor)'}
              </button>
            )}
            {sinVoucher && faltanCapturas.length > 0 && (
              <ExcepcionSinVoucher
                local={local}
                medio={faltanCapturas.join('+')}
                motivo={motivoSinVoucher}
                onMotivo={setMotivoSinVoucher}
                pin={pinSupervisor}
                onPin={setPinSupervisor}
                alVolver={() => {
                  setSinVoucher(false);
                  setMotivoSinVoucher('');
                  setPinSupervisor('');
                }}
              />
            )}
          </div>
        )}

        {/* Comprobante del pago digital: la foto es obligatoria; la lectura de la IA solo informa */}
        {!multiples && hayDigital && medioDigital && (
          <div
            data-testid="seccion-comprobante-cobro"
            style={{
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              borderRadius: 12,
              padding: 12,
              background: 'var(--cp-white, #FFFFFF)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 14 }}>
              Comprobante del pago digital ({medioDigital})
            </div>

            {!voucher && !sinVoucher && (
              <>
                <SubirVoucherMozo
                  pedidoId={pedido.id}
                  medio={medioDigital}
                  ofrecerExcepcion
                  alVoucherValido={(info) => {
                    // Solo una foto legible queda como comprobante del cobro
                    setIlegible(!info.legible);
                    if (info.legible) setVoucher({ id: info.id });
                  }}
                  alRespuesta={(r) => {
                    if ('semaforo' in r) setLectura(r);
                  }}
                />
                <button
                  type="button"
                  data-testid="btn-sin-voucher"
                  onClick={() => setSinVoucher(true)}
                  style={{
                    minHeight: 44,
                    border: '1.5px dashed var(--cp-rust, #B2500F)',
                    borderRadius: 10,
                    background: 'transparent',
                    color: 'var(--cp-rust, #B2500F)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {local ? 'Sin captura: el cliente ya pagó' : 'No hay foto: registrar sin voucher (con supervisor)'}
                </button>
              </>
            )}

            {voucher && (
              <>
                <div
                  data-testid="voucher-guardado"
                  style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green, #2F7A45)' }}
                >
                  Foto del comprobante enlazada al pedido como prueba del cobro.
                </div>
                {fotoArchivoId && <FotoAmpliable archivoId={fotoArchivoId} alt="Foto del voucher" />}
                {lectura && (
                  <TarjetaLecturaVoucher
                    voucher={{
                      id: lectura.id,
                      semaforo: lectura.semaforo,
                      motivos: lectura.motivos,
                      extraido: lectura.extraido,
                      medio: medioDigital,
                    }}
                    pedido={{ total: totalPedido, medio: medioDigital }}
                    puedeVer
                  />
                )}
                <button
                  type="button"
                  data-testid="btn-cambiar-foto-cobro"
                  onClick={() => {
                    setVoucher(null);
                    setLectura(null);
                    setFotoArchivoId(null);
                    setIlegible(false);
                  }}
                  style={{
                    minHeight: 44,
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    borderRadius: 10,
                    background: 'transparent',
                    color: 'var(--cp-navy, #0B2C3E)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Subir otra foto
                </button>
              </>
            )}

            {sinVoucher && !voucher && (
              <ExcepcionSinVoucher
                local={local}
                medio={medioDigital}
                motivo={motivoSinVoucher}
                onMotivo={setMotivoSinVoucher}
                pin={pinSupervisor}
                onPin={setPinSupervisor}
                alVolver={() => {
                  setSinVoucher(false);
                  setMotivoSinVoucher('');
                  setPinSupervisor('');
                }}
              />
            )}
          </div>
        )}

        {/* Indicador de cuadre */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: cuadra
              ? 'var(--cp-green, #2F7A45)'
              : 'var(--cp-rust, #B2500F)',
          }}
        >
          {cuadra
            ? 'Cuadra con el total.'
            : diferencia < 0
              ? `Falta cobrar S/ ${Math.abs(diferencia).toFixed(2)}.`
              : `Se pasa por S/ ${diferencia.toFixed(2)}.`}
        </div>

        {/* Mensaje de error si hubo */}
        {errorMensaje && (
          <div
            role="alert"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--cp-rust, #B2500F)',
              background: '#FFF0E6',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--cp-rust, #B2500F)',
            }}
          >
            {errorMensaje}
          </div>
        )}

        {sinUbicar && (
          <AvisoDeliverySinUbicacion
            pedidoId={String(pedido.id)}
            codigo={pedido.codigo}
            direccion={pedido.entrega_direccion}
            alActualizar={alActualizarPedido ?? alCerrar}
          />
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Boton
            variante="primario"
            cargando={enviando}
            disabled={!cuadra || enviando || !comprobanteListo || sinUbicar}
            title={sinUbicar ? MENSAJE_DELIVERY_SIN_UBICACION : undefined}
            onClick={iniciarCobro}
            style={{
              flex: 1,
              minHeight: 52,
              borderRadius: 12,
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            Registrar cobro
          </Boton>
          <Boton
            variante="secundario"
            disabled={enviando}
            onClick={alCerrar}
            style={{
              flex: 1,
              minHeight: 52,
              borderRadius: 12,
              fontWeight: 800,
            }}
          >
            Cancelar
          </Boton>
        </div>
      </div>

      {mostrarConfirmar && (
        <Confirmar
          abierto={mostrarConfirmar}
          titulo={`Registrar el cobro de ${pedido.codigo}`}
          mensaje={`Queda cobrado por S/ ${totalPedido.toFixed(2)} con ${pagos
            .map((p) => `${p.medio} S/ ${parseFloat(p.monto).toFixed(2)}`)
            .join(' + ')}.`}
          textoSi="Cobrar"
          alConfirmar={() => pedirImpresion(ejecutarCobro)}
          alCancelar={() => setMostrarConfirmar(false)}
        />
      )}
      {dialogoImpresion}
    </>
  );
}
