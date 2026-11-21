import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useCarrito } from './CarritoContext';
import { useCuenta } from './cuenta/CuentaContext';
import { useEsMovil } from './useEsMovil';
import { usePedidosGuardados } from './seguimiento';
import { RetratoAvatar } from '../avatar/RetratoAvatar';
import { fotoDelCliente } from '../avatar/fotoCliente';
import { AvatarEditorPerezoso } from '../avatar/AvatarEditorPerezoso';
import { BotonInstalarApp } from '../pwa/BotonInstalarApp';
import { BotonReservar } from './reservas/BotonReservar';
import { estiloItemMenu } from './menuItemEstilo';

const TACTIL = 44;
const CLAVE_MENU_VISTO = 'caprichos_menu_opciones_visto';
const CLAVE_AVATAR_VISTO = 'caprichos_avatar_nuevo_visto';

const leer = (clave: string): boolean => {
  try {
    return window.localStorage.getItem(clave) === '1';
  } catch {
    return false;
  }
};
const guardar = (clave: string): void => {
  try {
    window.localStorage.setItem(clave, '1');
  } catch {
    // sin almacenamiento: el aviso vuelve a salir, sin romper nada
  }
};

const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Icono({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...trazo} aria-hidden="true" style={{ flex: 'none' }}>
      {children}
    </svg>
  );
}

interface Props {
  mostrarInstalar: boolean;
  mostrarReservar: boolean;
}

/**
 * Botón «Opciones» (⋯) de la cabecera: reúne Mi cuenta, Mi avatar, Mis pedidos, Reservas e Instalar app para que la
 * cabecera quede en una sola línea. Las opciones quedan montadas (ocultas) mientras el menú está cerrado, porque
 * «Reservar» e «Instalar» llevan su propia ventana y su propia consulta.
 */
export function MenuOpciones({ mostrarInstalar, mostrarReservar }: Props) {
  const { setListaPedidosAbierta } = useCarrito();
  const { cliente, abrirPanel, cargarAvatar, guardarAvatar } = useCuenta();
  // Misma regla de foto que la cuenta: avatar si lo eligió o si no tiene foto
  const foto = fotoDelCliente(cliente);
  const movil = useEsMovil();
  const guardados = usePedidosGuardados();
  const activos = guardados.filter((p) => !p.terminado).length;
  const etiquetaPedidos = guardados.length === 1 && !cliente ? 'Mi pedido' : 'Mis pedidos';
  const mostrarPedidos = guardados.length > 0 || cliente !== null;
  const puntosTexto = (Number(cliente?.puntos) || 0).toFixed(2);

  const [abierto, setAbierto] = useState(false);
  const [menuVisto, setMenuVisto] = useState(() => leer(CLAVE_MENU_VISTO));
  const [avatarVisto, setAvatarVisto] = useState(() => leer(CLAVE_AVATAR_VISTO));
  const [globo, setGlobo] = useState(true);
  const [editor, setEditor] = useState<{ inicial: unknown | null } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorAvatar, setErrorAvatar] = useState('');
  const raiz = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  // el globito se retira solo a los 8 s (no cuenta como visto: vuelve la próxima vez)
  useEffect(() => {
    const t = window.setTimeout(() => setGlobo(false), 8000);
    return () => window.clearTimeout(t);
  }, []);

  const items = () => Array.from(lista.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  const cerrar = (devolverFoco: boolean) => {
    setAbierto(false);
    if (devolverFoco) disparador.current?.focus();
  };

  const alternar = () => {
    if (abierto) return cerrar(false);
    setAbierto(true);
    setMenuVisto(true);
    guardar(CLAVE_MENU_VISTO);
  };

  // al abrir: foco en la primera opción; clic fuera cierra
  useEffect(() => {
    if (!abierto) return;
    items()[0]?.focus();
    const fuera = (e: MouseEvent | TouchEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('touchstart', fuera);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('touchstart', fuera);
    };
  }, [abierto]);

  const alTeclear = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      return cerrar(true);
    }
    if (e.key === 'Tab') return setAbierto(false);
    const todos = items();
    const i = todos.indexOf(document.activeElement as HTMLElement);
    const ir = (n: number) => {
      e.preventDefault();
      todos[(n + todos.length) % todos.length]?.focus();
    };
    if (e.key === 'ArrowDown') ir(i + 1);
    else if (e.key === 'ArrowUp') ir(i < 0 ? -1 : i - 1);
    else if (e.key === 'Home') ir(0);
    else if (e.key === 'End') ir(-1);
  };

  // cada opción cierra el menú y hace lo mismo que hacía su botón en la cabecera
  const elegir = (accion: () => void) => () => {
    setAbierto(false);
    accion();
  };

  const abrirAvatar = async () => {
    setAvatarVisto(true);
    guardar(CLAVE_AVATAR_VISTO);
    // sin sesión: primero ingresar o crear la cuenta
    if (!cliente || !guardarAvatar) return abrirPanel();
    setCargando(true);
    setErrorAvatar('');
    try {
      setEditor({ inicial: cliente.avatarUrl && cargarAvatar ? await cargarAvatar() : null });
    } catch {
      setErrorAvatar('No pudimos abrir tu avatar. Inténtalo otra vez.');
    } finally {
      setCargando(false);
    }
  };

  // el puntito y el globo se quitan al abrir el menú o «Mi avatar»; la etiqueta «Nuevo» de la opción, solo al abrir «Mi avatar»
  const hayNuevo = !menuVisto && !avatarVisto;

  return (
    <div ref={raiz} style={{ position: 'relative', flex: 'none' }}>
      <style>{`
        @keyframes cp-brillo { 0%,100% { box-shadow: 0 0 0 0 rgba(217,158,57,.7) } 50% { box-shadow: 0 0 0 7px rgba(217,158,57,0) } }
        @media (prefers-reduced-motion: no-preference) { .cp-menu-nuevo { animation: cp-brillo 2s ease-in-out infinite } }
        .cp-menu-item:hover, .cp-menu-item:focus-visible { background: rgba(230,121,41,.14) !important; outline: none }
        .cp-menu-item:focus-visible { box-shadow: inset 0 0 0 2px var(--cp-orange) }
      `}</style>

      <button
        ref={disparador}
        type="button"
        onClick={alternar}
        aria-label="Opciones"
        title="Opciones"
        aria-haspopup="menu"
        aria-expanded={abierto}
        className={hayNuevo ? 'cp-menu-nuevo' : undefined}
        style={{
          position: 'relative',
          flex: 'none',
          width: TACTIL,
          height: TACTIL,
          minHeight: TACTIL,
          padding: 0,
          boxSizing: 'border-box',
          borderRadius: 12,
          border: `1.5px solid ${hayNuevo ? 'var(--cp-gold)' : 'var(--cp-navy)'}`,
          background: abierto ? 'rgba(11,44,62,0.08)' : 'transparent',
          color: 'var(--cp-navy)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
        {hayNuevo && (
          <span data-testid="punto-nuevo" aria-hidden="true" style={{ position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: 6, background: 'var(--cp-gold)', border: '2px solid var(--cp-cream)', boxSizing: 'border-box' }} />
        )}
      </button>

      {hayNuevo && globo && !abierto && (
        <div
          role="status"
          style={{ position: 'absolute', top: TACTIL + 8, right: 0, zIndex: 2, whiteSpace: 'nowrap', background: 'var(--cp-navy)', color: 'var(--cp-cream)', borderRadius: 10, padding: '6px 10px', fontSize: 12, fontWeight: 700, boxShadow: '0 4px 14px rgba(11,44,62,.25)', pointerEvents: 'none' }}
        >
          ✨ ¡Nuevo: crea tu avatar!
        </div>
      )}

      {abierto && <div aria-hidden="true" onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 40, background: movil ? 'rgba(11,44,62,0.45)' : 'transparent' }} />}

      <div
        ref={lista}
        role="menu"
        aria-label="Opciones"
        hidden={!abierto}
        onKeyDown={alTeclear}
        style={{
          ...(movil
            ? { position: 'fixed', left: 0, right: 0, bottom: 0, borderRadius: '18px 18px 0 0', maxHeight: '80dvh', paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }
            : { position: 'absolute', top: TACTIL + 8, right: 0, width: 300, borderRadius: 16, maxHeight: 'calc(100dvh - 100px)' }),
          zIndex: 41,
          boxSizing: 'border-box',
          overflowY: 'auto',
          padding: 10,
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          boxShadow: '0 12px 36px rgba(11,44,62,0.22)',
          display: abierto ? 'flex' : 'none',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <button type="button" role="menuitem" className="cp-menu-item" onClick={elegir(abrirPanel)} style={estiloItemMenu}>
          {foto?.esAvatar ? (
            <RetratoAvatar url={foto.url} tamano={22} />
          ) : foto ? (
            <img src={foto.url} alt="" width={22} height={22} style={{ width: 22, height: 22, borderRadius: 11, objectFit: 'cover', flex: 'none' }} />
          ) : (
            <Icono>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
            </Icono>
          )}
          <span style={{ flex: 1 }}>{cliente ? 'Mi cuenta' : 'Ingresar o crear cuenta'}</span>
          {cliente && <span style={{ background: 'rgba(230,121,41,0.25)', borderRadius: 9999, padding: '2px 10px', fontSize: 13 }}>{puntosTexto} pts</span>}
        </button>

        <button
          type="button"
          role="menuitem"
          className="cp-menu-item"
          onClick={elegir(() => void abrirAvatar())}
          disabled={cargando}
          style={{ ...estiloItemMenu, background: 'linear-gradient(90deg, rgba(217,158,57,0.30), rgba(230,121,41,0.18))', boxShadow: 'inset 0 0 0 1.5px var(--cp-gold)' }}
        >
          <Icono>
            <circle cx="12" cy="9" r="4" />
            <path d="M5 21c.8-4 3.5-6 7-6s6.2 2 7 6" />
            <path d="M19 2v4M17 4h4" />
          </Icono>
          <span style={{ flex: 1 }}>{cargando ? 'Abriendo…' : 'Mi avatar'}</span>
          {!avatarVisto && (
            <span style={{ background: 'var(--cp-orange)', color: '#fff', borderRadius: 9999, padding: '2px 10px', fontSize: 12 }}>Nuevo ✨</span>
          )}
        </button>

        {mostrarPedidos && (
          <button type="button" role="menuitem" className="cp-menu-item" onClick={elegir(() => setListaPedidosAbierta(true))} style={estiloItemMenu}>
            <Icono>
              <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
              <path d="M9 8h6M9 12h6" />
            </Icono>
            <span style={{ flex: 1 }}>{etiquetaPedidos}</span>
            {activos > 0 && (
              <span aria-label={`${activos} ${activos === 1 ? 'pedido activo' : 'pedidos activos'}`} style={{ minWidth: 20, height: 20, padding: '0 6px', boxSizing: 'border-box', borderRadius: 10, background: 'var(--cp-orange)', color: '#fff', fontSize: 12, lineHeight: '20px', textAlign: 'center' }}>
                {activos}
              </span>
            )}
          </button>
        )}

        {mostrarReservar && <BotonReservar comoItem alAbrir={() => setAbierto(false)} />}
        {mostrarInstalar && <BotonInstalarApp comoItem alAbrir={() => setAbierto(false)} />}
      </div>

      {errorAvatar && (
        <div role="alert" style={{ position: 'absolute', top: TACTIL + 8, right: 0, zIndex: 2, background: 'var(--cp-white)', color: 'var(--cp-rust)', border: '1px solid var(--cp-line)', borderRadius: 10, padding: '6px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {errorAvatar}
        </div>
      )}
      {editor && cliente && guardarAvatar && (
        <AvatarEditorPerezoso inicial={editor.inicial} nombreCuenta={cliente.nombre} guardar={guardarAvatar} cerrar={() => setEditor(null)} />
      )}
    </div>
  );
}
