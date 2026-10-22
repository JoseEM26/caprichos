import React, { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { repartosApi, ContactoIntento, PedidoReparto } from './repartosApi';
import { ErrorApi } from '../../comun/api';

interface ModalReportarFallaProps {
  pedido: PedidoReparto;
  alCerrar: () => void;
  alCompletar: () => void;
}

export function ModalReportarFalla({
  pedido,
  alCerrar,
  alCompletar,
}: ModalReportarFallaProps) {
  const [motivo, setMotivo] = useState<'NO_CONTESTA' | 'DIRECCION_NO_ENCONTRADA'>('NO_CONTESTA');
  const [contactos, setContactos] = useState<ContactoIntento[]>([]);
  const [fotoArchivoId, setFotoArchivoId] = useState<string>('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  const llamadasCount = contactos.filter((c) => c.tipo === 'LLAMADA').length;
  const whatsappCount = contactos.filter((c) => c.tipo === 'WHATSAPP').length;

  const registrarIntento = (tipo: 'LLAMADA' | 'WHATSAPP') => {
    const ahora = new Date().toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setContactos((prev) => [...prev, { tipo, en: ahora }]);
    setErrorLocal(null);
  };

  const eliminarIntento = (index: number) => {
    setContactos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleIntentarEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);

    if (motivo === 'NO_CONTESTA' && llamadasCount < 2) {
      setErrorLocal(
        'Se requieren al menos 2 llamadas registradas como evidencia para el motivo NO_CONTESTA',
      );
      return;
    }

    setMostrarConfirmacion(true);
  };

  const handleConfirmarReporte = async () => {
    setEnviando(true);
    setErrorLocal(null);

    try {
      await repartosApi.reportarFalla(pedido.id, {
        motivo,
        contactos,
        fotoArchivoId: fotoArchivoId.trim() ? fotoArchivoId.trim() : undefined,
      });
      setMostrarConfirmacion(false);
      alCompletar();
    } catch (err: any) {
      setMostrarConfirmacion(false);
      if (err instanceof ErrorApi) {
        setErrorLocal(err.message || 'Error al reportar la falla de entrega');
      } else {
        setErrorLocal('Error inesperado al reportar la entrega fallida');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-reportar-falla"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70,
          background: 'rgba(11, 44, 62, 0.65)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !enviando) alCerrar();
        }}
      >
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '20px',
            boxShadow: '0 20px 40px rgba(11, 44, 62, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h2
                id="titulo-reportar-falla"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '18px',
                  color: 'var(--cp-navy)',
                  margin: 0,
                }}
              >
                Reportar entrega fallida
              </h2>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '13px',
                  color: 'var(--cp-soft)',
                }}
              >
                Pedido {pedido.codigo} · {pedido.cliente_nombre}
              </p>
            </div>
            <button
              type="button"
              onClick={alCerrar}
              aria-label="Cerrar ventana"
              disabled={enviando}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '22px',
                border: '1.5px solid var(--cp-line)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontSize: '18px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              x
            </button>
          </div>

          <form onSubmit={handleIntentarEnviar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label
                htmlFor="motivo-select"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--cp-navy)',
                  marginBottom: '6px',
                }}
              >
                Motivo del incidente
              </label>
              <select
                id="motivo-select"
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value as any);
                  setErrorLocal(null);
                }}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 12px',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                <option value="NO_CONTESTA">Cliente no contesta</option>
                <option value="DIRECCION_NO_ENCONTRADA">Dirección no encontrada</option>
              </select>
            </div>

            {/* Evidencia de contacto */}
            <div
              style={{
                background: 'var(--cp-cream)',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                  Evidencia de contacto
                </span>
                <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                  {llamadasCount} llamada(s) · {whatsappCount} WhatsApp
                </span>
              </div>

              {motivo === 'NO_CONTESTA' && (
                <div
                  style={{
                    fontSize: '12px',
                    color: llamadasCount >= 2 ? 'var(--cp-green, #2F7A45)' : 'var(--cp-rust, #B2500F)',
                    fontWeight: 700,
                  }}
                >
                  {llamadasCount >= 2
                    ? 'Requisito cumplido: al menos 2 llamadas registradas.'
                    : 'Regla obligatoria: se requieren al menos 2 llamadas registradas para NO_CONTESTA.'}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => registrarIntento('LLAMADA')}
                  style={{
                    flex: '1 1 140px',
                    minHeight: '44px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-navy)',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  + Registrar llamada
                </button>
                <button
                  type="button"
                  onClick={() => registrarIntento('WHATSAPP')}
                  style={{
                    flex: '1 1 140px',
                    minHeight: '44px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-navy)',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  + Registrar WhatsApp
                </button>
              </div>

              {contactos.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                  {contactos.map((c, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--cp-white)',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        border: '1px solid var(--cp-line)',
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>
                        {idx + 1}. {c.tipo === 'LLAMADA' ? 'Llamada telefónica' : 'Mensaje WhatsApp'}{' '}
                        {c.en && <span style={{ fontWeight: 400, color: 'var(--cp-soft)' }}>({c.en})</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => eliminarIntento(idx)}
                        aria-label={`Eliminar intento ${idx + 1}`}
                        style={{
                          border: 0,
                          background: 'transparent',
                          color: 'var(--cp-rust)',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          padding: '4px 8px',
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--cp-soft)', fontStyle: 'italic' }}>
                  No has registrado intentos de contacto todavía.
                </div>
              )}
            </div>

            {/* Foto opcional */}
            <div>
              <label
                htmlFor="foto-id-input"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--cp-navy)',
                  marginBottom: '4px',
                }}
              >
                ID de foto de fachada o puerta (opcional)
              </label>
              <input
                id="foto-id-input"
                type="text"
                value={fotoArchivoId}
                onChange={(e) => setFotoArchivoId(e.target.value)}
                placeholder="Ej. ID o número de comprobante/foto"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 12px',
                  fontSize: '14px',
                  background: 'var(--cp-white)',
                }}
              />
            </div>

            {errorLocal && (
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
                {errorLocal}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <Boton
                type="submit"
                variante="peligro"
                cargando={enviando}
                style={{ flex: 1, minHeight: '48px', fontWeight: 800 }}
              >
                Reportar entrega fallida
              </Boton>
              <Boton
                type="button"
                variante="secundario"
                onClick={alCerrar}
                deshabilitado={enviando}
                style={{ minHeight: '48px' }}
              >
                Cancelar
              </Boton>
            </div>
          </form>
        </div>
      </div>

      <Confirmar
        abierto={mostrarConfirmacion}
        titulo="¿Confirmar reporte de entrega fallida?"
        mensaje={`El pedido ${pedido.codigo} se marcará con falla "${motivo === 'NO_CONTESTA' ? 'No contesta' : 'Dirección no encontrada'}" y pasará a coordinación de caja.`}
        textoSi="Sí, reportar"
        textoNo="No, revisar"
        peligro
        cargando={enviando}
        alConfirmar={handleConfirmarReporte}
        alCancelar={() => setMostrarConfirmacion(false)}
      />
    </>
  );
}
