import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../comun/sesion';
import { Confirmar } from '../comun/Confirmar';
import { Icono } from '../comun/Icono';
import { useEsMovil } from '../carta/useEsMovil';
import { GRUPOS_MODULOS, MODULOS } from './modulos';
import { TITULOS_VISTA } from './titulos';
import { useSocketConectado } from '../comun/socket';
import { useNotificaciones } from './useNotificaciones';
import { marcarTodasNotificacionesLeidas } from './notificaciones/notificacionesApi';
import { CampanaNotificaciones } from './notificaciones/CampanaNotificaciones';
import { BannerInstalarApp } from '../pwa/BannerInstalarApp';
import { AvisosEmergentes, useTituloContador } from './notificaciones/AvisosNotificaciones';
import { hayQueSonar, useSonidoAvisos } from './notificaciones/sonidoAviso';
import { AJUSTES_NOTIFICACIONES_DEFECTO } from './notificaciones/notificacionesTipos';
import './notificaciones/parpadeo-reservas.css';

// Carga diferida de la ayuda con Capri para no penalizar el tiempo de carga del panel
const AyudaCapri = lazy(() => import('./ayuda/AyudaCapri'));

const ZOOM_CELULAR = 0.82;
const CLAVE_MENU = 'caprichos_menu_contraido';

const COLOR_ROL: Record<string, string> = {
  ADMIN: 'var(--cp-orange)',
  CAJERO: 'var(--cp-gold)',
  COCINA: '#8FA9B8',
  MOZO: 'var(--cp-line)',
  CALLCENTER: '#B7C9D6',
  ALMACEN: '#D9B38C',
  PRODUCCION: '#C9A6D9',
  REPARTIDOR: '#9BD3AB',
  SUPERVISOR: 'var(--cp-gold)',
};
const NOMBRE_ROL: Record<string, string> = {
  ADMIN: 'Administrador',
  CAJERO: 'Cajero',
  COCINA: 'Cocina y barra',
  MOZO: 'Mozo',
  CALLCENTER: 'Call center',
  ALMACEN: 'Almacén',
  PRODUCCION: 'Producción',
  REPARTIDOR: 'Repartidor',
  SUPERVISOR: 'Supervisor',
};

const leerContraido = (): boolean => {
  try {
    return window.localStorage.getItem(CLAVE_MENU) === '1';
  } catch {
    return false;
  }
};

const horaLima = (d: Date): string =>
  `${d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' }).replace('.', '')} · ${d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' })}`;

/**
 * Cabecera y menú del administrativo, iguales al mockup (Admin ▸ menú lateral, barra de estado y menú del celular):
 * menú que se contrae a iconos, grupos plegables con insignias, tarjeta de perfil, hora, conexión y campanita.
 */
export function AdminShell() {
  const { usuario, salir, tiene } = useSesion();
  const navigate = useNavigate();
  const location = useLocation();
  const movil = useEsMovil();
  const resumen = useNotificaciones();

  const [contraido, setContraido] = useState<boolean>(leerContraido);
  const [menuMovil, setMenuMovil] = useState(false);
  const [gruposCerrados, setGruposCerrados] = useState<Record<string, boolean>>({});
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [ahora, setAhora] = useState(() => new Date());
  const socketConectado = useSocketConectado();
  const [enLinea, setEnLinea] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [controlesVisiblesRepartidor, setControlesVisiblesRepartidor] = useState(true);
  const [masRepartidorAbierto, setMasRepartidorAbierto] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30000);
    const alIr = () => setEnLinea(true);
    const alCaer = () => setEnLinea(false);
    window.addEventListener('online', alIr);
    window.addEventListener('offline', alCaer);

    // Decisión 6: tocar el mapa oculta/muestra los controles
    const alAlternarControles = () => setControlesVisiblesRepartidor((v) => !v);
    window.addEventListener('caprichos:toggle-controles', alAlternarControles);

    return () => {
      clearInterval(t);
      window.removeEventListener('online', alIr);
      window.removeEventListener('offline', alCaer);
      window.removeEventListener('caprichos:toggle-controles', alAlternarControles);
    };
  }, []);

  useEffect(() => {
    setMenuMovil(false);
  }, [location.pathname]);

  const alternarContraido = () => {
    setContraido((c) => {
      try {
        window.localStorage.setItem(CLAVE_MENU, c ? '0' : '1');
      } catch {
        // sin almacenamiento
      }
      return !c;
    });
  };

  const modulos = useMemo(() => MODULOS.filter((m) => !m.permisoMinimo || tiene(m.permisoMinimo)), [tiene]);
  const grupos = useMemo(
    () => GRUPOS_MODULOS.map((g) => ({ grupo: g, items: modulos.filter((m) => m.grupo === g) })).filter((g) => g.items.length > 0),
    [modulos],
  );

  const moduloActual =
    modulos.find((m) => m.ruta === location.pathname) ??
    modulos.find((m) => m.ruta !== '/admin' && location.pathname.startsWith(m.ruta));
  const enPerfil = location.pathname.startsWith('/admin/perfil');
  const titulo = enPerfil
    ? { titulo: 'Mi perfil', subtitulo: 'Tu cuenta, tu rol y los módulos a los que tienes acceso.' }
    : (moduloActual && TITULOS_VISTA[moduloActual.clave]) || { titulo: moduloActual?.nombre ?? 'Caprichos', subtitulo: '' };

  const cuenta = (clave: string): number =>
    clave === 'notificaciones' ? totalNotif : (resumen.conteos[clave] ?? 0);

  const rol = (usuario?.rol || '').toUpperCase();
  const colorRol = COLOR_ROL[rol] ?? 'var(--cp-orange)';
  const nombreRol = NOMBRE_ROL[rol] ?? usuario?.rol ?? 'Personal';
  const iniciales = (usuario?.nombres || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  const alSalir = async () => {
    setSaliendo(true);
    try {
      await salir();
      setConfirmarSalida(false);
      navigate('/admin/ingresar', { replace: true });
    } finally {
      setSaliendo(false);
    }
  };

  const ir = (ruta: string) => {
    navigate(ruta);
    setMenuMovil(false);
  };

  /** Marca todas como leídas para este usuario; el resto de usuarios no se entera */
  const marcarTodasLeidas = async () => {
    try {
      await marcarTodasNotificacionesLeidas();
    } catch {
      // sin conexión o sin permiso: se quedan como están
    }
    await resumen.refrescar();
  };

  // Lo no leído (urgente primero) es lo que suena, cuenta en la campanita y en el título
  const noLeidasAhora = resumen.notificaciones.filter((n) => !n.leida);
  const totalNotif = noLeidasAhora.length;
  // Ajustes del ADMIN (Configuración › Notificaciones): mientras no llegan, valen los de siempre
  const ajustes = { ...AJUSTES_NOTIFICACIONES_DEFECTO, ...(resumen.ajustes ?? {}) };
  const sonido = useSonidoAvisos(
    ajustes.sonidoActivo && hayQueSonar(resumen.notificaciones, ajustes.sonidoAlcance),
    ajustes.sonidoIntervaloSeg * 1000,
  );
  // Reservas nuevas sin atender: la entrada «Reservas» y su fila parpadean hasta que alguien las atienda o las marque leídas
  const reservasSinAtender = tiene('reservas/ver') && resumen.notificaciones.some((n) => n.id === 'reservas' && !n.leida);
  const parpadea = (clave: string) => clave === 'reservas' && reservasSinAtender;
  useTituloContador(totalNotif);

  // ---- piezas del menú ----
  const itemMenu = (m: (typeof modulos)[number], pequeno: boolean) => {
    const activo = moduloActual?.clave === m.clave && !enPerfil;
    const n = cuenta(m.clave);
    return (
      <button
        key={m.clave}
        type="button"
        onClick={() => ir(m.ruta)}
        aria-current={activo ? 'page' : undefined}
        style={{
          minHeight: 44,
          border: 0,
          borderRadius: 10,
          background: activo ? 'var(--cp-orange)' : 'transparent',
          color: activo ? 'var(--cp-navy)' : 'var(--cp-cream)',
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 700,
          fontSize: pequeno ? 13 : 14,
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {pequeno && <Icono nombre={m.icono || m.clave} tamano={18} />}
          {m.nombre}
        </span>
        {n > 0 && (
          <span className={parpadea(m.clave) ? 'cp-parpadea-insignia' : undefined} style={{ minWidth: 22, textAlign: 'center', borderRadius: 11, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontSize: 12, padding: '1px 6px' }}>
            {n}
          </span>
        )}
      </button>
    );
  };

  const encabezadoGrupo = (g: string, margen: number) => (
    <button
      key={`h-${g}`}
      type="button"
      onClick={() => setGruposCerrados((p) => ({ ...p, [g]: !p[g] }))}
      aria-label={`Contraer o abrir ${g}`}
      aria-expanded={!gruposCerrados[g]}
      style={{ marginTop: margen, minHeight: 44, border: 0, background: 'transparent', color: 'var(--cp-gold)', padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textAlign: 'left', fontFamily: 'inherit' }}
    >
      <span>{g}</span>
      <span style={{ fontSize: 14 }}>{gruposCerrados[g] ? '▸' : '▾'}</span>
    </button>
  );

  const listaMenu = (pequeno: boolean, margenGrupo: number) =>
    grupos.map((g) => (
      <div key={g.grupo} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {encabezadoGrupo(g.grupo, margenGrupo)}
        {!gruposCerrados[g.grupo] && g.items.map((m) => itemMenu(m, pequeno))}
      </div>
    ));

  const avatar = (tam: number) =>
    usuario?.fotoUrl ? (
      <img
        src={usuario.fotoUrl}
        alt=""
        width={tam}
        height={tam}
        style={{ width: tam, height: tam, borderRadius: tam / 2, objectFit: 'cover', display: 'block', flex: 'none' }}
      />
    ) : (
      <span
        style={{ width: tam, height: tam, borderRadius: tam / 2, background: colorRol, color: 'var(--cp-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, flex: 'none' }}
      >
        {iniciales}
      </span>
    );

  const logo = (tam: number) => <img src="/logo.webp" alt="Caprichos" width={tam} height={tam} style={{ borderRadius: tam / 2, display: 'block', flex: 'none' }} />;

  const menuPC = (
    <aside
      aria-label="Menú del administrativo"
      style={{
        // el mockup suma el relleno al ancho (250 + 32 y 72 + 16)
        flex: `0 0 ${contraido ? 88 : 282}px`,
        minWidth: contraido ? 88 : 282,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'var(--cp-navy)',
        color: 'var(--cp-cream)',
        padding: contraido ? '12px 8px' : '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <button
        type="button"
        onClick={alternarContraido}
        aria-label={contraido ? 'Expandir menú' : 'Contraer menú'}
        title={contraido ? 'Expandir menú' : 'Contraer menú'}
        style={{ alignSelf: contraido ? 'center' : 'flex-end', flex: 'none', width: 36, height: 36, minHeight: 36, padding: 0, border: '1.5px solid var(--cp-soft)', borderRadius: 10, background: 'transparent', color: 'var(--cp-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={contraido ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'} />
        </svg>
      </button>

      {!contraido ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            {logo(44)}
            <div>
              <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 17, lineHeight: '20px' }}>CAPRICHOS</div>
              <div style={{ fontSize: 12, color: 'var(--cp-line2)' }}>Panel del local</div>
            </div>
          </div>
          {listaMenu(true, 10)}
          <button
            type="button"
            onClick={() => navigate('/admin/perfil')}
            style={{ marginTop: 'auto', textAlign: 'left', border: '1px solid var(--cp-soft)', borderRadius: 12, background: 'transparent', color: 'var(--cp-cream)', padding: 10, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit' }}
          >
            {avatar(44)}
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 13, lineHeight: '17px' }}>{usuario?.nombres}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--cp-line2)' }}>{nombreRol} · Ver perfil</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmarSalida(true)}
            style={{ minHeight: 44, border: 0, background: 'transparent', color: 'var(--cp-gold)', fontWeight: 700, textAlign: 'left', padding: '0 6px', fontFamily: 'inherit' }}
          >
            Cerrar sesión
          </button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ marginBottom: 4 }}>{logo(40)}</span>
            {grupos.map((g, gi) => (
              <div key={g.grupo} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                {gi > 0 && <div style={{ width: 32, height: 1, background: 'var(--cp-soft)', margin: '4px 0' }} />}
                {g.items.map((m) => {
                  const activo = moduloActual?.clave === m.clave && !enPerfil;
                  const n = cuenta(m.clave);
                  return (
                    <button
                      key={m.clave}
                      type="button"
                      onClick={() => ir(m.ruta)}
                      title={m.nombre}
                      aria-label={m.nombre}
                      style={{ position: 'relative', flex: 'none', width: 48, height: 48, padding: 0, border: 0, borderRadius: 12, background: activo ? 'var(--cp-orange)' : 'transparent', color: activo ? 'var(--cp-navy)' : 'var(--cp-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icono nombre={m.icono || m.clave} tamano={22} />
                      {n > 0 && (
                        <span className={parpadea(m.clave) ? 'cp-parpadea-insignia' : undefined} style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '2px solid var(--cp-navy)', boxSizing: 'content-box' }}>
                          {n}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/perfil')}
            title="Ver perfil"
            aria-label="Ver perfil"
            style={{ marginTop: 'auto', alignSelf: 'center', flex: 'none', width: 44, height: 44, padding: 0, borderRadius: 22, border: 0, background: 'transparent' }}
          >
            {avatar(44)}
          </button>
          <button
            type="button"
            onClick={() => setConfirmarSalida(true)}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            style={{ alignSelf: 'center', flex: 'none', width: 44, height: 44, padding: 0, border: 0, borderRadius: 12, background: 'transparent', color: 'var(--cp-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icono nombre="salir" tamano={20} />
          </button>
        </>
      )}
    </aside>
  );

  const barraMovil = (
    <>
      <div style={{ background: 'var(--cp-navy)', color: 'var(--cp-cream)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={() => setMenuMovil(true)} aria-label="Abrir menú" style={{ width: 44, height: 44, padding: 0, border: 0, borderRadius: 10, background: 'transparent', color: 'var(--cp-cream)', fontSize: 24 }}>
          ☰
        </button>
        {logo(34)}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 15, lineHeight: '18px' }}>CAPRICHOS</div>
          <div style={{ fontSize: 12, color: 'var(--cp-line2)' }}>{nombreRol}</div>
        </div>
        <button type="button" onClick={() => navigate('/admin/perfil')} aria-label="Ver perfil" style={{ width: 44, height: 44, padding: 0, borderRadius: 22, border: 0, background: 'transparent' }}>
          {avatar(44)}
        </button>
      </div>
      {menuMovil && (
        <>
          <div onClick={() => setMenuMovil(false)} style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(11,44,62,0.55)' }} />
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '80%', zIndex: 40, background: 'var(--cp-navy)', color: 'var(--cp-cream)', padding: 16, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 17 }}>Menú</span>
              <button type="button" onClick={() => setMenuMovil(false)} aria-label="Cerrar menú" style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: 'var(--cp-cream)', fontSize: 24 }}>
                ×
              </button>
            </div>
            {listaMenu(false, 8)}
            <button type="button" onClick={() => setConfirmarSalida(true)} style={{ marginTop: 12, minHeight: 44, border: 0, background: 'transparent', color: 'var(--cp-gold)', fontWeight: 700, textAlign: 'left', padding: '0 6px', fontFamily: 'inherit' }}>
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </>
  );

  const barraEstado = (
    <div
      style={{ flex: 'none', position: 'relative', zIndex: 35, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: movil ? '6px 12px' : '8px 24px', background: 'var(--cp-cream)', borderBottom: '1px solid var(--cp-line)' }}
    >
      <span
        title={!enLinea ? 'Sin conexión con el servidor' : socketConectado ? 'Conectado al servidor' : 'Reconectando con el servidor'}
        style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${enLinea && socketConectado ? '#9BD3AB' : '#E9A79B'}`, background: enLinea && socketConectado ? '#E6F5EA' : '#FDECE8', borderRadius: 9999, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: 'var(--cp-navy)' }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 4, background: enLinea && socketConectado ? 'var(--cp-ok)' : '#C73E2A' }} />
        {!enLinea ? 'Sin internet' : socketConectado ? 'En línea' : 'Reconectando…'}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-soft)', fontVariantNumeric: 'tabular-nums' }}>{horaLima(ahora)}</span>
      <BannerInstalarApp compacto />
      <CampanaNotificaciones
        notificaciones={resumen.notificaciones}
        sonidoSoportado={sonido.soportado}
        sonidoBloqueado={sonido.bloqueado}
        onMarcar={resumen.marcar}
        onMarcarTodas={marcarTodasLeidas}
        marcarTodasActivo={ajustes.marcarTodasActivo}
        onActivarSonido={() => void sonido.activar()}
      />
    </div>
  );

  const esRolRepartidor = rol === 'REPARTIDOR';
  const esRepartidorMovil = esRolRepartidor && movil;

  const enRepartosMapa =
    location.pathname === '/admin/repartos' &&
    !location.search.includes('vista=lista') &&
    !location.search.includes('vista=mios');
  const enRepartosMios =
    location.pathname === '/admin/repartos' &&
    (location.search.includes('vista=lista') || location.search.includes('vista=mios'));

  const barraInferiorRepartidor = (
    <>
      {/* Modal / Menú Más para repartidor */}
      {masRepartidorAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Opciones del repartidor"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            background: 'rgba(11, 44, 62, 0.65)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setMasRepartidorAbierto(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: 'var(--cp-white)',
              borderRadius: '20px 20px 0 0',
              padding: '20px',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {avatar(40)}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)' }}>
                    {usuario?.nombres}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Repartidor · Caprichos
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar opciones"
                onClick={() => setMasRepartidorAbierto(false)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '18px',
                  border: 'none',
                  background: 'var(--cp-cream)',
                  fontSize: '20px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  color: 'var(--cp-navy)',
                }}
              >
                ×
              </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--cp-line)', margin: '4px 0' }} />

            {/* El repartidor en celular no ve la barra de estado: el botón de instalar va aquí */}
            <BannerInstalarApp compacto />

            <button
              type="button"
              onClick={() => {
                setMasRepartidorAbierto(false);
                navigate('/admin/perfil');
              }}
              style={{
                minHeight: '48px',
                border: '1.5px solid var(--cp-line)',
                borderRadius: '12px',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: '10px',
                cursor: 'pointer',
              }}
            >
              <Icono nombre="usuarios" tamano={18} />
              <span>Mi perfil</span>
            </button>
            {tiene('iniciativas/ver') && (
              <button
                type="button"
                onClick={() => {
                  setMasRepartidorAbierto(false);
                  navigate('/admin/iniciativas');
                }}
                style={{
                  minHeight: '48px',
                  border: '1.5px solid var(--cp-line)',
                  borderRadius: '12px',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  gap: '10px',
                  cursor: 'pointer',
                }}
              >
                <Icono nombre="iniciativas" tamano={18} />
                <span>Iniciativas (quejas, mejoras e ideas)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMasRepartidorAbierto(false);
                navigate('/admin/notificaciones');
              }}
              style={{
                minHeight: '48px',
                border: '1.5px solid var(--cp-line)',
                borderRadius: '12px',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icono nombre="notificaciones" tamano={18} />
                <span>Notificaciones</span>
              </span>
              {totalNotif > 0 && (
                <span
                  style={{
                    background: 'var(--cp-orange)',
                    color: 'var(--cp-navy)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}
                >
                  {totalNotif}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMasRepartidorAbierto(false);
                setConfirmarSalida(true);
              }}
              style={{
                minHeight: '48px',
                border: '1.5px solid var(--cp-rust)',
                borderRadius: '12px',
                background: 'transparent',
                color: 'var(--cp-rust)',
                fontWeight: 800,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: '10px',
                cursor: 'pointer',
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      )}

      {/* Barra mínima de 3 botones grandes (Decisión 6 del dueño) */}
      <nav
        aria-label="Navegación del repartidor"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          background: 'rgba(11, 44, 62, 0.96)',
          backdropFilter: 'blur(8px)',
          borderTop: '1.5px solid rgba(255, 255, 255, 0.15)',
          paddingTop: '8px',
          paddingLeft: '12px',
          paddingRight: '12px',
          paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))',
          display: 'flex',
          gap: '8px',
          justifyContent: 'space-around',
          alignItems: 'center',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.35)',
          transform: controlesVisiblesRepartidor ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 0.25s ease',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setMasRepartidorAbierto(false);
            navigate('/admin/repartos?vista=mapa');
          }}
          aria-current={enRepartosMapa ? 'page' : undefined}
          style={{
            flex: 1,
            minHeight: '52px',
            borderRadius: '12px',
            border: 'none',
            background: enRepartosMapa ? 'var(--cp-orange)' : 'rgba(255, 255, 255, 0.12)',
            color: enRepartosMapa ? 'var(--cp-navy)' : 'var(--cp-cream)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            cursor: 'pointer',
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          <span>Mapa</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMasRepartidorAbierto(false);
            navigate('/admin/repartos?vista=mios');
          }}
          aria-current={enRepartosMios ? 'page' : undefined}
          style={{
            flex: 1,
            minHeight: '52px',
            borderRadius: '12px',
            border: 'none',
            background: enRepartosMios ? 'var(--cp-orange)' : 'rgba(255, 255, 255, 0.12)',
            color: enRepartosMios ? 'var(--cp-navy)' : 'var(--cp-cream)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            cursor: 'pointer',
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="1" y="3" width="15" height="13" />
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
          <span>Mis entregas</span>
        </button>

        <button
          type="button"
          onClick={() => setMasRepartidorAbierto((v) => !v)}
          aria-expanded={masRepartidorAbierto}
          aria-label="Más opciones"
          style={{
            flex: 1,
            minHeight: '52px',
            borderRadius: '12px',
            border: 'none',
            background: masRepartidorAbierto ? 'var(--cp-orange)' : 'rgba(255, 255, 255, 0.12)',
            color: masRepartidorAbierto ? 'var(--cp-navy)' : 'var(--cp-cream)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            cursor: 'pointer',
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="12" r="2.5" />
            <circle cx="19" cy="12" r="2.5" />
            <circle cx="5" cy="12" r="2.5" />
          </svg>
          <span>Más</span>
        </button>
      </nav>
    </>
  );

  return (
    <div
      style={{
        // el mockup en celular maqueta a 476 px y reduce al 82 %
        zoom: movil ? ZOOM_CELULAR : 1,
        height: movil ? `${100 / ZOOM_CELULAR}dvh` : '100vh',
        display: 'flex',
        flexDirection: movil ? 'column' : 'row',
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--cp-cream)',
        color: 'var(--cp-navy)',
        fontSize: 14,
        lineHeight: '20px',
      }}
    >
      {/* Navegación según rol y dispositivo (Decisión 6: Repartidor en celular sin barra lateral ni cabecera grande) */}
      {esRepartidorMovil ? null : movil ? barraMovil : menuPC}

      <div style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {esRepartidorMovil ? null : barraEstado}
        <main
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: esRepartidorMovil ? 0 : movil ? 16 : 24,
            display: 'flex',
            flexDirection: 'column',
            gap: esRepartidorMovil ? 0 : 16,
          }}
        >
          {/* Mensajes: sin encabezado visible (ocupa espacio); el título queda solo para lectores de pantalla */}
          {moduloActual?.clave === 'mensajes' && (
            <h1 style={{ position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', border: 0, whiteSpace: 'nowrap' }}>
              {titulo.titulo}
            </h1>
          )}
          {!esRepartidorMovil && moduloActual?.clave !== 'mensajes' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h1 style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 26, lineHeight: '32px' }}>{titulo.titulo}</h1>
                {titulo.subtitulo && <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>{titulo.subtitulo}</div>}
              </div>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Barra inferior del repartidor en celular (Decisión 6 del dueño) */}
      {/* En /admin/repartos la pantalla del repartidor trae su propia barra (Pedidos, Mis pedidos, Más) */}
      {esRepartidorMovil && location.pathname !== '/admin/repartos' && barraInferiorRepartidor}

      <Confirmar
        abierto={confirmarSalida}
        titulo="Cerrar sesión"
        mensaje="¿Seguro que quieres cerrar tu sesión en el panel de Caprichos?"
        textoSi="Sí, cerrar sesión"
        textoNo="No, quedarme"
        cargando={saliendo}
        alConfirmar={alSalir}
        alCancelar={() => setConfirmarSalida(false)}
      />

      {/* Avisos grandes que aparecen al llegar algo nuevo, montados una vez para todo el panel */}
      <AvisosEmergentes notificaciones={resumen.notificaciones} listo={resumen.cargado} onMarcar={resumen.marcar} />

      {/* Asistente de ayuda del administrador (Capri) montado una vez para todo el panel */}
      {/* El repartidor trabaja en la calle con una barra inferior propia: no se le muestra el botón flotante */}
      {rol !== 'REPARTIDOR' && (
        <Suspense fallback={null}>
          <AyudaCapri />
        </Suspense>
      )}
    </div>
  );
}
