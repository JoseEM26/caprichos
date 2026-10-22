import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../comun/sesion';
import { Confirmar } from '../comun/Confirmar';
import { Icono } from '../comun/Icono';
import { useEsMovil } from '../carta/useEsMovil';
import { GRUPOS_MODULOS, MODULOS } from './modulos';
import { TITULOS_VISTA } from './titulos';
import { useNotificaciones } from './useNotificaciones';
import type { NotificacionAdmin } from './useNotificaciones';

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
};
const COLOR_PRIORIDAD: Record<NotificacionAdmin['prioridad'], string> = { ALTA: '#C73E2A', MEDIA: '#E2812C', BAJA: '#8FA9B8' };
const TEXTO_PRIORIDAD: Record<NotificacionAdmin['prioridad'], string> = { ALTA: 'Urgente', MEDIA: 'Pendiente', BAJA: 'Cuando puedas' };

const leerContraido = (): boolean => {
  try {
    return window.localStorage.getItem(CLAVE_MENU) === '1';
  } catch {
    return false;
  }
};

const esperaTexto = (desde: string | null): string => {
  if (!desde) return '';
  const min = Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 60000));
  if (min < 60) return `espera ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `espera ${h} h ${min % 60} min` : `espera ${Math.floor(h / 24)} d`;
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
  const [campanaAbierta, setCampanaAbierta] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [ahora, setAhora] = useState(() => new Date());
  const [enLinea, setEnLinea] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30000);
    const alIr = () => setEnLinea(true);
    const alCaer = () => setEnLinea(false);
    window.addEventListener('online', alIr);
    window.addEventListener('offline', alCaer);
    return () => {
      clearInterval(t);
      window.removeEventListener('online', alIr);
      window.removeEventListener('offline', alCaer);
    };
  }, []);

  useEffect(() => {
    setMenuMovil(false);
    setCampanaAbierta(false);
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
    clave === 'notificaciones' ? resumen.notificaciones.length : (resumen.conteos[clave] ?? 0);

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

  const prioritaria = resumen.notificaciones[0];
  const totalNotif = resumen.notificaciones.length;

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
          <span style={{ minWidth: 22, textAlign: 'center', borderRadius: 11, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontSize: 12, padding: '1px 6px' }}>
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

  const avatar = (tam: number) => (
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
                        <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '2px solid var(--cp-navy)', boxSizing: 'content-box' }}>
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
        title={enLinea ? 'Conectado al servidor' : 'Sin conexión con el servidor'}
        style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${enLinea ? '#9BD3AB' : '#E9A79B'}`, background: enLinea ? '#E6F5EA' : '#FDECE8', borderRadius: 9999, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: 'var(--cp-navy)' }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 4, background: enLinea ? 'var(--cp-ok)' : '#C73E2A' }} />
        {enLinea ? 'En línea' : 'Sin internet'}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-soft)', fontVariantNumeric: 'tabular-nums' }}>{horaLima(ahora)}</span>
      <button
        type="button"
        onClick={() => setCampanaAbierta((v) => !v)}
        aria-label={`Notificaciones: ${totalNotif}`}
        aria-expanded={campanaAbierta}
        style={{ position: 'relative', flex: 'none', width: 44, height: 44, padding: 0, border: '1.5px solid var(--cp-navy)', borderRadius: 22, background: 'var(--cp-white)', color: 'var(--cp-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Icono nombre="notificaciones" tamano={22} />
        {totalNotif > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, boxSizing: 'border-box', borderRadius: 10, background: COLOR_PRIORIDAD[prioritaria.prioridad], color: 'var(--cp-white)', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            {totalNotif}
          </span>
        )}
      </button>
      {campanaAbierta && (
        <>
          <div onClick={() => setCampanaAbierta(false)} style={{ position: 'fixed', inset: 0, zIndex: 36 }} />
          <div
            role="dialog"
            aria-label="Notificaciones"
            style={{ position: 'absolute', zIndex: 37, top: 'calc(100% + 6px)', right: 12, width: 'min(400px, calc(100% - 24px))', maxHeight: 'min(70vh, 520px)', overflowY: 'auto', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 16, boxShadow: '0 16px 40px rgba(11,44,62,0.28)', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--cp-sand)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 16 }}>Notificaciones</span>
              <span style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Primero lo más urgente; lo que lleva más tiempo esperando sube.</span>
            </div>
            {totalNotif === 0 && <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 14, color: 'var(--cp-soft)' }}>Todo al día. No hay nada pendiente.</div>}
            {resumen.notificaciones.map((n) => (
              <div key={n.id} style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--cp-sand)' }}>
                <span style={{ flex: 'none', width: 6, borderRadius: 3, background: COLOR_PRIORIDAD[n.prioridad] }} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, lineHeight: '19px', overflowWrap: 'anywhere' }}>{n.titulo}</span>
                    <span style={{ flex: 'none', fontSize: 12, fontWeight: 800, color: 'var(--cp-white)', background: COLOR_PRIORIDAD[n.prioridad], borderRadius: 9999, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                      {TEXTO_PRIORIDAD[n.prioridad]}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: '18px', color: 'var(--cp-soft)' }}>{n.detalle}</div>
                  {n.desde && <div style={{ fontSize: 12, color: 'var(--cp-soft)', fontVariantNumeric: 'tabular-nums' }}>{esperaTexto(n.desde)}</div>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const m = MODULOS.find((x) => x.clave === n.modulo);
                        if (m) ir(m.ruta);
                        setCampanaAbierta(false);
                      }}
                      style={{ minHeight: 44, padding: '0 14px', border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 13 }}
                    >
                      {n.accion}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setCampanaAbierta(false);
                navigate('/admin/notificaciones');
              }}
              style={{ minHeight: 48, border: 0, background: 'var(--cp-cream)', color: 'var(--cp-navy)', fontWeight: 700, borderRadius: '0 0 16px 16px' }}
            >
              Ver todas las notificaciones
            </button>
          </div>
        </>
      )}
    </div>
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
      {movil ? barraMovil : menuPC}

      <div style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {barraEstado}
        <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: movil ? 16 : 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 26, lineHeight: '32px' }}>{titulo.titulo}</h1>
              {titulo.subtitulo && <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>{titulo.subtitulo}</div>}
            </div>
          </div>
          <Outlet />
        </main>
      </div>

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
    </div>
  );
}
