import { useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { ErrorApi } from '../../comun/api';
import { useEventos } from '../../comun/socket';
import { MapaUbicacion } from '../../comun/mapa/MapaUbicacion';
import { PropuestaPendiente, cambioUbicacionApi, textoDifEnvio, textoDistancia } from './cambioUbicacionApi';

/**
 * Bandeja de Caja: propuestas de ubicación del repartidor pendientes. Cada una con mapa antes/después, envío nuevo y
 * diferencia; Caja las aprueba (se aplica como cambio suyo) o las rechaza con motivo opcional.
 */
export function BandejaPropuestasUbicacion({ alAplicar }: { alAplicar?: () => void }) {
  const [propuestas, setPropuestas] = useState<PropuestaPendiente[]>([]);
  const [aprobando, setAprobando] = useState<PropuestaPendiente | null>(null);
  const [rechazando, setRechazando] = useState<PropuestaPendiente | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    cambioUbicacionApi
      .propuestasPendientes()
      .then(setPropuestas)
      .catch(() => setPropuestas([]));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useEventos('ubicacion:propuesta', cargar);

  const aprobar = async () => {
    if (!aprobando) return;
    setOcupado(true);
    setError('');
    try {
      await cambioUbicacionApi.aprobarPropuesta(aprobando.pedidoId, aprobando.id);
      setAprobando(null);
      cargar();
      alAplicar?.();
    } catch (err) {
      setAprobando(null);
      setError(err instanceof ErrorApi || err instanceof Error ? err.message : 'No se pudo aprobar.');
    } finally {
      setOcupado(false);
    }
  };

  const rechazar = async () => {
    if (!rechazando) return;
    setOcupado(true);
    setError('');
    try {
      await cambioUbicacionApi.rechazarPropuesta(rechazando.pedidoId, rechazando.id, motivo.trim() || undefined);
      setRechazando(null);
      setMotivo('');
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo rechazar.');
    } finally {
      setOcupado(false);
    }
  };

  if (propuestas.length === 0) return null;

  return (
    <section aria-label="Cambios de ubicación propuestos" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, background: 'rgb(255, 241, 201)', borderRadius: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy, #0B2C3E)' }}>Cambios de ubicación propuestos ({propuestas.length})</div>
      {error && (
        <div role="alert" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-rust, #C4412B)' }}>
          {error}
        </div>
      )}
      {propuestas.map((p) => (
        <article key={p.id} aria-label={`Propuesta del pedido ${p.codigo}`} style={{ background: '#fff', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13 }}>
            <strong>{p.codigo}</strong> ·{' '}
            {p.origen === 'WHATSAPP_CLIENTE'
              ? p.fueraDeZona
                ? 'Fuera de zona: ubicación del cliente (WhatsApp)'
                : 'El cliente envió otra ubicación: ¿usarla?'
              : `Cambio de ubicación propuesto por ${p.propuestoPorNombre ?? 'el repartidor'}`}
          </div>
          {p.nota && <div style={{ fontSize: 12 }}>Nota: {p.nota}</div>}
          {textoDistancia(p) && <div style={{ fontSize: 12, fontWeight: 700 }}>{textoDistancia(p)}</div>}
          {!p.fueraDeZona && (
            <div style={{ fontSize: 12 }}>
              Envío S/ {(p.envioAnterior ?? 0).toFixed(2)} → S/ {(p.envioNuevo ?? 0).toFixed(2)} · {textoDifEnvio(p.diferencia)} · nuevo total S/ {(p.totalNuevo ?? 0).toFixed(2)}
              {p.pagoEstado === 'PAGADO' && ' · ya pagado (quedará saldo o devolución)'}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <MapaUbicacion punto={p.anterior.lat != null ? { lat: p.anterior.lat, lng: p.anterior.lng! } : null} soloLectura altura={130} etiqueta="Antes" />
            <MapaUbicacion punto={{ lat: p.nueva.lat!, lng: p.nueva.lng! }} soloLectura altura={130} etiqueta="Después" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!p.fueraDeZona && (
              <Boton tamano="pequeno" deshabilitado={ocupado} onClick={() => setAprobando(p)}>
                {p.origen === 'WHATSAPP_CLIENTE' ? 'Usar' : 'Aprobar'}
              </Boton>
            )}
            <Boton variante="secundario" tamano="pequeno" deshabilitado={ocupado} onClick={() => setRechazando(p)}>
              {p.origen === 'WHATSAPP_CLIENTE' ? 'Descartar' : 'Rechazar'}
            </Boton>
          </div>
        </article>
      ))}

      <Confirmar
        abierto={aprobando !== null}
        titulo={`¿Aprobar el cambio del pedido ${aprobando?.codigo ?? ''}?`}
        mensaje={aprobando ? `Se recalcularán la zona, el envío y el total. Envío nuevo S/ ${(aprobando.envioNuevo ?? 0).toFixed(2)}.` : ''}
        textoSi="Sí, aprobar"
        cargando={ocupado}
        alConfirmar={aprobar}
        alCancelar={() => setAprobando(null)}
      />

      {rechazando && (
        <div role="dialog" aria-label="Rechazar propuesta" style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(11,44,62,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--cp-cream, #FBF4EC)', borderRadius: 16, padding: 16, width: 'min(420px, calc(100% - 24px))', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 800 }}>Rechazar el cambio de {rechazando.codigo}</div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Motivo (opcional)
              <input value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} style={{ width: '100%', minHeight: 40, marginTop: 4, borderRadius: 10, border: '1.5px solid var(--cp-line, #E3D6C6)', padding: '0 10px', boxSizing: 'border-box' }} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Boton variante="secundario" onClick={() => setRechazando(null)} style={{ flex: 1 }}>
                Volver
              </Boton>
              <Boton style={{ flex: 1 }} cargando={ocupado} onClick={rechazar}>
                Rechazar
              </Boton>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
