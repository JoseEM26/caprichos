import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { useCuenta } from './CuentaContext';

const campo: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 48,
  borderRadius: 12,
  border: '1.5px solid var(--cp-line)',
  background: 'var(--cp-cream)',
  color: 'var(--cp-navy)',
  padding: '0 12px',
  fontSize: 14,
};
const etiqueta: CSSProperties = { fontWeight: 700, display: 'block', marginBottom: 4 };
const ayuda: CSSProperties = { fontSize: 12, color: 'var(--cp-soft)', marginTop: 3 };

const hoyISO = (): string => new Date().toISOString().slice(0, 10);

/** Ventana «Tu cuenta Caprichos»: ingresar, crear cuenta o ver mis puntos (mockup Main ▸ cuenta). */
export function PanelCuenta() {
  const { cliente, panelAbierto, cerrarPanel, ingresar, registrar, salir } = useCuenta();
  const [pestana, setPestana] = useState<'in' | 'new'>('in');
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [correo, setCorreo] = useState('');
  const [cumple, setCumple] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  if (!panelAbierto) return null;

  const validar = (): string => {
    if (!/^\d{8}$/.test(dni)) return 'El DNI debe tener 8 dígitos.';
    if (pestana === 'new') {
      if (nombre.trim().length < 3) return 'Escribe tu nombre.';
      if (contrasena.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
      if (correo && !/^\S+@\S+\.\S+$/.test(correo)) return 'El correo no es válido.';
      if (!cumple) return 'El cumpleaños es obligatorio para enviarte tu cupón.';
      if (!acepta) return 'Debes aceptar el uso de tus datos para crear la cuenta.';
    } else if (!contrasena) {
      return 'Escribe tu contraseña.';
    }
    return '';
  };

  const enviar = async () => {
    const error = validar();
    if (error) {
      setMensaje(error);
      return;
    }
    setEnviando(true);
    setMensaje('');
    try {
      if (pestana === 'in') {
        await ingresar(dni, contrasena);
      } else {
        await registrar({
          dni,
          nombre: nombre.trim(),
          contrasena,
          correo: correo.trim() || undefined,
          cumpleanos: cumple,
          aceptaDatos: true,
        });
      }
      setContrasena('');
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : 'No se pudo completar. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const iniciales = cliente?.nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <>
      <div onClick={cerrarPanel} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(11,44,62,0.55)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tu cuenta"
        style={{
          position: 'fixed',
          zIndex: 105,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(440px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream)',
          color: 'var(--cp-navy)',
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 20, lineHeight: '26px' }}>
            {cliente ? `Hola, ${cliente.nombre.split(' ')[0]}` : 'Tu cuenta Caprichos'}
          </div>
          <button
            onClick={cerrarPanel}
            aria-label="Cerrar"
            style={{ flex: 'none', width: 44, height: 44, borderRadius: 22, border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontSize: 20, fontWeight: 800 }}
          >
            ×
          </button>
        </div>

        {cliente ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--cp-orange)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18 }}>
                {iniciales}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{cliente.nombre}</div>
                <div style={{ fontSize: 13, color: 'var(--cp-soft)', overflowWrap: 'anywhere' }}>
                  DNI {cliente.dniMascara}
                  {cliente.correo ? ` · ${cliente.correo}` : ''}
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--cp-navy)', color: 'var(--cp-cream)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--cp-orange)' }}>TUS PUNTOS</span>
              <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 34 }}>{cliente.puntos}</span>
              <span style={{ fontSize: 12, opacity: 0.85 }}>Los acumulas con cada pedido que haces con tu cuenta y los usas en tus siguientes pedidos.</span>
            </div>
            <button
              onClick={() => setConfirmarSalida(true)}
              style={{ minHeight: 48, border: '1.5px solid var(--cp-navy)', borderRadius: 12, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 800 }}
            >
              Cerrar sesión
            </button>
            <Confirmar
              abierto={confirmarSalida}
              titulo="¿Cerrar tu sesión?"
              mensaje="Podrás volver a ingresar con tu DNI y tu contraseña."
              textoSi="Sí, cerrar sesión"
              alConfirmar={async () => {
                setConfirmarSalida(false);
                await salir();
                cerrarPanel();
              }}
              alCancelar={() => setConfirmarSalida(false)}
            />
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--cp-soft)' }}>
              Con tu cuenta acumulas <b>puntos por lo que pagas</b> y los usas en tus siguientes pedidos. Es opcional: también puedes pedir como invitado, sin cuenta.
            </div>
            <div role="tablist" style={{ display: 'flex', gap: 6 }}>
              {(
                [
                  ['in', 'Ingresar'],
                  ['new', 'Crear cuenta'],
                ] as const
              ).map(([id, texto]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={pestana === id}
                  onClick={() => {
                    setPestana(id);
                    setMensaje('');
                  }}
                  style={{ flex: 1, minHeight: 44, borderRadius: 12, border: '1.5px solid var(--cp-navy)', background: pestana === id ? 'var(--cp-navy)' : 'transparent', color: pestana === id ? 'var(--cp-cream)' : 'var(--cp-navy)', fontWeight: 800, fontSize: 14 }}
                >
                  {texto}
                </button>
              ))}
            </div>

            {pestana === 'new' && (
              <div>
                <label htmlFor="ac-n" style={etiqueta}>Nombre</label>
                <input id="ac-n" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} style={campo} />
              </div>
            )}
            <div>
              <label htmlFor="ac-d" style={etiqueta}>DNI</label>
              <input id="ac-d" type="text" inputMode="numeric" maxLength={8} value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))} placeholder="8 dígitos" style={campo} />
            </div>
            <div>
              <label htmlFor="ac-p" style={etiqueta}>Contraseña</label>
              <input id="ac-p" type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} style={campo} />
            </div>
            {pestana === 'in' ? (
              <div style={{ fontSize: 12, lineHeight: '17px', color: 'var(--cp-soft)' }}>
                Si te registraron en el local, ingresa con tu DNI y crea tu contraseña la primera vez.
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="ac-e" style={etiqueta}>Correo personal (opcional)</label>
                  <input id="ac-e" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="Solo si quieres recibir avisos" style={campo} />
                  <div style={ayuda}>Sirve para avisos y para recuperar tu contraseña. Puedes dejarlo vacío.</div>
                </div>
                <div>
                  <label htmlFor="ac-b" style={etiqueta}>Cumpleaños (obligatorio)</label>
                  <input id="ac-b" type="date" value={cumple} max={hoyISO()} onChange={(e) => setCumple(e.target.value)} style={campo} />
                  <div style={ayuda}>Para enviarte tu cupón de cumpleaños.</div>
                </div>
                <button
                  role="checkbox"
                  aria-checked={acepta}
                  onClick={() => setAcepta((v) => !v)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left', minHeight: 48, padding: '6px 0', border: 0, background: 'transparent', color: 'var(--cp-navy)', fontSize: 13, lineHeight: '18px' }}
                >
                  <span style={{ flex: 'none', width: 24, height: 24, borderRadius: 6, border: '2px solid var(--cp-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, background: acepta ? 'var(--cp-orange)' : 'transparent', color: '#fff' }}>
                    {acepta ? '✓' : ''}
                  </span>
                  <span>
                    Acepto que Caprichos guarde mi DNI y mis datos para acumular puntos y enviarme mi cupón de cumpleaños (
                    <a href="/legal/privacidad" target="_blank" rel="noreferrer">política de privacidad</a>).
                  </span>
                </button>
              </>
            )}
            {mensaje && (
              <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
                {mensaje}
              </div>
            )}
            <button
              onClick={enviar}
              disabled={enviando}
              style={{ minHeight: 52, border: 0, borderRadius: 12, background: 'var(--cp-orange)', color: '#fff', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 15 }}
            >
              {enviando ? 'Un momento...' : pestana === 'in' ? 'Ingresar' : 'Crear mi cuenta'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--cp-soft)', fontSize: 12 }}>
              <span style={{ flex: 1, height: 1, background: 'var(--cp-line)' }} />o<span style={{ flex: 1, height: 1, background: 'var(--cp-line)' }} />
            </div>
            <button
              onClick={cerrarPanel}
              style={{ minHeight: 48, border: '1.5px solid var(--cp-navy)', borderRadius: 12, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 800 }}
            >
              Seguir como invitado
            </button>
          </>
        )}
      </div>
    </>
  );
}
