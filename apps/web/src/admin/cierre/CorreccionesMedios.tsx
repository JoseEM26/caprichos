import { useState } from 'react';
import { ErrorApi } from '../../comun/api';
import { cierreApi, AjusteMedio, MedioAjustable } from './cierreApi';

export const ETIQUETA_MEDIO: Record<string, string> = {
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
};

const MOTIVO_MINIMO = 10;

const soles = (n: number) => `s/ ${n.toFixed(2)}`;

const horaLima = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// Monto en soles: solo dígitos y un punto, máximo dos decimales
const limpiarMonto = (v: string) => v.replace(/[^\d.]/g, '').replace(/^(\d*\.?\d{0,2}).*$/, '$1');

/** Lista de correcciones de una caja (en el modal de cierre y en el detalle del historial). */
export function ListaCorrecciones({ ajustes, titulo = 'Correcciones de esta caja' }: { ajustes: AjusteMedio[]; titulo?: string }) {
  return (
    <div
      data-testid="lista-correcciones"
      style={{ background: 'var(--cp-white, #FFFFFF)', border: '1px solid var(--cp-line, #E3D6C6)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <div style={{ fontWeight: 800, fontSize: 13 }}>{titulo}</div>
      {ajustes.length === 0 && <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>Ninguna corrección.</div>}
      {ajustes.map((a) => (
        <div key={a.id} data-testid="correccion" style={{ borderTop: '1px solid var(--cp-sand, #EDE1D1)', paddingTop: 4, fontSize: 12 }}>
          <div>
            <b>{ETIQUETA_MEDIO[a.medio] ?? a.medio}</b>: {soles(a.montoSistema)} → {soles(a.montoNuevo)}
          </div>
          <div>Motivo: {a.motivo}</div>
          <div style={{ color: 'var(--cp-soft, #2C4C5D)' }}>
            Hecha por {a.porNombre ?? 'sin dato'} · aprobada por {a.autorizadoPorNombre ?? 'sin dato'} · {horaLima(a.creadoEn)}
          </div>
        </div>
      ))}
    </div>
  );
}

interface DialogoCorregirMedioProps {
  medio: MedioAjustable;
  montoSistema: number;
  montoActual: number;
  /** true para el cajero: pide el código de supervisor. ADMIN y SUPERVISOR no lo escriben. */
  pideCodigo: boolean;
  alCerrar: () => void;
  alGuardado: (ajuste: AjusteMedio) => void;
}

/** Diálogo de excepción: monto nuevo, motivo obligatorio y autorización. */
export function DialogoCorregirMedio({ medio, montoSistema, montoActual, pideCodigo, alCerrar, alGuardado }: DialogoCorregirMedioProps) {
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const nombre = ETIQUETA_MEDIO[medio] ?? medio;

  const guardar = async () => {
    if (guardando) return;
    const numero = Number(limpiarMonto(monto));
    if (monto.trim() === '' || Number.isNaN(numero)) {
      setError('Escribe el monto nuevo.');
      return;
    }
    if (Math.abs(numero - montoActual) < 0.005) {
      setError(`El monto nuevo es igual al que ya vale (${soles(montoActual)}).`);
      return;
    }
    if (motivo.trim().length < MOTIVO_MINIMO) {
      setError(`Escribe el motivo del cambio (mínimo ${MOTIVO_MINIMO} caracteres).`);
      return;
    }
    if (pideCodigo && !/^\d{6}$/.test(codigo.trim())) {
      setError('Escribe el código de supervisor de 6 dígitos.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const ajuste = await cierreApi.registrarAjusteMedio(
        { medio, montoNuevo: numero, motivo: motivo.trim() },
        pideCodigo ? codigo.trim() : undefined,
      );
      alGuardado(ajuste);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar la corrección.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div className="vm-fondo" onClick={alCerrar} />
      <div role="dialog" aria-modal="true" aria-labelledby="corr-titulo" className="vm-modal">
        <div className="vm-enc">
          <h2 id="corr-titulo" className="vm-titulo">Corregir monto de {nombre}</h2>
          <button type="button" className="vm-x" onClick={alCerrar} aria-label="Cerrar">×</button>
        </div>
        <div className="vm-cuerpo" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13 }}>
            Sistema: {soles(montoSistema)} · Vale ahora: {soles(montoActual)}
          </div>
          <div>
            <label htmlFor="corr-monto" style={{ fontWeight: 700, fontSize: 13 }}>Monto nuevo</label>
            <input
              id="corr-monto"
              aria-label="Monto nuevo"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={monto}
              onChange={(e) => setMonto(limpiarMonto(e.target.value))}
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 38, borderRadius: 8, border: '1px solid var(--cp-line, #E3D6C6)', padding: '0 8px' }}
            />
          </div>
          <div>
            <label htmlFor="corr-motivo" style={{ fontWeight: 700, fontSize: 13 }}>
              Motivo del cambio (obligatorio, mínimo {MOTIVO_MINIMO} caracteres)
            </label>
            <textarea
              id="corr-motivo"
              aria-label="Motivo del cambio"
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid var(--cp-line, #E3D6C6)', padding: 8, fontFamily: 'inherit' }}
            />
          </div>
          {pideCodigo && (
            <div>
              <label htmlFor="corr-codigo" style={{ fontWeight: 700, fontSize: 13 }}>Código de supervisor</label>
              <input
                id="corr-codigo"
                aria-label="Código de supervisor"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 38, borderRadius: 8, border: '1px solid var(--cp-line, #E3D6C6)', padding: '0 8px' }}
              />
            </div>
          )}
          {error && (
            <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={guardando}
              onClick={guardar}
              style={{ flex: 1, minHeight: 44, border: 0, borderRadius: 12, background: 'var(--cp-orange, #E67929)', color: 'var(--cp-navy, #0B2C3E)', fontWeight: 800, cursor: 'pointer' }}
            >
              {guardando ? 'Guardando...' : 'Guardar corrección'}
            </button>
            <button
              type="button"
              onClick={alCerrar}
              style={{ flex: 1, minHeight: 44, borderRadius: 12, border: '1.5px solid var(--cp-navy, #0B2C3E)', background: 'transparent', color: 'var(--cp-navy, #0B2C3E)', fontWeight: 800, cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
