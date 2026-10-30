import { useState } from 'react';
import { Boton } from '../../../comun/Boton';
import { Confirmar } from '../../../comun/Confirmar';
import { DisenoCompletoJson } from '../tipos';

export interface ModalDisenoTextoProps {
  abierto: boolean;
  disenoActual: DisenoCompletoJson | null;
  alCerrar: () => void;
  alAplicarDiseno: (diseno: DisenoCompletoJson) => Promise<void>;
}

export function ModalDisenoTexto({
  abierto,
  disenoActual,
  alCerrar,
  alAplicarDiseno,
}: ModalDisenoTextoProps) {
  const [textoPegado, setTextoPegado] = useState('');
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [copiadoExito, setCopiadoExito] = useState(false);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [disenoValidoParaAplicar, setDisenoValidoParaAplicar] =
    useState<DisenoCompletoJson | null>(null);
  const [cargando, setCargando] = useState(false);

  if (!abierto) return null;

  const textoDisenoActual = disenoActual
    ? JSON.stringify(disenoActual, null, 2)
    : '';

  const handleCopiar = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(textoDisenoActual);
      }
      setCopiadoExito(true);
      setTimeout(() => setCopiadoExito(false), 3000);
    } catch {
      // Fallback si clipboard falla
      setCopiadoExito(false);
    }
  };

  const handleValidarYAbrirConfirmar = () => {
    setErrorValidacion(null);
    if (!textoPegado.trim()) {
      setErrorValidacion('Por favor pega el texto de un diseño JSON antes de aplicar.');
      return;
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(textoPegado.trim());
    } catch {
      setErrorValidacion(
        'El texto pegado no es un JSON válido. Revisa el formato y vuelve a intentarlo sin cambios.',
      );
      return;
    }

    if (!parsed || typeof parsed !== 'object') {
      setErrorValidacion('El diseño debe ser un objeto JSON.');
      return;
    }

    if (!Array.isArray(parsed.floors) || parsed.floors.length === 0) {
      setErrorValidacion(
        'El diseño pegado es inválido: debe contener un arreglo no vacío de pisos en "floors". No se modificó el plano.',
      );
      return;
    }

    if (!parsed.plan || typeof parsed.plan !== 'object') {
      setErrorValidacion(
        'El diseño pegado es inválido: debe contener la distribución de elementos en "plan". No se modificó el plano.',
      );
      return;
    }

    setDisenoValidoParaAplicar(parsed);
    setConfirmarAbierto(true);
  };

  const ejecutarAplicar = async () => {
    if (!disenoValidoParaAplicar) return;
    setCargando(true);
    setErrorValidacion(null);
    try {
      await alAplicarDiseno(disenoValidoParaAplicar);
      setConfirmarAbierto(false);
      alCerrar();
    } catch (err: any) {
      setErrorValidacion(
        err?.message ||
          'Ocurrió un error al aplicar el diseño en el servidor. El plano actual se conservó.',
      );
      setConfirmarAbierto(false);
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
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
          aria-label="Guardar o restaurar diseño del plano"
          style={{
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '20px',
            boxShadow: '0 20px 48px rgba(11, 44, 62, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--cp-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '18px',
                  color: 'var(--cp-navy)',
                }}
              >
                Guardar o cambiar el diseño del plano
              </h2>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '13px',
                  color: 'var(--cp-soft)',
                }}
              >
                Copia todo el plano como texto para respaldarlo o pega un diseño para restaurarlo.
              </p>
            </div>
            <button
              onClick={alCerrar}
              aria-label="Cerrar ventana"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '22px',
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontSize: '20px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              x
            </button>
          </div>

          {/* Contenido */}
          <div
            style={{
              padding: '20px 24px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Sección: Copiar diseño actual */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <label
                  htmlFor="diseno-actual"
                  style={{
                    fontWeight: 700,
                    fontSize: '13px',
                    color: 'var(--cp-navy)',
                  }}
                >
                  Diseño actual (respaldo en texto)
                </label>
                <Boton
                  type="button"
                  variante="primario"
                  tamano="pequeno"
                  onClick={handleCopiar}
                >
                  {copiadoExito ? 'Copiado al portapapeles' : 'Copiar diseño'}
                </Boton>
              </div>
              <textarea
                id="diseno-actual"
                readOnly
                value={textoDisenoActual}
                rows={5}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '12px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-cream)',
                  color: 'var(--cp-navy)',
                  padding: '10px 12px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Sección: Pegar y aplicar diseño */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label
                htmlFor="diseno-pegar"
                style={{
                  fontWeight: 700,
                  fontSize: '13px',
                  color: 'var(--cp-navy)',
                }}
              >
                Pegar un diseño para restaurar
              </label>
              <textarea
                id="diseno-pegar"
                value={textoPegado}
                onChange={(e) => {
                  setTextoPegado(e.target.value);
                  setErrorValidacion(null);
                }}
                placeholder="Pega aquí el JSON completo del diseño..."
                rows={6}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '12px',
                  border: `1.5px solid ${
                    errorValidacion ? 'var(--cp-rust)' : 'var(--cp-line)'
                  }`,
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '10px 12px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                Si el texto pegado es inválido o corrupto, se mostrará un error y tu plano actual no se modificará.
              </div>
            </div>

            {/* Mensaje de error de validación */}
            {errorValidacion && (
              <div
                role="alert"
                style={{
                  padding: '12px 14px',
                  background: '#FBEDE9',
                  border: '1.5px solid var(--cp-rust)',
                  borderRadius: '12px',
                  color: 'var(--cp-rust)',
                  fontSize: '13px',
                  fontWeight: 700,
                  lineHeight: '18px',
                }}
              >
                {errorValidacion}
              </div>
            )}
          </div>

          {/* Pie */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--cp-line)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              background: 'var(--cp-cream)',
            }}
          >
            <Boton type="button" variante="secundario" onClick={alCerrar}>
              Cerrar
            </Boton>
            <Boton
              type="button"
              variante="primario"
              disabled={!textoPegado.trim()}
              onClick={handleValidarYAbrirConfirmar}
            >
              Aplicar el diseño pegado
            </Boton>
          </div>
        </div>
      </div>

      {/* Modal de confirmación obligatoria Sí/No */}
      <Confirmar
        abierto={confirmarAbierto}
        titulo="¿Restaurar y reemplazar el plano actual?"
        mensaje="Esta acción reemplazará toda la distribución de pisos y elementos del plano por el diseño pegado. ¿Deseas continuar?"
        textoSi="Sí, aplicar diseño"
        textoNo="No, cancelar"
        cargando={cargando}
        alConfirmar={ejecutarAplicar}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </>
  );
}
