import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSesion } from '../comun/sesion';
import { api } from '../comun/api';
import { Tarjeta } from '../comun/Tarjeta';
import { Boton } from '../comun/Boton';
import { Insignia } from '../comun/Insignia';
import { Icono } from '../comun/Icono';

interface EstadoCartaRespuesta {
  abierta: boolean;
  texto?: string;
  motivo?: string;
  pausaAltaDemanda?: boolean;
  altaDemandaMin?: number;
}

interface EstadoCajaRespuesta {
  abierta: boolean;
  caja?: {
    id?: string;
    fecha?: string;
    estado?: string;
    apertura?: number;
    creada_en?: string;
  } | null;
}

export function Escritorio() {
  const { usuario, tiene } = useSesion();
  const navigate = useNavigate();

  const rol = (usuario?.rol || '').toUpperCase();
  const esAdmin = rol === 'ADMIN';
  const puedeVerCaja = tiene('caja/ver');

  // Estado real del local desde GET /carta/estado
  const [localCargando, setLocalCargando] = useState(true);
  const [localError, setLocalError] = useState(false);
  const [localDato, setLocalDato] = useState<EstadoCartaRespuesta | null>(null);

  // Estado real de la caja desde GET /admin/caja/actual
  const [cajaCargando, setCajaCargando] = useState(puedeVerCaja);
  const [cajaError, setCajaError] = useState(false);
  const [cajaDato, setCajaDato] = useState<EstadoCajaRespuesta | null>(null);

  useEffect(() => {
    let montado = true;

    // 1. Cargar estado público del local
    api
      .get<EstadoCartaRespuesta>('/carta/estado')
      .then((res) => {
        if (montado) {
          setLocalDato(res);
          setLocalError(false);
        }
      })
      .catch(() => {
        if (montado) {
          setLocalDato(null);
          setLocalError(true);
        }
      })
      .finally(() => {
        if (montado) {
          setLocalCargando(false);
        }
      });

    // 2. Cargar estado de la caja solo si tiene permiso caja/ver
    if (puedeVerCaja) {
      setCajaCargando(true);
      api
        .get<EstadoCajaRespuesta>('/admin/caja/actual')
        .then((res) => {
          if (montado) {
            setCajaDato(res);
            setCajaError(false);
          }
        })
        .catch(() => {
          if (montado) {
            setCajaDato(null);
            setCajaError(true);
          }
        })
        .finally(() => {
          if (montado) {
            setCajaCargando(false);
          }
        });
    } else {
      setCajaCargando(false);
    }

    return () => {
      montado = false;
    };
  }, [puedeVerCaja]);

  // Tarjetas de acceso rápido filtradas según permisos y con iconos SVG
  const accesosRapidos = [
    {
      titulo: 'Pedidos y caja',
      subtitulo: 'Recepción de pedidos, cobros de salón y delivery',
      ruta: '/admin/caja',
      permiso: 'caja/ver',
      icono: 'caja',
      destacado: 'Operativo',
    },
    {
      titulo: 'Caja y cierres',
      subtitulo: 'Arqueo ciego de caja, turnos y liquidación',
      ruta: '/admin/cierre',
      permiso: 'caja/cerrar',
      icono: 'cierre',
      destacado: 'Cierre',
    },
    {
      titulo: 'Cocina y barra',
      subtitulo: 'Comandas por área de preparación y tiempos de espera',
      ruta: '/admin/cocina',
      permiso: 'cocina/ver',
      icono: 'cocina',
      destacado: 'Comandas',
    },
    {
      titulo: 'Repartos y motorizados',
      subtitulo: 'Despacho de pedidos delivery y rutas asignadas',
      ruta: '/admin/repartos',
      permiso: 'repartos/ver',
      icono: 'repartos',
      destacado: 'Entregas',
    },
    {
      titulo: 'Stock y almacén',
      subtitulo: 'Movimientos de insumos, alertas de stock mínimo',
      ruta: '/admin/stock',
      permiso: 'stock/ver',
      icono: 'stock',
      destacado: 'Inventario',
    },
    {
      titulo: 'Usuarios y personal',
      subtitulo: 'Gestión de colaboradores, roles y horarios',
      ruta: '/admin/usuarios',
      permiso: 'usuarios/ver',
      icono: 'usuarios',
      destacado: 'Personal',
    },
    {
      titulo: 'Catálogo y carta',
      subtitulo: 'Productos, categorías, precios y combos',
      ruta: '/admin/productos',
      permiso: 'catalogo/ver',
      icono: 'productos',
      destacado: 'Carta',
    },
    {
      titulo: 'Configuración del local',
      subtitulo: 'Horarios de atención, datos de contacto y pagos',
      ruta: '/admin/mirest',
      permiso: 'local/ver',
      icono: 'mirest',
      destacado: 'Ajustes',
    },
    {
      titulo: 'Auditoría e historial',
      subtitulo: 'Registro inmutable de acciones realizadas',
      ruta: '/admin/historial',
      permiso: 'auditoria/ver',
      icono: 'historial',
      destacado: 'Auditoría',
    },
  ].filter((item) => !item.permiso || tiene(item.permiso));

  // Render texto estado del local
  const renderEstadoLocal = () => {
    if (localCargando) return 'Cargando...';
    if (localError || !localDato) return 'Sin dato';
    return localDato.abierta ? 'Abierto' : 'Cerrado';
  };

  const colorEstadoLocal = () => {
    if (localCargando || localError || !localDato) return 'var(--cp-soft)';
    return localDato.abierta ? 'var(--cp-green)' : 'var(--cp-rust)';
  };

  const detalleEstadoLocal = () => {
    if (localCargando) return 'Consultando estado...';
    if (localError || !localDato) return 'No se pudo conectar con el servicio';
    if (localDato.pausaAltaDemanda) {
      return `Pausa por alta demanda (+${localDato.altaDemandaMin || 0} min)`;
    }
    return localDato.texto || (localDato.abierta ? 'Carta abierta a pedidos' : 'Local cerrado a pedidos');
  };

  // Render texto estado de la caja
  const renderEstadoCaja = () => {
    if (!puedeVerCaja) return 'No aplica';
    if (cajaCargando) return 'Cargando...';
    if (cajaError || !cajaDato) return 'Sin dato';
    return cajaDato.abierta ? 'Abierta' : 'Cerrada';
  };

  const colorEstadoCaja = () => {
    if (!puedeVerCaja || cajaCargando || cajaError || !cajaDato) return 'var(--cp-soft)';
    return cajaDato.abierta ? 'var(--cp-green)' : 'var(--cp-rust)';
  };

  const detalleEstadoCaja = () => {
    if (!puedeVerCaja) return 'Sin permiso para caja';
    if (cajaCargando) return 'Consultando caja del día...';
    if (cajaError || !cajaDato) return 'No se pudo obtener la caja actual';
    if (!cajaDato.caja) return 'No se ha abierto caja hoy';
    return cajaDato.abierta ? 'Caja activa para cobros' : 'Caja cerrada';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
          Hola, <strong>{usuario?.nombres || 'Usuario'}</strong>. Este es tu
          escritorio de <strong>{usuario?.rol || 'personal'}</strong>: solo
          muestra lo que corresponde a tu rol.
        </div>
      </div>

      {/* Indicadores en tiempo real con datos de API */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
        }}
      >
        {/* Tarjeta 1: Estado del local */}
        <div
          data-testid="tarjeta-estado-local"
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--cp-soft)',
            }}
          >
            ESTADO DEL LOCAL
          </div>
          <div
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '22px',
              lineHeight: '28px',
              color: colorEstadoLocal(),
            }}
          >
            {renderEstadoLocal()}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
            {detalleEstadoLocal()}
          </div>
        </div>

        {/* Tarjeta 2: Caja del día (si tiene permiso) */}
        {(esAdmin || puedeVerCaja) && (
          <div
            data-testid="tarjeta-caja-actual"
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: 'var(--cp-soft)',
              }}
            >
              CAJA DEL DÍA
            </div>
            <div
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '22px',
                lineHeight: '28px',
                color: colorEstadoCaja(),
              }}
            >
              {renderEstadoCaja()}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
              {detalleEstadoCaja()}
            </div>
          </div>
        )}

        {/* Tarjeta 3: Rol del usuario autenticado */}
        <div
          data-testid="tarjeta-rol-sesion"
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--cp-soft)',
            }}
          >
            ROL ASIGNADO
          </div>
          <div
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '22px',
              lineHeight: '28px',
              color: 'var(--cp-orange)',
            }}
          >
            {usuario?.rol || 'Personal'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
            {usuario?.nombres || 'Sesión activa'}
          </div>
        </div>
      </div>

      {/* Sección de accesos rápidos por rol y permisos */}
      <div>
        <h2
          style={{
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: '17px',
            color: 'var(--cp-navy)',
            marginBottom: '12px',
          }}
        >
          Accesos rápidos
        </h2>

        {accesosRapidos.length === 0 ? (
          <div
            style={{
              padding: '24px',
              background: 'var(--cp-white)',
              borderRadius: '14px',
              border: '1px solid var(--cp-line)',
              textAlign: 'center',
              color: 'var(--cp-soft)',
            }}
          >
            No tienes módulos asignados actualmente para tu rol.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '14px',
            }}
          >
            {accesosRapidos.map((item) => (
              <Tarjeta
                key={item.ruta}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, transform 0.1s',
                }}
                onClick={() => navigate(item.ruta)}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                    }}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'var(--cp-sand)',
                        color: 'var(--cp-navy)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icono nombre={item.icono} tamano={20} />
                    </div>
                    <Insignia variante="neutro">{item.destacado}</Insignia>
                  </div>
                  <h3
                    style={{
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '16px',
                      color: 'var(--cp-navy)',
                      marginBottom: '4px',
                    }}
                  >
                    {item.titulo}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      lineHeight: '18px',
                      color: 'var(--cp-soft)',
                    }}
                  >
                    {item.subtitulo}
                  </p>
                </div>

                <Boton
                  variante="secundario"
                  tamano="pequeno"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(item.ruta);
                  }}
                  style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>Ingresar al módulo</span>
                  <Icono nombre="flechaDerecha" tamano={14} />
                </Boton>
              </Tarjeta>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
