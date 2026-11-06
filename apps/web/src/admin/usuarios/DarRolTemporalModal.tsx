import { useState } from 'react';
import { ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { ETIQUETAS_ROLES, ROLES_ASIGNABLES } from './roles';
import { darRolExtra, fechaLimaAIso } from './rolesTemporalesApi';

export interface DarRolTemporalModalProps {
  usuarioId: string;
  /** Rol principal y extra que ya tiene: no se puede dar otra vez. */
  rolesActuales: string[];
  abierto: boolean;
  alCerrar: () => void;
  alDarRol: (dado: { rol: string; motivo: string | null; venceEn: string | null }, mensaje: string) => void;
}

/** Da un rol extra a la persona: con fecha de fin (temporal) o sin ella (hasta que el ADMIN lo quite). */
export function DarRolTemporalModal({ usuarioId, rolesActuales, abierto, alCerrar, alDarRol }: DarRolTemporalModalProps) {
  const [rol, setRol] = useState('');
  const [motivo, setMotivo] = useState('');
  const [hasta, setHasta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  if (!abierto) return null;

  const opciones = ROLES_ASIGNABLES.filter((r) => !rolesActuales.includes(r));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!rol) return setError('Elige el rol que se da.');
    if (hasta && new Date(fechaLimaAIso(hasta)).getTime() <= Date.now()) {
      return setError('La fecha de fin ya pasó.');
    }
    setGuardando(true);
    const venceEn = hasta ? fechaLimaAIso(hasta) : null;
    try {
      await darRolExtra(usuarioId, {
        rol,
        motivo: motivo.trim() || undefined,
        hasta: venceEn ?? undefined,
      });
      alDarRol(
        { rol, motivo: motivo.trim() || null, venceEn },
        hasta
          ? `Rol ${ETIQUETAS_ROLES[rol] || rol} dado hasta la fecha indicada.`
          : `Rol ${ETIQUETAS_ROLES[rol] || rol} dado sin fecha de fin.`,
      );
      setRol('');
      setMotivo('');
      setHasta('');
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'Error de conexión al servidor.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dar-rol-temporal-titulo"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 95,
        background: 'rgba(11, 44, 62, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={guardando ? undefined : alCerrar}
    >
      <form
        onSubmit={guardar}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'var(--cp-white)',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <h2 id="dar-rol-temporal-titulo" style={{ margin: 0, fontSize: '18px', color: 'var(--cp-navy)' }}>
          Dar rol temporal
        </h2>
        <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
          Sirve, por ejemplo, para que alguien apruebe con el código de supervisor cuando el titular no viene. Al vencer, deja de valer
          solo; el historial lo guarda.
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy)' }}>
          Rol
          <select value={rol} onChange={(e) => setRol(e.target.value)} style={{ minHeight: '44px', borderRadius: '10px', padding: '0 10px' }}>
            <option value="">Elige un rol…</option>
            {opciones.map((r) => (
              <option key={r} value={r}>
                {ETIQUETAS_ROLES[r] || r}
              </option>
            ))}
          </select>
        </label>
        <Campo
          etiqueta="Motivo (opcional)"
          value={motivo}
          maxLength={200}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej.: el supervisor titular no viene hoy"
        />
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy)' }}>
          Hasta cuándo (opcional)
          <input
            type="datetime-local"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            style={{ minHeight: '44px', borderRadius: '10px', padding: '0 10px' }}
          />
          <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--cp-soft)' }}>Vacío = hasta que lo quites tú.</span>
        </label>
        {error && (
          <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: '13px', fontWeight: 700 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <Boton variante="secundario" type="button" onClick={alCerrar} deshabilitado={guardando}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardando} deshabilitado={!rol}>
            Dar rol
          </Boton>
        </div>
      </form>
    </div>
  );
}
