import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Pestanas } from '../../comun/ModalConPestanas';

interface Cumple {
  nombre: string;
  rol?: string;
  fecha: string;
  enDias: number;
  etiqueta: string;
  /** Solo clientes: celular enmascarado y si se puede felicitar sin costo (ventana de 24 h abierta). */
  celular?: string | null;
  ventanaAbierta?: boolean;
  chatCelular?: string | null;
}
interface RespuestaCumples {
  ventanaDias: number;
  sinFecha?: number;
  proximos: Cumple[];
}

type Periodo = 'hoy' | '7' | '30';
const PERIODOS: { id: Periodo; texto: string; dias: number; vacio: string }[] = [
  { id: 'hoy', texto: 'Hoy', dias: 0, vacio: 'Hoy no cumple años nadie' },
  { id: '7', texto: '7 días', dias: 7, vacio: 'Sin cumpleaños en los próximos 7 días' },
  { id: '30', texto: 'Este mes', dias: 30, vacio: 'Sin cumpleaños en los próximos 30 días' },
];

function Lista({ ruta, clientes }: { ruta: string; clientes?: boolean }) {
  const { tiene } = useSesion();
  const navigate = useNavigate();
  const [datos, setDatos] = useState<RespuestaCumples | null>(null);
  const [error, setError] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>('30');

  useEffect(() => {
    let vigente = true;
    api
      .get<RespuestaCumples>(ruta)
      .then((r) => {
        if (vigente && r && Array.isArray(r.proximos)) setDatos(r);
      })
      .catch(() => vigente && setError(true));
    return () => {
      vigente = false;
    };
  }, [ruta]);

  if (error) return <div role="alert" style={{ fontSize: 14, color: '#2C4C5D' }}>No se pudo cargar. Vuelve a abrir el escritorio.</div>;
  if (!datos) return <div role="status" style={{ fontSize: 14, color: '#2C4C5D' }}>Cargando…</div>;

  const p = PERIODOS.find((x) => x.id === periodo)!;
  const lista = datos.proximos.filter((c) => c.enDias <= p.dias);
  const puedeEditar = tiene('usuarios/editar');

  return (
    <div>
      <div role="group" aria-label="Período" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {PERIODOS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={periodo === x.id}
            onClick={() => setPeriodo(x.id)}
            style={{
              minHeight: 44, padding: '0 14px', borderRadius: 999, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              border: '1px solid #D99E39', background: periodo === x.id ? '#D99E39' : '#FFFFFF', color: '#0B2C3E',
            }}
          >
            {x.texto}
          </button>
        ))}
      </div>
      {lista.length === 0 ? (
        <div style={{ fontSize: 14, color: '#2C4C5D' }}>{p.vacio}</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lista.map((c, i) => {
            const hoy = c.enDias === 0;
            return (
              <li
                key={`${c.nombre}-${i}`}
                style={{ fontSize: 14, color: '#0B2C3E', padding: '8px 10px', borderRadius: 10, background: hoy ? '#FBF4EC' : 'transparent', border: hoy ? '1px solid #D99E39' : '1px solid transparent' }}
              >
                <b>{hoy ? '🎉 ' : ''}{c.nombre}</b>{' '}
                <span style={{ color: '#2C4C5D' }}>· {clientes ? c.celular ?? 'sin celular' : c.rol}</span>
                <div style={{ fontSize: 13, color: hoy ? '#0B2C3E' : '#2C4C5D', fontWeight: hoy ? 700 : 400 }}>
                  {hoy ? '¡Hoy cumple años!' : c.etiqueta} · {c.fecha}
                </div>
                {clientes && hoy && (
                  c.ventanaAbierta && c.chatCelular ? (
                    <a
                      href={`/admin/mensajes?telefono=${c.chatCelular}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginTop: 6, padding: '0 14px', borderRadius: 12, background: '#2F7A45', color: '#FFFFFF', fontWeight: 800, textDecoration: 'none' }}
                    >
                      Felicitar por WhatsApp
                    </a>
                  ) : (
                    <div style={{ fontSize: 12, color: '#2C4C5D', marginTop: 4 }}>
                      No se puede felicitar sin costo: no hay un chat abierto en las últimas 24 horas.
                    </div>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!clientes && puedeEditar && (datos.sinFecha ?? 0) > 0 && (
        <button
          type="button"
          onClick={() => navigate('/admin/usuarios')}
          style={{ marginTop: 10, minHeight: 44, padding: '0 4px', background: 'none', border: 'none', color: '#0B2C3E', textDecoration: 'underline', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {datos.sinFecha} {datos.sinFecha === 1 ? 'persona sin fecha de nacimiento' : 'personas sin fecha de nacimiento'} · completar
        </button>
      )}
    </div>
  );
}

/**
 * «Cumpleaños»: equipo (ADMIN y SUPERVISOR, permiso escritorio/cumpleanos) y clientes (quien ve clientes),
 * en pestañas, con Hoy / 7 días / Este mes. Nunca muestra edad ni fecha completa. Los clientes llevan el
 * celular enmascarado y «Felicitar por WhatsApp» solo si ya hay un chat abierto (sin plantilla de pago).
 */
export function TarjetaCumpleanos() {
  const { tiene } = useSesion();
  const equipo = tiene('escritorio/cumpleanos');
  const clientes = tiene('clientes/ver');
  if (!equipo && !clientes) return null;

  const tEquipo = <Lista ruta="/admin/escritorio/cumpleanos?dias=60" />;
  const tClientes = <Lista ruta="/admin/escritorio/cumpleanos-clientes?dias=31" clientes />;

  return (
    <section aria-labelledby="cumples-titulo" style={{ background: '#FFFFFF', border: '1px solid #E3D6C6', borderRadius: 16, padding: '16px 18px' }}>
      <h2 id="cumples-titulo" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15, color: '#0B2C3E', margin: '0 0 10px' }}>
        🎂 Cumpleaños
      </h2>
      {equipo && clientes ? (
        <Pestanas
          etiqueta="Cumpleaños"
          pestanas={[
            { id: 'equipo', etiqueta: 'Equipo', contenido: tEquipo },
            { id: 'clientes', etiqueta: 'Clientes', contenido: tClientes },
          ]}
        />
      ) : equipo ? tEquipo : tClientes}
    </section>
  );
}
