import { useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { ErrorApi } from '../../comun/api';
import { MapaUbicacion } from '../../comun/mapa/MapaUbicacion';
import type { Punto } from '../../comun/mapa/MapaUbicacion';
import { SEDE_DEFECTO, cargarSede } from '../../comun/mapa/sedeDefecto';
import { CambioUbicacion, propuestaUbicacionApi } from '../pedidos/cambioUbicacionApi';

const ESTADOS_EN_CURSO = ['LISTO', 'EN_CAMINO'];

const TEXTO_ESTADO: Record<CambioUbicacion['estado'], string> = {
  PROPUESTA: 'Pendiente de revisión en caja',
  APROBADA: 'Aprobada: caja cambió la ubicación',
  RECHAZADA: 'Rechazada por caja',
  CANCELADA: 'Cancelada',
};

/**
 * El repartidor propone la ubicación real del cliente en su pedido en curso: con su GPS («Estoy en la ubicación
 * real») o con el pin en el mapa. Nada cambia hasta que Caja la aprueba; aquí ve el resultado.
 */
export function BotonProponerUbicacion({ pedidoId, codigo, estado }: { pedidoId: string; codigo: string; estado: string }) {
  const [abierto, setAbierto] = useState(false);
  const [punto, setPunto] = useState<Punto | null>(null);
  const [nota, setNota] = useState('');
  const [vigente, setVigente] = useState<CambioUbicacion | null>(null);
  const [gpsMensaje, setGpsMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [sedeLocal, setSedeLocal] = useState(SEDE_DEFECTO);

  useEffect(() => {
    if (!abierto) return;
    let vigenteMontaje = true;
    cargarSede().then((s) => vigenteMontaje && setSedeLocal(s));
    propuestaUbicacionApi
      .vigente(pedidoId)
      .then((r) => vigenteMontaje && setVigente(r))
      .catch(() => vigenteMontaje && setVigente(null));
    return () => {
      vigenteMontaje = false;
    };
  }, [abierto, pedidoId]);

  if (!ESTADOS_EN_CURSO.includes(estado)) return null;

  const usarGps = () => {
    setGpsMensaje('');
    if (!('geolocation' in navigator)) {
      setGpsMensaje('Este dispositivo no permite leer tu ubicación: marca el punto en el mapa.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPunto({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsMensaje('Usamos tu ubicación actual. Puedes mover el pin si hace falta.');
      },
      () => setGpsMensaje('No pudimos leer tu ubicación. Da permiso de ubicación o marca el punto en el mapa.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const enviar = async () => {
    if (!punto) return;
    setOcupado(true);
    setError('');
    try {
      const r = await propuestaUbicacionApi.proponer(pedidoId, { lat: punto.lat, lng: punto.lng, nota: nota.trim() || undefined });
      setVigente(r);
      setAviso('Propuesta enviada. Caja la revisará; el pedido no cambia hasta que la aprueben.');
      setNota('');
    } catch (err) {
      setError(err instanceof ErrorApi || err instanceof Error ? err.message : 'No se pudo enviar la propuesta.');
    } finally {
      setOcupado(false);
    }
  };

  const cancelar = async () => {
    setOcupado(true);
    setError('');
    try {
      await propuestaUbicacionApi.cancelar(pedidoId);
      setVigente(await propuestaUbicacionApi.vigente(pedidoId));
      setAviso('Propuesta cancelada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar.');
    } finally {
      setOcupado(false);
    }
  };

  const pendiente = vigente?.estado === 'PROPUESTA';

  return (
    <>
      <Boton variante="secundario" onClick={() => setAbierto(true)} aria-label={`Proponer ubicación real del pedido ${codigo}`}>
        Proponer ubicación real
      </Boton>

      {abierto && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(11, 44, 62, 0.55)' }} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Proponer ubicación"
            style={{
              position: 'fixed',
              zIndex: 60,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(560px, calc(100% - 24px))',
              maxHeight: 'calc(100% - 24px)',
              overflowY: 'auto',
              background: 'var(--cp-cream, #FBF4EC)',
              borderRadius: 20,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--cp-navy, #0B2C3E)' }}>
              Ubicación real de {codigo}
            </div>
            <div style={{ fontSize: 13 }}>
              Si la dirección no es exacta, propón el punto correcto. Caja lo revisa antes de cambiar el envío.
            </div>

            {vigente && (
              <div role="status" style={{ fontSize: 13, fontWeight: 700, background: '#fff', borderRadius: 10, padding: 8 }}>
                Tu última propuesta: {TEXTO_ESTADO[vigente.estado]}
                {vigente.estado === 'RECHAZADA' && vigente.motivo ? ` (${vigente.motivo})` : ''}
              </div>
            )}

            <Boton variante="secundario" onClick={usarGps} disabled={ocupado}>
              Estoy en la ubicación real
            </Boton>
            {gpsMensaje && <div style={{ fontSize: 12 }}>{gpsMensaje}</div>}

            <MapaUbicacion punto={punto} onCambiar={setPunto} altura={260} local={sedeLocal} ajustarA={punto ? 'ambos' : 'local'} />

            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Nota (opcional)
              <input
                value={nota}
                maxLength={200}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej.: casa con portón verde"
                style={{ width: '100%', minHeight: 44, marginTop: 4, borderRadius: 10, border: '1.5px solid var(--cp-line, #E3D6C6)', padding: '0 12px', boxSizing: 'border-box' }}
              />
            </label>

            {aviso && (
              <div role="status" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-teal, #2C6E7F)' }}>
                {aviso}
              </div>
            )}
            {error && (
              <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #C4412B)' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {pendiente && (
                <Boton variante="secundario" onClick={cancelar} cargando={ocupado} style={{ flex: 1 }}>
                  Cancelar mi propuesta
                </Boton>
              )}
              <Boton onClick={enviar} deshabilitado={!punto || ocupado || pendiente} style={{ flex: 1 }}>
                Enviar propuesta
              </Boton>
            </div>
          </div>
        </>
      )}
    </>
  );
}
