import { useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { ErrorApi } from '../../comun/api';
import { MapaUbicacion } from '../../comun/mapa/MapaUbicacion';
import type { Punto } from '../../comun/mapa/MapaUbicacion';
import { SEDE_DEFECTO, cargarSede } from '../../comun/mapa/sedeDefecto';
import { BuscadorDireccion } from '../../comun/mapa/BuscadorDireccion';
import { CodigoPlus } from '../../comun/mapa/CodigoPlus';
import { pedidosApi } from './pedidosApi';

export interface ModalUbicarProps {
  pedidoId: string | number;
  codigoPedido: string;
  direccionInicial?: string | null;
  puntoInicial?: Punto | null;
  alCerrar: () => void;
  alUbicar: (respuesta: { zona: string; envio: number; total: number }) => void;
}

/** Fija el punto de un delivery buscando la dirección o tocando el mapa (RQ-CAJ-01-09). */
export function ModalUbicar({ pedidoId, codigoPedido, direccionInicial, puntoInicial = null, alCerrar, alUbicar }: ModalUbicarProps) {
  const [punto, setPunto] = useState<Punto | null>(puntoInicial);
  const [direccion, setDireccion] = useState(direccionInicial ?? '');
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

  const guardar = async () => {
    if (!punto) return;
    setEnviando(true);
    setError('');
    try {
      const r = await pedidosApi.ubicarPedido(pedidoId, { ...punto, direccion: direccion.trim() || undefined });
      setConfirmando(false);
      alUbicar(r);
    } catch (err) {
      setConfirmando(false);
      setError(
        err instanceof ErrorApi && err.codigo === 'FUERA_DE_COBERTURA'
          ? 'Ese punto está fuera de la zona de reparto. Mueve el pin o busca otra dirección.'
          : err instanceof Error
            ? err.message
            : 'No se pudo guardar la ubicación.',
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div onClick={alCerrar} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(11, 44, 62, 0.55)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ubicar pedido"
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(600px, calc(100% - 24px))',
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
          Ubicar pedido {codigoPedido}
        </div>
        <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
          Busca la dirección o toca el mapa y arrastra el pin hasta la puerta. Al guardar se recalculan la zona, el envío y el total.
        </div>

        <BuscadorDireccion
          onElegir={(p, texto) => {
            setPunto(p);
            setDireccion(texto.split(',').slice(0, 2).join(',').trim());
          }}
        />
        <MapaUbicacion
          punto={punto}
          onCambiar={setPunto}
          altura={300}
          local={sedeLocal}
          ajustarA={punto ? 'ambos' : 'local'}
        />
        <div style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)' }}>
          El icono de la tienda es la sede (Caprichos).
        </div>
        <CodigoPlus lat={punto?.lat} lng={punto?.lng} />

        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>
          Dirección
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            maxLength={200}
            style={{ width: '100%', minHeight: 44, marginTop: 4, borderRadius: 10, border: '1.5px solid var(--cp-line, #E3D6C6)', padding: '0 12px', boxSizing: 'border-box' }}
          />
        </label>

        {error && (
          <div role="alert" style={{ fontSize: 13, color: 'var(--cp-rust, #C4412B)', fontWeight: 700 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Boton variante="secundario" onClick={alCerrar} style={{ flex: 1 }}>
            Cancelar
          </Boton>
          <Boton onClick={() => setConfirmando(true)} deshabilitado={!punto || enviando} style={{ flex: 1 }}>
            Guardar ubicación
          </Boton>
        </div>
      </div>

      <Confirmar
        abierto={confirmando}
        titulo={`¿Guardar la ubicación del pedido ${codigoPedido}?`}
        mensaje="Se recalcularán la zona, el costo de envío y el total del pedido."
        textoSi="Sí, guardar"
        cargando={enviando}
        alConfirmar={guardar}
        alCancelar={() => setConfirmando(false)}
      />
    </>
  );
}
