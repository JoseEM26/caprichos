import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { useCuenta } from './CuentaContext';
import { FormularioAcceso, ayuda, botonPrincipal, botonSecundario, campo, etiqueta } from './FormularioAcceso';
import { MisDirecciones } from './MisDirecciones';
import { TusPuntos } from './TusPuntos';

const campoBloqueado: CSSProperties = { ...campo, background: 'var(--cp-sand)', color: 'var(--cp-soft)', cursor: 'not-allowed' };

const hoyISO = (): string => new Date().toISOString().slice(0, 10);
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
const FOTO_MAX_BYTES = 2 * 1024 * 1024;
const CORREO_VALIDO = /^\S+@\S+\.\S+$/;

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
  const { cliente, panelAbierto, cerrarPanel, actualizarPerfil, salir } = useCuenta();
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  const [editando, setEditando] = useState(false);
  const [perfil, setPerfil] = useState({ nombre: '', correo: '', cumple: '' });
  const [mensajePerfil, setMensajePerfil] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  const [confirmarPerfil, setConfirmarPerfil] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  if (!panelAbierto) return null;

  const abrirEdicion = () => {
    setPerfil({
      nombre: cliente?.nombre ?? '',
      correo: cliente?.correo ?? '',
      cumple: '',
    });
    setMensajePerfil('');
    setMensajeExito('');
    setEditando(true);
  };

  const validarPerfil = (): string => {
    if (perfil.nombre.trim().length < 3) return 'Escribe tu nombre.';
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
                  {cliente.telefono ? `Celular ${cliente.telefono}` : ''}
                  {cliente.correo ? `${cliente.telefono ? ' · ' : ''}${cliente.correo}` : ''}
                </div>
              </div>
            </div>

            <BotonesFoto />

            {mensajeExito && (
              <div role="status" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-ok)', background: 'var(--cp-greenbg)', borderRadius: 12, padding: '10px 12px' }}>
                {mensajeExito}
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
                  <label htmlFor="pf-t" style={etiqueta}>Celular</label>
                  <input id="pf-t" type="text" value={cliente.telefono ?? ''} disabled readOnly aria-describedby="pf-t-ayuda" style={campoBloqueado} />
                  <div id="pf-t-ayuda" style={ayuda}>Para cambiar tu celular, escríbenos por WhatsApp.</div>
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
                  mensaje="Se actualizarán tu nombre, correo y cumpleaños."
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

            <TusPuntos puntos={cliente.puntos} />

            <MisDirecciones />

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
              mensaje="Podrás volver a ingresar con tu celular y tu contraseña."
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
          <FormularioAcceso alSeguirInvitado={cerrarPanel} />
        )}
      </div>
    </>
  );
}
