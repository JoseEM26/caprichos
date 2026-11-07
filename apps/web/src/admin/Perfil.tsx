import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSesion } from '../comun/sesion';
import { api, clienteFetch, ErrorApi } from '../comun/api';
import { Boton } from '../comun/Boton';
import { Campo } from '../comun/Campo';
import { Confirmar } from '../comun/Confirmar';
import { Tarjeta } from '../comun/Tarjeta';
import { IndicadorSubida } from '../comun/IndicadorSubida';
import { useSubidaArchivo } from '../comun/useSubidaArchivo';
import { MODULOS } from './modulos';
import { reducirImagenVoucher } from './vouchers/reducirImagenVoucher';

const NOMBRE_ROL: Record<string, string> = {
  ADMIN: 'Administrador',
  CAJERO: 'Cajero',
  COCINA: 'Cocina y barra',
  MOZO: 'Mozo',
  ALMACEN: 'Almacén',
  PRODUCCION: 'Producción',
  REPARTIDOR: 'Repartidor',
};

/** Lo que el backend devuelve de GET /auth/perfil. Rol, DNI y estado son solo lectura. */
interface MiPerfil {
  nombres: string;
  apellidos: string;
  correo: string;
  avisosCorreo: boolean;
  fotoUrl: string | null;
  rol: string;
  dniEnmascarado: string;
  activo: boolean;
}

interface DatosForm {
  nombres: string;
  apellidos: string;
  correo: string;
  avisosCorreo: boolean;
}

const FORMATO_CORREO = /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inicialesDe = (nombre: string): string =>
  (nombre || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

const mensajeDe = (err: unknown, respaldo: string): string =>
  err instanceof ErrorApi ? err.message || respaldo : respaldo;

/** Dato de solo lectura dentro de la tarjeta "Mis datos". */
function DatoLectura({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div
      style={{
        flex: '1 1 160px',
        minWidth: 0,
        background: 'var(--cp-cream)',
        border: '1px solid var(--cp-line)',
        borderRadius: 12,
        padding: '10px 12px',
      }}
    >
      <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', color: 'var(--cp-soft)' }}>
        {etiqueta.toUpperCase()}
      </div>
      <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 15, color: 'var(--cp-navy)', overflowWrap: 'anywhere' }}>
        {valor}
      </div>
    </div>
  );
}

/** Mi perfil: el usuario edita solo su nombre, apellidos, correo y foto. Rol, DNI y accesos son de lectura. */
export function Perfil() {
  const { usuario, tiene, salir, refrescarYo } = useSesion();
  const navigate = useNavigate();
  const inputFoto = useRef<HTMLInputElement>(null);

  const [perfil, setPerfil] = useState<MiPerfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState(false);
  const subidaFoto = useSubidaArchivo<MiPerfil>();

  const [form, setForm] = useState<DatosForm>({ nombres: '', apellidos: '', correo: '', avisosCorreo: false });
  const [errorDatos, setErrorDatos] = useState('');
  const [confirmarDatos, setConfirmarDatos] = useState(false);

  const [fotoNueva, setFotoNueva] = useState<Blob | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState('');
  const [errorFoto, setErrorFoto] = useState('');
  const [confirmarFoto, setConfirmarFoto] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  const [confirmarSalir, setConfirmarSalir] = useState(false);

  useEffect(() => {
    let vivo = true;
    api
      .get<MiPerfil>('/auth/perfil')
      .then((p) => {
        if (!vivo) return;
        setPerfil(p);
        setForm({ nombres: p.nombres, apellidos: p.apellidos, correo: p.correo, avisosCorreo: Boolean(p.avisosCorreo) });
      })
      .catch((err) => {
        if (vivo) setErrorCarga(mensajeDe(err, 'No pudimos cargar tu perfil. Intenta de nuevo.'));
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Libera la vista previa de la foto cuando cambia o se desmonta la vista
  useEffect(() => {
    return () => {
      if (vistaPrevia.startsWith('blob:')) URL.revokeObjectURL(vistaPrevia);
    };
  }, [vistaPrevia]);

  const nombreMostrado = perfil?.nombres || usuario?.nombres || 'Tu cuenta';
  const nombreCompleto = perfil ? [perfil.nombres, perfil.apellidos].filter(Boolean).join(' ') : nombreMostrado;
  const iniciales = inicialesDe(nombreMostrado);
  const fotoMostrada = vistaPrevia || perfil?.fotoUrl || '';
  const nombreRol = NOMBRE_ROL[(perfil?.rol || usuario?.rol || '').toUpperCase()] ?? (perfil?.rol || usuario?.rol || 'Personal');
  const accesibles = MODULOS.filter((m) => !m.permisoMinimo || tiene(m.permisoMinimo));

  const datosCambiados =
    perfil !== null &&
    (form.nombres.trim() !== perfil.nombres ||
      form.apellidos.trim() !== perfil.apellidos ||
      form.correo.trim() !== perfil.correo ||
      form.avisosCorreo !== Boolean(perfil.avisosCorreo));

  // ---- Mis datos ----
  const validarDatos = (): string => {
    if (form.nombres.trim().length < 2) return 'Escribe tu nombre (mínimo 2 letras).';
    if (form.nombres.trim().length > 60) return 'El nombre no puede pasar de 60 caracteres.';
    if (form.apellidos.trim().length > 60) return 'Los apellidos no pueden pasar de 60 caracteres.';
    if (!FORMATO_CORREO.test(form.correo.trim())) return 'El correo no tiene un formato válido.';
    if (form.avisosCorreo && !form.correo.trim()) return 'Para recibir avisos por correo escribe tu correo.';
    return '';
  };

  const pedirGuardarDatos = (e: FormEvent) => {
    e.preventDefault();
    setMensaje('');
    const error = validarDatos();
    setErrorDatos(error);
    if (error) return;
    if (!datosCambiados) {
      setMensaje('No hay cambios que guardar.');
      return;
    }
    setConfirmarDatos(true);
  };

  const guardarDatos = async () => {
    setProcesando(true);
    setErrorDatos('');
    try {
      const actualizado = await api.patch<MiPerfil>('/auth/perfil', {
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        correo: form.correo.trim(),
        ...(form.avisosCorreo !== Boolean(perfil?.avisosCorreo) ? { avisosCorreo: form.avisosCorreo } : {}),
      });
      setPerfil(actualizado);
      setForm({
        nombres: actualizado.nombres,
        apellidos: actualizado.apellidos,
        correo: actualizado.correo,
        avisosCorreo: Boolean(actualizado.avisosCorreo),
      });
      setMensaje('Tus datos se guardaron.');
      await refrescarYo();
    } catch (err) {
      setErrorDatos(mensajeDe(err, 'No se pudieron guardar tus datos. Intenta de nuevo.'));
    } finally {
      setProcesando(false);
      setConfirmarDatos(false);
    }
  };

  // ---- Mi foto ----
  const alElegirFoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setMensaje('');
    setErrorFoto('');
    if (!archivo.type.startsWith('image/')) {
      setErrorFoto('Elige un archivo de imagen (JPG, PNG o WebP).');
      return;
    }
    try {
      const reducida = await reducirImagenVoucher(archivo, 560, 0.82);
      setFotoNueva(reducida);
      setVistaPrevia(URL.createObjectURL(reducida));
    } catch {
      setErrorFoto('No pudimos leer esa imagen. Prueba con otra foto.');
    }
  };

  const descartarFoto = () => {
    setFotoNueva(null);
    setVistaPrevia('');
    setErrorFoto('');
  };

  const guardarFoto = async () => {
    if (!fotoNueva) return;
    setProcesando(true);
    setErrorFoto('');
    // «Foto actualizada» solo cuando el servidor respondió; si falla, el indicador muestra el error con Reintentar.
    const actualizado = await subidaFoto.ejecutar(async () => {
      const fd = new FormData();
      fd.append('foto', fotoNueva, 'foto.jpg');
      return clienteFetch<MiPerfil>('/auth/perfil/foto', { method: 'PUT', body: fd });
    });
    if (actualizado) {
      setPerfil(actualizado);
      descartarFoto();
      setMensaje('Tu foto se actualizó.');
      await refrescarYo();
    }
    setProcesando(false);
    setConfirmarFoto(false);
  };

  const quitarFoto = async () => {
    setProcesando(true);
    setErrorFoto('');
    try {
      const actualizado = await api.delete<MiPerfil>('/auth/perfil/foto');
      setPerfil(actualizado);
      descartarFoto();
      setMensaje('Quitaste tu foto. Ahora se ve tu inicial.');
      await refrescarYo();
    } catch (err) {
      setErrorFoto(mensajeDe(err, 'No se pudo quitar la foto. Intenta de nuevo.'));
    } finally {
      setProcesando(false);
      setConfirmarQuitar(false);
    }
  };

  const cerrarSesion = async () => {
    await salir();
    navigate('/admin/ingresar', { replace: true });
  };

  const estilosCampo = { minHeight: 48 };

  if (cargando) {
    return <p style={{ color: 'var(--cp-soft)', padding: 16 }}>Cargando tu perfil...</p>;
  }

  if (errorCarga || !perfil) {
    return (
      <p role="alert" style={{ color: 'var(--cp-rust)', padding: 16 }}>
        {errorCarga || 'No pudimos cargar tu perfil.'}
      </p>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, boxSizing: 'border-box' }}>
      {/* Cabecera: foto, nombre, rol y estado */}
      <section
        aria-label="Resumen de tu cuenta"
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: 20,
          padding: 20,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 20,
          boxSizing: 'border-box',
        }}
      >
        {fotoMostrada ? (
          <img
            src={fotoMostrada}
            alt=""
            width={112}
            height={112}
            style={{ width: 112, height: 112, borderRadius: 56, objectFit: 'cover', flex: 'none' }}
          />
        ) : (
          <span
            aria-hidden="true"
            style={{
              width: 112,
              height: 112,
              borderRadius: 56,
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: 40,
              flex: 'none',
            }}
          >
            {iniciales}
          </span>
        )}
        <div style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 24, lineHeight: '28px', color: 'var(--cp-navy)', overflowWrap: 'anywhere' }}>
            {nombreCompleto}
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ background: 'var(--cp-navy)', color: 'var(--cp-cream)', borderRadius: 9999, padding: '4px 12px', fontFamily: 'var(--fuente-titulos)', fontWeight: 700, fontSize: 12 }}>
              {nombreRol}
            </span>
            <span
              style={{
                border: '1px solid var(--cp-line)',
                color: perfil.activo ? 'var(--cp-navy)' : 'var(--cp-rust)',
                borderRadius: 9999,
                padding: '3px 12px',
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {perfil.activo ? 'Cuenta activa' : 'Cuenta inactiva'}
            </span>
          </div>
        </div>
      </section>

      {(mensaje || errorDatos || errorFoto) && (
        <p
          role={errorDatos || errorFoto ? 'alert' : 'status'}
          style={{
            margin: 0,
            padding: '10px 14px',
            borderRadius: 12,
            background: errorDatos || errorFoto ? 'var(--cp-white)' : 'var(--cp-cream)',
            border: `1px solid ${errorDatos || errorFoto ? 'var(--cp-rust)' : 'var(--cp-line)'}`,
            color: errorDatos || errorFoto ? 'var(--cp-rust)' : 'var(--cp-navy)',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {errorDatos || errorFoto || mensaje}
        </p>
      )}

      <Tarjeta titulo="Mis datos" subtitulo="Tu nombre y tu contacto. Cada cambio se guarda después de confirmarlo.">
        <form onSubmit={pedirGuardarDatos} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14 }}>
            <Campo
              etiqueta="Nombres"
              value={form.nombres}
              maxLength={60}
              autoComplete="given-name"
              onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
              style={estilosCampo}
            />
            <Campo
              etiqueta="Apellidos"
              value={form.apellidos}
              maxLength={60}
              autoComplete="family-name"
              onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
              style={estilosCampo}
            />
            <Campo
              etiqueta="Correo electrónico"
              type="email"
              value={form.correo}
              maxLength={120}
              autoComplete="email"
              placeholder="opcional"
              onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
              style={estilosCampo}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 14, color: 'var(--cp-navy)' }}>
              <input
                type="checkbox"
                checked={form.avisosCorreo}
                onChange={(e) => setForm((f) => ({ ...f, avisosCorreo: e.target.checked }))}
              />
              Recibir avisos del sistema por correo (dentro de mi horario)
            </label>
          </div>
          <div>
            <Boton type="submit" variante="primario" deshabilitado={procesando || !datosCambiados}>
              Guardar mis datos
            </Boton>
          </div>
        </form>

        <div style={{ borderTop: '1px solid var(--cp-line)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', color: 'var(--cp-soft)' }}>
            DATOS DE ACCESO (SOLO LECTURA)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <DatoLectura etiqueta="Rol" valor={nombreRol} />
            <DatoLectura etiqueta="Usuario de acceso" valor={perfil.dniEnmascarado} />
            <DatoLectura etiqueta="Estado" valor={perfil.activo ? 'Activa' : 'Inactiva'} />
          </div>
          <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', color: 'var(--cp-soft)' }}>
            MÓDULOS CON ACCESO
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {accesibles.map((m) => (
              <span key={m.clave} style={{ background: 'var(--cp-cream)', color: 'var(--cp-navy)', border: '1px solid var(--cp-line)', borderRadius: 9999, padding: '4px 12px', fontFamily: 'var(--fuente-titulos)', fontWeight: 700, fontSize: 12 }}>
                {m.nombre}
              </span>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--cp-soft)' }}>
            Para cambiar tu rol, tu usuario o tus accesos, pídelo al administrador.
          </p>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Mi foto" subtitulo="Se ve en el menú del panel. La imagen se reduce sola antes de subirla.">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          {fotoMostrada ? (
            <img src={fotoMostrada} alt="Vista previa de tu foto" width={120} height={120} style={{ width: 120, height: 120, borderRadius: 60, objectFit: 'cover', flex: 'none' }} />
          ) : (
            <span
              aria-hidden="true"
              style={{ width: 120, height: 120, borderRadius: 60, background: 'var(--cp-orange)', color: 'var(--cp-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 44, flex: 'none' }}
            >
              {iniciales}
            </span>
          )}
          <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <input
              ref={inputFoto}
              type="file"
              accept="image/*"
              onChange={alElegirFoto}
              aria-label="Elegir foto de perfil"
              style={{ display: 'none' }}
            />
            {!fotoNueva && (
              <Boton variante="secundario" onClick={() => inputFoto.current?.click()} deshabilitado={procesando}>
                {perfil.fotoUrl ? 'Cambiar foto' : 'Subir foto'}
              </Boton>
            )}
            <IndicadorSubida estado={subidaFoto.estado} error={subidaFoto.error} onReintentar={subidaFoto.reintentar} />
            {fotoNueva && (
              <>
                <Boton variante="primario" onClick={() => setConfirmarFoto(true)} deshabilitado={procesando || subidaFoto.subiendo}>
                  {subidaFoto.subiendo ? 'Subiendo imagen…' : 'Guardar foto'}
                </Boton>
                <Boton variante="texto" onClick={descartarFoto} deshabilitado={procesando}>
                  Cancelar
                </Boton>
              </>
            )}
            {!fotoNueva && perfil.fotoUrl && (
              <Boton variante="texto" onClick={() => setConfirmarQuitar(true)} deshabilitado={procesando}>
                Quitar foto
              </Boton>
            )}
            <p style={{ flexBasis: '100%', margin: 0, fontSize: 13, color: 'var(--cp-soft)' }}>
              Sin foto, se muestran tus iniciales. Quitar la foto no borra nada: solo vuelve a tus iniciales.
            </p>
          </div>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Seguridad" subtitulo="Tu contraseña es personal. Cámbiala cuando lo necesites.">
        <div>
          <Boton variante="secundario" onClick={() => navigate('/admin/cambiar-clave')} deshabilitado={procesando}>
            Cambiar mi contraseña
          </Boton>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Sesión" subtitulo="Cierra tu sesión si usas un equipo compartido.">
        <div>
          <Boton variante="oscuro" onClick={() => setConfirmarSalir(true)} deshabilitado={procesando}>
            Cerrar sesión
          </Boton>
        </div>
      </Tarjeta>

      <Confirmar
        abierto={confirmarDatos}
        titulo="Guardar tus datos"
        mensaje="¿Guardar los cambios en tu nombre y contacto?"
        textoSi="Sí, guardar"
        textoNo="No, revisar"
        cargando={procesando}
        alConfirmar={guardarDatos}
        alCancelar={() => setConfirmarDatos(false)}
      />
      <Confirmar
        abierto={confirmarFoto}
        titulo="Guardar tu foto"
        mensaje="¿Usar esta foto como tu foto de perfil?"
        textoSi="Sí, guardar"
        textoNo="No, revisar"
        cargando={procesando}
        alConfirmar={guardarFoto}
        alCancelar={() => setConfirmarFoto(false)}
      />
      <Confirmar
        abierto={confirmarQuitar}
        titulo="Quitar tu foto"
        mensaje="¿Quitar tu foto? Se volverá a ver tu inicial."
        textoSi="Sí, quitar"
        textoNo="No, dejarla"
        cargando={procesando}
        alConfirmar={quitarFoto}
        alCancelar={() => setConfirmarQuitar(false)}
      />
      <Confirmar
        abierto={confirmarSalir}
        titulo="Cerrar sesión"
        mensaje="¿Seguro que quieres cerrar tu sesión en el panel de Caprichos?"
        textoSi="Sí, cerrar sesión"
        textoNo="No, quedarme"
        alConfirmar={cerrarSesion}
        alCancelar={() => setConfirmarSalir(false)}
      />
    </div>
  );
}
