import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSesion } from '../comun/sesion';
import { ErrorApi } from '../comun/api';

export function Ingresar() {
  const { ingresar, usuario, debeCambiar, cargando: sesionCargando } = useSesion();
  const navigate = useNavigate();
  const location = useLocation();

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

    const limpio = usuarioTexto.trim();
    if (!limpio) {
      setErrorTexto('El DNI debe tener 8 dígitos numéricos.');
      return;
    }

    if (/^\d+$/.test(limpio) && limpio.length !== 8) {
      setErrorTexto('El DNI debe tener 8 dígitos numéricos.');
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
      } catch {}
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

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--cp-cream)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
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
    </div>
  );
}
