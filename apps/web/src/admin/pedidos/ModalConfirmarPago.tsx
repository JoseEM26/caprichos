import { useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { pedidosApi, Pedido } from './pedidosApi';

export interface ModalConfirmarPagoProps {
  pedido: Pedido;
  alCerrar: () => void;
  alConfirmarExitoso: (datosPago?: {
    medio: string;
    comprobanteImg: string | null;
    codigoOp: string;
    montoPagaCon: string;
  }) => void;
}

const MEDIOS_PC = ['Yape', 'Plin', 'Efectivo', 'Tarjeta', 'Transferencia'] as const;

export function ModalConfirmarPago({ pedido, alCerrar, alConfirmarExitoso }: ModalConfirmarPagoProps) {
  const [contactado, setContactado] = useState(false);
  const [medio, setMedio] = useState<string>(pedido.pago_metodo || pedido.pago_preferido || 'Yape');
  const [montoPagaCon, setMontoPagaCon] = useState(pedido.paga_con ? String(pedido.paga_con) : '');
  const [codigoOp, setCodigoOp] = useState('');
  const [comprobanteImg, setComprobanteImg] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmandoSiNo, setConfirmandoSiNo] = useState(false);

  const esEfectivo = medio.toLowerCase() === 'efectivo';
  const esTarjeta = medio.toLowerCase() === 'tarjeta';
  const esDigital = !esEfectivo && !esTarjeta;
  const esDelivery = (pedido.modalidad || '').toUpperCase() === 'DELIVERY';
  const tieneUbicacion =
    (pedido.entrega_lat != null && pedido.entrega_lng != null) || Boolean(pedido.zona);

  const phone = pedido.cliente_telefono || '';
  const cleanPhone = phone.replace(/\D/g, '');
  const waUrl = cleanPhone
    ? `https://wa.me/51${cleanPhone}?text=${encodeURIComponent(`Hola ${pedido.cliente_nombre || ''}, te escribimos de Caprichos respecto a tu pedido ${pedido.codigo}.`)}`
    : '#';

  const handleSubirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setComprobanteImg(reader.result as string);
        setMsg('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmar = () => {
    if (!contactado) {
      setMsg('Marca la casilla confirmando que hablaste con el cliente.');
      return;
    }
    if (esDelivery && !tieneUbicacion) {
      setMsg('Para delivery primero ubica la dirección en el mapa (calcula la zona y el envío).');
      return;
    }
    if (esDigital && !comprobanteImg) {
      setMsg('Sube el comprobante del pago para continuar.');
      return;
    }
    setMsg('');
    setConfirmandoSiNo(true);
  };

  const ejecutarConfirmacion = async () => {
    setEnviando(true);
    setMsg('');
    try {
      await pedidosApi.registrarPago(
        pedido.id,
        medio.toUpperCase(),
        esDigital ? 'PAGADO' : 'COORDINADO',
      );
      if (String(pedido.estado).toUpperCase() === 'NUEVO') {
        await pedidosApi.cambiarEstado(
          pedido.id,
          'COLA',
          'Confirmado con cliente y pago verificado',
        );
      }
      setConfirmandoSiNo(false);
      alConfirmarExitoso({
        medio,
        comprobanteImg,
        codigoOp,
        montoPagaCon,
      });
    } catch (err: any) {
      setConfirmandoSiNo(false);
      setMsg(err?.message || 'Error al confirmar el pedido');
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
          background: 'rgba(11,44,62,0.55)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar pedido y pago"
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 'min(670px,calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream, #FBF4EC)',
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'Montserrat,sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--cp-navy, #0B2C3E)' }}>
            Confirmar {pedido.codigo}
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
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ fontSize: 13, lineHeight: '18px', color: 'var(--cp-soft, #2C4C5D)' }}>
          Habla con el cliente por WhatsApp para confirmar que todo esté bien y verificar el pago. Solo después de confirmar pasa a las pantallas de cocina.
        </div>

        {/* 1. Contacto con el cliente */}
        <div style={{ border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 800 }}>1. Contacto con el cliente</div>
          <div style={{ fontSize: 13 }}>
            Cliente: <b>{pedido.cliente_nombre || 'Cliente'}</b> · {pedido.cliente_telefono || 'Sin teléfono'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--cp-soft, #2C4C5D)',
              background: 'var(--cp-white, #FFFFFF)',
              border: '1px solid var(--cp-line, #E3D6C6)',
              borderRadius: 8,
              padding: '8px 10px',
              whiteSpace: 'pre-line',
              maxHeight: 200,
              overflowY: 'auto',
            }}
          >
            {pedido.lineas && pedido.lineas.length > 0
              ? pedido.lineas.map((l) => `${l.cantidad}× ${l.nombre}`).join('\n')
              : `Total a cobrar: S/ ${Number(pedido.total).toFixed(2)}`}
          </div>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              minHeight: 48,
              border: 0,
              borderRadius: 12,
              background: 'var(--cp-green, #2F7A45)',
              color: 'var(--cp-white, #FFFFFF)',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Abrir WhatsApp con el cliente
          </a>

          <button
            type="button"
            onClick={() => {
              setContactado(!contactado);
              setMsg('');
            }}
            role="checkbox"
            aria-checked={contactado}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textAlign: 'left',
              minHeight: 44,
              padding: '4px 0',
              border: 0,
              background: 'transparent',
              color: 'var(--cp-navy, #0B2C3E)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                flex: 'none',
                width: 24,
                height: 24,
                borderRadius: 6,
                border: '2px solid var(--cp-navy, #0B2C3E)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                background: contactado ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                color: contactado ? 'var(--cp-cream, #FBF4EC)' : 'transparent',
              }}
            >
              ✓
            </span>
            <span>Ya hablé con el cliente y el pedido está bien</span>
          </button>
        </div>

        {/* 2. Medio de pago */}
        <div style={{ border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 800 }}>2. Medio de pago</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MEDIOS_PC.map((m) => {
              const activo = medio.toLowerCase() === m.toLowerCase();
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMedio(m);
                    setMsg('');
                  }}
                  style={{
                    minHeight: 42,
                    padding: '0 14px',
                    borderRadius: 9999,
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    background: activo ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                    color: activo ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
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
              <input
                id="pc-m"
                type="text"
                value={montoPagaCon}
                onChange={(e) => setMontoPagaCon(e.target.value)}
                placeholder="s/"
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

          {esDigital && (
            <div>
              <label htmlFor="pc-r" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                Código de operación (opcional)
              </label>
              <input
                id="pc-r"
                type="text"
                value={codigoOp}
                onChange={(e) => setCodigoOp(e.target.value)}
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
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 8, marginBottom: 4 }}>
                Comprobante del pago (obligatorio)
              </div>
              {comprobanteImg ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <img
                    src={comprobanteImg}
                    alt="Comprobante subido"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 220,
                      objectFit: 'contain',
                      border: '1px solid var(--cp-line, #E3D6C6)',
                      borderRadius: 10,
                      background: 'var(--cp-sand, #EDE1D1)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setComprobanteImg(null)}
                    style={{
                      alignSelf: 'flex-start',
                      minHeight: 38,
                      padding: '0 12px',
                      border: '1.5px solid var(--cp-rust, #B2500F)',
                      borderRadius: 10,
                      background: 'transparent',
                      color: 'var(--cp-rust, #B2500F)',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Quitar y subir otro
                  </button>
                </div>
              ) : (
                <label
                  style={{
                    minHeight: 48,
                    border: '1.5px dashed var(--cp-navy, #0B2C3E)',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--cp-navy, #0B2C3E)',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Subir comprobante
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSubirArchivo}
                    style={{ position: 'absolute', left: -9999 }}
                  />
                </label>
              )}
            </div>
          )}
        </div>

        {msg && (
          <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
            {msg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={enviando}
            style={{
              flex: 1,
              minHeight: 52,
              border: 0,
              borderRadius: 12,
              background: 'var(--cp-orange, #E67929)',
              color: 'var(--cp-navy, #0B2C3E)',
              fontFamily: 'Montserrat,sans-serif',
              fontWeight: 800,
              fontSize: 15,
              cursor: enviando ? 'not-allowed' : 'pointer',
            }}
          >
            {enviando ? 'Confirmando...' : 'Confirmar y enviar a cocina'}
          </button>
          <button
            type="button"
            onClick={alCerrar}
            style={{
              flex: 1,
              minHeight: 52,
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              borderRadius: 12,
              background: 'transparent',
              color: 'var(--cp-navy, #0B2C3E)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>

      <Confirmar
        abierto={confirmandoSiNo}
        titulo={`¿Confirmar el pedido ${pedido.codigo} y enviarlo a cocina?`}
        mensaje={`Se registrará el medio de pago (${medio}) y el pedido pasará a las pantallas de cocina.`}
        textoConfirmar="Sí, confirmar"
        textoNo="No"
        cargando={enviando}
        alConfirmar={ejecutarConfirmacion}
        alCancelar={() => setConfirmandoSiNo(false)}
      />
    </>
  );
}
