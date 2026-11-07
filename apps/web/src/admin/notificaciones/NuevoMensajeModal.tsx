import React, { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { crearMensajeInterno } from './notificacionesApi';

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  alGuardarExitoso: () => void;
}

const ROLES_DESTINO = [
  { clave: '', nombre: 'Todos los roles' },
  { clave: 'ADMIN', nombre: 'Administrador' },
  { clave: 'CAJERO', nombre: 'Cajero' },
  { clave: 'SUPERVISOR', nombre: 'Supervisor' },
  { clave: 'COCINA', nombre: 'Cocina y barra' },
  { clave: 'MOZO', nombre: 'Mozo' },
  { clave: 'REPARTIDOR', nombre: 'Repartidor' },
  { clave: 'ALMACEN', nombre: 'Almacén' },
  { clave: 'PRODUCCION', nombre: 'Producción' },
];

export function NuevoMensajeModal({ abierto, alCerrar, alGuardarExitoso }: Props) {
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [rolDestino, setRolDestino] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmarEnvio, setConfirmarEnvio] = useState(false);

  if (!abierto) return null;

  const handleValidarYConfirmar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !mensaje.trim()) {
      setError('Escribe un título y un mensaje');
      return;
    }
    setError(null);
    setConfirmarEnvio(true);
  };

  const handleEnviar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await crearMensajeInterno({
        rol_destino: rolDestino || undefined,
        titulo: titulo.trim(),
        mensaje: mensaje.trim(),
      });
      setConfirmarEnvio(false);
      alGuardarExitoso();
      alCerrar();
    } catch (err: any) {
      setError(err?.message || 'Error al enviar el mensaje');
      setConfirmarEnvio(false);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 90,
          background: 'rgba(11, 44, 62, 0.65)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
        onClick={alCerrar}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-msg-titulo"
          style={{
            width: '100%',
            maxWidth: '480px',
            background: 'var(--cp-white)',
            borderRadius: '16px',
            border: '1px solid var(--cp-line)',
            boxShadow: '0 12px 36px rgba(11, 44, 62, 0.2)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2
                id="modal-msg-titulo"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '18px',
                  color: 'var(--cp-navy)',
                  margin: '0 0 4px',
                }}
              >
                Nuevo mensaje interno
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--cp-soft)' }}>
                Envía un aviso o comunicado que quedará registrado en el historial del equipo.
              </p>
            </div>
            <button
              onClick={alCerrar}
              aria-label="Cerrar modal"
              style={{
                background: 'transparent',
                border: 0,
                fontSize: '20px',
                color: 'var(--cp-soft)',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleValidarYConfirmar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                Destinatario
              </label>
              <select
                value={rolDestino}
                onChange={(e) => setRolDestino(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-cream)',
                  padding: '0 12px',
                  fontSize: '14px',
                  color: 'var(--cp-navy)',
                }}
              >
                {ROLES_DESTINO.map((r) => (
                  <option key={r.clave} value={r.clave}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                Título del aviso
              </label>
              <input
                type="text"
                placeholder="Ejemplo: Cambio de turno o recordatorio"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  padding: '0 12px',
                  fontSize: '14px',
                  color: 'var(--cp-navy)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                Mensaje
              </label>
              <textarea
                rows={4}
                placeholder="Escribe el detalle del comunicado..."
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  padding: '10px 12px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  color: 'var(--cp-navy)',
                }}
              />
            </div>

            {error && (
              <div style={{ color: 'var(--cp-rust)', fontSize: '12px', fontWeight: 700 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Boton type="button" variante="secundario" onClick={alCerrar} disabled={enviando}>
                Cancelar
              </Boton>
              <Boton type="submit" cargando={enviando}>
                Enviar mensaje
              </Boton>
            </div>
          </form>
        </div>
      </div>

      <Confirmar
        abierto={confirmarEnvio}
        titulo="¿Enviar este mensaje interno?"
        mensaje={`Se notificará ${rolDestino ? `al rol ${rolDestino}` : 'a todos los miembros del equipo'}.`}
        textoSi="Sí, enviar"
        cargando={enviando}
        alConfirmar={handleEnviar}
        alCancelar={() => setConfirmarEnvio(false)}
      />
    </>
  );
}
