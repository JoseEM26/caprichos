import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSesion } from '../comun/sesion';
import { api, clienteFetch, ErrorApi } from '../comun/api';
import { IndicadorSubida } from '../comun/IndicadorSubida';
import { Confirmar } from '../comun/Confirmar';
import { useSubidaArchivo } from '../comun/useSubidaArchivo';

export function CambiarClave() {
  const { usuario, debeCambiar, marcarClaveCambiada, salir } = useSesion();
  const navigate = useNavigate();

  // Campos para Primer Ingreso o Voluntario
  const [actual, setActual] = useState(() => {
    try {
      return sessionStorage.getItem('caprichos_temp_clave') || '';
    } catch {
      return '';
    }
  });
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [mostrarClave, setMostrarClave] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [errorApi, setErrorApi] = useState('');
  const [foto, setFoto] = useState<string>('');
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const [quitandoFoto, setQuitandoFoto] = useState(false);
  const subidaFoto = useSubidaArchivo();

  // Reglas de validación
  const tieneMinimo8 = nueva.length >= 8;
  const tieneLetra = /[a-zA-Z]/.test(nueva);
  const tieneNumero = /\d/.test(nueva);
  const esDistinta = actual ? nueva !== actual : Boolean(nueva);
  const sonIguales = nueva.length > 0 && nueva === confirmacion;

  const iniciales = (usuario?.nombres || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  // La foto se guarda en el servidor (la misma de Mi perfil); se ve al abrir la pantalla.
  useEffect(() => {
    api
      .get<{ fotoUrl: string | null }>('/auth/perfil')
      .then((p) => setFoto(p.fotoUrl ?? ''))
      .catch(() => {});
  }, []);

  const handleSubirFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void subidaFoto.ejecutar(async () => {
      const fd = new FormData();
      fd.append('foto', file, 'foto.jpg');
      const actualizado = await clienteFetch<{ fotoUrl: string | null }>('/auth/perfil/foto', { method: 'PUT', body: fd });
      setFoto(actualizado.fotoUrl ?? '');
    });
  };

  const quitarFoto = async () => {
    setQuitandoFoto(true);
    try {
      const actualizado = await api.delete<{ fotoUrl: string | null }>('/auth/perfil/foto');
      setFoto(actualizado.fotoUrl ?? '');
    } catch (err) {
      setErrorApi(err instanceof ErrorApi ? err.message : 'No se pudo quitar la foto. Inténtalo de nuevo.');
    } finally {
      setQuitandoFoto(false);
      setConfirmarQuitar(false);
    }
  };

  // Submit Primer Ingreso
  const handleGuardarPrimerIngreso = async (e: FormEvent) => {
    e.preventDefault();
    setErrorApi('');

    if (nueva.length < 8 || !tieneLetra || !tieneNumero) {
      setErrorApi('La contraseña nueva debe tener al menos 8 caracteres con letras y números.');
      return;
    }
    if (!esDistinta) {
      setErrorApi('Esa es la contraseña inicial. Elige otra distinta.');
      return;
    }
    if (!sonIguales) {
      setErrorApi('Las dos contraseñas no son iguales.');
      return;
    }

    setCargando(true);
    try {
      let clavePrevia = actual;
      if (!clavePrevia) {
        try {
          clavePrevia = sessionStorage.getItem('caprichos_temp_clave') || '';
        } catch { /* sessionStorage puede no estar disponible (modo privado): se ignora */ }
      }
      await api.post('/auth/cambiar-contrasena', {
        contrasenaActual: clavePrevia,
        contrasenaNueva: nueva,
      });

      try {
        sessionStorage.removeItem('caprichos_temp_clave');
      } catch { /* sessionStorage puede no estar disponible (modo privado): se ignora */ }

      marcarClaveCambiada();
      navigate('/admin', { replace: true });
    } catch (err: any) {
      if (err instanceof ErrorApi) {
        setErrorApi(err.message || 'Error al actualizar la contraseña.');
      } else {
        setErrorApi(err?.message || 'Error de conexión con el servidor.');
      }
    } finally {
      setCargando(false);
    }
  };

  // Submit Cambio Voluntario
  const handleGuardarVoluntario = async (e: FormEvent) => {
    e.preventDefault();
    setErrorApi('');

    if (!actual) {
      setErrorApi('Escribe tu contraseña actual.');
      return;
    }
    if (nueva.length < 8 || !tieneLetra || !tieneNumero) {
      setErrorApi('La nueva contraseña debe tener mínimo 8 caracteres con letra y número.');
      return;
    }
    if (nueva === actual) {
      setErrorApi('La nueva contraseña debe ser distinta de la actual.');
      return;
    }
    if (nueva !== confirmacion) {
      setErrorApi('Las contraseñas nuevas no coinciden.');
      return;
    }

    setCargando(true);
    try {
      await api.post('/auth/cambiar-contrasena', {
        contrasenaActual: actual,
        contrasenaNueva: nueva,
      });
      marcarClaveCambiada();
      navigate('/admin', { replace: true });
    } catch (err: any) {
      if (err instanceof ErrorApi) {
        setErrorApi(err.message || 'Error al cambiar la contraseña.');
      } else {
        setErrorApi(err?.message || 'Error de conexión con el servidor.');
      }
    } finally {
      setCargando(false);
    }
  };

  const handleVolverLogin = async () => {
    await salir();
    navigate('/admin/ingresar', { replace: true });
  };

  // CASO 1: Primer Ingreso (debeCambiar === true)
  if (debeCambiar) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          overflowY: 'auto',
          background: 'var(--cp-cream)',
        }}
      >
        <div
          role="dialog"
          aria-label="Crea tu contraseña nueva"
          style={{
            width: '100%',
            maxWidth: '440px',
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '20px',
            boxShadow: '0 10px 30px rgba(11, 44, 62, 0.18)',
            padding: '26px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '22px',
              lineHeight: '28px',
              color: 'var(--cp-navy)',
            }}
          >
            Bienvenido, {usuario?.nombres || 'colaborador'}
          </div>
          <div style={{ fontSize: '14px', lineHeight: '20px', color: 'var(--cp-soft)' }}>
            Es tu primera vez. Antes de entrar, crea tu contraseña nueva: la inicial ya no sirve.
          </div>

          <form onSubmit={handleGuardarPrimerIngreso} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label htmlFor="fp-1" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Contraseña nueva
              </label>
              <input
                id="fp-1"
                type={mostrarClave ? 'text' : 'password'}
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                autoComplete="new-password"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '48px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '0 12px',
                  fontSize: '15px',
                }}
              />
            </div>

            <div>
              <label htmlFor="fp-2" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Escríbela otra vez
              </label>
              <input
                id="fp-2"
                type={mostrarClave ? 'text' : 'password'}
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                autoComplete="new-password"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '48px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '0 12px',
                  fontSize: '15px',
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => setMostrarClave(!mostrarClave)}
              aria-pressed={mostrarClave}
              style={{
                alignSelf: 'flex-start',
                minHeight: '44px',
                padding: '0 14px',
                border: '1.5px solid var(--cp-navy)',
                borderRadius: '10px',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {mostrarClave ? 'Ocultar contraseña' : 'Ver contraseña'}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}>
              <div
                style={{
                  color: tieneMinimo8 && tieneLetra && tieneNumero ? 'var(--cp-green)' : 'var(--cp-soft)',
                  fontWeight: tieneMinimo8 && tieneLetra && tieneNumero ? 700 : 500,
                }}
              >
                {tieneMinimo8 && tieneLetra && tieneNumero ? '✓' : '○'} Al menos 8 caracteres (letras y números)
              </div>
              <div
                style={{
                  color: esDistinta && nueva.length > 0 ? 'var(--cp-green)' : 'var(--cp-soft)',
                  fontWeight: esDistinta && nueva.length > 0 ? 700 : 500,
                }}
              >
                {esDistinta && nueva.length > 0 ? '✓' : '○'} Distinta de la contraseña inicial
              </div>
              <div
                style={{
                  color: sonIguales ? 'var(--cp-green)' : 'var(--cp-soft)',
                  fontWeight: sonIguales ? 700 : 500,
                }}
              >
                {sonIguales ? '✓' : '○'} Las dos escritas son iguales
              </div>
            </div>

            <div
              style={{
                borderTop: '1px solid var(--cp-line)',
                paddingTop: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--cp-sand)',
                  backgroundImage: foto ? `url('${foto}')` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  color: 'var(--cp-navy)',
                  fontSize: '20px',
                }}
              >
                {!foto && iniciales}
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <div style={{ fontWeight: 700 }}>
                  Foto de perfil <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--cp-soft)' }}>· opcional</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <label
                    style={{
                      position: 'relative',
                      minHeight: '44px',
                      padding: '0 14px',
                      boxSizing: 'border-box',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-navy)',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    {foto ? 'Cambiar foto' : 'Subir foto'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSubirFoto}
                      disabled={subidaFoto.subiendo}
                      aria-label="Elegir foto de perfil"
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                    />
                  </label>
                  {foto && (
                    <button
                      type="button"
                      onClick={() => setConfirmarQuitar(true)}
                      style={{
                        minHeight: '44px',
                        padding: '0 12px',
                        border: 0,
                        background: 'transparent',
                        color: 'var(--cp-rust)',
                        fontWeight: 700,
                        fontSize: '13px',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>

            <IndicadorSubida estado={subidaFoto.estado} error={subidaFoto.error} onReintentar={subidaFoto.reintentar} />

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
                }}
              >
                {errorApi}
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
              {cargando ? 'Guardando...' : 'Guardar y entrar'}
            </button>

            <Confirmar
              abierto={confirmarQuitar}
              titulo="Quitar tu foto"
              mensaje="¿Quitar tu foto? Se volverá a ver tu inicial."
              textoSi="Sí, quitar"
              textoNo="No, dejarla"
              cargando={quitandoFoto}
              alConfirmar={quitarFoto}
              alCancelar={() => setConfirmarQuitar(false)}
            />

            <button
              type="button"
              onClick={handleVolverLogin}
              style={{
                minHeight: '44px',
                border: 0,
                background: 'transparent',
                color: 'var(--cp-soft)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Volver al inicio de sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  // CASO 2: «CAMBIAR MI CONTRASEÑA (pide la actual)»
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
        role="dialog"
        aria-modal="true"
        aria-label="Cambiar mi contraseña"
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'var(--cp-cream)',
          border: '1px solid var(--cp-line)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '22px',
            color: 'var(--cp-navy)',
          }}
        >
          Cambiar mi contraseña
        </div>
        <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--cp-soft)' }}>
          Por seguridad, escribe primero tu contraseña actual para confirmar que eres tú. En esta maqueta no se valida; el sistema real sí la comprueba.
        </div>

        <form onSubmit={handleGuardarVoluntario} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label htmlFor="pc-cur" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
              Contraseña actual
            </label>
            <input
              id="pc-cur"
              type="password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              placeholder="Contraseña actual"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '46px',
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
            <label htmlFor="pc-1" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
              Contraseña nueva
            </label>
            <input
              id="pc-1"
              type="password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              placeholder="Contraseña nueva"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '46px',
                borderRadius: '12px',
                border: '1.5px solid var(--cp-line)',
                background: 'var(--cp-white)',
                color: 'var(--cp-navy)',
                padding: '0 12px',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label htmlFor="pc-2" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
              Repite la contraseña nueva
            </label>
            <input
              id="pc-2"
              type="password"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              placeholder="Repite la contraseña nueva"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '46px',
                borderRadius: '12px',
                border: '1.5px solid var(--cp-line)',
                background: 'var(--cp-white)',
                color: 'var(--cp-navy)',
                padding: '0 12px',
                fontSize: '14px',
              }}
            />
          </div>

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
              }}
            >
              {errorApi}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button
              type="submit"
              disabled={cargando}
              style={{
                flex: 1,
                minHeight: '52px',
                borderRadius: '12px',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '15px',
                border: 0,
                background: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                cursor: 'pointer',
                opacity: cargando ? 0.7 : 1,
              }}
            >
              {cargando ? 'Cambiando...' : 'Cambiar contraseña'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/perfil')}
              style={{
                flex: 1,
                minHeight: '52px',
                borderRadius: '12px',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '15px',
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
