import { useState, useEffect } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { subirCapturaIniciativa } from './iniciativasApi';

export interface NuevaIniciativaModalProps {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar: (datos: {
    tipo: string;
    area: string;
    titulo: string;
    detalle: string;
    archivoId?: string | null;
  }) => Promise<void>;
}

const AREAS = [
  { v: 'CARTA_WEB', n: 'Carta web y pedidos en línea' },
  { v: 'PEDIDOS_CAJA', n: 'Pedidos y caja' },
  { v: 'COCINA', n: 'Cocina y barra' },
  { v: 'REPARTO', n: 'Reparto y delivery' },
  { v: 'ALMACEN_COMPRAS', n: 'Almacén y compras' },
  { v: 'OTRO', n: 'Otro' },
];

const TIPOS = [
  { v: 'QUEJA', n: 'Queja' },
  { v: 'MEJORA', n: 'Mejora' },
  { v: 'IDEA', n: 'Idea' },
];

export function NuevaIniciativaModal({
  abierto,
  alCerrar,
  alGuardar,
}: NuevaIniciativaModalProps) {
  const [tipo, setTipo] = useState<string>('MEJORA');
  const [area, setArea] = useState<string>('PEDIDOS_CAJA');
  const [titulo, setTitulo] = useState<string>('');
  const [detalle, setDetalle] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [cargando, setCargando] = useState<boolean>(false);
  const [archivoId, setArchivoId] = useState<string | null>(null);
  const [fotoVistaPrevia, setFotoVistaPrevia] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState<boolean>(false);
  const [confirmando, setConfirmando] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      if (fotoVistaPrevia && fotoVistaPrevia.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(fotoVistaPrevia);
        } catch {
          // Ignorar
        }
      }
    };
  }, [fotoVistaPrevia]);

  if (!abierto) return null;

  const handleSeleccionarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('La captura no puede superar los 5 MB');
      return;
    }

    try {
      setSubiendoFoto(true);
      setError('');
      if (fotoVistaPrevia && fotoVistaPrevia.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(fotoVistaPrevia);
        } catch {
          // Ignorar
        }
      }
      const previewUrl = URL.createObjectURL(file);
      setFotoVistaPrevia(previewUrl);

      const res = await subirCapturaIniciativa(file);
      setArchivoId(res.id);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Error al subir la imagen. Intenta de nuevo.');
      setFotoVistaPrevia(null);
      setArchivoId(null);
    } finally {
      setSubiendoFoto(false);
    }
  };

  const quitarFoto = () => {
    if (fotoVistaPrevia && fotoVistaPrevia.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(fotoVistaPrevia);
      } catch {
        // Ignorar
      }
    }
    setArchivoId(null);
    setFotoVistaPrevia(null);
  };

  const intentarEnviar = () => {
    if (!titulo.trim()) {
      setError('Escribe un título corto');
      return;
    }
    if (!detalle.trim()) {
      setError('Cuéntanos qué pasa o qué propones');
      return;
    }
    setError('');
    setConfirmando(true);
  };

  const ejecutarGuardado = async () => {
    setCargando(true);
    try {
      await alGuardar({
        tipo,
        area,
        titulo: titulo.trim(),
        detalle: detalle.trim(),
        archivoId,
      });
      setConfirmando(false);
      alCerrar();
    } catch (err: any) {
      setError(err?.message || 'Error al guardar la iniciativa');
      setConfirmando(false);
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
          background: 'rgba(11, 44, 62, 0.55)',
          backdropFilter: 'blur(1px)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nueva iniciativa"
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(620px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px', lineHeight: '27px' }}>
              Nueva iniciativa
            </div>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              La verá todo el personal con tu nombre.
            </div>
          </div>
          <button
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{
              flex: 'none',
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontSize: '20px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <div>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>¿Qué es?</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {TIPOS.map((t) => {
              const seleccionado = tipo === t.v;
              return (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setTipo(t.v)}
                  style={{
                    minHeight: '40px',
                    padding: '0 12px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '9999px',
                    background: seleccionado ? 'var(--cp-navy)' : 'transparent',
                    color: seleccionado ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {t.n}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="in-area" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
            ¿Sobre qué parte?
          </label>
          <select
            id="in-area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            style={{
              width: '100%',
              minHeight: '46px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-line)',
              padding: '0 12px',
              fontSize: '14px',
              background: 'var(--cp-white)',
              color: 'var(--cp-navy)',
            }}
          >
            {AREAS.map((a) => (
              <option key={a.v} value={a.v}>
                {a.n}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="in-t" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
            Título corto
          </label>
          <input
            id="in-t"
            type="text"
            maxLength={80}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej.: La tablet se queda sin batería"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '46px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              padding: '0 12px',
              fontSize: '14px',
            }}
          />
        </div>

        <div>
          <label htmlFor="in-x" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
            Cuéntanos
          </label>
          <textarea
            id="in-x"
            rows={4}
            maxLength={600}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder="Qué pasa o qué propones"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              padding: '10px 12px',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
            Captura <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--cp-soft)' }}>· opcional</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label
              style={{
                position: 'relative',
                minHeight: '44px',
                padding: '0 14px',
                boxSizing: 'border-box',
                borderRadius: '10px',
                background: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              {subiendoFoto ? 'Subiendo…' : 'Subir captura'}
              <input
                type="file"
                accept="image/*"
                onChange={handleSeleccionarFoto}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
              />
            </label>
            {fotoVistaPrevia && (
              <>
                <img
                  src={fotoVistaPrevia}
                  alt="Captura elegida"
                  style={{
                    width: '96px',
                    height: '72px',
                    objectFit: 'cover',
                    borderRadius: '10px',
                    border: '1px solid var(--cp-line)',
                  }}
                />
                <button
                  type="button"
                  onClick={quitarFoto}
                  style={{
                    minHeight: '40px',
                    padding: '0 12px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '9999px',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Quitar
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={intentarEnviar}
            disabled={cargando || subiendoFoto}
            style={{
              flex: 1,
              minHeight: '52px',
              borderRadius: '12px',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '15px',
              border: 0,
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              cursor: 'pointer',
            }}
          >
            Subir iniciativa
          </button>
          <button
            type="button"
            onClick={alCerrar}
            style={{
              flex: 1,
              minHeight: '52px',
              borderRadius: '12px',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '15px',
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>

      <Confirmar
        abierto={confirmando}
        titulo="¿Subir iniciativa al equipo?"
        mensaje={`La iniciativa "${titulo}" quedará registrada con tu usuario y la verá todo el personal.`}
        textoSi="Sí, subir"
        textoNo="No, cancelar"
        cargando={cargando}
        alConfirmar={ejecutarGuardado}
        alCancelar={() => setConfirmando(false)}
      />
    </>
  );
}
