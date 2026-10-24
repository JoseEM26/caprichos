import { useRef, useState } from 'react';
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
const campoBloqueado: CSSProperties = { ...campo, background: 'var(--cp-sand)', color: 'var(--cp-soft)', cursor: 'not-allowed' };
const etiqueta: CSSProperties = { fontWeight: 700, display: 'block', marginBottom: 4 };
const ayuda: CSSProperties = { fontSize: 12, color: 'var(--cp-soft)', marginTop: 3 };
const botonPrincipal: CSSProperties = { minHeight: 52, border: 0, borderRadius: 12, background: 'var(--cp-orange)', color: '#fff', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 15 };
const botonSecundario: CSSProperties = { minHeight: 48, border: '1.5px solid var(--cp-navy)', borderRadius: 12, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 800 };

const hoyISO = (): string => new Date().toISOString().slice(0, 10);
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
const FOTO_MAX_BYTES = 2 * 1024 * 1024;
const TELEFONO_VALIDO = /^9\d{8}$/;
const CORREO_VALIDO = /^\S+@\S+\.\S+$/;
const MENSAJE_TELEFONO = 'El teléfono celular debe tener 9 dígitos y empezar con 9.';

/** Foto de perfil, o las iniciales en un círculo de color si el cliente no tiene foto. */
function Avatar({ nombre, fotoUrl, tamano }: { nombre: string; fotoUrl: string | null; tamano: number }) {
  const estilo: CSSProperties = { width: tamano, height: tamano, borderRadius: tamano / 2, flex: 'none', objectFit: 'cover' };
  if (fotoUrl) return <img src={fotoUrl} alt="" style={estilo} />;
  const iniciales = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <span style={{ ...estilo, background: 'var(--cp-orange)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: Math.round(tamano * 0.35) }}>
      {iniciales}
    </span>
  );
}

/** Foto de perfil opcional: subir, cambiar o quitar. Se valida en el navegador; el servidor vuelve a validar los bytes. */
function BotonesFoto() {
  const { cliente, subirFoto, quitarFoto } = useCuenta();
  const inputFoto = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  if (!cliente) return null;

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    if (!TIPOS_FOTO.includes(archivo.type)) {
      setMensaje('Solo se aceptan fotos JPEG, PNG o WebP.');
      return;
    }
    if (archivo.size > FOTO_MAX_BYTES) {
      setMensaje('La foto no puede pasar de 2 MB.');
      return;
    }
    setMensaje('');
    setSubiendo(true);
    try {
      await subirFoto(archivo);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : 'No se pudo subir la foto. Intenta de nuevo.');
    } finally {
      setSubiendo(false);
    }
  };

  const quitar = async () => {
    setConfirmarQuitar(false);
    setMensaje('');
    try {
      await quitarFoto();
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : 'No se pudo quitar la foto. Intenta de nuevo.');
    }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <input
        ref={inputFoto}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Elegir foto de perfil"
        style={{ display: 'none' }}
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = '';
          void elegir(archivo);
        }}
      />
      <button onClick={() => inputFoto.current?.click()} disabled={subiendo} style={{ ...botonSecundario, flex: '1 1 150px' }}>
        {subiendo ? 'Subiendo...' : cliente.fotoUrl ? 'Cambiar foto' : 'Subir foto'}
      </button>
      {cliente.fotoUrl && (
        <button onClick={() => setConfirmarQuitar(true)} disabled={subiendo} style={{ ...botonSecundario, flex: '1 1 150px' }}>
          Quitar foto
        </button>
      )}
      {mensaje && (
        <div role="alert" style={{ flexBasis: '100%', fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
          {mensaje}
        </div>
      )}
      <Confirmar
        abierto={confirmarQuitar}
        titulo="¿Quitar tu foto de perfil?"
        mensaje="Volverás a ver tus iniciales. Puedes subir otra cuando quieras."
        textoSi="Sí, quitar"
        alConfirmar={quitar}
        alCancelar={() => setConfirmarQuitar(false)}
      />
    </div>
  );
}

/** Ventana «Tu cuenta Caprichos»: ingresar, crear cuenta, ver mis puntos y editar mi perfil (mockup Main ▸ cuenta). */
export function PanelCuenta({ alVerPedidos }: { alVerPedidos?: () => void } = {}) {
  const { cliente, panelAbierto, cerrarPanel, ingresar, registrar, actualizarPerfil, salir } = useCuenta();
  const [pestana, setPestana] = useState<'in' | 'new'>('in');
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [correo, setCorreo] = useState('');
  const [cumple, setCumple] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  const [editando, setEditando] = useState(false);
  const [perfil, setPerfil] = useState({ nombre: '', telefono: '', correo: '', cumple: '' });
  const [mensajePerfil, setMensajePerfil] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  const [confirmarPerfil, setConfirmarPerfil] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  if (!panelAbierto) return null;

  const validar = (): string => {
    if (!/^\d{8}$/.test(dni)) return 'El DNI debe tener 8 dígitos.';
    if (pestana === 'new') {
      if (nombre.trim().length < 3) return 'Escribe tu nombre.';
      if (!TELEFONO_VALIDO.test(telefono)) return MENSAJE_TELEFONO;
      if (contrasena.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
      if (correo && !CORREO_VALIDO.test(correo)) return 'El correo no es válido.';
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
          telefono,
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

  const abrirEdicion = () => {
    setPerfil({
      nombre: cliente?.nombre ?? '',
      telefono: cliente?.telefono ?? '',
      correo: cliente?.correo ?? '',
      cumple: '',
    });
    setMensajePerfil('');
    setMensajeExito('');
    setEditando(true);
  };

  const validarPerfil = (): string => {
    if (perfil.nombre.trim().length < 3) return 'Escribe tu nombre.';
    if (!TELEFONO_VALIDO.test(perfil.telefono)) return MENSAJE_TELEFONO;
    if (perfil.correo.trim() && !CORREO_VALIDO.test(perfil.correo.trim())) return 'El correo no es válido.';
    return '';
  };

  const pedirGuardarPerfil = () => {
    const error = validarPerfil();
    setMensajePerfil(error);
    if (!error) setConfirmarPerfil(true);
  };

  const guardarPerfil = async () => {
    setConfirmarPerfil(false);
    setGuardandoPerfil(true);
    setMensajePerfil('');
    try {
      await actualizarPerfil({
        nombre: perfil.nombre.trim(),
        telefono: perfil.telefono,
        correo: perfil.correo.trim(),
        ...(perfil.cumple ? { cumpleanos: perfil.cumple } : {}),
      });
      setEditando(false);
      setMensajeExito('Tus datos se guardaron.');
    } catch (err) {
      setMensajePerfil(err instanceof Error ? err.message : 'No se pudieron guardar tus datos. Intenta de nuevo.');
    } finally {
      setGuardandoPerfil(false);
    }
  };

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
              <Avatar nombre={cliente.nombre} fotoUrl={cliente.fotoUrl} tamano={52} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{cliente.nombre}</div>
                <div style={{ fontSize: 13, color: 'var(--cp-soft)', overflowWrap: 'anywhere' }}>
                  DNI {cliente.dniMascara}
                  {cliente.correo ? ` · ${cliente.correo}` : ''}
                </div>
                {cliente.telefono && <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Celular {cliente.telefono}</div>}
              </div>
            </div>

            <BotonesFoto />

            {mensajeExito && (
              <div role="status" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-ok)', background: 'var(--cp-greenbg)', borderRadius: 12, padding: '10px 12px' }}>
                {mensajeExito}
              </div>
            )}

            {!cliente.telefono && !editando && (
              <div style={{ background: 'var(--cp-sand)', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, lineHeight: '18px' }}>Agrega tu teléfono para que no tengas que escribirlo en cada pedido.</div>
                <button onClick={abrirEdicion} style={{ ...botonSecundario, background: 'var(--cp-cream)' }}>
                  Agregar mi teléfono
                </button>
              </div>
            )}

            {editando ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 16 }}>Editar mi perfil</div>
                <div>
                  <label htmlFor="pf-n" style={etiqueta}>Nombre</label>
                  <input id="pf-n" type="text" value={perfil.nombre} onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })} style={campo} />
                </div>
                <div>
                  <label htmlFor="pf-d" style={etiqueta}>DNI</label>
                  <input id="pf-d" type="text" value={cliente.dniMascara} disabled readOnly aria-describedby="pf-d-ayuda" style={campoBloqueado} />
                  <div id="pf-d-ayuda" style={ayuda}>El DNI no se puede cambiar. Si está mal, avísanos en el local.</div>
                </div>
                <div>
                  <label htmlFor="pf-t" style={etiqueta}>Teléfono celular (9 dígitos)</label>
                  <input
                    id="pf-t"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={9}
                    value={perfil.telefono}
                    onChange={(e) => setPerfil({ ...perfil, telefono: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                    placeholder="9XXXXXXXX"
                    style={campo}
                  />
                </div>
                <div>
                  <label htmlFor="pf-e" style={etiqueta}>Correo personal (opcional)</label>
                  <input id="pf-e" type="email" value={perfil.correo} onChange={(e) => setPerfil({ ...perfil, correo: e.target.value })} placeholder="Déjalo vacío para quitarlo" style={campo} />
                </div>
                <div>
                  <label htmlFor="pf-c" style={etiqueta}>Cumpleaños</label>
                  <input id="pf-c" type="date" value={perfil.cumple} max={hoyISO()} onChange={(e) => setPerfil({ ...perfil, cumple: e.target.value })} style={campo} />
                  <div style={ayuda}>
                    {cliente.cumpleanos && cliente.cumpleanos !== '—' ? `Actual: ${cliente.cumpleanos}. ` : ''}Elige una fecha solo si quieres cambiarlo.
                  </div>
                </div>
                {mensajePerfil && (
                  <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
                    {mensajePerfil}
                  </div>
                )}
                <button onClick={pedirGuardarPerfil} disabled={guardandoPerfil} style={botonPrincipal}>
                  {guardandoPerfil ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button onClick={() => setEditando(false)} disabled={guardandoPerfil} style={botonSecundario}>
                  Cancelar
                </button>
                <Confirmar
                  abierto={confirmarPerfil}
                  titulo="¿Guardar los cambios de tu perfil?"
                  mensaje="Se actualizarán tu nombre, teléfono, correo y cumpleaños."
                  textoSi="Sí, guardar"
                  alConfirmar={guardarPerfil}
                  alCancelar={() => setConfirmarPerfil(false)}
                />
              </div>
            ) : (
              <button onClick={abrirEdicion} style={botonSecundario}>
                Editar mi perfil
              </button>
            )}

            <div style={{ background: 'var(--cp-navy)', color: 'var(--cp-cream)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--cp-orange)' }}>TUS PUNTOS</span>
              <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 34 }}>{cliente.puntos}</span>
              <span style={{ fontSize: 12, opacity: 0.85 }}>Los acumulas con cada pedido que haces con tu cuenta y los usas en tus siguientes pedidos.</span>
            </div>
            <button
              onClick={() => {
                cerrarPanel();
                alVerPedidos?.();
              }}
              style={botonSecundario}
            >
              Mis pedidos
            </button>
            <button onClick={() => setConfirmarSalida(true)} style={botonSecundario}>
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
                  <label htmlFor="ac-t" style={etiqueta}>Teléfono celular (9 dígitos)</label>
                  <input
                    id="ac-t"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={9}
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="9XXXXXXXX"
                    style={campo}
                  />
                  <div style={ayuda}>Con tu celular te reconocemos en cada pedido, sin volver a escribirlo.</div>
                </div>
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
            <button onClick={enviar} disabled={enviando} style={botonPrincipal}>
              {enviando ? 'Un momento...' : pestana === 'in' ? 'Ingresar' : 'Crear mi cuenta'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--cp-soft)', fontSize: 12 }}>
              <span style={{ flex: 1, height: 1, background: 'var(--cp-line)' }} />o<span style={{ flex: 1, height: 1, background: 'var(--cp-line)' }} />
            </div>
            <button onClick={cerrarPanel} style={botonSecundario}>
              Seguir como invitado
            </button>
          </>
        )}
      </div>
    </>
  );
}
