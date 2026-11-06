import { useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { ErrorApi } from '../../comun/api';
import { MapaUbicacion } from '../../comun/mapa/MapaUbicacion';
import type { Punto } from '../../comun/mapa/MapaUbicacion';
import { SEDE_DEFECTO, cargarSede } from '../../comun/mapa/sedeDefecto';
import { BuscadorDireccion } from '../../comun/mapa/BuscadorDireccion';
import { cambioUbicacionApi, PrevisualizacionCambio, textoDifEnvio } from './cambioUbicacionApi';

export interface ModalCambiarUbicacionProps {
  pedidoId: string;
  codigoPedido: string;
  direccionActual?: string | null;
  puntoActual?: Punto | null;
  alCerrar: () => void;
  alCambiar: (respuesta: { envioNuevo: number; totalNuevo: number; avisoCliente: string | null }) => void;
}

/**
 * Caja cambia el punto de un delivery aunque ya tenga ubicación. Antes de confirmar muestra zona, envío antes y
 * después, diferencia, nuevo total y, si ya estaba pagado, el saldo o la devolución que quedará pendiente.
 */
export function ModalCambiarUbicacion({
  pedidoId,
  codigoPedido,
  direccionActual,
  puntoActual = null,
  alCerrar,
  alCambiar,
}: ModalCambiarUbicacionProps) {
  const [punto, setPunto] = useState<Punto | null>(puntoActual);
  const [direccion, setDireccion] = useState(direccionActual ?? '');
  const [vista, setVista] = useState<PrevisualizacionCambio | null>(null);
  const [cargandoVista, setCargandoVista] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [sedeLocal, setSedeLocal] = useState(SEDE_DEFECTO);

  useEffect(() => {
    let vigente = true;
    cargarSede().then((s) => vigente && setSedeLocal(s));
    return () => {
      vigente = false;
    };
  }, []);

  // Vista previa cada vez que cambia el punto: la respuesta vieja se descarta si llega tarde
  useEffect(() => {
    if (!punto) {
      setVista(null);
      return;
    }
    let vigente = true;
    setCargandoVista(true);
    setError('');
    cambioUbicacionApi
      .previsualizar(pedidoId, punto.lat, punto.lng)
      .then((r) => vigente && setVista(r))
      .catch((err) => {
        if (!vigente) return;
        setVista(null);
        setError(
          err instanceof ErrorApi && err.codigo === 'FUERA_DE_COBERTURA'
            ? 'Ese punto está fuera de la zona de reparto. Mueve el pin o busca otra dirección.'
            : err instanceof Error
              ? err.message
              : 'No se pudo calcular el envío.',
        );
      })
      .finally(() => vigente && setCargandoVista(false));
    return () => {
      vigente = false;
    };
  }, [punto, pedidoId]);

  const guardar = async () => {
    if (!punto) return;
    setEnviando(true);
    setError('');
    try {
      const r = await cambioUbicacionApi.cambiar(pedidoId, {
        ...punto,
        direccion: direccion.trim() || undefined,
      });
      setConfirmando(false);
      alCambiar({ envioNuevo: r.envioNuevo, totalNuevo: r.totalNuevo, avisoCliente: r.avisoCliente });
    } catch (err) {
      setConfirmando(false);
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la ubicación.');
    } finally {
      setEnviando(false);
    }
  };

  const filaComparacion = (titulo: string, antes: string, despues: string) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 6, fontSize: 13 }}>
      <span style={{ fontWeight: 700 }}>{titulo}</span>
      <span>{antes}</span>
      <span style={{ fontWeight: 800 }}>{despues}</span>
    </div>
  );

  return (
    <>
      <div onClick={alCerrar} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(11, 44, 62, 0.55)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cambiar ubicación"
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(640px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream, #FBF4EC)',
          borderRadius: 20,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--cp-navy, #0B2C3E)' }}>
          Cambiar ubicación de {codigoPedido}
        </div>
        <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
          Elige el nuevo punto. Verás el envío y el total antes de confirmar.
        </div>

        <BuscadorDireccion
          onElegir={(p, texto) => {
            setPunto(p);
            setDireccion(texto.split(',').slice(0, 2).join(',').trim());
          }}
        />
        <MapaUbicacion punto={punto} onCambiar={setPunto} altura={280} local={sedeLocal} ajustarA={punto ? 'ambos' : 'local'} />

        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>
          Dirección
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            maxLength={200}
            style={{ width: '100%', minHeight: 44, marginTop: 4, borderRadius: 10, border: '1.5px solid var(--cp-line, #E3D6C6)', padding: '0 12px', boxSizing: 'border-box' }}
          />
        </label>
        {direccionActual && (
          <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>Dirección actual: {direccionActual}</div>
        )}

        <section
          aria-label="Comparación del envío"
          style={{ background: '#fff', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 6, fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
            <span />
            <span>Antes</span>
            <span>Después</span>
          </div>
          {cargandoVista && <div style={{ fontSize: 13 }}>Calculando el envío…</div>}
          {vista && !cargandoVista && (
            <>
              {filaComparacion('Zona', '—', vista.zona)}
              {filaComparacion('Envío', `S/ ${vista.envioAnterior.toFixed(2)}`, `S/ ${vista.envioNuevo.toFixed(2)}`)}
              {filaComparacion('Diferencia', '', textoDifEnvio(vista.diferencia))}
              {filaComparacion('Total', `S/ ${vista.totalAnterior.toFixed(2)}`, `S/ ${vista.totalNuevo.toFixed(2)}`)}
              {vista.ajuste && (
                <div role="note" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-navy, #0B2C3E)' }}>
                  {vista.ajuste.tipo === 'SALDO'
                    ? `Ya estaba pagado: quedará un saldo por cobrar de S/ ${vista.ajuste.monto.toFixed(2)}.`
                    : `Ya estaba pagado: quedará una devolución pendiente de S/ ${vista.ajuste.monto.toFixed(2)}.`}
                </div>
              )}
              {vista.cambiaEnvio && (
                <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>Se avisará al cliente por WhatsApp si la ventana de 24 h está abierta.</div>
              )}
            </>
          )}
        </section>

        {error && (
          <div role="alert" style={{ fontSize: 13, color: 'var(--cp-rust, #C4412B)', fontWeight: 700 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Boton variante="secundario" onClick={alCerrar} style={{ flex: 1 }}>
            Cancelar
          </Boton>
          <Boton onClick={() => setConfirmando(true)} deshabilitado={!vista || cargandoVista || enviando} style={{ flex: 1 }}>
            Confirmar cambio
          </Boton>
        </div>
      </div>

      <Confirmar
        abierto={confirmando}
        titulo={`¿Cambiar la ubicación del pedido ${codigoPedido}?`}
        mensaje={
          vista
            ? `Envío S/ ${vista.envioAnterior.toFixed(2)} → S/ ${vista.envioNuevo.toFixed(2)}. Nuevo total S/ ${vista.totalNuevo.toFixed(2)}.`
            : 'Se recalcularán la zona, el envío y el total.'
        }
        textoSi="Sí, cambiar"
        cargando={enviando}
        alConfirmar={guardar}
        alCancelar={() => setConfirmando(false)}
      />
    </>
  );
}
