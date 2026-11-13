import { useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { comprobantesApi } from '../comprobantes/comprobantesApi';
import type { CambioComprobantePendiente } from '../comprobantes/tipos';
import { SelectorComprobante, VALOR_COMPROBANTE_VACIO, aPayloadComprobante, errorValorComprobante, etiquetaComprobante, type ValorComprobante } from './SelectorComprobante';

/** «Cambiará a Factura RUC 20… esta noche»: lo que dice el pedido mientras el cambio espera al envío nocturno. */
export function textoCambioPendiente(c: CambioComprobantePendiente): string {
  const doc = c.tipo === 'SIMPLE' || !c.documento ? '' : ` ${c.tipo === 'FACTURA' ? 'RUC' : 'DNI'} ${c.documento}`;
  return `Cambiará a ${etiquetaComprobante(c.tipo)}${doc} esta noche`;
}

export interface CambioComprobanteCobradoProps {
  pedidoId: string;
  total?: number;
  cambio: CambioComprobantePendiente | null;
  /** Caja y ADMIN (permiso comprobantes/anular) */
  puede: boolean;
  /** Con mensaje cuando «Aplicar ahora» terminó (el padre lo muestra: al recargar este bloque se remonta) */
  alCambiar: (mensaje?: string) => void;
}

/**
 * Cambiar el comprobante de un pedido YA cobrado. No emite: deja el cambio pendiente y el envío de la noche lo aplica
 * (si el original no había salido a SUNAT, se reemplaza sin anular nada). Cambiar de nuevo reemplaza al anterior.
 */
export function CambioComprobanteCobrado({ pedidoId, total, cambio, puede, alCambiar }: CambioComprobanteCobradoProps) {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState<ValorComprobante>({ ...VALOR_COMPROBANTE_VACIO, tipo: 'BOLETA' });
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [deshaciendo, setDeshaciendo] = useState(false);
  const [confirmarAhora, setConfirmarAhora] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  const aplicarAhora = async () => {
    setAplicando(true);
    setError(null);
    try {
      const r = await comprobantesApi.aplicarCambioAhora(pedidoId);
      alCambiar(r.mensaje);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo aplicar el cambio ahora');
    } finally {
      setAplicando(false);
      setConfirmarAhora(false);
    }
  };

  const errorForm = errorValorComprobante(valor)?.mensaje ?? (motivo.trim().length < 5 ? 'Escribe el motivo (al menos 5 letras)' : null);

  const guardar = async () => {
    const dto = aPayloadComprobante(valor);
    if (!dto) return;
    setGuardando(true);
    setError(null);
    try {
      await comprobantesApi.cambiarComprobanteCobrado(pedidoId, { ...dto, motivo: motivo.trim() });
      setAbierto(false);
      setMotivo('');
      alCambiar();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo pedir el cambio');
    } finally {
      setGuardando(false);
    }
  };

  const deshacer = async () => {
    setDeshaciendo(true);
    try {
      await comprobantesApi.deshacerCambioComprobante(pedidoId);
      alCambiar();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo deshacer el cambio');
    } finally {
      setDeshaciendo(false);
    }
  };

  return (
    <div className="cpd-cambio" data-testid="cambio-comprobante">
      {cambio && (
        <p className="cpd-nota" role="status" data-testid="cambio-pendiente">
          {textoCambioPendiente(cambio)}. Motivo: {cambio.motivo}
        </p>
      )}
      {error && !abierto && <p role="alert" className="cpd-aviso">{error}</p>}
      {puede && (
        <div className="cpd-acciones">
          <button type="button" className="cpd-btn" onClick={() => { setError(null); setAbierto(true); }}>
            Cambiar comprobante
          </button>
          {cambio && (
            <button type="button" className="cpd-btn" onClick={() => setConfirmarAhora(true)} disabled={aplicando}>
              Aplicar ahora
            </button>
          )}
          {cambio && (
            <button type="button" className="cpd-btn" onClick={deshacer} disabled={deshaciendo}>
              Deshacer cambio
            </button>
          )}
        </div>
      )}
      <Confirmar
        abierto={confirmarAhora}
        titulo="Aplicar ahora"
        mensaje="Se hará ya: si la boleta ya salió a SUNAT se da de baja y se emite la factura nueva ahora. ¿Aplicar ahora?"
        textoSi="Sí, aplicar"
        textoNo="No"
        cargando={aplicando}
        alConfirmar={aplicarAhora}
        alCancelar={() => setConfirmarAhora(false)}
      />
      <Confirmar
        abierto={abierto}
        titulo="Cambiar comprobante"
        mensaje="No se emite ahora: el cambio se aplica esta noche, antes del envío a SUNAT. ¿Pedir el cambio?"
        textoSi="Sí, cambiar"
        textoNo="No"
        cargando={guardando}
        deshabilitarConfirmar={!!errorForm}
        error={error}
        alConfirmar={guardar}
        alCancelar={() => setAbierto(false)}
      >
        <SelectorComprobante idPrefijo="cc-comp" valor={valor} onChange={setValor} total={total} />
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 700 }}>
          Motivo del cambio
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} aria-label="Motivo del cambio" style={{ minHeight: 44, padding: '0 10px' }} />
        </label>
        {errorForm && <p style={{ margin: 0, fontSize: 12, color: 'var(--cp-soft)' }}>{errorForm}</p>}
      </Confirmar>
    </div>
  );
}
