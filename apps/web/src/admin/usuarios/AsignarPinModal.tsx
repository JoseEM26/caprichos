import { useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Confirmar } from '../../comun/Confirmar';
import { Icono } from '../../comun/Icono';
import type { UsuarioItem } from './tipos';

export interface AsignarPinModalProps {
  usuario: UsuarioItem | null;
  abierto: boolean;
  alCerrar: () => void;
  alPinAsignado: (mensaje: string) => void;
}

export function AsignarPinModal({
  usuario,
  abierto,
  alCerrar,
  alPinAsignado,
}: AsignarPinModalProps) {
  const [pin, setPin] = useState('');
  const [confirmarPin, setConfirmarPin] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const [confirmarModalAbierto, setConfirmarModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  if (!abierto || !usuario) return null;

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};

    if (!pin) {
      nuevosErrores.pin = 'Ingresa el PIN de 6 dígitos';
    } else if (!/^\d{6}$/.test(pin)) {
      nuevosErrores.pin = 'El PIN debe tener exactamente 6 dígitos numéricos';
    }

    if (!confirmarPin) {
      nuevosErrores.confirmarPin = 'Confirma el PIN ingresado';
    } else if (pin !== confirmarPin) {
      nuevosErrores.confirmarPin = 'Los dos PIN ingresados no coinciden';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  function handleSolicitarGuardar(e: React.FormEvent) {
    e.preventDefault();
    setErrorServidor(null);
    if (!validar()) return;
    setConfirmarModalAbierto(true);
  }

  async function handleConfirmarGuardar() {
    if (!usuario) return;
    setGuardando(true);
    try {
      const resp = await api.post<{ mensaje: string }>(`/admin/usuarios/${usuario.id}/pin`, {
        pin,
      });

      // Limpiar campos de PIN en memoria
      setPin('');
      setConfirmarPin('');
      setErrores({});
      setConfirmarModalAbierto(false);
      alPinAsignado(resp.mensaje || 'PIN de supervisor asignado exitosamente');
    } catch (err) {
      setConfirmarModalAbierto(false);
      if (err instanceof ErrorApi) {
        setErrorServidor(err.message || 'Error al asignar el PIN');
      } else {
        setErrorServidor('Error de conexión al servidor.');
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-asignar-pin-titulo"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 90,
          background: 'rgba(11, 44, 62, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
        onClick={guardando ? undefined : alCerrar}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            background: 'var(--cp-white)',
            border: '1.5px solid var(--cp-line)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 16px 40px rgba(11, 44, 62, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2
              id="modal-asignar-pin-titulo"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '20px',
                color: 'var(--cp-navy)',
                margin: 0,
              }}
            >
              PIN de supervisor
            </h2>
            <button
              type="button"
              onClick={alCerrar}
              disabled={guardando}
              aria-label="Cerrar modal"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '20px',
                border: '1.5px solid var(--cp-line)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: guardando ? 'not-allowed' : 'pointer',
              }}
            >
              <Icono nombre="cerrar" tamano={18} />
            </button>
          </div>

          <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--cp-soft)' }}>
            Asigna un PIN confidencial de 6 dígitos para el administrador{' '}
            <b>{usuario.nombres} {usuario.apellidos}</b>. Este PIN se solicita en persona en caja para
            autorizar anulaciones de pedidos y cierres de caja con descuadre (DT-61).
          </div>

          <div
            style={{
              background: '#FFF8E6',
              border: '1px solid var(--cp-gold)',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '12px',
              color: 'var(--cp-navy)',
              fontWeight: 600,
            }}
          >
            Por seguridad, el PIN guardado se almacena cifrado y nunca se muestra en pantalla.
          </div>

          {errorServidor && (
            <div
              role="alert"
              style={{
                background: '#FBEDE9',
                border: '1.5px solid var(--cp-rust)',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '13px',
                color: 'var(--cp-rust)',
                fontWeight: 600,
              }}
            >
              {errorServidor}
            </div>
          )}

          <form onSubmit={handleSolicitarGuardar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Campo
              id="pin-supervisor"
              etiqueta="Nuevo PIN (6 dígitos numéricos)"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={pin}
              onChange={(e) => {
                const solonum = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPin(solonum);
                if (errores.pin) setErrores((prev) => ({ ...prev, pin: '' }));
              }}
              error={errores.pin}
              disabled={guardando}
            />

            <Campo
              id="pin-confirmar"
              etiqueta="Confirmar nuevo PIN"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={confirmarPin}
              onChange={(e) => {
                const solonum = e.target.value.replace(/\D/g, '').slice(0, 6);
                setConfirmarPin(solonum);
                if (errores.confirmarPin) setErrores((prev) => ({ ...prev, confirmarPin: '' }));
              }}
              error={errores.confirmarPin}
              disabled={guardando}
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <Boton
                type="submit"
                variante="primario"
                tamano="grande"
                disabled={guardando}
                style={{ flex: 1 }}
              >
                Asignar PIN
              </Boton>
              <Boton
                type="button"
                variante="secundario"
                tamano="grande"
                onClick={alCerrar}
                disabled={guardando}
              >
                Cancelar
              </Boton>
            </div>
          </form>
        </div>
      </div>

      <Confirmar
        abierto={confirmarModalAbierto}
        titulo="¿Asignar PIN de supervisor?"
        mensaje={`¿Confirmas la asignación del PIN de 6 dígitos a ${usuario.nombres}? Solo quien conozca este PIN podrá autorizar excepciones de caja.`}
        textoSi="Sí, asignar PIN"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={handleConfirmarGuardar}
        alCancelar={() => setConfirmarModalAbierto(false)}
      />
    </>
  );
}
