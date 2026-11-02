import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSesion } from '../comun/sesion';
import { ErrorApi } from '../comun/api';
import {
  FRASE_INGRESO_DEFECTO,
  IMAGEN_INGRESO_DEFECTO,
  pantallaIngresoApi,
} from './configuracion/pantallaIngresoApi';

const CONSULTA_PANTALLA_ANCHA = '(min-width: 900px)';
const CONSULTA_MOVIMIENTO_REDUCIDO = '(prefers-reduced-motion: reduce)';
const SEGUNDOS_ENTRE_IMAGENES = 6;

function consultaCoincide(consulta: string): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(consulta).matches
  );
}

/** PC (>= 900 px): pantalla dividida. Celular: imagen arriba y formulario debajo. */
function useEsPantallaAncha(): boolean {
  const [ancha, setAncha] = useState<boolean>(() => consultaCoincide(CONSULTA_PANTALLA_ANCHA));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(CONSULTA_PANTALLA_ANCHA);
    const alCambiar = () => setAncha(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);
  return ancha;
}

/** Imagen y frase de la pantalla. Si la consulta falla, quedan los valores por defecto. */
function useContenidoIngreso(): { imagenes: string[]; frase: string } {
  const [contenido, setContenido] = useState<{ imagenes: string[]; frase: string }>({
    imagenes: [IMAGEN_INGRESO_DEFECTO],
    frase: FRASE_INGRESO_DEFECTO,
  });
  useEffect(() => {
    let vigente = true;
    pantallaIngresoApi
      .obtenerPublica()
      .then((respuesta) => {
        if (!vigente || !respuesta || !Array.isArray(respuesta.imagenes)) return;
        if (respuesta.imagenes.length === 0) return;
        setContenido({
          imagenes: respuesta.imagenes,
          frase: respuesta.frase?.trim() || FRASE_INGRESO_DEFECTO,
        });
      })
      .catch(() => {
        // Sin conexión o error del servidor: se mantiene la imagen por defecto.
      });
    return () => {
      vigente = false;
    };
  }, []);
  return contenido;
}

interface CarruselIngresoProps {
  imagenes: string[];
  frase: string;
  estilo: React.CSSProperties;
}

/** Imágenes apiladas con fundido; rota cada 6 s salvo que el usuario pida movimiento reducido. */
function CarruselIngreso({ imagenes, frase, estilo }: CarruselIngresoProps) {
  const [indice, setIndice] = useState(0);
  const movimientoReducido = consultaCoincide(CONSULTA_MOVIMIENTO_REDUCIDO);
  const rotar = imagenes.length > 1 && !movimientoReducido;

  useEffect(() => {
    if (!rotar) return;
    const id = window.setInterval(
      () => setIndice((actual) => (actual + 1) % imagenes.length),
      SEGUNDOS_ENTRE_IMAGENES * 1000,
    );
    return () => window.clearInterval(id);
  }, [rotar, imagenes.length]);

  const activa = indice % imagenes.length;

  return (
    <div
      data-testid="imagen-ingreso"
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--cp-navy)',
        ...estilo,
      }}
    >
      {imagenes.map((src, i) => (
        <img
          key={`${i}-${src}`}
          src={src}
          alt=""
          aria-hidden="true"
          loading={i === 0 ? 'eager' : 'lazy'}
          data-activa={i === activa ? 'true' : 'false'}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 15%',
            opacity: i === activa ? 1 : 0,
            transition: movimientoReducido ? 'none' : 'opacity 900ms ease-in-out',
          }}
        />
      ))}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(11, 44, 62, 0.45), rgba(11, 44, 62, 0) 50%)',
        }}
      />
      <p
        data-testid="frase-ingreso"
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          margin: 0,
          padding: '28px',
          maxWidth: '80%',
          boxSizing: 'border-box',
          color: '#FFFFFF',
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 800,
          fontSize: 'clamp(20px, 2.6vw, 30px)',
          lineHeight: 1.2,
          textShadow: '0 2px 12px rgba(0, 0, 0, 0.35)',
        }}
      >
        {frase}
      </p>
    </div>
  );
}

export function Ingresar() {
  const { ingresar, usuario, debeCambiar, cargando: sesionCargando } = useSesion();
  const navigate = useNavigate();
  const location = useLocation();
  const avisoSalida = (location.state as { aviso?: string } | null)?.aviso;
  const pantallaAncha = useEsPantallaAncha();
  const contenidoIngreso = useContenidoIngreso();

  const [usuarioTexto, setUsuarioTexto] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errorTexto, setErrorTexto] = useState('');
  const [errorApi, setErrorApi] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!sesionCargando && usuario) {
      if (debeCambiar) {
        navigate('/admin/cambiar-clave', { replace: true });
      } else {
        const destino = (location.state as any)?.desde || '/admin';
        navigate(destino, { replace: true });
      }
    }
  }, [sesionCargando, usuario, debeCambiar, navigate, location.state]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorTexto('');
    setErrorApi('');

    // Entra con su documento: DNI (8 dígitos) o CE, cédula y pasaporte (de 7 a 12 letras o números)
    const limpio = usuarioTexto.trim();
    if (!limpio) {
      setErrorTexto('Escribe tu documento.');
      return;
    }

    if (/^\d+$/.test(limpio) && limpio.length < 7) {
      setErrorTexto('El DNI debe tener 8 dígitos numéricos.');
      return;
    }

    if (!/^[A-Za-z0-9]{7,12}$/.test(limpio)) {
      setErrorTexto('El documento debe tener de 7 a 12 letras o números.');
      return;
    }

    if (!contrasena) {
      setErrorTexto('Ingresa tu contraseña.');
      return;
    }

    setCargando(true);
    try {
      try {
        sessionStorage.setItem('caprichos_temp_clave', contrasena);
      } catch { /* sessionStorage puede no estar disponible (modo privado): se ignora */ }
      const resultado = await ingresar(limpio, contrasena);
      if (resultado.debeCambiar) {
        navigate('/admin/cambiar-clave', { replace: true });
      } else {
        const destino = (location.state as any)?.desde || '/admin';
        navigate(destino, { replace: true });
      }
    } catch (err: any) {
      if (err instanceof ErrorApi) {
        if (err.codigo === 'CREDENCIALES_INVALIDAS') {
          setErrorApi(err.message || 'Credenciales inválidas. Verifica tu usuario y contraseña.');
        } else if (err.codigo === 'USUARIO_DESACTIVADO') {
          setErrorApi(err.message || 'El usuario se encuentra desactivado. Consulta con administración.');
        } else if (err.codigo === 'CUENTA_BLOQUEADA') {
          setErrorApi(err.message || 'Cuenta bloqueada temporalmente tras 5 intentos fallidos.');
        } else {
          setErrorApi(err.message || 'Error al iniciar sesión.');
        }
      } else {
        setErrorApi(err?.message || 'Error de conexión con el servidor.');
      }
    } finally {
      setCargando(false);
    }
  };

  const tarjeta = (
    <div
      style={{
        width: '100%',
        maxWidth: pantallaAncha ? '520px' : '420px',
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: '20px',
        boxShadow: '0 10px 30px rgba(11, 44, 62, 0.18)',
        padding: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          textAlign: 'center',
        }}
      >
        <img
          src="/logo.webp"
          alt="Caprichos"
          style={{ width: '72px', height: '72px', borderRadius: '36px', objectFit: 'cover' }}
        />
        <div
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '22px',
            lineHeight: '28px',
            color: 'var(--cp-navy)',
          }}
        >
          CAPRICHOS
        </div>
        <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
          Panel del local · Inicia sesión
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div
          style={{
            flex: '1 1 100px',
            border: '1.5px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '8px 10px',
            background: 'var(--cp-cream)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>LOCAL</div>
          <div style={{ fontWeight: 700 }}>CAPRICHOS</div>
        </div>
        <div
          style={{
            flex: '1 1 100px',
            border: '1.5px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '8px 10px',
            background: 'var(--cp-cream)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>CAJA</div>
          <div style={{ fontWeight: 700 }}>Caja Principal</div>
        </div>
        <div
          style={{
            flex: '1 1 100px',
            border: '1.5px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '8px 10px',
            background: 'var(--cp-cream)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>TURNO</div>
          <div style={{ fontWeight: 700 }}>Día</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label
            htmlFor="lg-user"
            style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}
          >
            Usuario
          </label>
          <input
            id="lg-user"
            aria-label="DNI"
            type="text"
            value={usuarioTexto}
            onChange={(e) => {
              setUsuarioTexto(e.target.value);
              if (errorTexto) setErrorTexto('');
            }}
            placeholder="Usuario"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '48px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              padding: '0 12px',
              fontSize: '14px',
            }}
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor="lg-pass"
            style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}
          >
            Contraseña
          </label>
          <input
            id="lg-pass"
            aria-label="Contraseña"
            type="password"
            value={contrasena}
            onChange={(e) => {
              setContrasena(e.target.value);
              if (errorTexto) setErrorTexto('');
            }}
            placeholder="Contraseña"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '48px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              padding: '0 12px',
              fontSize: '14px',
            }}
          />
        </div>

        {avisoSalida && !errorTexto && !errorApi && (
          <div
            role="status"
            style={{
              border: '1.5px solid var(--cp-navy)',
              background: '#EEF3F7',
              color: 'var(--cp-navy)',
              borderRadius: '12px',
              padding: '10px 12px',
              fontSize: '14px',
              fontWeight: 700,
              lineHeight: '19px',
            }}
          >
            {avisoSalida}
          </div>
        )}

        {(errorTexto || errorApi) && (
          <div
            role="alert"
            style={{
              border: '1.5px solid var(--cp-rust)',
              background: '#FBEDE9',
              color: 'var(--cp-rust)',
              borderRadius: '12px',
              padding: '10px 12px',
              fontSize: '14px',
              fontWeight: 700,
              lineHeight: '19px',
            }}
          >
            {errorTexto || errorApi}
          </div>
        )}

        <button
          type="submit"
          disabled={cargando}
          style={{
            minHeight: '52px',
            border: 0,
            borderRadius: '12px',
            background: 'var(--cp-orange)',
            color: 'var(--cp-navy)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '15px',
            cursor: 'pointer',
            opacity: cargando ? 0.7 : 1,
          }}
        >
          {cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </button>
      </form>
    </div>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: pantallaAncha ? 'row' : 'column',
        background: 'var(--cp-cream)',
        overflowX: 'hidden',
      }}
    >
      {pantallaAncha ? (
        <>
          <section
            style={{
              flex: '0 0 40%',
              minWidth: '420px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 40px',
              boxSizing: 'border-box',
              background: 'var(--cp-cream)',
            }}
          >
            {tarjeta}
          </section>
          <CarruselIngreso
            imagenes={contenidoIngreso.imagenes}
            frase={contenidoIngreso.frase}
            estilo={{ flex: '1 1 60%', minHeight: '100vh' }}
          />
        </>
      ) : (
        <>
          <CarruselIngreso
            imagenes={contenidoIngreso.imagenes}
            frase={contenidoIngreso.frase}
            estilo={{ width: '100%', height: '35vh', minHeight: '200px' }}
          />
          <section
            style={{
              position: 'relative',
              zIndex: 1,
              marginTop: '-32px',
              padding: '0 16px 32px',
              display: 'flex',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            {tarjeta}
          </section>
        </>
      )}
    </div>
  );
}
