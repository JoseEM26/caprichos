import type { RegistroAuditoriaItem } from './tipos';
import { Insignia } from '../../comun/Insignia';
import { etiquetaAccion, fechaLegible } from './accionesAuditoria';

interface FilaAuditoriaProps {
  registro: RegistroAuditoriaItem;
  expandido: boolean;
  alAlternar: () => void;
}

/** Una fila del historial: qué se hizo, quién y cuándo. El detalle técnico va colapsado. */
export function FilaAuditoria({ registro: r, expandido, alAlternar }: FilaAuditoriaProps) {
  const esRechazado = r.resultado === 'RECHAZADO';
  const titulo = r.descripcion || etiquetaAccion(r.accion);

  return (
    <div
      style={{
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderLeft: esRechazado ? '6px solid var(--cp-rust)' : '6px solid var(--cp-green)',
        borderRadius: '12px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 2px 6px rgba(11, 44, 62, 0.03)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <strong style={{ flex: '1 1 240px', fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px', lineHeight: '20px', color: 'var(--cp-navy)' }}>
          {titulo}
        </strong>
        <Insignia variante={esRechazado ? 'peligro' : 'exito'}>{r.resultado}</Insignia>
      </div>

      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        👤 {r.usuarioNombre || 'Usuario desconocido'} · {fechaLegible(r.en)}
      </div>

      <div>
        <button
          type="button"
          aria-expanded={expandido}
          onClick={alAlternar}
          style={{
            minHeight: '34px',
            padding: '0 12px',
            borderRadius: '8px',
            border: '1.5px solid var(--cp-navy)',
            background: 'transparent',
            color: 'var(--cp-navy)',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          {expandido ? 'Ocultar detalle técnico' : 'Detalle técnico'}
        </button>
      </div>

      {expandido && (
        <div
          style={{
            background: 'var(--cp-cream)',
            border: '1px solid var(--cp-line)',
            borderRadius: '10px',
            padding: '12px',
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginTop: '4px',
          }}
        >
          <div>
            <b>HUELLA ACTUAL (SHA-256):</b>{' '}
            <code style={{ wordBreak: 'break-all', color: 'var(--cp-navy)', fontWeight: 700 }}>{r.hash}</code>
          </div>
          <div>
            <b>HUELLA PREVIA:</b>{' '}
            <code style={{ wordBreak: 'break-all', color: 'var(--cp-soft)' }}>
              {r.hashAnterior || '0000000000000000000000000000000000000000000000000000000000000000 (Génesis)'}
            </code>
          </div>
          <div>
            <b>Acción:</b> {r.accion} · <b>Módulo:</b> {r.modulo} · <b>Categoría:</b> {r.categoria} · <b>Resultado:</b> {r.resultado}
          </div>
          {r.entidad && (
            <div>
              <b>Entidad:</b> {r.entidad} (id {r.entidadId || 'N/A'})
            </div>
          )}
          <div>
            <b>Id de persona:</b> {r.partyId || 'N/A'} · <b>IP:</b> {r.ip || '127.0.0.1'}
            {r.dispositivo && <span style={{ color: 'var(--cp-soft)' }}> ({r.dispositivo})</span>}
          </div>
          {r.motivo && (
            <div style={{ color: 'var(--cp-rust)', fontWeight: 600 }}>
              <b>Motivo:</b> {r.motivo}
            </div>
          )}
          {Boolean(r.antes) && (
            <div>
              <b>ESTADO ANTES:</b>
              <pre style={{ margin: '4px 0 0 0', padding: '8px', background: 'var(--cp-white)', borderRadius: '6px', fontSize: '12px', overflowX: 'auto' }}>
                {JSON.stringify(r.antes, null, 2)}
              </pre>
            </div>
          )}
          {Boolean(r.despues) && (
            <div>
              <b>ESTADO DESPUÉS:</b>
              <pre style={{ margin: '4px 0 0 0', padding: '8px', background: 'var(--cp-white)', borderRadius: '6px', fontSize: '12px', overflowX: 'auto' }}>
                {JSON.stringify(r.despues, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
