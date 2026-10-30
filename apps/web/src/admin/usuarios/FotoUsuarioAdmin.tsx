import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { api, clienteFetch, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { IndicadorSubida } from '../../comun/IndicadorSubida';
import { useSubidaArchivo } from '../../comun/useSubidaArchivo';
import { reducirImagenVoucher } from '../vouchers/reducirImagenVoucher';
import type { UsuarioItem } from './tipos';

export interface FotoUsuarioAdminProps {
  usuario: UsuarioItem;
  deshabilitado?: boolean;
}

/** Foto de perfil de otra persona (solo ADMIN). Subir o quitar pide confirmación. */
export function FotoUsuarioAdmin({ usuario, deshabilitado = false }: FotoUsuarioAdminProps) {
  const inputFoto = useRef<HTMLInputElement>(null);
  const [fotoNueva, setFotoNueva] = useState<Blob | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [confirmarGuardar, setConfirmarGuardar] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const subida = useSubidaArchivo<{ fotoUrl: string | null }>();

  useEffect(() => {
    return () => {
      if (vistaPrevia.startsWith('blob:')) URL.revokeObjectURL(vistaPrevia);
    };
  }, [vistaPrevia]);

  const alElegirFoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setMensaje('');
    setError('');
    if (!archivo.type.startsWith('image/')) {
      setError('Elige un archivo de imagen (JPG, PNG o WebP).');
      return;
    }
    try {
      const reducida = await reducirImagenVoucher(archivo, 560, 0.82);
      setFotoNueva(reducida);
      setVistaPrevia(URL.createObjectURL(reducida));
    } catch {
      setError('No pudimos leer esa imagen. Prueba con otra foto.');
    }
  };

  const descartar = () => {
    setFotoNueva(null);
    setVistaPrevia('');
    setError('');
  };

  const guardar = async () => {
    if (!fotoNueva) return;
    const resultado = await subida.ejecutar(async () => {
      const fd = new FormData();
      fd.append('foto', fotoNueva, 'foto.jpg');
      return clienteFetch<{ fotoUrl: string | null }>(`/admin/usuarios/${usuario.id}/foto`, { method: 'PUT', body: fd });
    });
    setConfirmarGuardar(false);
    if (resultado) {
      descartar();
      setMensaje(`Foto de ${usuario.nombres} guardada.`);
    }
  };

  const quitar = async () => {
    setQuitando(true);
    setError('');
    try {
      await api.delete<{ fotoUrl: string | null }>(`/admin/usuarios/${usuario.id}/foto`);
      descartar();
      setMensaje(`Quitaste la foto de ${usuario.nombres}. Se verá su inicial.`);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message || 'No se pudo quitar la foto.' : 'Error de conexión al servidor.');
    } finally {
      setQuitando(false);
      setConfirmarQuitar(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy)' }}>Foto de perfil</span>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: vistaPrevia ? `center / cover no-repeat url(${vistaPrevia})` : 'var(--cp-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            color: 'var(--cp-navy)',
          }}
        >
          {!vistaPrevia && `${usuario.nombres.charAt(0)}${usuario.apellidos.charAt(0)}`.toUpperCase()}
        </div>
        <input
          ref={inputFoto}
          type="file"
          accept="image/*"
          onChange={alElegirFoto}
          aria-label="Elegir foto de la persona"
          style={{ display: 'none' }}
        />
        <Boton type="button" variante="secundario" onClick={() => inputFoto.current?.click()} deshabilitado={deshabilitado || subida.subiendo}>
          Elegir foto
        </Boton>
        {fotoNueva && (
          <>
            <Boton type="button" variante="primario" onClick={() => setConfirmarGuardar(true)} deshabilitado={deshabilitado || subida.subiendo}>
              Guardar foto
            </Boton>
            <Boton type="button" variante="texto" onClick={descartar} deshabilitado={subida.subiendo}>
              Cancelar
            </Boton>
          </>
        )}
        <Boton type="button" variante="texto" onClick={() => setConfirmarQuitar(true)} deshabilitado={deshabilitado || quitando || subida.subiendo}>
          Quitar foto
        </Boton>
      </div>
      <IndicadorSubida estado={subida.estado} error={subida.error} onReintentar={subida.reintentar} />
      {error && (
        <div role="alert" style={{ color: 'var(--cp-rust)', fontWeight: 600, fontSize: '13px' }}>
          {error}
        </div>
      )}
      {mensaje && (
        <div role="status" style={{ color: 'var(--cp-green)', fontWeight: 700, fontSize: '13px' }}>
          {mensaje}
        </div>
      )}

      <Confirmar
        abierto={confirmarGuardar}
        titulo="Guardar la foto"
        mensaje={`¿Usar esta foto como foto de perfil de ${usuario.nombres}?`}
        textoSi="Sí, guardar"
        textoNo="No, revisar"
        cargando={subida.subiendo}
        alConfirmar={guardar}
        alCancelar={() => setConfirmarGuardar(false)}
      />
      <Confirmar
        abierto={confirmarQuitar}
        titulo="Quitar la foto"
        mensaje={`¿Quitar la foto de ${usuario.nombres}? Se volverá a ver su inicial.`}
        textoSi="Sí, quitar"
        textoNo="No, dejarla"
        peligro
        cargando={quitando}
        alConfirmar={quitar}
        alCancelar={() => setConfirmarQuitar(false)}
      />
    </div>
  );
}
