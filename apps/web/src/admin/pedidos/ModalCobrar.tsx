import { useState, useMemo } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { CampoCodigoSupervisor } from '../../comun/CampoCodigoSupervisor';
import { pedidosApi, Pedido, PagoItem, CobrarDto } from './pedidosApi';
import { ErrorApi } from '../../comun/api';
import { SubirVoucherMozo } from '../vouchers/SubirVoucherMozo';
import { TarjetaLecturaVoucher } from '../vouchers/TarjetaLecturaVoucher';
import type { RespuestaSubirVoucherAdmin } from '../vouchers/tipos';
import { medioDigitalVoucher, mismoMedio } from './mediosPago';

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
}: ModalCobrarProps) {
  const totalPedido = Number(pedido.total) || 0;

  const [pagos, setPagos] = useState<FilaPago[]>([
    {
      medio: (pedido.pago_metodo || pedido.pago_preferido || 'Efectivo'),
      monto: totalPedido.toFixed(2),
      recibido: pedido.paga_con ? String(pedido.paga_con) : '',
    },
  ]);

  const [errorMensaje, setErrorMensaje] = useState<string>('');
  const [enviando, setEnviando] = useState<boolean>(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState<boolean>(false);

  // Comprobante del pago digital: la foto subida (id) y su lectura informativa
  const [voucher, setVoucher] = useState<{ id: string | number } | null>(null);
  const [lectura, setLectura] = useState<RespuestaSubirVoucherAdmin | null>(null);
  // Excepción «Registrar sin voucher»: motivo escrito + código rotativo del supervisor
  const [sinVoucher, setSinVoucher] = useState<boolean>(false);
  const [motivoSinVoucher, setMotivoSinVoucher] = useState<string>('');
  const [pinSupervisor, setPinSupervisor] = useState<string>('');

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
    pinSupervisor.length === 6;
  const comprobanteListo = !hayDigital || voucher !== null || excepcionLista;

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
        'Falta la foto del comprobante del pago digital. Súbela, o registra el cobro sin voucher con motivo y código del supervisor.',
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
    const comprobante: Partial<CobrarDto> = voucher
      ? { voucherId: voucher.id }
      : hayDigital && sinVoucher
        ? { sinVoucher: { motivo: motivoSinVoucher.trim(), pinSupervisor } }
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

        {/* Comprobante del pago digital: la foto es obligatoria; la lectura de la IA solo informa */}
        {hayDigital && medioDigital && (
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
                  alVoucherValido={(info) => setVoucher({ id: info.id })}
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
                  No hay foto: registrar sin voucher (con supervisor)
                </button>
              </>
            )}

            {voucher && (
              <>
                <div
                  data-testid="voucher-guardado"
                  style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green, #2F7A45)' }}
                >
                  Foto guardada y enlazada al pedido como prueba del cobro.
                </div>
                {lectura && (
                  <TarjetaLecturaVoucher
                    voucher={{
                      id: lectura.id,
                      semaforo: lectura.semaforo,
                      motivos: lectura.motivos,
                      extraido: lectura.extraido,
                      medio: medioDigital,
                    }}
                    pedido={{ total: pedido.total, medio: medioDigital }}
                    puedeVer
                  />
                )}
              </>
            )}

            {sinVoucher && !voucher && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                  Cobro sin foto: solo con motivo escrito y el código del supervisor. Queda auditado.
                </div>
                <label htmlFor="motivo-sin-voucher" style={{ fontWeight: 700, fontSize: 13 }}>
                  Motivo (mínimo {MOTIVO_MINIMO} letras)
                </label>
                <textarea
                  id="motivo-sin-voucher"
                  data-testid="motivo-sin-voucher"
                  rows={2}
                  value={motivoSinVoucher}
                  onChange={(e) => setMotivoSinVoucher(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    borderRadius: 10,
                    border: '1.5px solid var(--cp-line, #E3D6C6)',
                    background: 'var(--cp-white, #FFFFFF)',
                    padding: 10,
                    fontSize: 14,
                    fontFamily: 'inherit',
                  }}
                />
                <CampoCodigoSupervisor valor={pinSupervisor} onChange={setPinSupervisor} />
                <button
                  type="button"
                  onClick={() => {
                    setSinVoucher(false);
                    setMotivoSinVoucher('');
                    setPinSupervisor('');
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
                  Volver a pedir la foto
                </button>
              </>
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

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Boton
            variante="primario"
            cargando={enviando}
            disabled={!cuadra || enviando || !comprobanteListo}
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
          alConfirmar={ejecutarCobro}
          alCancelar={() => setMostrarConfirmar(false)}
        />
      )}
    </>
  );
}
