import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { ErrorApi } from '../../comun/api';
import { IndicadorSubida } from '../../comun/IndicadorSubida';
import { useSubidaArchivo } from '../../comun/useSubidaArchivo';
import {
  FotoLocal,
  listarFotosLocal,
  migrarFotosDelNavegador,
  quitarFotoLocal,
  subirFotoLocal,
} from './fotosLocalApi';

export const SLOTS_FOTOS = [
  'Fachada',
  'Salón principal',
  'Barra y vitrina',
  'Terraza',
  'Equipo y cocina',
  'Ambiente de noche',
];

const botonFoto = {
  position: 'relative' as const,
  flex: 1,
  minHeight: '44px',
  boxSizing: 'border-box' as const,
  borderRadius: '10px',
  background: 'var(--cp-orange)',
  color: 'var(--cp-navy)',
  fontWeight: 800,
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

interface TarjetaFotoLocalProps {
  slot: string;
  foto?: FotoLocal;
  puedeEditar: boolean;
  alSubir: (foto: FotoLocal) => void;
  alQuitar: (slot: string) => void;
}

function TarjetaFotoLocal({ slot, foto, puedeEditar, alSubir, alQuitar }: TarjetaFotoLocalProps) {
  const subida = useSubidaArchivo<FotoLocal>();

  const alElegir = (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    void subida.ejecutar(async () => {
      const nueva = await subirFotoLocal(slot, archivo);
      alSubir(nueva);
      return nueva;
    });
  };

  return (
    <div
      style={{
        border: '1px solid var(--cp-line)',
        borderRadius: '12px',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: '4/3',
          borderRadius: '10px',
          overflow: 'hidden',
          background: 'var(--cp-sand)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--cp-soft)',
          fontSize: '12px',
          fontWeight: 700,
        }}
      >
        {foto ? (
          <img
            src={foto.url}
            alt={slot}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span>Sin foto</span>
        )}
      </div>
      <div style={{ fontWeight: 700, fontSize: '13px' }}>{slot}</div>
      {puedeEditar && (
        <>
          <div style={{ display: 'flex', gap: '6px' }}>
            <label
              style={{ ...botonFoto, opacity: subida.subiendo ? 0.6 : 1, cursor: subida.subiendo ? 'not-allowed' : 'pointer' }}
            >
              {subida.subiendo ? 'Subiendo…' : foto ? 'Cambiar foto' : 'Subir foto'}
              <input
                type="file"
                accept="image/*"
                disabled={subida.subiendo}
                onChange={alElegir}
                aria-label={`Subir foto de ${slot}`}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
              />
            </label>
            {foto && (
              <button
                type="button"
                onClick={() => alQuitar(slot)}
                disabled={subida.subiendo}
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  border: '1.5px solid var(--cp-rust)',
                  borderRadius: '10px',
                  background: 'transparent',
                  color: 'var(--cp-rust)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Quitar
              </button>
            )}
          </div>
          <IndicadorSubida
            estado={subida.estado}
            error={subida.error}
            onReintentar={subida.reintentar}
            textoListo="Foto guardada"
          />
        </>
      )}
    </div>
  );
}

function textoMigracion(recuperadas: number, fallidas: number): string {
  const partes: string[] = [];
  if (recuperadas > 0) {
    partes.push(
      recuperadas === 1
        ? 'Recuperamos 1 foto que estaba solo en este navegador.'
        : `Recuperamos ${recuperadas} fotos que estaban solo en este navegador.`,
    );
  }
  if (fallidas > 0) {
    partes.push(
      `No pudimos subir ${fallidas} ${fallidas === 1 ? 'foto' : 'fotos'}: siguen guardadas en este navegador. Vuelve a abrir esta pantalla para reintentar.`,
    );
  }
  return partes.join(' ');
}

export function FotosLocalSeccion({ puedeEditar }: { puedeEditar: boolean }) {
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aQuitar, setAQuitar] = useState<string | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [errorQuitar, setErrorQuitar] = useState<string | null>(null);

  const cargar = async (): Promise<FotoLocal[] | null> => {
    try {
      const lista = await listarFotosLocal();
      setFotos(lista);
      setErrorCarga(null);
      return lista;
    } catch (err) {
      setErrorCarga(err instanceof ErrorApi ? err.message : 'No se pudieron cargar las fotos del local.');
      return null;
    }
  };

  useEffect(() => {
    let vivo = true;
    (async () => {
      const lista = await cargar();
      if (!vivo) return;
      setCargando(false);
      if (!lista || !puedeEditar) return;
      const migracion = await migrarFotosDelNavegador(lista);
      if (!vivo) return;
      if (migracion.recuperadas > 0 || migracion.fallidas > 0) {
        setAviso(textoMigracion(migracion.recuperadas, migracion.fallidas));
        await cargar();
      }
    })();
    return () => {
      vivo = false;
    };
    // Se carga una vez al abrir la pantalla.
  }, []);

  const alSubir = (nueva: FotoLocal) =>
    setFotos((previas) => [...previas.filter((f) => f.slot !== nueva.slot), nueva]);

  const confirmarQuitar = async () => {
    if (!aQuitar) return;
    setQuitando(true);
    setErrorQuitar(null);
    try {
      await quitarFotoLocal(aQuitar);
      setFotos((previas) => previas.filter((f) => f.slot !== aQuitar));
      setAQuitar(null);
    } catch (err) {
      setErrorQuitar(err instanceof ErrorApi ? err.message : 'No se pudo quitar la foto. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setQuitando(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '18px' }}>
          Fotos del local
        </div>
        <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
          Se guardan en el servidor y se ven en Conócenos (galería «Nuestro lugar»). Sube las fotos que entregue el restaurante: del local, del grupo, del equipo.
        </div>
      </div>

      {aviso && (
        <div role="status" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
          {aviso}
        </div>
      )}
      {errorCarga && (
        <div role="alert" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
          {errorCarga}
        </div>
      )}
      {cargando && (
        <div role="status" style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
          Cargando fotos…
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
        {SLOTS_FOTOS.map((slot) => (
          <TarjetaFotoLocal
            key={slot}
            slot={slot}
            foto={fotos.find((f) => f.slot === slot)}
            puedeEditar={puedeEditar}
            alSubir={alSubir}
            alQuitar={setAQuitar}
          />
        ))}
      </div>

      <Confirmar
        abierto={aQuitar !== null}
        titulo="¿Quitar esta foto de la galería?"
        mensaje={aQuitar ? `Se quita de «${aQuitar}» en Conócenos. La imagen no se borra: queda guardada en el servidor.` : undefined}
        textoSi="Sí, quitar"
        textoNo="No"
        peligro
        cargando={quitando}
        alConfirmar={confirmarQuitar}
        alCancelar={() => {
          setAQuitar(null);
          setErrorQuitar(null);
        }}
      >
        {errorQuitar && (
          <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: '13px', fontWeight: 700 }}>
            {errorQuitar}
          </div>
        )}
      </Confirmar>
    </div>
  );
}
