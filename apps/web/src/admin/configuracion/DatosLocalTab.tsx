import { useState, useEffect } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';

export interface DatosLocal {
  nombre: string;
  direccion: string;
  telefono: string;
  whatsapp?: string;
  redes?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    [key: string]: string | undefined;
  };
}

interface DatosLocalTabProps {
  puedeEditar: boolean;
}

export function DatosLocalTab({ puedeEditar }: DatosLocalTabProps) {
  const [datos, setDatos] = useState<DatosLocal>({
    nombre: '',
    direccion: '',
    telefono: '',
    whatsapp: '',
    redes: { instagram: '', facebook: '', tiktok: '' },
  });
  const [original, setOriginal] = useState<DatosLocal | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);

  const cargarDatos = async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await api.get<DatosLocal>('/admin/local/datos');
      const formateado: DatosLocal = {
        nombre: res.nombre || '',
        direccion: res.direccion || '',
        telefono: res.telefono || '',
        whatsapp: res.whatsapp || '',
        redes: {
          instagram: res.redes?.instagram || '',
          facebook: res.redes?.facebook || '',
          tiktok: res.redes?.tiktok || '',
        },
      };
      setDatos(formateado);
      setOriginal(formateado);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'No se pudieron cargar los datos del local';
      setErrorCarga(msg);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const hayCambios =
    original !== null &&
    (datos.nombre !== original.nombre ||
      datos.direccion !== original.direccion ||
      datos.telefono !== original.telefono ||
      (datos.whatsapp || '') !== (original.whatsapp || '') ||
      (datos.redes?.instagram || '') !== (original.redes?.instagram || '') ||
      (datos.redes?.facebook || '') !== (original.redes?.facebook || '') ||
      (datos.redes?.tiktok || '') !== (original.redes?.tiktok || ''));

  const validar = (): string | null => {
    if (!datos.nombre.trim()) return 'El nombre del local es requerido';
    if (!datos.direccion.trim()) return 'La dirección del local es requerida';
    if (!datos.telefono.trim()) return 'El teléfono es requerido';
    return null;
  };

  const errorValidacion = validar();

  const handleGuardar = async () => {
    if (!puedeEditar || errorValidacion || !hayCambios) return;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const res = await api.put<DatosLocal>('/admin/local/datos', {
        nombre: datos.nombre.trim(),
        direccion: datos.direccion.trim(),
        telefono: datos.telefono.trim(),
        whatsapp: datos.whatsapp?.trim() || undefined,
        redes: {
          instagram: datos.redes?.instagram?.trim() || '',
          facebook: datos.redes?.facebook?.trim() || '',
          tiktok: datos.redes?.tiktok?.trim() || '',
        },
      });

      const formateado: DatosLocal = {
        nombre: res.nombre || '',
        direccion: res.direccion || '',
        telefono: res.telefono || '',
        whatsapp: res.whatsapp || '',
        redes: {
          instagram: res.redes?.instagram || '',
          facebook: res.redes?.facebook || '',
          tiktok: res.redes?.tiktok || '',
        },
      };
      setDatos(formateado);
      setOriginal(formateado);
      const ahora = new Date();
      const horaStr = ahora.toLocaleTimeString('es-PE', { hour12: false });
      setMensajeGuardado(`Guardado a las ${horaStr}`);
      setConfirmarAbierto(false);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'Error al guardar los datos del local';
      setErrorGuardar(msg);
      setConfirmarAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  const handleDescartar = () => {
    if (original) {
      setDatos(original);
      setErrorGuardar(null);
    }
  };

  if (cargando) {
    return <Cargando mensaje="Cargando datos del local..." />;
  }

  if (errorCarga) {
    return (
      <EstadoError
        titulo="Error al cargar datos del local"
        mensaje={errorCarga}
        alReintentar={cargarDatos}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '18px',
              color: 'var(--cp-navy)',
            }}
          >
            Datos del local
          </h2>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--cp-soft)',
              margin: '4px 0 0 0',
            }}
          >
            Información básica visible en la carta virtual, chatbot y comprobantes.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hayCambios ? (
            <Insignia variante="aviso">Cambios sin guardar</Insignia>
          ) : (
            <Insignia variante="neutro">Todo guardado</Insignia>
          )}
          {mensajeGuardado && !hayCambios && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--cp-green)',
              }}
            >
              {mensajeGuardado}
            </span>
          )}
        </div>
      </div>

      {!puedeEditar && (
        <div
          role="status"
          style={{
            background: 'var(--cp-sand)',
            border: '1px solid var(--cp-line)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--cp-soft)',
          }}
        >
          Modo sólo lectura. No tienes el permiso <b>local/editar</b> para modificar estos datos.
        </div>
      )}

      {errorGuardar && (
        <div
          role="alert"
          style={{
            background: '#FBEDE9',
            border: '1px solid var(--cp-rust)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--cp-rust)',
            fontWeight: 600,
          }}
        >
          {errorGuardar}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (puedeEditar && hayCambios && !errorValidacion) {
            setConfirmarAbierto(true);
          }
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <Campo
            etiqueta="Nombre del local *"
            value={datos.nombre}
            disabled={!puedeEditar || guardando}
            onChange={(e) => {
              setDatos({ ...datos, nombre: e.target.value });
              setMensajeGuardado(null);
            }}
            placeholder="Ej: Caprichos"
            required
          />

          <Campo
            etiqueta="Dirección *"
            value={datos.direccion}
            disabled={!puedeEditar || guardando}
            onChange={(e) => {
              setDatos({ ...datos, direccion: e.target.value });
              setMensajeGuardado(null);
            }}
            placeholder="Ej: Av. Principal 123"
            required
          />

          <Campo
            etiqueta="Teléfono de contacto *"
            value={datos.telefono}
            disabled={!puedeEditar || guardando}
            onChange={(e) => {
              setDatos({ ...datos, telefono: e.target.value });
              setMensajeGuardado(null);
            }}
            placeholder="Ej: 999999999"
            required
          />

          <Campo
            etiqueta="WhatsApp para pedidos"
            value={datos.whatsapp || ''}
            disabled={!puedeEditar || guardando}
            onChange={(e) => {
              setDatos({ ...datos, whatsapp: e.target.value });
              setMensajeGuardado(null);
            }}
            placeholder="Ej: 999999999"
          />
        </div>

        <div style={{ marginTop: '8px' }}>
          <h3
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '15px',
              color: 'var(--cp-navy)',
              marginBottom: '12px',
            }}
          >
            Redes sociales
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <Campo
              etiqueta="Instagram"
              value={datos.redes?.instagram || ''}
              disabled={!puedeEditar || guardando}
              onChange={(e) => {
                setDatos({
                  ...datos,
                  redes: { ...datos.redes, instagram: e.target.value },
                });
                setMensajeGuardado(null);
              }}
              placeholder="@caprichos o enlace"
            />

            <Campo
              etiqueta="Facebook"
              value={datos.redes?.facebook || ''}
              disabled={!puedeEditar || guardando}
              onChange={(e) => {
                setDatos({
                  ...datos,
                  redes: { ...datos.redes, facebook: e.target.value },
                });
                setMensajeGuardado(null);
              }}
              placeholder="Página o enlace de Facebook"
            />

            <Campo
              etiqueta="TikTok"
              value={datos.redes?.tiktok || ''}
              disabled={!puedeEditar || guardando}
              onChange={(e) => {
                setDatos({
                  ...datos,
                  redes: { ...datos.redes, tiktok: e.target.value },
                });
                setMensajeGuardado(null);
              }}
              placeholder="@caprichos en TikTok"
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            marginTop: '12px',
            flexWrap: 'wrap',
          }}
        >
          <Boton
            type="submit"
            variante="primario"
            disabled={!puedeEditar || !hayCambios || !!errorValidacion || guardando}
            cargando={guardando}
          >
            Guardar cambios
          </Boton>

          <Boton
            type="button"
            variante="secundario"
            disabled={!hayCambios || guardando}
            onClick={handleDescartar}
          >
            Descartar
          </Boton>
        </div>
      </form>

      <Confirmar
        abierto={confirmarAbierto}
        titulo="¿Guardar datos del local?"
        mensaje="Los cambios se aplicarán inmediatamente en la carta virtual, chatbot y comprobantes."
        textoSi="Sí, guardar"
        textoNo="No, revisar"
        cargando={guardando}
        alConfirmar={handleGuardar}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </div>
  );
}
