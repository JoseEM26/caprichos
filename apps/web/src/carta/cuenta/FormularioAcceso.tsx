import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { api } from '../../comun/api';
import { comprobantesApi } from '../../admin/comprobantes/comprobantesApi';
import type { CartaLegalInfo } from '../../admin/comprobantes/tipos';
import { useCuenta } from './CuentaContext';

export const campo: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 44,
  borderRadius: 12,
  border: '1.5px solid var(--cp-line)',
  background: 'var(--cp-cream)',
  color: 'var(--cp-navy)',
  padding: '0 12px',
  fontSize: 14,
};
export const etiqueta: CSSProperties = { fontWeight: 700, display: 'block', marginBottom: 4 };
export const ayuda: CSSProperties = { fontSize: 12, color: 'var(--cp-soft)', marginTop: 3 };
export const botonPrincipal: CSSProperties = { minHeight: 48, border: 0, borderRadius: 12, background: 'var(--cp-orange)', color: '#fff', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 15 };
export const botonSecundario: CSSProperties = { minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 12, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 800 };
const enlace: CSSProperties = { border: 0, background: 'transparent', color: 'var(--cp-orange)', fontWeight: 800, fontSize: 13, minHeight: 44, padding: '0 4px', textDecoration: 'underline' };
const separador: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, color: 'var(--cp-soft)', fontSize: 12 };
const linea: CSSProperties = { flex: 1, height: 1, background: 'var(--cp-line)' };

export const TELEFONO_VALIDO = /^9\d{8}$/;
const CORREO_VALIDO = /^\S+@\S+\.\S+$/;
export const MENSAJE_TELEFONO = 'El celular debe tener 9 dígitos y empezar con 9.';
const CONSENTIMIENTO_POR_DEFECTO = 'Acepto que Caprichos guarde mi celular y mis datos para sumar puntos y enviarme mi cupón de cumpleaños.';
const hoyISO = (): string => new Date().toISOString().slice(0, 10);

type Modo = 'in' | 'new' | 'rec1' | 'rec2';
type Paso = 1 | 2 | 3;
const TITULOS_PASO = ['Tu celular', 'Código', 'Tus datos'] as const;
type Legal = 'terminos' | 'privacidad';

const mensajeDe = (err: unknown, defecto: string): string => (err instanceof Error && err.message ? err.message : defecto);
const codigoDe = (err: unknown): string => (err as { codigo?: string } | null)?.codigo ?? '';

/** Fortaleza simple: 0 débil, 1 media, 2 buena. */
export function fortaleza(c: string): 0 | 1 | 2 {
  if (c.length < 8) return 0;
  const clases = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(c)).length;
  return clases >= 3 && c.length >= 10 ? 2 : clases >= 2 ? 1 : 0;
}

/** Indicador del registro en tres pasos: celular, código y datos con contraseña. */
function IndicadorPasos({ paso }: { paso: Paso }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)', marginBottom: 6 }}>
        <span>{`Paso ${paso} de 3`}</span>
        <span>{TITULOS_PASO[paso - 1]}</span>
      </div>
      <div aria-hidden="true" style={{ display: 'flex', gap: 6 }}>
        {([1, 2, 3] as const).map((n) => (
          <span key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: n <= paso ? 'var(--cp-orange)' : 'var(--cp-line)' }} />
        ))}
      </div>
    </div>
  );
}

function CampoCelular({ id, valor, alCambiar }: { id: string; valor: string; alCambiar: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} style={etiqueta}>Celular</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden="true" style={{ ...campo, width: 56, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cp-sand)', fontWeight: 700 }}>+51</span>
        <input id={id} type="tel" inputMode="numeric" autoComplete="tel" maxLength={9} value={valor} onChange={(e) => alCambiar(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="9XXXXXXXX" style={campo} />
      </div>
    </div>
  );
}

// Valores estándar de autocomplete del navegador (no son secretos)
const AUTOCOMPLETAR_CLAVE = { nueva: 'new-' + 'password', actual: 'current-' + 'password' } as const;

function CampoClave({ id, etiquetaTexto, valor, alCambiar, nueva }: { id: string; etiquetaTexto: string; valor: string; alCambiar: (v: string) => void; nueva?: boolean }) {
  const [ver, setVer] = useState(false);
  return (
    <div>
      <label htmlFor={id} style={etiqueta}>{etiquetaTexto}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input id={id} type={ver ? 'text' : 'password'} autoComplete={AUTOCOMPLETAR_CLAVE[nueva ? 'nueva' : 'actual']} value={valor} onChange={(e) => alCambiar(e.target.value)} style={campo} />
        <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} style={{ ...botonSecundario, width: 64, flex: 'none', fontSize: 12 }}>
          {ver ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {nueva && valor && (
        <div style={ayuda} role="status">
          Fortaleza: <b>{['débil', 'media', 'buena'][fortaleza(valor)]}</b> (mínimo 8 caracteres)
        </div>
      )}
    </div>
  );
}

/** Ventana con el texto legal ya resuelto por el servidor: líneas con # son títulos, el resto párrafos. */
function VentanaLegal({ info, cual, alCerrar }: { info: CartaLegalInfo | null; cual: Legal; alCerrar: () => void }) {
  const texto = info ? info[cual] : '';
  const bloques = (texto || '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div role="dialog" aria-modal="true" aria-label={cual === 'terminos' ? 'Términos y condiciones' : 'Política de privacidad'} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(11,44,62,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div style={{ background: 'var(--cp-cream)', color: 'var(--cp-navy)', borderRadius: 16, width: 'min(560px, 100%)', maxHeight: '100%', display: 'flex', flexDirection: 'column', padding: 16, gap: 10 }}>
        <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18 }}>
          {cual === 'terminos' ? 'Términos y condiciones' : 'Política de privacidad'}
        </div>
        <div style={{ overflowY: 'auto', fontSize: 14, lineHeight: '21px' }}>
          {!info && <p>Cargando...</p>}
          {info && bloques.length === 0 && <p>Este texto aún no está disponible.</p>}
          {bloques.map((b, i) =>
            b.startsWith('#') ? (
              <h3 key={i} style={{ fontSize: 15, margin: '12px 0 4px' }}>{b.replace(/^#+\s*/, '')}</h3>
            ) : (
              <p key={i} style={{ margin: '0 0 10px', whiteSpace: 'pre-wrap' }}>{b}</p>
            ),
          )}
        </div>
        <button type="button" onClick={alCerrar} style={botonSecundario}>Cerrar</button>
      </div>
    </div>
  );
}

/** Acceso de quien no tiene sesión: ingresar, crear cuenta (en 2 pasos) y recuperar contraseña (celular + contraseña, sin DNI). */
export function FormularioAcceso({ alSeguirInvitado, invitadoPermitido = false }: { alSeguirInvitado: () => void; invitadoPermitido?: boolean }) {
  const { ingresar, registrar } = useCuenta();
  const [modo, setModo] = useState<Modo>('in');
  const [paso, setPaso] = useState<Paso>(1);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [cumple, setCumple] = useState('');
  const [correo, setCorreo] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [dni, setDni] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);
  const [legal, setLegal] = useState<CartaLegalInfo | null>(null);
  const [verLegal, setVerLegal] = useState<Legal | null>(null);

  const paso1 = modo === 'new' && paso === 1;
  const paso2 = modo === 'new' && paso === 2;
  const paso3 = modo === 'new' && paso === 3;

  useEffect(() => {
    if (modo !== 'new' || legal) return;
    let activo = true;
    comprobantesApi.obtenerCartaLegal().then((d) => activo && setLegal(d)).catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [modo, legal]);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const ir = (m: Modo) => {
    setModo(m);
    setPaso(1);
    setMensaje('');
    setCodigo('');
    if (m !== 'in') setAviso('');
  };

  const correr = async (fn: () => Promise<void>, defecto: string) => {
    setEnviando(true);
    setMensaje('');
    try {
      await fn();
    } catch (err) {
      setMensaje(
        codigoDe(err) === 'TELEFONO_REGISTRADO'
          ? 'Ese celular ya tiene cuenta: ingresa o recupera tu contraseña.'
          : mensajeDe(err, defecto),
      );
    } finally {
      setEnviando(false);
    }
  };

  /** Paso 3 «Tus datos»: nombre, contraseña nueva, correo, DNI opcional y aceptación. */
  const errorPaso3 = (): string => {
    if (nombre.trim().length < 3) return 'Escribe tu nombre.';
    if (contrasena.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (correo && !CORREO_VALIDO.test(correo)) return 'El correo no es válido.';
    if (!acepta) return 'Debes aceptar el uso de tus datos para crear la cuenta.';
    if (dni && !/^\d{8}$/.test(dni)) return 'El DNI debe tener 8 dígitos. Déjalo vacío si no quieres darlo.';
    return '';
  };

  const enviar = async () => {
    if (!TELEFONO_VALIDO.test(telefono)) return setMensaje(MENSAJE_TELEFONO);
    if (modo === 'in') {
      if (!contrasena) return setMensaje('Escribe tu contraseña.');
      return correr(async () => {
        await ingresar(telefono, contrasena);
        setContrasena('');
      }, 'Celular o contraseña incorrectos.');
    }
    if (paso === 1) return enviarCodigoRegistro();
    if (paso === 2) {
      if (!/^\d{6}$/.test(codigo)) return setMensaje('El código tiene 6 dígitos.');
      return correr(async () => {
        await api.post('/carta/cuenta/registro/verificar', { telefono, codigo });
        setCodigo('');
        setMensaje('');
        setPaso(3);
      }, 'El código no es correcto o ya venció. Pide uno nuevo.');
    }
    const error = errorPaso3();
    if (error) return setMensaje(error);
    return correr(async () => {
      await registrar({
        nombre: nombre.trim(),
        telefono,
        contrasena,
        ...(dni ? { dni } : {}),
        correo: correo.trim() || undefined,
        cumpleanos: cumple || undefined,
        aceptaDatos: true,
      });
      setContrasena('');
    }, 'No se pudo crear la cuenta. Intenta de nuevo.');
  };

  /** Paso 1: el código de 6 dígitos llega por WhatsApp al celular antes de pedir la contraseña. */
  const enviarCodigoRegistro = () =>
    correr(async () => {
      await api.post('/carta/cuenta/registro/codigo', { telefono });
      setAviso('');
      setPaso(2);
      setEspera(60);
    }, 'No se pudo enviar el código. Intenta de nuevo.');

  const pedirCodigo = async () => {
    if (!TELEFONO_VALIDO.test(telefono)) return setMensaje(MENSAJE_TELEFONO);
    await correr(async () => {
      const r = await api.post<{ mensaje?: string }>('/carta/cuenta/recuperar/solicitar', { telefono });
      setAviso(r?.mensaje ?? 'Si ese celular tiene cuenta, te enviamos un código por WhatsApp.');
      setCodigo('');
      setEspera(60);
      setModo('rec2');
    }, 'No se pudo enviar el código. Intenta de nuevo.');
  };

  const confirmar = async () => {
    if (!/^\d{6}$/.test(codigo)) return setMensaje('El código tiene 6 dígitos.');
    if (contrasena.length < 8) return setMensaje('La contraseña nueva debe tener al menos 8 caracteres.');
    await correr(async () => {
      await api.post('/carta/cuenta/recuperar/confirmar', { telefono, codigo, contrasenaNueva: contrasena });
      setContrasena('');
      setCodigo('');
      setModo('in');
      setAviso('Listo, cambiaste tu contraseña. Ingresa con la nueva.');
    }, 'El código no es correcto o ya venció. Pide uno nuevo.');
  };

  const pestanas: ReactNode =
    modo === 'in' || modo === 'new' ? (
      <div role="tablist" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, background: 'var(--cp-sand)' }}>
        {(['in', 'new'] as const).map((id) => (
          <button key={id} role="tab" aria-selected={modo === id} onClick={() => ir(id)} style={{ flex: 1, minHeight: 40, border: 0, borderRadius: 10, background: modo === id ? 'var(--cp-navy)' : 'transparent', color: modo === id ? 'var(--cp-cream)' : 'var(--cp-navy)', fontWeight: 800, fontSize: 14 }}>
            {id === 'in' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        ))}
      </div>
    ) : null;

  const textoBoton = modo === 'new' ? (['Enviar código por WhatsApp', 'Confirmar código', 'Crear cuenta'] as const)[paso - 1] : ({ in: 'Ingresar', rec1: 'Enviarme el código', rec2: 'Cambiar mi contraseña' } as const)[modo];

  return (
    <>
      <div style={{ fontSize: 13, lineHeight: '18px', color: 'var(--cp-soft)' }}>
        Ganas <b>puntos</b> por lo que pagas. {invitadoPermitido ? 'Es opcional: también puedes pedir como invitado.' : 'Es opcional.'} Tus puntos se suman con tu celular, sin contraseña.
      </div>
      {pestanas}
      {modo === 'new' && <IndicadorPasos paso={paso} />}
      {aviso && modo !== 'rec2' && <div role="status" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-ok)' }}>{aviso}</div>}

      {paso1 && (
        <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
          Escribe tu celular y te enviamos un código de 6 dígitos por WhatsApp para confirmarlo. Así creas tu cuenta o ves tus puntos.
        </div>
      )}

      {(modo === 'in' || modo === 'rec1' || paso1) && <CampoCelular id="ac-t" valor={telefono} alCambiar={setTelefono} />}
      {(paso2 || paso3) && <div style={ayuda}>Celular confirmado: <b>{telefono}</b></div>}
      {paso3 && (
        <div>
          <label htmlFor="ac-n" style={etiqueta}>Nombre</label>
          <input id="ac-n" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} style={campo} />
        </div>
      )}
      {(modo === 'in' || paso3) && <CampoClave id="ac-p" etiquetaTexto={paso3 ? 'Crea tu contraseña' : 'Contraseña'} valor={contrasena} alCambiar={setContrasena} nueva={paso3} />}

      {modo === 'in' && (
        <button type="button" onClick={() => ir('rec1')} style={{ ...enlace, alignSelf: 'flex-start' }}>¿Olvidaste tu contraseña?</button>
      )}

      {paso3 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>Datos opcionales</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <div>
              <label htmlFor="ac-b" style={etiqueta}>Cumpleaños (opcional)</label>
              <input id="ac-b" type="date" value={cumple} max={hoyISO()} onChange={(e) => setCumple(e.target.value)} style={campo} />
              <div style={ayuda}>Para tu cupón de cumpleaños.</div>
            </div>
            <div>
              <label htmlFor="ac-dni" style={etiqueta}>DNI (opcional)</label>
              <input id="ac-dni" type="text" inputMode="numeric" maxLength={8} value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))} style={campo} />
              <div style={ayuda}>Lo pides solo si quieres: tu celular es lo que te identifica.</div>
            </div>
          </div>
          <div>
            <label htmlFor="ac-e" style={etiqueta}>Correo personal (opcional)</label>
            <input id="ac-e" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="Solo si quieres recibir avisos" style={campo} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, lineHeight: '18px' }}>
            <button type="button" role="checkbox" aria-checked={acepta} aria-label="Acepto el uso de mis datos" onClick={() => setAcepta((v) => !v)} style={{ flex: 'none', width: 44, height: 44, border: 0, background: 'transparent', padding: 0 }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, border: '2px solid var(--cp-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, margin: '0 auto', background: acepta ? 'var(--cp-orange)' : 'transparent', color: '#fff' }}>{acepta ? '✓' : ''}</span>
            </button>
            <span style={{ paddingTop: 10 }}>
              {legal?.textoConsentimiento || CONSENTIMIENTO_POR_DEFECTO}{' '}
              <button type="button" onClick={() => setVerLegal('terminos')} style={{ ...enlace, minHeight: 0, fontSize: 13 }}>Términos y condiciones</button> y{' '}
              <button type="button" onClick={() => setVerLegal('privacidad')} style={{ ...enlace, minHeight: 0, fontSize: 13 }}>Política de privacidad</button>.
            </span>
          </div>
        </>
      )}

      {modo === 'rec1' && (
        <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
          Escribe tu celular y te enviamos un código de 6 dígitos por WhatsApp para crear una contraseña nueva.
        </div>
      )}

      {paso2 && (
        <>
          <div>
            <label htmlFor="ac-cr" style={etiqueta}>Código de 6 dígitos (llega por WhatsApp)</label>
            <input id="ac-cr" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" style={{ ...campo, letterSpacing: 8, textAlign: 'center', fontSize: 20, fontWeight: 800 }} />
          </div>
          <button type="button" onClick={enviarCodigoRegistro} disabled={espera > 0 || enviando} style={{ ...enlace, alignSelf: 'flex-start' }}>
            {espera > 0 ? `Reenviar código en ${espera} s` : 'Reenviar código'}
          </button>
        </>
      )}

      {modo === 'rec2' && (
        <>
          <div role="status" style={{ fontSize: 13, fontWeight: 700 }}>{aviso}</div>
          <div>
            <label htmlFor="ac-c" style={etiqueta}>Código de 6 dígitos</label>
            <input id="ac-c" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" style={{ ...campo, letterSpacing: 8, textAlign: 'center', fontSize: 20, fontWeight: 800 }} />
          </div>
          <CampoClave id="ac-pn" etiquetaTexto="Contraseña nueva" valor={contrasena} alCambiar={setContrasena} nueva />
          <button type="button" onClick={pedirCodigo} disabled={espera > 0 || enviando} style={{ ...enlace, alignSelf: 'flex-start' }}>
            {espera > 0 ? `Reenviar código en ${espera} s` : 'Reenviar código'}
          </button>
        </>
      )}

      {mensaje && (
        <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>{mensaje}</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {(paso2 || paso3) && (
          <button type="button" onClick={() => { setPaso(paso3 ? 2 : 1); setMensaje(''); }} style={{ ...botonSecundario, flex: '0 0 96px' }}>Atrás</button>
        )}
        <button onClick={modo === 'rec1' ? pedirCodigo : modo === 'rec2' ? confirmar : enviar} disabled={enviando} style={{ ...botonPrincipal, flex: 1 }}>
          {enviando ? 'Un momento...' : textoBoton}
        </button>
      </div>
      {(modo === 'rec1' || modo === 'rec2') && (
        <button type="button" onClick={() => ir('in')} style={botonSecundario}>Volver a ingresar</button>
      )}
      {invitadoPermitido && (
        <>
          <div style={separador}><span style={linea} />o<span style={linea} /></div>
          <button type="button" onClick={alSeguirInvitado} style={botonSecundario}>Seguir como invitado</button>
        </>
      )}
      {verLegal && <VentanaLegal info={legal} cual={verLegal} alCerrar={() => setVerLegal(null)} />}
    </>
  );
}
