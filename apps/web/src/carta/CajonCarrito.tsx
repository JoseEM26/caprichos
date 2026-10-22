import { useState } from 'react';
import { useCarrito } from './CarritoContext';
import { EstadoLocalCarta } from './tipos';
import { api } from '../comun/api';

interface CajonCarritoProps {
  estadoLocal: EstadoLocalCarta | null;
}

export function CajonCarrito({ estadoLocal }: CajonCarritoProps) {
  const {
    lineas,
    subtotal,
    cajonAbierto,
    cerrarCajon,
    actualizarCantidad,
    eliminarLinea,
    abrirCheckout,
  } = useCarrito();

  const [cuponCodigo, setCuponCodigo] = useState('');
  const [cuponAplicado, setCuponAplicado] = useState<{
    codigo: string;
    descripcion: string;
    descuentoCalculado: number;
  } | null>(null);
  const [cargandoCupon, setCargandoCupon] = useState(false);
  const [mensajeCupon, setMensajeCupon] = useState<string | null>(null);

  const aplicarCupon = async () => {
    if (!cuponCodigo.trim()) return;
    setCargandoCupon(true);
    setMensajeCupon(null);
    try {
      const res = await api.post<any>('/carta/cupon/validar', {
        codigo: cuponCodigo.trim().toUpperCase(),
        subtotal,
        canal: 'CARTA',
      });
      if (res && res.cupon) {
        setCuponAplicado({
          codigo: res.cupon.codigoBase || cuponCodigo.trim().toUpperCase(),
          descripcion: res.cupon.descripcion || 'Descuento aplicado',
          descuentoCalculado: Number(res.cupon.descuentoCalculado || 0),
        });
        setMensajeCupon(`Cupón aplicado: ${res.cupon.descripcion || ''}.`);
      }
    } catch (err: any) {
      setCuponAplicado(null);
      setMensajeCupon(err.response?.data?.mensaje || err.message || 'Código no válido');
    } finally {
      setCargandoCupon(false);
    }
  };

  const removerCupon = () => {
    setCuponAplicado(null);
    setCuponCodigo('');
    setMensajeCupon(null);
  };

  if (!cajonAbierto) return null;

  const localBloqueado = Boolean(
    estadoLocal && (!estadoLocal.abierta || estadoLocal.pausaAltaDemanda),
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Carrito de compras"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        backgroundColor: 'rgba(11, 44, 62, 0.65)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Fondo clickeable para cerrar */}
      <div
        onClick={cerrarCajon}
        style={{
          position: 'absolute',
          inset: 0,
        }}
      />

      {/* Panel lateral */}
      <div
        style={{
          position: 'relative',
          width: 'min(440px, 100%)',
          height: '100%',
          backgroundColor: 'var(--cp-cream)',
          boxShadow: '-10px 0 30px rgba(11, 44, 62, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1,
        }}
      >
        {/* Cabecera del carrito */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--cp-line)',
            backgroundColor: 'var(--cp-white)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '20px',
              color: 'var(--cp-navy)',
            }}
          >
            Mi pedido
          </h2>
          <button
            onClick={cerrarCajon}
            aria-label="Cerrar pedido"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: '1.5px solid var(--cp-navy)',
              backgroundColor: 'transparent',
              color: 'var(--cp-navy)',
              fontSize: '20px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Lista de productos en el carrito */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {lineas.length === 0 ? (
            <div
              style={{
                marginTop: '48px',
                textAlign: 'center',
                color: 'var(--cp-soft)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 700,
                  fontSize: '18px',
                  color: 'var(--cp-navy)',
                }}
              >
                Tu pedido está vacío
              </div>
              <p style={{ margin: 0, fontSize: '13px' }}>
                Elige algo de la carta para empezar.
              </p>
              <button
                onClick={cerrarCajon}
                style={{
                  marginTop: '16px',
                  minHeight: '44px',
                  padding: '0 20px',
                  border: 0,
                  borderRadius: '12px',
                  backgroundColor: 'var(--cp-orange)',
                  color: '#FFFFFF',
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '14px',
                }}
              >
                Ir a la carta
              </button>
            </div>
          ) : (
            lineas.map((linea) => {
              const iniciales = linea.nombre
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase())
                .join('');

              const nombresPersonas = (linea.personas || []).filter(Boolean).join(', ');

              return (
                <div
                  key={linea.id}
                  style={{
                    backgroundColor: 'var(--cp-white)',
                    border: '1px solid var(--cp-line)',
                    borderRadius: '14px',
                    padding: '12px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Foto o iniciales */}
                  <div
                    style={{
                      position: 'relative',
                      width: '60px',
                      height: '60px',
                      flex: 'none',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      backgroundColor: 'var(--cp-sand)',
                    }}
                  >
                    {linea.fotoUrl ? (
                      <img
                        src={linea.fotoUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'var(--fuente-titulos)',
                          fontWeight: 800,
                          fontSize: '20px',
                          color: 'var(--cp-soft)',
                        }}
                      >
                        {iniciales}
                      </div>
                    )}
                  </div>

                  {/* Detalles */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: 'var(--fuente-titulos)',
                        fontWeight: 700,
                        fontSize: '14px',
                        lineHeight: '18px',
                        color: 'var(--cp-navy)',
                      }}
                    >
                      {linea.nombre}
                    </div>

                    {linea.tamanoNombre && (
                      <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '2px' }}>
                        Tamaño: {linea.tamanoNombre}
                      </div>
                    )}

                    {linea.opciones && linea.opciones.length > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--cp-soft)', marginTop: '2px' }}>
                        {linea.opciones.map((o) => o.nombre).join(', ')}
                      </div>
                    )}

                    {nombresPersonas && (
                      <div style={{ fontSize: '11px', color: 'var(--cp-navy)', marginTop: '2px', fontWeight: 600 }}>
                        Para: {nombresPersonas}
                      </div>
                    )}

                    {linea.nota && (
                      <div style={{ fontSize: '11px', color: 'var(--cp-rust)', marginTop: '2px', fontStyle: 'italic' }}>
                        Nota: {linea.nota}
                      </div>
                    )}

                    <div
                      style={{
                        fontFamily: 'var(--fuente-titulos)',
                        fontWeight: 800,
                        fontSize: '14px',
                        color: 'var(--cp-rust)',
                        marginTop: '4px',
                      }}
                    >
                      S/ {linea.subtotal.toFixed(2)}
                    </div>
                  </div>

                  {/* Controles cantidad y eliminar */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '6px',
                      flex: 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        border: '1.5px solid var(--cp-navy)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        onClick={() => actualizarCantidad(linea.id, -1)}
                        aria-label={`Quitar uno a ${linea.nombre}`}
                        style={{
                          width: '32px',
                          height: '36px',
                          border: 0,
                          backgroundColor: 'transparent',
                          color: 'var(--cp-navy)',
                          fontSize: '18px',
                          fontWeight: 800,
                        }}
                      >
                        −
                      </button>
                      <span
                        style={{
                          minWidth: '24px',
                          textAlign: 'center',
                          fontWeight: 700,
                          fontSize: '13px',
                        }}
                      >
                        {linea.cantidad}
                      </span>
                      <button
                        onClick={() => actualizarCantidad(linea.id, 1)}
                        aria-label={`Agregar uno más a ${linea.nombre}`}
                        style={{
                          width: '32px',
                          height: '36px',
                          border: 0,
                          backgroundColor: 'transparent',
                          color: 'var(--cp-navy)',
                          fontSize: '18px',
                          fontWeight: 800,
                        }}
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => eliminarLinea(linea.id)}
                      style={{
                        border: 0,
                        backgroundColor: 'transparent',
                        color: 'var(--cp-soft)',
                        fontSize: '11px',
                        textDecoration: 'underline',
                        minHeight: '24px',
                        padding: 0,
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pie del carrito con resumen y botón de continuar */}
        {lineas.length > 0 && (
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: 'var(--cp-white)',
              borderTop: '1px solid var(--cp-line)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Campo de cupón */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="c-cup" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                ¿Tienes un cupón? <span style={{ fontWeight: 500, color: 'var(--cp-soft)' }}>(opcional)</span>
              </label>
              {!cuponAplicado ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="c-cup"
                    type="text"
                    value={cuponCodigo}
                    onChange={(e) => {
                      setCuponCodigo(e.target.value);
                      setMensajeCupon(null);
                    }}
                    placeholder="Código"
                    autoCapitalize="characters"
                    style={{
                      flex: 1,
                      minHeight: '40px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-line)',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  />
                  <button
                    type="button"
                    onClick={aplicarCupon}
                    disabled={cargandoCupon || !cuponCodigo.trim()}
                    style={{
                      minHeight: '40px',
                      padding: '0 14px',
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: '10px',
                      backgroundColor: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: cargandoCupon || !cuponCodigo.trim() ? 'not-allowed' : 'pointer',
                      opacity: cargandoCupon || !cuponCodigo.trim() ? 0.6 : 1,
                    }}
                  >
                    {cargandoCupon ? '...' : 'Aplicar'}
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(47, 122, 69, 0.08)',
                    border: '1px solid #2F7A45',
                    borderRadius: '10px',
                    padding: '6px 12px',
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--cp-navy)' }}>{cuponAplicado.codigo}</span>
                  <button
                    type="button"
                    onClick={removerCupon}
                    style={{
                      border: 0,
                      backgroundColor: 'transparent',
                      color: 'var(--cp-rust)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Quitar
                  </button>
                </div>
              )}
              {mensajeCupon && (
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: cuponAplicado ? '#2F7A45' : 'var(--cp-rust)',
                  }}
                >
                  {mensajeCupon}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: cuponAplicado ? '14px' : '18px',
                  color: 'var(--cp-navy)',
                }}
              >
                <span>Subtotal</span>
                <span>S/ {subtotal.toFixed(2)}</span>
              </div>

              {cuponAplicado && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    color: 'var(--cp-rust)',
                    fontWeight: 700,
                  }}
                >
                  <span>Descuento cupón</span>
                  <span>−S/ {cuponAplicado.descuentoCalculado.toFixed(2)}</span>
                </div>
              )}

              {cuponAplicado && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 800,
                    fontSize: '18px',
                    color: 'var(--cp-navy)',
                    borderTop: '1px dashed var(--cp-line)',
                    paddingTop: '6px',
                    marginTop: '4px',
                  }}
                >
                  <span>Total estimado</span>
                  <span>S/ {Math.max(0, subtotal - cuponAplicado.descuentoCalculado).toFixed(2)}</span>
                </div>
              )}
            </div>

            {localBloqueado && (
              <div
                role="alert"
                style={{
                  backgroundColor: '#FDECEA',
                  color: 'var(--cp-rust)',
                  border: '1.5px solid var(--cp-rust)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  lineHeight: '16px',
                }}
              >
                {estadoLocal?.pausaAltaDemanda
                  ? 'Local en pausa por alta demanda: no se pueden enviar pedidos por el momento.'
                  : `El local está cerrado (${estadoLocal?.texto}): no se pueden enviar pedidos.`}
              </div>
            )}

            <button
              onClick={abrirCheckout}
              disabled={localBloqueado}
              style={{
                width: '100%',
                minHeight: '50px',
                borderRadius: '12px',
                border: 0,
                backgroundColor: localBloqueado ? 'var(--cp-line)' : 'var(--cp-orange)',
                color: localBloqueado ? 'var(--cp-soft)' : '#FFFFFF',
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '15px',
                cursor: localBloqueado ? 'not-allowed' : 'pointer',
              }}
            >
              {localBloqueado
                ? 'Carta cerrada para pedidos'
                : `Continuar · S/ ${subtotal.toFixed(2)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
