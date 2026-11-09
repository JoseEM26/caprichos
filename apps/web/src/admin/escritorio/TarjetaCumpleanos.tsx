import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../comun/api';
import { useSesion } from '../../comun/sesion';

interface Cumple {
  nombre: string;
  rol: string;
  fecha: string;
  enDias: number;
  etiqueta: string;
}
interface RespuestaCumples {
  ventanaDias: number;
  sinFecha: number;
  proximos: Cumple[];
}

/**
 * «Próximos cumpleaños del equipo»: solo ADMIN y SUPERVISOR (permiso escritorio/cumpleanos; el servidor
 * también lo exige). Se carga al abrir el escritorio, sin tiempo real. Si falla, no muestra nada.
 */
export function TarjetaCumpleanos() {
  const { tiene } = useSesion();
  const navigate = useNavigate();
  const permitido = tiene('escritorio/cumpleanos');
  const puedeEditar = tiene('usuarios/editar');
  const [datos, setDatos] = useState<RespuestaCumples | null>(null);

  useEffect(() => {
    if (!permitido) return;
    let vigente = true;
    api
      .get<RespuestaCumples>('/admin/escritorio/cumpleanos?dias=60')
      .then((r) => {
        if (vigente && r && Array.isArray(r.proximos)) setDatos(r);
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [permitido]);

  if (!permitido || !datos) return null;

  return (
    <section
      aria-labelledby="cumples-titulo"
      style={{ background: '#FFFFFF', border: '1px solid #E3D6C6', borderRadius: 16, padding: '16px 18px' }}
    >
      <h2 id="cumples-titulo" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15, color: '#0B2C3E', margin: '0 0 10px' }}>
        🎂 Próximos cumpleaños del equipo
      </h2>
      {datos.proximos.length === 0 ? (
        <div style={{ fontSize: 14, color: '#2C4C5D' }}>Sin cumpleaños en los próximos {datos.ventanaDias} días</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {datos.proximos.map((c, i) => {
            const hoy = c.enDias === 0;
            return (
              <li
                key={`${c.nombre}-${i}`}
                style={{
                  fontSize: 14,
                  color: '#0B2C3E',
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: hoy ? '#FBF4EC' : 'transparent',
                  border: hoy ? '1px solid #D99E39' : '1px solid transparent',
                }}
              >
                <b>{hoy ? '🎉 ' : ''}{c.nombre}</b> <span style={{ color: '#2C4C5D' }}>· {c.rol}</span>
                <div style={{ fontSize: 13, color: hoy ? '#0B2C3E' : '#2C4C5D', fontWeight: hoy ? 700 : 400 }}>
                  {hoy ? '¡Hoy cumple años!' : c.etiqueta} · {c.fecha}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {puedeEditar && datos.sinFecha > 0 && (
        <button
          type="button"
          onClick={() => navigate('/admin/usuarios')}
          style={{ marginTop: 10, minHeight: 44, padding: '0 4px', background: 'none', border: 'none', color: '#0B2C3E', textDecoration: 'underline', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {datos.sinFecha} {datos.sinFecha === 1 ? 'persona sin fecha de nacimiento' : 'personas sin fecha de nacimiento'} · completar
        </button>
      )}
    </section>
  );
}
