import { comoLista } from '../../comun/comoLista';
import { useState, useEffect, useCallback } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import {
  pedidosApi,
  CajaActualRespuesta,
  MovimientoCaja,
  PedidoPorCobrar,
} from './pedidosApi';
import { ErrorApi } from '../../comun/api';
import { SeccionEquipos } from '../impresion/SeccionEquipos';
import { SeccionColaPruebas } from '../impresion/SeccionColaPruebas';
import { ModalCoordinarPago } from './ModalCoordinarPago';

export interface ModalCajaProps {
  cajaInfo: CajaActualRespuesta | null;
  alCerrar: () => void;
  alActualizarCaja: () => void;
  alSeleccionarPedidoPorCobrar?: (pedidoId: string) => void;
}

export function ModalCaja({
  cajaInfo,
  alCerrar,
  alActualizarCaja,
  alSeleccionarPedidoPorCobrar,
}: ModalCajaProps) {
  const [pestana, setPestana] = useState<'movimientos' | 'por_coordinar' | 'abrir' | 'impresion'>(
    !cajaInfo?.abierta ? 'abrir' : 'movimientos',
  );

  // Estado para apertura
  // Precargado con el monto inicial oficial; otro monto se permite y queda auditado
  const montoOficial = cajaInfo?.montoInicialOficial ?? 0;
  const [montoApertura, setMontoApertura] = useState<string>(montoOficial.toFixed(2));
  // Si el monto oficial llega después de abrir el modal y nadie tocó el campo, se precarga
  const [montoTocado, setMontoTocado] = useState<boolean>(false);
  useEffect(() => {
    if (!montoTocado) setMontoApertura(montoOficial.toFixed(2));
  }, [montoOficial, montoTocado]);
  const [abriendoCaja, setAbriendoCaja] = useState<boolean>(false);
  const [mostrarConfirmarAbrir, setMostrarConfirmarAbrir] = useState<boolean>(false);

  // Estado para movimientos
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [cargandoMovs, setCargandoMovs] = useState<boolean>(false);
  const [tipoMov, setTipoMov] = useState<'INGRESO' | 'EGRESO'>('INGRESO');
  const [montoMov, setMontoMov] = useState<string>('');
  const [motivoMov, setMotivoMov] = useState<string>('');
  const [guardandoMov, setGuardandoMov] = useState<boolean>(false);
  const [mostrarConfirmarMov, setMostrarConfirmarMov] = useState<boolean>(false);

  // Anulación de movimiento
  const [movParaAnular, setMovParaAnular] = useState<MovimientoCaja | null>(null);
  const [motivoAnularMov, setMotivoAnularMov] = useState<string>('');
  const [anulandoMov, setAnulandoMov] = useState<boolean>(false);

  // Estado para pedidos por coordinar
  const [porCobrarList, setPorCobrarList] = useState<PedidoPorCobrar[]>([]);
  const [cargandoPorCobrar, setCargandoPorCobrar] = useState<boolean>(false);
  // Pedido al que se le marca el pago coordinado (con foto o excepción)
  const [pedidoPorCoordinar, setPedidoPorCoordinar] = useState<PedidoPorCobrar | null>(null);

  // Errores
  const [errorMensaje, setErrorMensaje] = useState<string>('');

  const cargarMovimientos = useCallback(async () => {
    setCargandoMovs(true);
    try {
      const datos = await pedidosApi.listarMovimientos();
      setMovimientos(comoLista<MovimientoCaja>(datos));
    } catch {
      // Ignorar
    } finally {
      setCargandoMovs(false);
    }
  }, []);

  const cargarPorCobrar = useCallback(async () => {
    setCargandoPorCobrar(true);
    try {
      const datos = await pedidosApi.listarPorCobrar();
      setPorCobrarList(comoLista<PedidoPorCobrar>(datos));
    } catch {
      // Ignorar
    } finally {
      setCargandoPorCobrar(false);
    }
  }, []);

  useEffect(() => {
    if (pestana === 'movimientos') {
      cargarMovimientos();
    } else if (pestana === 'por_coordinar') {
      cargarPorCobrar();
    }
  }, [pestana, cargarMovimientos, cargarPorCobrar]);

  // Manejador: Abrir Caja
  const ejecutarAbrirCaja = async () => {
    setMostrarConfirmarAbrir(false);
    setAbriendoCaja(true);
    setErrorMensaje('');
    try {
      const val = parseFloat(montoApertura);
      await pedidosApi.abrirCaja(isNaN(val) ? 0 : Math.max(0, val));
      alActualizarCaja();
      setPestana('movimientos');
    } catch (err: any) {
      if (err instanceof ErrorApi) {
        setErrorMensaje(err.message || 'Error al abrir caja');
      } else {
        setErrorMensaje(err?.message || 'No se pudo abrir la caja');
      }
    } finally {
      setAbriendoCaja(false);
    }
  };

  // Manejador: Crear Movimiento
  const ejecutarCrearMovimiento = async () => {
    setMostrarConfirmarMov(false);
    setGuardandoMov(true);
    setErrorMensaje('');
    try {
      const val = parseFloat(montoMov);
      await pedidosApi.crearMovimiento(tipoMov, val, motivoMov.trim());
      setMontoMov('');
      setMotivoMov('');
      await cargarMovimientos();
      alActualizarCaja();
    } catch (err: any) {
      if (err instanceof ErrorApi) {
        setErrorMensaje(err.message || 'Error al registrar movimiento');
      } else {
        setErrorMensaje(err?.message || 'Error al guardar movimiento');
      }
    } finally {
      setGuardandoMov(false);
    }
  };

  // Manejador: Anular Movimiento
  const ejecutarAnularMovimiento = async () => {
    if (!movParaAnular) return;
    setAnulandoMov(true);
    setErrorMensaje('');
    try {
      await pedidosApi.anularMovimiento(movParaAnular.id, motivoAnularMov.trim());
      setMovParaAnular(null);
      setMotivoAnularMov('');
      await cargarMovimientos();
      alActualizarCaja();
    } catch (err: any) {
      if (err instanceof ErrorApi) {
        setErrorMensaje(err.message || 'Error al anular movimiento');
      } else {
        setErrorMensaje(err?.message || 'Error al anular movimiento');
      }
    } finally {
      setAnulandoMov(false);
    }
  };

  // Tras marcar coordinado (con la foto del comprobante o con la excepción con motivo): refresca la cola
  const alCoordinarPedido = async () => {
    setPedidoPorCoordinar(null);
    setErrorMensaje('');
    await cargarPorCobrar();
    alActualizarCaja();
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
        aria-label="Gestión de caja"
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(760px, calc(100% - 24px))',
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
        {/* Cabecera */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 20,
                color: 'var(--cp-navy, #0B2C3E)',
              }}
            >
              Control de Caja
            </div>
            <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
              {cajaInfo?.abierta
                ? `Caja abierta hoy (S/ ${cajaInfo.efectivoEsperado.toFixed(2)} efectivo esperado)`
                : 'La caja de hoy aún no está abierta.'}
            </div>
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

        {/* Pestañas de la modal */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {!cajaInfo?.abierta && (
            <button
              onClick={() => {
                setPestana('abrir');
                setErrorMensaje('');
              }}
              style={{
                minHeight: 44,
                padding: '0 14px',
                borderRadius: 9999,
                border: '1.5px solid var(--cp-navy, #0B2C3E)',
                background:
                  pestana === 'abrir'
                    ? 'var(--cp-navy, #0B2C3E)'
                    : 'transparent',
                color:
                  pestana === 'abrir'
                    ? 'var(--cp-cream, #FBF4EC)'
                    : 'var(--cp-navy, #0B2C3E)',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              Abrir caja
            </button>
          )}
          <button
            onClick={() => {
              setPestana('movimientos');
              setErrorMensaje('');
            }}
            style={{
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 9999,
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              background:
                pestana === 'movimientos'
                  ? 'var(--cp-navy, #0B2C3E)'
                  : 'transparent',
              color:
                pestana === 'movimientos'
                  ? 'var(--cp-cream, #FBF4EC)'
                  : 'var(--cp-navy, #0B2C3E)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Caja chica (movimientos)
          </button>
          <button
            onClick={() => {
              setPestana('por_coordinar');
              setErrorMensaje('');
            }}
            style={{
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 9999,
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              background:
                pestana === 'por_coordinar'
                  ? 'var(--cp-navy, #0B2C3E)'
                  : 'transparent',
              color:
                pestana === 'por_coordinar'
                  ? 'var(--cp-cream, #FBF4EC)'
                  : 'var(--cp-navy, #0B2C3E)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Por coordinar
          </button>

          <button
            type="button"
            onClick={() => {
              setPestana('impresion');
              setErrorMensaje('');
            }}
            style={{
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 9999,
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              background:
                pestana === 'impresion'
                  ? 'var(--cp-navy, #0B2C3E)'
                  : 'transparent',
              color:
                pestana === 'impresion'
                  ? 'var(--cp-cream, #FBF4EC)'
                  : 'var(--cp-navy, #0B2C3E)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Impresión
          </button>
        </div>

        {/* Mensaje de error general si hubo */}
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

        {/* PESTAÑA: ABRIR CAJA */}
        {pestana === 'abrir' && (
          <div
            style={{
              background: 'var(--cp-white, #FFFFFF)',
              border: '1px solid var(--cp-line, #E3D6C6)',
              borderRadius: 14,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              Apertura de la caja del día
            </div>
            <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
              Solo se permite una apertura por día. Ingresa el monto inicial con el que inicia la gaveta en soles.
            </div>

            <div>
              <label
                htmlFor="monto-apertura"
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Monto inicial en soles (S/)
              </label>
              <input
                id="monto-apertura"
                type="text"
                inputMode="decimal"
                value={montoApertura}
                onChange={(e) => {
                  setMontoTocado(true);
                  setMontoApertura(e.target.value);
                }}
                placeholder="0.00"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 44,
                  borderRadius: 10,
                  border: '1.5px solid var(--cp-line, #E3D6C6)',
                  padding: '0 12px',
                  fontSize: 16,
                }}
              />
              <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)', marginTop: 4 }}>
                Monto inicial oficial: S/ {montoOficial.toFixed(2)}. Solo el administrador lo configura.
              </div>
            </div>

            <Boton
              variante="primario"
              cargando={abriendoCaja}
              onClick={() => {
                const val = parseFloat(montoApertura);
                if (isNaN(val) || val < 0) {
                  setErrorMensaje('El monto no puede ser negativo.');
                  return;
                }
                setMostrarConfirmarAbrir(true);
              }}
              style={{
                alignSelf: 'flex-start',
                minHeight: 44,
                fontWeight: 800,
              }}
            >
              Abrir caja hoy
            </Boton>
          </div>
        )}

        {/* PESTAÑA: MOVIMIENTOS DE CAJA CHICA */}
        {pestana === 'movimientos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Formulario nuevo movimiento */}
            {cajaInfo?.abierta && (
              <div
                style={{
                  background: 'var(--cp-white, #FFFFFF)',
                  border: '1px solid var(--cp-line, #E3D6C6)',
                  borderRadius: 14,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 15 }}>
                  Nuevo movimiento de caja chica
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setTipoMov('INGRESO')}
                    style={{
                      minHeight: 44,
                      padding: '0 16px',
                      borderRadius: 10,
                      border: '1.5px solid var(--cp-navy, #0B2C3E)',
                      background:
                        tipoMov === 'INGRESO'
                          ? 'var(--cp-navy, #0B2C3E)'
                          : 'transparent',
                      color:
                        tipoMov === 'INGRESO'
                          ? 'var(--cp-cream, #FBF4EC)'
                          : 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    Ingreso (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoMov('EGRESO')}
                    style={{
                      minHeight: 44,
                      padding: '0 16px',
                      borderRadius: 10,
                      border: '1.5px solid var(--cp-rust, #B2500F)',
                      background:
                        tipoMov === 'EGRESO'
                          ? 'var(--cp-rust, #B2500F)'
                          : 'transparent',
                      color:
                        tipoMov === 'EGRESO'
                          ? '#FFFFFF'
                          : 'var(--cp-rust, #B2500F)',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    Egreso (-)
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 120px' }}>
                    <label
                      htmlFor="mov-monto"
                      style={{
                        fontWeight: 700,
                        fontSize: 12,
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      Monto (S/)
                    </label>
                    <input
                      id="mov-monto"
                      type="text"
                      inputMode="decimal"
                      value={montoMov}
                      placeholder="0.00"
                      onChange={(e) => setMontoMov(e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: 44,
                        borderRadius: 10,
                        border: '1.5px solid var(--cp-line, #E3D6C6)',
                        padding: '0 12px',
                        fontSize: 14,
                      }}
                    />
                  </div>
                  <div style={{ flex: '2 1 200px' }}>
                    <label
                      htmlFor="mov-motivo"
                      style={{
                        fontWeight: 700,
                        fontSize: 12,
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      Motivo (min. 3 caracteres)
                    </label>
                    <input
                      id="mov-motivo"
                      type="text"
                      value={motivoMov}
                      placeholder="Ej. Compra de servilletas"
                      onChange={(e) => setMotivoMov(e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: 44,
                        borderRadius: 10,
                        border: '1.5px solid var(--cp-line, #E3D6C6)',
                        padding: '0 12px',
                        fontSize: 14,
                      }}
                    />
                  </div>
                </div>

                <Boton
                  variante="primario"
                  cargando={guardandoMov}
                  onClick={() => {
                    const m = parseFloat(montoMov);
                    if (isNaN(m) || m <= 0) {
                      setErrorMensaje('Ingresa un monto válido mayor a 0.');
                      return;
                    }
                    if (motivoMov.trim().length < 3) {
                      setErrorMensaje('El motivo debe tener al menos 3 caracteres.');
                      return;
                    }
                    setMostrarConfirmarMov(true);
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    minHeight: 44,
                    fontWeight: 800,
                  }}
                >
                  Registrar movimiento
                </Boton>
              </div>
            )}

            {/* Listado de movimientos de hoy */}
            <div
              style={{
                background: 'var(--cp-white, #FFFFFF)',
                border: '1px solid var(--cp-line, #E3D6C6)',
                borderRadius: 14,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                Movimientos registrados hoy
              </div>

              {cargandoMovs ? (
                <Cargando mensaje="Cargando movimientos..." />
              ) : movimientos.length === 0 ? (
                <EstadoVacio
                  titulo="Sin movimientos de caja chica"
                  descripcion="Todavía no hay ingresos o egresos en este turno."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {movimientos.map((m) => {
                    const esIngreso = m.tipo === 'INGRESO';
                    const estaAnulado = Boolean(m.anulado_en);

                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderBottom: '1px solid var(--cp-sand, #F3E9DB)',
                          opacity: estaAnulado ? 0.5 : 1,
                          textDecoration: estaAnulado ? 'line-through' : 'none',
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: 13,
                              color: esIngreso
                                ? 'var(--cp-green, #2F7A45)'
                                : 'var(--cp-rust, #B2500F)',
                              marginRight: 8,
                            }}
                          >
                            {m.tipo} S/ {m.monto.toFixed(2)}
                          </span>
                          <span style={{ fontSize: 13 }}>{m.motivo}</span>
                          {estaAnulado && (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 11,
                                color: 'var(--cp-rust, #B2500F)',
                                fontWeight: 700,
                              }}
                            >
                              (Anulado: {m.motivo_anulacion})
                            </span>
                          )}
                        </div>
                        {!estaAnulado && cajaInfo?.abierta && (
                          <button
                            onClick={() => {
                              setMovParaAnular(m);
                              setMotivoAnularMov('');
                              setErrorMensaje('');
                            }}
                            style={{
                              minHeight: 36,
                              padding: '0 10px',
                              border: '1px solid var(--cp-rust, #B2500F)',
                              borderRadius: 8,
                              background: 'transparent',
                              color: 'var(--cp-rust, #B2500F)',
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            Anular
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA: POR COORDINAR */}
        {pestana === 'por_coordinar' && (
          <div
            style={{
              background: 'var(--cp-white, #FFFFFF)',
              border: '1px solid var(--cp-line, #E3D6C6)',
              borderRadius: 14,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              Pedidos de la carta y WhatsApp por coordinar
            </div>
            <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
              Pedidos activos que esperan registro de pago coordinado o cobro en caja.
            </div>

            {cargandoPorCobrar ? (
              <Cargando mensaje="Cargando cola de cobro..." />
            ) : porCobrarList.length === 0 ? (
              <EstadoVacio
                titulo="Cola por coordinar vacía"
                descripcion="No hay pedidos de carta o bot pendientes por coordinar pago."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {porCobrarList.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      border: '1.5px solid var(--cp-line, #E3D6C6)',
                      borderRadius: 12,
                      padding: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>
                        {p.codigo} · S/ {p.total.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
                        {p.cliente_nombre || 'Cliente'} · {p.modalidad} · {p.canal}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 2 }}>
                        Estado: <span style={{ fontWeight: 700 }}>{p.estado}</span> ·
                        Pago: <span style={{ fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>{p.pago_estado}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {p.pago_estado !== 'COORDINADO' && (
                        <button
                          onClick={() => setPedidoPorCoordinar(p)}
                          style={{
                            minHeight: 44,
                            padding: '0 12px',
                            border: '1.5px solid var(--cp-navy, #0B2C3E)',
                            borderRadius: 10,
                            background: 'transparent',
                            color: 'var(--cp-navy, #0B2C3E)',
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          Marcar coordinado
                        </button>
                      )}
                      {alSeleccionarPedidoPorCobrar && (
                        <button
                          onClick={() => {
                            alSeleccionarPedidoPorCobrar(p.id);
                            alCerrar();
                          }}
                          style={{
                            minHeight: 44,
                            padding: '0 12px',
                            border: '0',
                            borderRadius: 10,
                            background: 'var(--cp-orange, #E67929)',
                            color: 'var(--cp-navy, #0B2C3E)',
                            fontWeight: 800,
                            fontSize: 12,
                          }}
                        >
                          Ver y cobrar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA: IMPRESIÓN (mismas secciones que Configuración > Impresión, para quien no ve Configuración) */}
        {pestana === 'impresion' && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <SeccionEquipos />
            <SeccionColaPruebas />
          </div>
        )}
      </div>

      {/* Confirmar Apertura */}
      {mostrarConfirmarAbrir && (
        <Confirmar
          abierto={mostrarConfirmarAbrir}
          titulo="¿Abrir la caja del día?"
          mensaje={`Se abrirá la caja hoy con un monto inicial de S/ ${parseFloat(
            montoApertura || '0',
          ).toFixed(2)}. Solo se puede registrar una caja por día.`}
          textoSi="Sí, abrir caja"
          alConfirmar={ejecutarAbrirCaja}
          alCancelar={() => setMostrarConfirmarAbrir(false)}
        />
      )}

      {/* Confirmar Movimiento */}
      {mostrarConfirmarMov && (
        <Confirmar
          abierto={mostrarConfirmarMov}
          titulo={`¿Registrar ${tipoMov.toLowerCase()} de S/ ${parseFloat(
            montoMov,
          ).toFixed(2)}?`}
          mensaje={`Motivo: ${motivoMov.trim()}`}
          textoSi="Registrar"
          alConfirmar={ejecutarCrearMovimiento}
          alCancelar={() => setMostrarConfirmarMov(false)}
        />
      )}

      {/* Modal / Confirmar Anulación de Movimiento */}
      {movParaAnular && (
        <Confirmar
          abierto={Boolean(movParaAnular)}
          titulo={`¿Anular movimiento de ${movParaAnular.tipo} (S/ ${movParaAnular.monto.toFixed(2)})?`}
          mensaje="Esta acción no se puede deshacer. Escribe el motivo abajo si estás seguro."
          textoSi="Anular movimiento"
          peligro
          cargando={anulandoMov}
          alConfirmar={() => {
            if (motivoAnularMov.trim().length < 3) {
              setErrorMensaje('El motivo de anulación debe tener al menos 3 caracteres.');
              return;
            }
            ejecutarAnularMovimiento();
          }}
          alCancelar={() => setMovParaAnular(null)}
        />
      )}

      {pedidoPorCoordinar && (
        <ModalCoordinarPago
          pedido={pedidoPorCoordinar}
          alCerrar={() => setPedidoPorCoordinar(null)}
          alCoordinado={alCoordinarPedido}
        />
      )}
    </>
  );
}
