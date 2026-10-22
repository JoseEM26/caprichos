import { useState } from 'react';
import { useSesion } from '../../comun/sesion';
import { DatosLocalTab } from './DatosLocalTab';
import { HorarioTab } from './HorarioTab';
import { FechasEspecialesTab } from './FechasEspecialesTab';
import { PagosTab } from './PagosTab';
import { ParametrosOperacionTab } from './ParametrosOperacionTab';

export type PestanaConfig =
  | 'datos'
  | 'horario'
  | 'fechas'
  | 'pagos'
  | 'operacion';

interface DefinicionPestana {
  id: PestanaConfig;
  nombre: string;
  descripcion: string;
  requierePermiso?: string;
}

const PESTANAS: DefinicionPestana[] = [
  {
    id: 'datos',
    nombre: 'Datos del local',
    descripcion: 'Nombre, dirección, teléfono y redes sociales',
  },
  {
    id: 'horario',
    nombre: 'Horario por día',
    descripcion: 'Horas de apertura y cierre semanales',
  },
  {
    id: 'fechas',
    nombre: 'Fechas especiales',
    descripcion: 'Feriados y días con horario excepcional',
  },
  {
    id: 'pagos',
    nombre: 'Medios de pago',
    descripcion: 'Efectivo, tarjetas, Yape, Plin y cuentas',
  },
  {
    id: 'operacion',
    nombre: 'Parámetros de operación',
    descripcion: 'Tiempos de entrega, umbrales y tolerancias',
    requierePermiso: 'configuracion/ver',
  },
];

export function ConfiguracionLocalView() {
  const { tiene } = useSesion();
  const [pestanaActiva, setPestanaActiva] = useState<PestanaConfig>('datos');

  const puedeVerLocal = tiene('local/ver');
  const puedeEditarLocal = tiene('local/editar');
  const puedeVerConfig = tiene('configuracion/ver');
  const puedeEditarConfig = tiene('configuracion/editar');

  if (!puedeVerLocal) {
    return (
      <div
        role="status"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 16px',
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '16px',
          textAlign: 'center',
          gap: '12px',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: '18px',
            color: 'var(--cp-rust)',
          }}
        >
          No tienes permiso
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--cp-soft)',
            maxWidth: '400px',
            lineHeight: '20px',
            margin: 0,
          }}
        >
          Tu rol actual no cuenta con el permiso <b>local/ver</b> necesario para visualizar la configuración del local.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      {/* Cabecera del módulo estilo mockup */}
      <div>
        <h1
          style={{
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: '22px',
            color: 'var(--cp-navy)',
          }}
        >
          Configuración del local
        </h1>
        <p
          style={{
            fontSize: '13px',
            lineHeight: '19px',
            color: 'var(--cp-soft)',
            margin: '4px 0 0 0',
          }}
        >
          Los datos que ve el cliente en la carta y en Conócenos: ubicación, contacto, horario, redes, pagos y parámetros de operación.
        </p>
      </div>

      {/* Selector de pestañas y contenedor principal */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'flex-start',
        }}
      >
        {/* Columna lateral de pestañas (diseño Admin.dc.html) */}
        <div
          role="tablist"
          aria-label="Pestañas de configuración"
          style={{
            flex: '1 1 240px',
            minWidth: '220px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {PESTANAS.map((p) => {
            const esActiva = pestanaActiva === p.id;
            const tieneAccesoPestana = !p.requierePermiso || tiene(p.requierePermiso);

            if (!tieneAccesoPestana) return null;

            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={esActiva}
                onClick={() => setPestanaActiva(p.id)}
                style={{
                  textAlign: 'left',
                  background: 'var(--cp-white)',
                  border: `2px solid ${esActiva ? 'var(--cp-orange)' : 'var(--cp-line)'}`,
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  color: 'var(--cp-navy)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background-color 0.15s',
                  boxShadow: esActiva ? '0 2px 8px rgba(230, 121, 41, 0.15)' : 'none',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 800,
                    fontSize: '14px',
                    color: esActiva ? 'var(--cp-navy)' : 'inherit',
                  }}
                >
                  {p.nombre}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--cp-soft)',
                    lineHeight: '16px',
                  }}
                >
                  {p.descripcion}
                </span>
              </button>
            );
          })}
        </div>

        {/* Panel de contenido de la pestaña activa */}
        <div
          role="tabpanel"
          style={{
            flex: '2 1 500px',
            minWidth: '280px',
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(11, 44, 62, 0.04)',
          }}
        >
          {pestanaActiva === 'datos' && (
            <DatosLocalTab puedeEditar={puedeEditarLocal} />
          )}

          {pestanaActiva === 'horario' && (
            <HorarioTab puedeEditar={puedeEditarLocal} />
          )}

          {pestanaActiva === 'fechas' && (
            <FechasEspecialesTab puedeEditar={puedeEditarLocal} />
          )}

          {pestanaActiva === 'pagos' && (
            <PagosTab puedeEditar={puedeEditarLocal} />
          )}

          {pestanaActiva === 'operacion' && (
            <ParametrosOperacionTab
              puedeVer={puedeVerConfig}
              puedeEditar={puedeEditarConfig}
            />
          )}
        </div>
      </div>
    </div>
  );
}
