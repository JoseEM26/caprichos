import { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSesion } from '../comun/sesion';
import { Confirmar } from '../comun/Confirmar';
import { Boton } from '../comun/Boton';
import { Icono } from '../comun/Icono';
import { GRUPOS_MODULOS, MODULOS } from './modulos';

export function AdminShell() {
  const { usuario, salir, tiene } = useSesion();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [modalSalirAbierto, setModalSalirAbierto] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [gruposColapsados, setGruposColapsados] = useState<Record<string, boolean>>({});

  // Indicador de conexión real según eventos del navegador
  const [enLinea, setEnLinea] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setEnLinea(true);
    const handleOffline = () => setEnLinea(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Filtrar módulos accesibles según permisos del usuario
  const modulosAccesibles = useMemo(() => {
    return MODULOS.filter(
      (m) => !m.permisoMinimo || tiene(m.permisoMinimo),
    );
  }, [tiene]);

  // Agrupar módulos
  const modulosPorGrupo = useMemo(() => {
    return GRUPOS_MODULOS.map((grupo) => ({
      grupo,
      items: modulosAccesibles.filter((m) => m.grupo === grupo),
    })).filter((g) => g.items.length > 0);
  }, [modulosAccesibles]);

  const toggleGrupo = (grupo: string) => {
    setGruposColapsados((prev) => ({
      ...prev,
      [grupo]: !prev[grupo],
    }));
  };

  const handleSalir = async () => {
    setCerrandoSesion(true);
    try {
      await salir();
      setModalSalirAbierto(false);
      navigate('/admin/ingresar', { replace: true });
    } finally {
      setCerrandoSesion(false);
    }
  };

  const iniciales = (usuario?.nombres || 'U')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  // Encontrar título del módulo activo
  const moduloActual = modulosAccesibles.find(
    (m) =>
      m.ruta === location.pathname ||
      (m.ruta !== '/admin' && location.pathname.startsWith(m.ruta)),
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--cp-cream)',
      }}
    >
      {/* ===== BARRA SUPERIOR PARA CELULAR ===== */}
      <header
        className="barra-movil"
        style={{
          background: 'var(--cp-navy)',
          color: 'var(--cp-cream)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <button
          type="button"
          onClick={() => setMenuMovilAbierto(true)}
          aria-label="Abrir menú"
          style={{
            width: '44px',
            height: '44px',
            border: 0,
            borderRadius: '10px',
            background: 'transparent',
            color: 'var(--cp-cream)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icono nombre="menu" tamano={24} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '16px',
              letterSpacing: '0.04em',
            }}
          >
            CAPRICHOS
          </div>
          <div style={{ fontSize: '12px', color: 'var(--cp-line2)' }}>
            {usuario?.rol || 'Personal'}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setModalSalirAbierto(true)}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          style={{
            border: 0,
            background: 'transparent',
            color: 'var(--cp-gold)',
            fontWeight: 700,
            fontSize: '13px',
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
          }}
        >
          <Icono nombre="salir" tamano={18} />
          <span>Salir</span>
        </button>
      </header>

      {/* ===== DRAWER MOVIL ===== */}
      {menuMovilAbierto && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
          <div
            onClick={() => setMenuMovilAbierto(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(11, 44, 62, 0.6)',
            }}
          />
          <nav
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '82%',
              maxWidth: '320px',
              background: 'var(--cp-navy)',
              color: 'var(--cp-cream)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              overflowY: 'auto',
              boxShadow: '4px 0 20px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--cp-soft)',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 800,
                    fontSize: '17px',
                  }}
                >
                  CAPRICHOS
                </div>
                <div style={{ fontSize: '12px', color: 'var(--cp-line2)' }}>
                  {usuario?.nombres} ({usuario?.rol})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuMovilAbierto(false)}
                aria-label="Cerrar menú"
                style={{
                  width: '44px',
                  height: '44px',
                  border: 0,
                  background: 'transparent',
                  color: 'var(--cp-cream)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icono nombre="cerrar" tamano={22} />
              </button>
            </div>

            {modulosPorGrupo.map((g) => {
              const colapsado = gruposColapsados[g.grupo];
              return (
                <div key={g.grupo} style={{ marginBottom: '8px' }}>
                  <button
                    type="button"
                    onClick={() => toggleGrupo(g.grupo)}
                    aria-label={`Contraer o expandir ${g.grupo}`}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      border: 0,
                      background: 'transparent',
                      color: 'var(--cp-gold)',
                      padding: '0 6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textAlign: 'left',
                    }}
                  >
                    <span>{g.grupo.toUpperCase()}</span>
                    <Icono
                      nombre={colapsado ? 'chevronDerecha' : 'chevronAbajo'}
                      tamano={14}
                    />
                  </button>

                  {!colapsado && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {g.items.map((m) => {
                        const esActivo =
                          location.pathname === m.ruta ||
                          (m.ruta !== '/admin' &&
                            location.pathname.startsWith(m.ruta));
                        return (
                          <button
                            key={m.clave}
                            type="button"
                            onClick={() => {
                              navigate(m.ruta);
                              setMenuMovilAbierto(false);
                            }}
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              border: 0,
                              borderRadius: '10px',
                              background: esActivo ? 'var(--cp-orange)' : 'transparent',
                              color: esActivo ? 'var(--cp-navy)' : 'var(--cp-cream)',
                              padding: '0 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              fontWeight: 700,
                              fontSize: '13px',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <Icono nombre={m.icono || 'punto'} tamano={18} />
                            <span>{m.nombre}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setMenuMovilAbierto(false);
                  setModalSalirAbierto(true);
                }}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  border: 0,
                  borderRadius: '10px',
                  background: 'transparent',
                  color: 'var(--cp-gold)',
                  fontWeight: 700,
                  textAlign: 'left',
                  padding: '0 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Icono nombre="salir" tamano={18} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* ===== CONTENEDOR PRINCIPAL: SIDEBAR PC + CONTENIDO ===== */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* SIDEBAR PC */}
        <aside
          className="sidebar-pc"
          style={{
            width: '260px',
            flexShrink: 0,
            background: 'var(--cp-navy)',
            color: 'var(--cp-cream)',
            padding: '20px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            overflowY: 'auto',
          }}
        >
          {/* Logo y marca */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              paddingLeft: '6px',
            }}
          >
            <img
              src="/logo.webp"
              alt="Caprichos"
              width={42}
              height={42}
              style={{ borderRadius: '50%', display: 'block' }}
            />
            <div>
              <div
                style={{
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '17px',
                  lineHeight: '20px',
                  letterSpacing: '0.04em',
                }}
              >
                CAPRICHOS
              </div>
              <div style={{ fontSize: '12px', color: 'var(--cp-line2)' }}>
                Panel del local
              </div>
            </div>
          </div>

          {/* Menú agrupado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {modulosPorGrupo.map((g) => {
              const colapsado = gruposColapsados[g.grupo];
              return (
                <div key={g.grupo}>
                  <button
                    type="button"
                    onClick={() => toggleGrupo(g.grupo)}
                    aria-label={`Contraer o expandir ${g.grupo}`}
                    style={{
                      width: '100%',
                      minHeight: '38px',
                      border: 0,
                      background: 'transparent',
                      color: 'var(--cp-gold)',
                      padding: '0 8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{g.grupo.toUpperCase()}</span>
                    <Icono
                      nombre={colapsado ? 'chevronDerecha' : 'chevronAbajo'}
                      tamano={14}
                    />
                  </button>

                  {!colapsado && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {g.items.map((m) => {
                        const esActivo =
                          location.pathname === m.ruta ||
                          (m.ruta !== '/admin' &&
                            location.pathname.startsWith(m.ruta));
                        return (
                          <button
                            key={m.clave}
                            type="button"
                            onClick={() => navigate(m.ruta)}
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              border: 0,
                              borderRadius: '10px',
                              background: esActivo ? 'var(--cp-orange)' : 'transparent',
                              color: esActivo ? 'var(--cp-navy)' : 'var(--cp-cream)',
                              padding: '0 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              fontWeight: 700,
                              fontSize: '13px',
                              textAlign: 'left',
                              cursor: 'pointer',
                              transition: 'background-color 0.1s',
                            }}
                          >
                            <Icono nombre={m.icono || 'punto'} tamano={18} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {m.nombre}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tarjeta de usuario al pie */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: '16px',
              borderTop: '1px solid var(--cp-soft)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 8px',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '19px',
                  background: 'var(--cp-sand)',
                  color: 'var(--cp-navy)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '14px',
                  flexShrink: 0,
                }}
              >
                {iniciales}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '13px',
                    lineHeight: '16px',
                    color: 'var(--cp-cream)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {usuario?.nombres || 'Personal'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--cp-line2)' }}>
                  {usuario?.rol}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalSalirAbierto(true)}
              style={{
                width: '100%',
                minHeight: '44px',
                border: 0,
                borderRadius: '10px',
                background: 'transparent',
                color: 'var(--cp-gold)',
                fontWeight: 700,
                fontSize: '13px',
                textAlign: 'left',
                padding: '0 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Icono nombre="salir" tamano={18} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </aside>

        {/* CONTENIDO DERECHA */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Cabecera interna */}
          <div
            style={{
              padding: '16px 24px',
              background: 'var(--cp-cream)',
              borderBottom: '1px solid var(--cp-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '20px',
                  color: 'var(--cp-navy)',
                }}
              >
                {moduloActual?.nombre || 'Panel Administrativo'}
              </h1>
              <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                {moduloActual?.grupo || 'Caprichos'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  borderRadius: '9999px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--cp-navy)',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '4px',
                    background: enLinea ? 'var(--cp-green)' : 'var(--cp-rust)',
                  }}
                />
                {enLinea ? 'En línea' : 'Sin conexión'}
              </span>

              <Boton
                variante="secundario"
                tamano="pequeno"
                onClick={() => setModalSalirAbierto(true)}
              >
                Salir
              </Boton>
            </div>
          </div>

          {/* Área de la ruta activa */}
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
            <Outlet />
          </div>
        </main>
      </div>

      {/* MODAL DE CONFIRMACIÓN AL SALIR */}
      <Confirmar
        abierto={modalSalirAbierto}
        titulo="Cerrar sesión"
        mensaje="¿Estás seguro de que deseas cerrar tu sesión en el panel de Caprichos?"
        textoSi="Sí, cerrar sesión"
        textoNo="No, permanecer aquí"
        cargando={cerrandoSesion}
        alConfirmar={handleSalir}
        alCancelar={() => setModalSalirAbierto(false)}
      />

      <style>{`
        @media (min-width: 769px) {
          .barra-movil { display: none !important; }
        }
        @media (max-width: 768px) {
          .sidebar-pc { display: none !important; }
        }
      `}</style>
    </div>
  );
}
