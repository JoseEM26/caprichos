import React, { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { AreaCocinaItem, PantallaItem } from './pantallasTipos';
import { editarPantalla } from './pantallasApi';

interface Props {
  pantalla: PantallaItem | null;
  areas: AreaCocinaItem[];
  alCerrar: () => void;
  alGuardarExitoso: () => void;
}

export function EditarPantallaModal({ pantalla, areas, alCerrar, alGuardarExitoso }: Props) {
  const [nombre, setNombre] = useState(pantalla?.nombre ?? '');
  const [areaId, setAreaId] = useState(pantalla?.areaId ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pantalla) return null;

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomLimpio = nombre.trim();
    if (!nomLimpio) {
      setError('El nombre de la pantalla es obligatorio');
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await editarPantalla(pantalla.id, {
        nombre: nomLimpio,
        areaId: areaId || undefined,
      });
      alGuardarExitoso();
      alCerrar();
    } catch (err: any) {
      setError(err?.message || 'Error al guardar los cambios');
    } finally {
      setGuardando(false);
    }
  };

  return (
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
        aria-labelledby="editar-tv-titulo"
        style={{
          width: '100%',
          maxWidth: '440px',
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
              id="editar-tv-titulo"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '18px',
                color: 'var(--cp-navy)',
                margin: '0 0 4px',
              }}
            >
              Editar pantalla
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--cp-soft)' }}>
              Cambia el nombre identificador o la estación asignada.
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

        <form onSubmit={handleGuardar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
              Nombre de la pantalla
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
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
              Estación asignada
            </label>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
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
              <option value="">Cocina y barra (Todas)</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div style={{ color: 'var(--cp-rust)', fontSize: '12px', fontWeight: 700 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Boton type="button" variante="secundario" onClick={alCerrar} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={guardando}>
              Guardar cambios
            </Boton>
          </div>
        </form>
      </div>
    </div>
  );
}
