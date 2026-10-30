import React, { useState, useEffect } from 'react';
import { comprasApi, ProveedorItem, CrearProveedorDto } from './comprasApi';

interface ModalProveedorProps {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
  proveedorEditar?: ProveedorItem | null;
}

export const ModalProveedor: React.FC<ModalProveedorProps> = ({
  abierto,
  alCerrar,
  alGuardar,
  proveedorEditar,
}) => {
  const [razonSocial, setRazonSocial] = useState('');
  const [nombreComercial, setNombreComercial] = useState('');
  const [ruc, setRuc] = useState('');
  const [telefono, setTelefono] = useState('');
  const [diasCredito, setDiasCredito] = useState('0');
  const [cuentaPago, setCuentaPago] = useState('');
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (abierto) {
      if (proveedorEditar) {
        setRazonSocial(proveedorEditar.razonSocial || '');
        setNombreComercial(proveedorEditar.nombreComercial || '');
        setRuc(proveedorEditar.ruc || '');
        setTelefono(proveedorEditar.telefono || '');
        setDiasCredito(String(proveedorEditar.diasCredito || 0));
        setCuentaPago(proveedorEditar.cuentaPago || '');
      } else {
        setRazonSocial('');
        setNombreComercial('');
        setRuc('');
        setTelefono('');
        setDiasCredito('0');
        setCuentaPago('');
      }
      setErrorMsg('');
    }
  }, [abierto, proveedorEditar]);

  if (!abierto) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!razonSocial.trim()) {
      setErrorMsg('La razón social es obligatoria.');
      return;
    }

    const dto: CrearProveedorDto = {
      razonSocial: razonSocial.trim(),
      nombreComercial: nombreComercial.trim() || undefined,
      ruc: ruc.trim() || undefined,
      telefono: telefono.trim() || undefined,
      diasCredito: parseInt(diasCredito, 10) || 0,
      cuentaPago: cuentaPago.trim() || undefined,
    };

    try {
      setCargando(true);
      setErrorMsg('');
      if (proveedorEditar) {
        await comprasApi.actualizarProveedor(proveedorEditar.id, dto);
      } else {
        await comprasApi.crearProveedor(dto);
      }
      alGuardar();
      alCerrar();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el proveedor.');
    } finally {
      setCargando(false);
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
        aria-label={proveedorEditar ? 'Editar proveedor' : 'Nuevo proveedor'}
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 'min(500px, calc(100% - 24px))',
          background: 'var(--cp-white)',
          borderRadius: 16,
          boxShadow: 'rgba(11, 44, 62, 0.25) 0px 10px 30px',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          color: 'var(--cp-navy)',
          fontFamily: '"Open Sans", system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2
            style={{
              margin: 0,
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: 20,
            }}
          >
            {proveedorEditar ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h2>
          <button
            onClick={alCerrar}
            style={{
              border: 0,
              background: 'transparent',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--cp-soft)',
            }}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgb(253, 236, 232)',
              color: 'var(--cp-rust)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Razón social *
            </label>
            <input
              type="text"
              placeholder="Ej. Distribuidora Central SAC"
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 40,
                borderRadius: 8,
                border: '1.5px solid var(--cp-line)',
                padding: '0 10px',
                background: 'var(--cp-cream)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Nombre comercial (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Lácteos San Jorge"
              value={nombreComercial}
              onChange={(e) => setNombreComercial(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 40,
                borderRadius: 8,
                border: '1.5px solid var(--cp-line)',
                padding: '0 10px',
                background: 'var(--cp-cream)',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                RUC (11 dígitos)
              </label>
              <input
                type="text"
                maxLength={11}
                placeholder="20123456789"
                value={ruc}
                onChange={(e) => setRuc(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  borderRadius: 8,
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 10px',
                  background: 'var(--cp-cream)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Teléfono / WhatsApp
              </label>
              <input
                type="text"
                placeholder="987654321"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  borderRadius: 8,
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 10px',
                  background: 'var(--cp-cream)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Días de crédito
              </label>
              <input
                type="number"
                min="0"
                value={diasCredito}
                onChange={(e) => setDiasCredito(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  borderRadius: 8,
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 10px',
                  background: 'var(--cp-cream)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Cuenta de pago (opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. BCP 191-12345678-0-99"
                value={cuentaPago}
                onChange={(e) => setCuentaPago(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  borderRadius: 8,
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 10px',
                  background: 'var(--cp-cream)',
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 10,
              borderTop: '1px solid var(--cp-line)',
              paddingTop: 14,
            }}
          >
            <button
              type="button"
              onClick={alCerrar}
              style={{
                minHeight: 44,
                padding: '0 16px',
                borderRadius: 9999,
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              style={{
                minHeight: 44,
                padding: '0 20px',
                borderRadius: 9999,
                border: 0,
                background: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 14,
                cursor: cargando ? 'not-allowed' : 'pointer',
                opacity: cargando ? 0.7 : 1,
              }}
            >
              {cargando ? 'Guardando...' : proveedorEditar ? 'Guardar cambios' : 'Crear proveedor'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
