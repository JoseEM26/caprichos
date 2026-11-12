import { useState } from 'react';
import { comprobantesApi } from '../comprobantes/comprobantesApi';

type Datos = Awaited<ReturnType<typeof comprobantesApi.listarEnviosEncuesta>>;

const MOTIVOS: Record<string, string> = {
  SIN_CELULAR: 'Sin celular',
  SIN_CONSENTIMIENTO: 'Sin consentimiento de WhatsApp',
  NUMERO_BLOQUEADO: 'Número bloqueado',
  TOPE_POR_CELULAR: 'Ya recibió una encuesta hace poco',
};

/** Últimas encuestas de calificación: enviadas u omitidas con su motivo, y la plantilla de Meta usada. Carga al abrir. */
export function EnviosEncuestaPanel() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setError(null);
    try {
      setDatos(await comprobantesApi.listarEnviosEncuesta());
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la lista de encuestas');
    }
  };

  return (
    <details
      style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 14, padding: '12px 16px' }}
      onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open && !datos) void cargar(); }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Últimas encuestas enviadas</summary>
      {error && <p role="alert">{error} <button type="button" onClick={() => void cargar()}>Reintentar</button></p>}
      {!datos && !error && <p>Cargando…</p>}
      {datos && (
        <>
          <p style={{ fontSize: 13 }}>
            Plantilla de Meta: <strong>{datos.plantilla.nombre}</strong> ({datos.plantilla.categoria}, {datos.plantilla.idioma}).
            Si un envío sale FALLIDO con error de plantilla, créala o espera su aprobación en Meta.
          </p>
          {datos.envios.length === 0 ? (
            <p>Aún no se envió ninguna encuesta.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6, fontSize: 13 }}>
              {datos.envios.map((x) => (
                <li key={x.id}>
                  <strong>{x.pedidoCodigo}</strong> · {x.cliente ?? 'Cliente'} · {x.telefonoEnmascarado ?? 'sin celular'} ·{' '}
                  {x.estado === 'OMITIDA'
                    ? `Omitida: ${MOTIVOS[x.motivo ?? ''] ?? x.motivo}`
                    : `${x.estado === 'RESPONDIDA' ? 'Respondida' : 'Enviada'}${x.envio ? ` (${x.envio})` : ''}`}
                  {x.errorEnvio ? ` · ${x.errorEnvio}` : ''} · {new Date(x.fecha).toLocaleString('es-PE')}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </details>
  );
}
