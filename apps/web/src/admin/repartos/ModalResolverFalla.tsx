import React, { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { repartosApi, PedidoReparto } from './repartosApi';
import { ErrorApi } from '../../comun/api';

interface ModalResolverFallaProps {
  pedido: PedidoReparto;
  alCerrar: () => void;
  alCompletar: () => void;
}

export function ModalResolverFalla({
  pedido,
  alCerrar,
  alCompletar,
}: ModalResolverFallaProps) {
  const [nota, setNota] = useState('');
  const [cierre, setCierre] = useState<'REPROGRAMADO' | 'DEVUELTO' | 'COBRADO_IGUAL'>('REPROGRAMADO');
  const [recargo, setRecargo] = useState<string>('0');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);

    if (!nota.trim()) {
      setErrorLocal('La nota de resolución es obligatoria');
      return;
    }

    setMostrarConfirmar(true);
  };

  const handleConfirmar = async () => {
    setEnviando(true);
    setErrorLocal(null);

    try {
      const recargoNum = parseFloat(recargo) || 0;
      await repartosApi.resolverFalla(pedido.id, {
        nota: nota.trim(),
        cierre,
        recargo: recargoNum > 0 ? recargoNum : undefined,
      });
      setMostrarConfirmar(false);
      alCompletar();
    } catch (err: any) {
      setMostrarConfirmar(false);
      if (err instanceof ErrorApi) {
        setErrorLocal(err.message || 'Error al resolver la falla');
      } else {
        setErrorLocal('Error inesperado al resolver la falla');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-resolver-falla"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70,
          background: 'rgba(11, 44, 62, 0.65)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !enviando) alCerrar();
        }}
      >
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '20px',
            boxShadow: '0 20px 40px rgba(11, 44, 62, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2
                id="titulo-resolver-falla"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '18px',
                  color: 'var(--cp-navy)',
                  margin: 0,
                }}
              >
                Resolver falla de entrega
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--cp-soft)' }}>
                Pedido {pedido.codigo} · {pedido.cliente_nombre}
              </p>
            </div>
            <button
              type="button"
              onClick={alCerrar}
              aria-label="Cerrar"
              disabled={enviando}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '22px',
                border: '1.5px solid var(--cp-line)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontSize: '18px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              x
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label
                htmlFor="tipo-cierre"
                style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)', marginBottom: '4px' }}
              >
                Acción de cierre
              </label>
              <select
                id="tipo-cierre"
                value={cierre}
                onChange={(e) => setCierre(e.target.value as any)}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 12px',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                <option value="REPROGRAMADO">Reprogramar (vuelve a pedidos listos)</option>
                <option value="DEVUELTO">Devuelto al local</option>
                <option value="COBRADO_IGUAL">Cobrado igual</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="nota-resolucion"
                style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)', marginBottom: '4px' }}
              >
                Nota de resolución (obligatoria)
              </label>
              <textarea
                id="nota-resolucion"
                rows={3}
                value={nota}
                onChange={(e) => {
                  setNota(e.target.value);
                  setErrorLocal(null);
                }}
                placeholder="Indica la coordinación efectuada con el cliente o el motivo de la decisión..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '10px 12px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {cierre === 'REPROGRAMADO' && (
              <div>
                <label
                  htmlFor="recargo-envio"
                  style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)', marginBottom: '4px' }}
                >
                  Recargo adicional por reenvío (S/)
                </label>
                <input
                  id="recargo-envio"
                  type="number"
                  step="0.50"
                  min="0"
                  value={recargo}
                  onChange={(e) => setRecargo(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '44px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    padding: '0 12px',
                    fontSize: '14px',
                  }}
                />
              </div>
            )}

            {errorLocal && (
              <div
                role="alert"
                style={{
                  background: '#FDE8E8',
                  border: '1.5px solid var(--cp-rust)',
                  color: 'var(--cp-rust)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {errorLocal}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <Boton
                type="submit"
                variante="primario"
                cargando={enviando}
                style={{ flex: 1, minHeight: '48px', fontWeight: 800 }}
              >
                Resolver incidente
              </Boton>
              <Boton
                type="button"
                variante="secundario"
                onClick={alCerrar}
                deshabilitado={enviando}
                style={{ minHeight: '48px' }}
              >
                Cancelar
              </Boton>
            </div>
          </form>
        </div>
      </div>

      <Confirmar
        abierto={mostrarConfirmar}
        titulo="¿Resolver incidente de entrega?"
        mensaje={`Se aplicará la resolución "${cierre}" para el pedido ${pedido.codigo}.`}
        textoSi="Sí, resolver"
        textoNo="No, revisar"
        cargando={enviando}
        alConfirmar={handleConfirmar}
        alCancelar={() => setMostrarConfirmar(false)}
      />
    </>
  );
}
