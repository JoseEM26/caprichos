import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { PedidoReparto, repartosApi, MensajeReparto } from './repartosApi';
import { ModalReportarFalla } from './ModalReportarFalla';
import { ModalResolverFalla } from './ModalResolverFalla';
import { ErrorApi } from '../../comun/api';

interface TarjetaRepartoProps {
  pedido: PedidoReparto;
  esMio?: boolean;
  esDisponible?: boolean;
  puedeLiquidar?: boolean;
  alActualizar: () => void;
  paradaNumero?: number;
  distanciaAprox?: string;
}

export function TarjetaReparto({
  pedido,
  esMio = false,
  esDisponible = false,
  puedeLiquidar = false,
  alActualizar,
  paradaNumero,
  distanciaAprox,
}: TarjetaRepartoProps) {
  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  // Modales de confirmación
  const [confirmarAccion, setConfirmarAccion] = useState<{
    abierto: boolean;
    titulo: string;
    mensaje: string;
    ejecutar: () => Promise<void>;
  }>({
    abierto: false,
    titulo: '',
    mensaje: '',
    ejecutar: async () => {},
  });

  // Modales de falla
  const [modalFallaAbierto, setModalFallaAbierto] = useState(false);
  const [modalResolverAbierto, setModalResolverAbierto] = useState(false);

  // Avisos de mensajes WhatsApp
  const [mostrarMensajes, setMostrarMensajes] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeReparto[]>([]);
  const [cargandoMensajes, setCargandoMensajes] = useState(false);

  const cargarMensajes = async () => {
    if (mostrarMensajes) {
      setMostrarMensajes(false);
      return;
    }
    setCargandoMensajes(true);
    try {
      const res = await repartosApi.consultarMensajes(pedido.id);
      setMensajes(res);
      setMostrarMensajes(true);
    } catch {
      // Si falla, simplemente mostrar vacío
      setMensajes([]);
      setMostrarMensajes(true);
    } finally {
      setCargandoMensajes(false);
    }
  };

  // Color de borde y badge según minutos de espera
  const colorBorde =
    pedido.color === 'rojo'
      ? 'var(--cp-rust, #B2500F)'
      : pedido.color === 'naranja'
      ? 'var(--cp-gold, #D99E39)'
      : 'var(--cp-green, #2F7A45)';

  const badgeColor =
    pedido.color === 'rojo'
      ? { bg: '#FDE8E8', fg: '#9B1C1C', texto: `${pedido.minutosEspera} min (crítico)` }
      : pedido.color === 'naranja'
      ? { bg: '#FEF08A', fg: '#713F12', texto: `${pedido.minutosEspera} min (espera)` }
      : { bg: '#DEF7EC', fg: '#03543F', texto: `${pedido.minutosEspera} min` };

  // Cobro contra entrega
  const esEfectivoPendiente =
    pedido.cobro_pendiente_efectivo ||
    pedido.cobroPendienteEfectivo ||
    (pedido.pago_estado !== 'PAGADO' && pedido.pago_metodo === 'EFECTIVO');

  const vueltoCalculado =
    pedido.paga_con && pedido.paga_con > pedido.total
      ? pedido.paga_con - pedido.total
      : null;

  // Enlaces de navegación
  const mapsUrl =
    pedido.lat && pedido.lng
      ? `https://www.google.com/maps/search/?api=1&query=${pedido.lat},${pedido.lng}`
      : pedido.direccion
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pedido.direccion)}`
      : '#';

  const wazeUrl =
    pedido.lat && pedido.lng
      ? `https://waze.com/ul?ll=${pedido.lat},${pedido.lng}&navigate=yes`
      : mapsUrl;

  const telDigitos = pedido.cliente_telefono
    ? pedido.cliente_telefono.replace(/\D/g, '').slice(-9)
    : null;
  const telUrl = telDigitos ? `tel:${telDigitos}` : null;
  const waUrl = telDigitos ? `https://wa.me/51${telDigitos}` : null;

  // Acciones con confirmación
  const pedirConfirmacion = (
    titulo: string,
    mensaje: string,
    ejecutar: () => Promise<void>,
  ) => {
    setErrorAccion(null);
    setConfirmarAccion({
      abierto: true,
      titulo,
      mensaje,
      ejecutar,
    });
  };

  const handleTomar = () => {
    if (pedido.lat == null || pedido.lng == null) {
      setErrorAccion('El pedido no tiene ubicación: caja debe ubicarlo antes de que se pueda tomar');
      return;
    }

    pedirConfirmacion(
      '¿Tomar este pedido?',
      `El pedido ${pedido.codigo} se asignará a tu usuario y desaparecerá de disponibles para otros repartidores.`,
      async () => {
        try {
          setCargandoAccion(true);
          await repartosApi.tomarPedido(pedido.id);
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
          alActualizar();
        } catch (err: any) {
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
          if (err instanceof ErrorApi) {
            if (err.codigo === 'LIMITE_PEDIDOS') {
              setErrorAccion(
                err.message || 'Ya llevas 3 pedidos: entrega alguno antes de tomar otro',
              );
            } else if (err.codigo === 'YA_TOMADO') {
              setErrorAccion(err.message || 'Otro repartidor ya tomó este pedido');
            } else if (err.codigo === 'FALTA_UBICAR') {
              setErrorAccion(
                err.message || 'El pedido no tiene ubicación: caja debe ubicarlo antes de que se pueda tomar',
              );
            } else {
              setErrorAccion(err.message || 'Error al tomar el pedido');
            }
          } else {
            setErrorAccion('Error al tomar el pedido');
          }
        } finally {
          setCargandoAccion(false);
        }
      },
    );
  };

  const handleSalir = () => {
    pedirConfirmacion(
      '¿Marcar salida con el pedido?',
      `El pedido ${pedido.codigo} pasará a estado EN CAMINO. Se registrará la hora de salida.`,
      async () => {
        try {
          setCargandoAccion(true);
          await repartosApi.salir(pedido.id);
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
          alActualizar();
        } catch (err: any) {
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
          setErrorAccion(err instanceof ErrorApi ? err.message : 'Error al marcar salida');
        } finally {
          setCargandoAccion(false);
        }
      },
    );
  };

  const handleLlegue = () => {
    pedirConfirmacion(
      '¿Marcar que has llegado?',
      `Se registrará que has llegado al destino del pedido ${pedido.codigo}.`,
      async () => {
        try {
          setCargandoAccion(true);
          await repartosApi.llegue(pedido.id);
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
          alActualizar();
        } catch (err: any) {
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
          setErrorAccion(err instanceof ErrorApi ? err.message : 'Error al marcar llegada');
        } finally {
          setCargandoAccion(false);
        }
      },
    );
  };

  const handleEntregar = () => {
    const textoCobro = esEfectivoPendiente
      ? ` Efectivo a rendir en caja: S/ ${pedido.total.toFixed(2)} (no se cobra aquí, se liquida al cerrar turno).`
      : ' Pedido ya pagado previamente.';

    pedirConfirmacion(
      '¿Confirmar entrega al cliente?',
      `El pedido ${pedido.codigo} pasará a ENTREGADO.${textoCobro}`,
      async () => {
        try {
          setCargandoAccion(true);
          await repartosApi.entregar(pedido.id);
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
          alActualizar();
        } catch (err: any) {
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
          setErrorAccion(err instanceof ErrorApi ? err.message : 'Error al entregar pedido');
        } finally {
          setCargandoAccion(false);
        }
      },
    );
  };

  return (
    <>
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderLeft: `6px solid ${colorBorde}`,
          borderRadius: '14px',
          boxShadow: '0 4px 14px rgba(11, 44, 62, 0.08)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* Cabecera con número de parada (si aplica), código, tiempo de espera y total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {paradaNumero !== undefined && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '14px',
                    background: 'var(--cp-navy)',
                    color: 'var(--cp-cream)',
                    fontWeight: 800,
                    fontSize: '13px',
                  }}
                  title="Parada sugerida"
                >
                  {paradaNumero}
                </span>
              )}
              <span
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '18px',
                  lineHeight: '22px',
                  color: 'var(--cp-navy)',
                }}
              >
                {pedido.codigo}
              </span>
              {pedido.zona && (
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    borderRadius: '9999px',
                    padding: '2px 8px',
                    background: 'var(--cp-cream)',
                    border: '1px solid var(--cp-line)',
                    color: 'var(--cp-navy)',
                  }}
                >
                  Zona {pedido.zona}
                </span>
              )}
              {(pedido.lat == null || pedido.lng == null) && (
                <span
                  data-testid="badge-falta-ubicar"
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    borderRadius: '9999px',
                    padding: '2px 8px',
                    background: '#FDE8E8',
                    color: 'var(--cp-rust, #C4412B)',
                    border: '1.5px solid var(--cp-rust, #C4412B)',
                  }}
                >
                  Falta ubicar
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  borderRadius: '9999px',
                  padding: '2px 10px',
                  background: badgeColor.bg,
                  color: badgeColor.fg,
                }}
              >
                {badgeColor.texto}
              </span>
              <Insignia variante={pedido.estado === 'LISTO' ? 'aviso' : pedido.estado === 'EN_CAMINO' ? 'acento' : 'exito'}>
                {pedido.estado === 'LISTO' ? 'Listo' : pedido.estado === 'EN_CAMINO' ? 'En camino' : pedido.estado}
              </Insignia>
              {distanciaAprox && (
                <span style={{ fontSize: '12px', color: 'var(--cp-soft)', fontWeight: 600 }}>
                  ~ {distanciaAprox}
                </span>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '20px',
                lineHeight: '24px',
                color: 'var(--cp-rust, #B2500F)',
              }}
            >
              S/ {Number(pedido.total).toFixed(2)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft)', fontWeight: 600 }}>
              {pedido.pago_metodo} · {pedido.pago_estado}
            </div>
          </div>
        </div>

        {/* Cliente y botones de contacto rápido */}
        <div
          style={{
            borderTop: '1px solid var(--cp-line)',
            paddingTop: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 150px' }}>
            <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)', overflowWrap: 'anywhere' }}>
              {pedido.cliente_nombre}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
              {pedido.cliente_telefono || 'Sin teléfono registrado'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {telUrl && (
              <a
                href={telUrl}
                aria-label={`Llamar a ${pedido.cliente_nombre}`}
                style={{
                  minWidth: '76px',
                  minHeight: '44px',
                  boxSizing: 'border-box',
                  borderRadius: '12px',
                  background: 'var(--cp-navy)',
                  color: 'var(--cp-cream)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  fontWeight: 800,
                  fontSize: '13px',
                  padding: '0 12px',
                }}
              >
                Llamar
              </a>
            )}
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Escribir por WhatsApp a ${pedido.cliente_nombre}`}
                style={{
                  minWidth: '76px',
                  minHeight: '44px',
                  boxSizing: 'border-box',
                  borderRadius: '12px',
                  background: 'var(--cp-green, #2F7A45)',
                  color: 'var(--cp-white)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  fontWeight: 800,
                  fontSize: '13px',
                  padding: '0 12px',
                }}
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Dirección y Navegación */}
        <div
          style={{
            background: 'var(--cp-cream)',
            borderRadius: '12px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: '14px', lineHeight: '19px', color: 'var(--cp-navy)' }}>
              {pedido.direccion || 'Dirección no especificada'}
            </div>
            {pedido.referencia && (
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '2px' }}>
                Ref.: {pedido.referencia}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: '1 1 110px',
                minHeight: '44px',
                boxSizing: 'border-box',
                border: '1.5px solid var(--cp-navy)',
                borderRadius: '10px',
                background: 'var(--cp-white)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '13px',
                color: 'var(--cp-navy)',
              }}
            >
              Google Maps
            </a>
            <a
              href={wazeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: '1 1 110px',
                minHeight: '44px',
                boxSizing: 'border-box',
                border: '1.5px solid var(--cp-navy)',
                borderRadius: '10px',
                background: 'var(--cp-white)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '13px',
                color: 'var(--cp-navy)',
              }}
            >
              Waze
            </a>
          </div>
        </div>

        {/* Aviso de cobro en efectivo y vuelto */}
        {esEfectivoPendiente && (
          <div
            style={{
              background: '#FFF6E3',
              border: '1.5px solid var(--cp-gold)',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--cp-navy)',
            }}
          >
            <div>Cobro pendiente en efectivo: S/ {Number(pedido.total).toFixed(2)}</div>
            {pedido.paga_con ? (
              <div style={{ fontSize: '12px', color: 'var(--cp-rust)', marginTop: '2px' }}>
                Paga con S/ {pedido.paga_con.toFixed(2)}
                {vueltoCalculado !== null && ` · Llevar vuelto S/ ${vueltoCalculado.toFixed(2)}`}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '2px' }}>
                Cobrar monto exacto o llevar sencillo
              </div>
            )}
          </div>
        )}

        {/* Si ya fue tomado por otro repartidor */}
        {pedido.repartidor && !esMio && (
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-soft)' }}>
            Tomado por: {pedido.repartidor.nombre || `Repartidor #${pedido.repartidor.id}`}
          </div>
        )}

        {/* Falla reportada */}
        {pedido.motivo_falla && (
          <div
            role="alert"
            style={{
              background: '#FBE9DF',
              border: '1.5px solid var(--cp-rust)',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--cp-rust)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div>Falla reportada: {pedido.motivo_falla}. En coordinación con caja/administrador.</div>
            {puedeLiquidar && (
              <button
                type="button"
                onClick={() => setModalResolverAbierto(true)}
                style={{
                  alignSelf: 'flex-start',
                  minHeight: '44px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-rust)',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-rust)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Resolver incidente (caja/admin)
              </button>
            )}
          </div>
        )}

        {/* Avisos al cliente (mensajes WhatsApp pendientes de enviar) */}
        <div>
          <button
            type="button"
            onClick={cargarMensajes}
            style={{
              border: '1px solid var(--cp-line)',
              background: 'transparent',
              borderRadius: '8px',
              minHeight: '44px',
              width: '100%',
              padding: '0 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--cp-soft)',
              cursor: 'pointer',
            }}
          >
            <span>Avisos al cliente (WhatsApp)</span>
            <span>{mostrarMensajes ? 'Ocultar' : 'Ver avisos'}</span>
          </button>

          {mostrarMensajes && (
            <div
              style={{
                marginTop: '8px',
                background: 'var(--cp-cream)',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '12px',
              }}
            >
              {cargandoMensajes ? (
                <div>Consultando avisos...</div>
              ) : mensajes.length > 0 ? (
                mensajes.map((m) => (
                  <div key={m.numero} style={{ borderBottom: '1px solid var(--cp-line)', paddingBottom: '4px' }}>
                    <div style={{ fontWeight: 800 }}>
                      Aviso {m.numero}: {m.numero === 1 ? '«En camino»' : m.numero === 2 ? '«He llegado»' : '«Te esperamos 10 minutos»'}
                    </div>
                    <div style={{ color: 'var(--cp-rust)', fontWeight: 700 }}>
                      PENDIENTE DE ENVIAR (no se envía nada real)
                    </div>
                    {m.enviado_en && (
                      <div style={{ color: 'var(--cp-soft)' }}>
                        Registrado: {new Date(m.enviado_en).toLocaleTimeString('es-PE')}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--cp-soft)' }}>
                  Aún no se han generado avisos. Se generan automáticamente al marcar «Salir» y «Llegué».
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mensaje de error de acción si hubo */}
        {errorAccion && (
          <div
            role="alert"
            style={{
              background: '#FDE8E8',
              border: '1.5px solid var(--cp-rust)',
              color: 'var(--cp-rust)',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            {errorAccion}
          </div>
        )}

        {/* Aviso de falta ubicar */}
        {pedido.lat == null || pedido.lng == null ? (
          <div
            role="status"
            style={{
              background: '#FFF1C9',
              border: '1.5px solid var(--cp-gold)',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--cp-navy)',
            }}
          >
            Pide a caja que ubique el pedido antes de tomarlo.
          </div>
        ) : null}

        {/* Botones de acción principales según pantalla */}
        {esDisponible && (
          pedido.lat == null || pedido.lng == null ? (
            <Boton
              disabled
              variante="secundario"
              style={{
                minHeight: '52px',
                fontSize: '16px',
                fontWeight: 800,
                width: '100%',
              }}
            >
              Falta ubicar
            </Boton>
          ) : (
            <Boton
              variante="primario"
              onClick={handleTomar}
              cargando={cargandoAccion}
              style={{
                minHeight: '52px',
                fontSize: '16px',
                fontWeight: 800,
                width: '100%',
              }}
            >
              Tomar pedido
            </Boton>
          )
        )}

        {esMio && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pedido.estado === 'LISTO' && (
              <Boton
                variante="primario"
                onClick={handleSalir}
                cargando={cargandoAccion}
                style={{
                  minHeight: '52px',
                  fontSize: '16px',
                  fontWeight: 800,
                  width: '100%',
                }}
              >
                Salir (En camino)
              </Boton>
            )}

            {pedido.estado === 'EN_CAMINO' && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {!pedido.llego_en && (
                  <Boton
                    variante="secundario"
                    onClick={handleLlegue}
                    cargando={cargandoAccion}
                    style={{
                      flex: '1 1 120px',
                      minHeight: '48px',
                      fontWeight: 800,
                    }}
                  >
                    Llegué
                  </Boton>
                )}
                <Boton
                  variante="primario"
                  onClick={handleEntregar}
                  cargando={cargandoAccion}
                  style={{
                    flex: '2 1 140px',
                    minHeight: '48px',
                    fontWeight: 800,
                  }}
                >
                  Entregar
                </Boton>
              </div>
            )}

            {/* Efectivo a rendir en mis pedidos */}
            {esEfectivoPendiente && (
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)', textAlign: 'center' }}>
                Efectivo a rendir: S/ {pedido.total.toFixed(2)} (se liquida en caja, no se cobra aquí)
              </div>
            )}

            {/* Opción de reportar falla */}
            {pedido.estado === 'EN_CAMINO' && (
              <button
                type="button"
                onClick={() => setModalFallaAbierto(true)}
                style={{
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-rust)',
                  background: 'transparent',
                  color: 'var(--cp-rust)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                Reportar entrega fallida
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de confirmación genérico */}
      <Confirmar
        abierto={confirmarAccion.abierto}
        titulo={confirmarAccion.titulo}
        mensaje={confirmarAccion.mensaje}
        textoSi="Sí, confirmar"
        textoNo="No, cancelar"
        cargando={cargandoAccion}
        alConfirmar={confirmarAccion.ejecutar}
        alCancelar={() => setConfirmarAccion((prev) => ({ ...prev, abierto: false }))}
      />

      {/* Modales de fallas */}
      {modalFallaAbierto && (
        <ModalReportarFalla
          pedido={pedido}
          alCerrar={() => setModalFallaAbierto(false)}
          alCompletar={() => {
            setModalFallaAbierto(false);
            alActualizar();
          }}
        />
      )}

      {modalResolverAbierto && (
        <ModalResolverFalla
          pedido={pedido}
          alCerrar={() => setModalResolverAbierto(false)}
          alCompletar={() => {
            setModalResolverAbierto(false);
            alActualizar();
          }}
        />
      )}
    </>
  );
}
