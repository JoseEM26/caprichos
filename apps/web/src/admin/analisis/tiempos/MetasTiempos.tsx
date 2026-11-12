import { useEffect, useState } from 'react';
import { ETAPAS_TIEMPOS, META_TIEMPO_MAX, META_TIEMPO_MIN } from '@caprichos/compartido';
import { api } from '../../../comun/api';
import { Boton } from '../../../comun/Boton';
import type { EtapaResumen } from './tipos';

/**
 * Metas de minutos por etapa. Se guardan en Configuración (parámetros meta_tiempo_*): solo el ADMIN las edita;
 * el supervisor las ve. Cada meta se valida (entero de 1 a 1440) antes de enviarla y el servidor la valida otra vez.
 */
export function MetasTiempos({ etapas, esAdmin, alGuardar }: { etapas: EtapaResumen[]; esAdmin: boolean; alGuardar: () => void }) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    setValores(Object.fromEntries(etapas.map((e) => [e.codigo, String(e.meta)])));
  }, [etapas]);

  const guardar = async () => {
    const nuevosErrores: Record<string, string> = {};
    const cambios = etapas.filter((e) => valores[e.codigo] !== String(e.meta));
    for (const e of cambios) {
      const n = Number(valores[e.codigo]);
      if (!Number.isInteger(n) || n < META_TIEMPO_MIN || n > META_TIEMPO_MAX) {
        nuevosErrores[e.codigo] = `Escribe un número entero entre ${META_TIEMPO_MIN} y ${META_TIEMPO_MAX}.`;
      }
    }
    setErrores(nuevosErrores);
    setAviso('');
    if (Object.keys(nuevosErrores).length) return;
    if (!cambios.length) return setAviso('No hay cambios que guardar.');
    setGuardando(true);
    try {
      for (const e of cambios) {
        const clave = ETAPAS_TIEMPOS.find((x) => x.codigo === e.codigo)!.clave;
        await api.put(`/admin/configuracion/${clave}`, { valor: Number(valores[e.codigo]) });
      }
      setAviso('Metas guardadas.');
      alGuardar();
    } catch (err) {
      setAviso(err instanceof Error && err.message ? err.message : 'No se pudieron guardar las metas. Prueba de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <details className="an-tarjeta">
      <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', fontWeight: 800, cursor: 'pointer' }}>Metas por etapa</summary>
      <p className="an-sub">
        Minutos esperados por etapa: mueven el semáforo y la lista de atascados.
        {esAdmin ? '' : ' Solo el administrador puede cambiarlas.'}
      </p>
      <div className="an-metas">
        {etapas.map((e) => (
          <div className="an-meta" key={e.codigo}>
            <label htmlFor={`meta-${e.codigo}`}>{e.nombre}</label>
            <input
              id={`meta-${e.codigo}`}
              className="an-campo"
              type="number"
              inputMode="numeric"
              min={META_TIEMPO_MIN}
              max={META_TIEMPO_MAX}
              step={1}
              disabled={!esAdmin || guardando}
              value={valores[e.codigo] ?? ''}
              aria-invalid={Boolean(errores[e.codigo])}
              aria-describedby={errores[e.codigo] ? `meta-${e.codigo}-e` : undefined}
              onChange={(ev) => setValores((v) => ({ ...v, [e.codigo]: ev.target.value }))}
            />
            {errores[e.codigo] && (
              <span id={`meta-${e.codigo}-e`} className="an-error-fechas" role="alert">
                {errores[e.codigo]}
              </span>
            )}
          </div>
        ))}
      </div>
      {esAdmin && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Boton onClick={guardar} cargando={guardando}>
            Guardar metas
          </Boton>
          {aviso && (
            <span role="status" className="an-sub">
              {aviso}
            </span>
          )}
        </div>
      )}
    </details>
  );
}
