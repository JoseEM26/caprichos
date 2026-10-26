import React, { useEffect, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';

export interface ModalEditarNombreProps {
  abierto: boolean;
  conversacionId: string;
  nombreActual: string;
  nombreEditado: boolean;
  nombrePerfilWa?: string | null;
  alCerrar: () => void;
  alGuardar: (nuevoNombre: string) => Promise<void>;
  alRevertir: () => Promise<void>;
}

export function IconoLapiz({
  tamano = 16,
  style,
}: {
  tamano?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamano}
      height={tamano}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function ModalEditarNombre({
  abierto,
  conversacionId: _conversacionId,
  nombreActual,
  nombreEditado,
  nombrePerfilWa,
  alCerrar,
  alGuardar,
  alRevertir,
}: ModalEditarNombreProps) {
  const [nombre, setNombre] = useState(nombreActual);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [confirmarGuardar, setConfirmarGuardar] = useState(false);
  const [confirmarRevertir, setConfirmarRevertir] = useState(false);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    if (abierto) {
      setNombre(nombreActual);
      setErrorValidacion(null);
      setConfirmarGuardar(false);
      setConfirmarRevertir(false);
    }
  }, [abierto, nombreActual]);

  if (!abierto) return null;

  const validar = (val: string): string | null => {
    const limpio = val.trim();
    if (!limpio) {
      return 'El nombre no puede estar vacío ni consistir únicamente en espacios';
    }
    if (limpio.length < 2) {
      return 'El nombre debe tener al menos 2 caracteres';
    }
    if (limpio.length > 60) {
      return 'El nombre no puede exceder los 60 caracteres';
    }
    return null;
  };

  const handleSolicitarGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validar(nombre);
    if (err) {
      setErrorValidacion(err);
      return;
    }
    setErrorValidacion(null);
    setConfirmarGuardar(true);
  };

  const handleConfirmarGuardar = async () => {
    const limpio = nombre.trim();
    setProcesando(true);
    try {
      await alGuardar(limpio);
      setConfirmarGuardar(false);
      alCerrar();
    } catch (err: any) {
      setErrorValidacion(err?.mensaje || 'Error al guardar el nombre');
      setConfirmarGuardar(false);
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarRevertir = async () => {
    setProcesando(true);
    try {
      await alRevertir();
      setConfirmarRevertir(false);
      alCerrar();
    } catch (err: any) {
      setErrorValidacion(err?.mensaje || 'Error al restablecer el nombre');
      setConfirmarRevertir(false);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-editar-nombre"
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
        onClick={(e) => {
          if (e.target === e.currentTarget && !procesando) alCerrar();
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            background: 'var(--cp-white, #FFFFFF)',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--cp-line, #E2E8F0)',
            overflow: 'hidden',
          }}
        >
          {/* Cabecera del modal */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--cp-line, #E2E8F0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconoLapiz tamano={18} style={{ color: 'var(--cp-navy, #0B2C3E)' }} />
              <h2
                id="titulo-editar-nombre"
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: 700,
                  color: 'var(--cp-navy, #0B2C3E)',
                }}
              >
                Editar nombre de contacto
              </h2>
            </div>
            <button
              type="button"
              onClick={alCerrar}
              disabled={procesando}
              aria-label="Cerrar modal"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                lineHeight: 1,
                cursor: 'pointer',
                color: 'var(--cp-soft, #64748B)',
                padding: '4px',
              }}
            >
              ✕
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSolicitarGuardar} style={{ padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="input-nombre-contacto"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--cp-navy, #0B2C3E)',
                  marginBottom: '6px',
                }}
              >
                Nombre o alias del contacto:
              </label>
              <input
                id="input-nombre-contacto"
                type="text"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  if (errorValidacion) setErrorValidacion(null);
                }}
                maxLength={60}
                placeholder="Ej. Don Pepe Panadería"
                autoFocus
                disabled={procesando}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: errorValidacion
                    ? '1px solid var(--cp-wine, #C53030)'
                    : '1px solid var(--cp-line, #CBD5E1)',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '4px',
                  fontSize: '12px',
                  color: 'var(--cp-soft, #64748B)',
                }}
              >
                <span>2 a 60 caracteres</span>
                <span>{nombre.length} / 60</span>
              </div>
              {errorValidacion && (
                <p
                  role="alert"
                  style={{
                    color: 'var(--cp-wine, #C53030)',
                    fontSize: '12px',
                    margin: '6px 0 0 0',
                    fontWeight: 600,
                  }}
                >
                  {errorValidacion}
                </p>
              )}
            </div>

            {/* Enlace o botón para volver al nombre de WhatsApp si fue editado previamente */}
            {nombreEditado && (
              <div style={{ marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={() => setConfirmarRevertir(true)}
                  disabled={procesando}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--cp-navy, #0B2C3E)',
                    textDecoration: 'underline',
                    fontSize: '13px',
                    cursor: 'pointer',
                    padding: 0,
                    fontWeight: 600,
                  }}
                >
                  Volver al nombre de WhatsApp
                </button>
                {nombrePerfilWa && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      color: 'var(--cp-soft, #64748B)',
                      marginTop: '2px',
                    }}
                  >
                    Perfil original de WhatsApp: <b>{nombrePerfilWa}</b>
                  </span>
                )}
              </div>
            )}

            {/* Botones de acción */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: '20px',
              }}
            >
              <button
                type="button"
                onClick={alCerrar}
                disabled={procesando}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: '1px solid var(--cp-line, #CBD5E1)',
                  background: 'var(--cp-sand, #F8FAFC)',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={procesando}
                style={{
                  padding: '9px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--cp-orange, #FF7A00)',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {procesando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Diálogo de confirmación para Guardar */}
      <Confirmar
        abierto={confirmarGuardar}
        titulo="¿Guardar nombre de contacto?"
        mensaje={`¿Deseas cambiar el nombre del contacto a «${nombre.trim()}»?`}
        textoConfirmar="Sí, guardar"
        textoNo="No, cancelar"
        cargando={procesando}
        alConfirmar={handleConfirmarGuardar}
        alCancelar={() => setConfirmarGuardar(false)}
      />

      {/* Diálogo de confirmación para Revertir */}
      <Confirmar
        abierto={confirmarRevertir}
        titulo="¿Volver al nombre de WhatsApp?"
        mensaje="¿Deseas restablecer el nombre del contacto al perfil original de WhatsApp? Esto cancelará la edición manual."
        textoConfirmar="Sí, restablecer"
        textoNo="No, cancelar"
        cargando={procesando}
        alConfirmar={handleConfirmarRevertir}
        alCancelar={() => setConfirmarRevertir(false)}
      />
    </>
  );
}
