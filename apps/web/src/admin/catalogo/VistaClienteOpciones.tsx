import { useState } from 'react';
import type { GrupoOpcionItem } from './catalogoApi';
import type { TamanoEstado } from './editorOpcionesTipos';

const soles = (n: number) => `S/ ${Number(n || 0).toFixed(2)}`;
const VISIBLES = 6;

/** Vista compacta de lo que verá el cliente: tamaños como chips y cada grupo con sus primeras 6 opciones. */
export function VistaCliente({ tamanos, grupos }: { tamanos: TamanoEstado[]; grupos: GrupoOpcionItem[] }) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const act = tamanos.filter((t) => t.activo);
  const alternar = (id: string) => setExpandidos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <div className="eo-vista" aria-label="Así lo verá el cliente">
      {act.length === 0 ? (
        <div className="eo-micro">Sin tamaños: se vende a un precio único.</div>
      ) : (
        <div>
          <div className="pregunta">Elige el tamaño <span className="eo-micro">(obligatoria)</span></div>
          <div className="eo-chips">
            {act.map((t) => <span key={t.tamanoValorId} className="eo-chip">{t.nombre} · {soles(t.precio)}</span>)}
          </div>
        </div>
      )}
      {grupos.length === 0 && <div className="eo-micro">Este producto no pregunta nada más. Actívalo en «Preguntas al cliente».</div>}
      {grupos.map((g) => {
        const varias = (g.maximo ?? 1) > 1;
        const ops = g.opciones.filter((o) => o.activo !== false);
        const abierto = expandidos.has(g.id);
        const lista = abierto ? ops : ops.slice(0, VISIBLES);
        const resto = ops.length - VISIBLES;
        return (
          <div key={g.id}>
            <div className="pregunta">
              {g.nombre} <span className="eo-micro">{g.obligatorio ? '(obligatoria)' : '(opcional)'}{varias ? ` · hasta ${g.maximo}` : ' · elige una'}</span>
            </div>
            <div className="eo-chips">
              {lista.map((o) => (
                <span key={o.id} className="eo-chip">{o.nombre}{o.precioExtra > 0 ? ` (+${soles(o.precioExtra)})` : ''}</span>
              ))}
              {resto > 0 && (
                <button type="button" className="eo-chip eo-chip-mas" aria-expanded={abierto} onClick={() => alternar(g.id)}>
                  {abierto ? 'Ver menos' : `Ver ${resto} más`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
