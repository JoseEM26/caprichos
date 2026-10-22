import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSesion } from '../comun/sesion';
import { ErrorApi } from '../comun/api';
import { Campo } from '../comun/Campo';
import { Boton } from '../comun/Boton';

export function Ingresar() {
  const { ingresar, usuario, debeCambiar, cargando: sesionCargando } = useSesion();
  const navigate = useNavigate();
  const location = useLocation();

  const [dni, setDni] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errorDni, setErrorDni] = useState('');
  const [errorContrasena, setErrorContrasena] = useState('');
  const [errorApi, setErrorApi] = useState('');
  const [cargando, setCargando] = useState(false);

  // Si ya tiene sesión activa
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
    setErrorDni('');
    setErrorContrasena('');
    setErrorApi('');

    const dniLimpio = dni.trim();
    if (!/^\d{8}$/.test(dniLimpio)) {
      setErrorDni('El DNI debe tener 8 dígitos numéricos.');
      return;
    }

    if (!contrasena) {
      setErrorContrasena('Ingresa tu contraseña.');
      return;
    }

    setCargando(true);
    try {
      const resultado = await ingresar(dniLimpio, contrasena);
      if (resultado.debeCambiar) {
        navigate('/admin/cambiar-clave', { replace: true });
      } else {
        const destino = (location.state as any)?.desde || '/admin';
        navigate(destino, { replace: true });
      }
    } catch (err: any) {
      if (err instanceof ErrorApi) {
        // Códigos específicos de la API y su texto
        if (err.codigo === 'CREDENCIALES_INVALIDAS') {
          setErrorApi(err.message || 'Credenciales inválidas. Verifica tu DNI y contraseña.');
        } else if (err.codigo === 'USUARIO_DESACTIVADO') {
          setErrorApi(err.message || 'El usuario se encuentra desactivado. Consulta con administración.');
        } else if (err.codigo === 'CUENTA_BLOQUEADA') {
          setErrorApi(err.message || 'Cuenta bloqueada temporalmente tras intentos fallidos.');
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
          boxShadow: '0 10px 30px rgba(11, 44, 62, 0.12)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Cabecera del login */}
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
            width={64}
            height={64}
            style={{ borderRadius: '50%', display: 'block', margin: '0 auto' }}
          />
          <h1
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '22px',
              lineHeight: '28px',
              letterSpacing: '0.04em',
              color: 'var(--cp-navy)',
            }}
          >
            CAPRICHOS
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
            Panel del local · Inicia sesión
          </div>
        </div>

        {/* Formulario */}
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <Campo
            id="login-dni"
            etiqueta="DNI"
            type="text"
            inputMode="numeric"
            maxLength={8}
            placeholder="DNI de 8 dígitos"
            value={dni}
            onChange={(e) => {
              const solonumeros = e.target.value.replace(/\D/g, '').slice(0, 8);
              setDni(solonumeros);
              if (errorDni) setErrorDni('');
            }}
            error={errorDni}
            autoFocus
          />

          <Campo
            id="login-contrasena"
            etiqueta="Contraseña"
            type="password"
            placeholder="Tu contraseña"
            permiteAlternarClave
            value={contrasena}
            onChange={(e) => {
              setContrasena(e.target.value);
              if (errorContrasena) setErrorContrasena('');
            }}
            error={errorContrasena}
          />

          {errorApi && (
            <div
              role="alert"
              style={{
                border: '1.5px solid var(--cp-rust)',
                background: '#FBEDE9',
                color: 'var(--cp-rust)',
                borderRadius: '12px',
                padding: '10px 12px',
                fontSize: '13px',
                fontWeight: 700,
                lineHeight: '18px',
              }}
            >
              {errorApi}
            </div>
          )}

          <Boton
            type="submit"
            variante="primario"
            tamano="grande"
            cargando={cargando}
            style={{ width: '100%', marginTop: '6px' }}
          >
            Iniciar sesión
          </Boton>
        </form>

        <div
          style={{
            fontSize: '12px',
            lineHeight: '17px',
            color: 'var(--cp-soft)',
            textAlign: 'center',
            paddingTop: '8px',
            borderTop: '1px solid var(--cp-line)',
          }}
        >
          Acceso exclusivo para el personal autorizado de Caprichos.
        </div>
      </div>
    </div>
  );
}
