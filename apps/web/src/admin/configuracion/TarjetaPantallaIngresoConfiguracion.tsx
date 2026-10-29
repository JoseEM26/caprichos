import { useState, useEffect, useCallback } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { ErrorApi } from '../../comun/api';
import { CampoAyuda } from './AyudaCampo';
import { CampoConfig } from './CampoConfig';
import { reducirImagenVoucher } from '../vouchers/reducirImagenVoucher';
import {
  FRASE_INGRESO_DEFECTO,
  IMAGENES_FABRICA_INGRESO,
  ImagenIngresoConfig,
  MAX_FRASE_INGRESO,
  MAX_IMAGENES_INGRESO,
  pantallaIngresoApi,
  urlImagenIngreso,
} from './pantallaIngresoApi';

const NOMBRES_FABRICA: Record<string, string> = {
  'caprichos-de-octubre.webp': 'Caprichos de octubre',
  'donuts-halloween.webp': 'Donuts de Halloween',
  'fantasma-cafe.webp': 'Fantasma con café',
  'hechizo-pumpkin.webp': 'Hechizo pumpkin',
  'caprichos-del-mes.webp': 'Caprichos del mes',
};

const MAX_LADO_SUBIDA_PX = 1400;

const mismaImagen = (a: ImagenIngresoConfig, b: ImagenIngresoConfig) =>
  a.tipo === b.tipo && a.valor === b.valor;

const estiloTarjeta = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '14px',
  padding: '18px 20px',
  background: 'var(--cp-white, #FFFFFF)',
  border: '1px solid var(--cp-line, #E3D6C6)',
  borderRadius: '16px',
  boxShadow: '0 2px 8px rgba(11, 44, 62, 0.05)',
  fontFamily: 'Montserrat, sans-serif',
};

const estiloSeccion = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '10px',
  background: 'var(--cp-cream, #FBF4EC)',
  border: '1px solid var(--cp-line, #E3D6C6)',
  borderRadius: '12px',
  padding: '14px',
};

const estiloTituloSeccion = {
  fontWeight: 800,
  fontSize: '13.5px',
  color: 'var(--cp-navy, #0B2C3E)',
};

const estiloMiniatura = {
  width: '56px',
  height: '72px',
  objectFit: 'cover' as const,
  borderRadius: '8px',
  flexShrink: 0,
  background: 'var(--cp-sand, #E3D6C6)',
};

export function TarjetaPantallaIngresoConfiguracion() {
  const [seleccion, setSeleccion] = useState<ImagenIngresoConfig[]>([]);
  const [propias, setPropias] = useState<ImagenIngresoConfig[]>([]);
  const [frase, setFrase] = useState<string>(FRASE_INGRESO_DEFECTO);
  const [cargando, setCargando] = useState<boolean>(true);
  const [subiendo, setSubiendo] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [confirmarGuardar, setConfirmarGuardar] = useState<boolean>(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await pantallaIngresoApi.obtenerAdmin();
      setSeleccion(datos.imagenes);
      setPropias(datos.imagenes.filter((img) => img.tipo === 'archivo'));
      setFrase(datos.frase);
    } catch (err) {
      setError(
        err instanceof ErrorApi
          ? err.message
          : 'No se pudo cargar la configuración de la pantalla de ingreso',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const fabrica: ImagenIngresoConfig[] = IMAGENES_FABRICA_INGRESO.map((valor) => ({
    tipo: 'defecto',
    valor,
  }));
  const disponibles = [...fabrica, ...propias];

  const estaElegida = (img: ImagenIngresoConfig) => seleccion.some((s) => mismaImagen(s, img));

  const alternarImagen = (img: ImagenIngresoConfig) => {
    setMensajeExito(null);
    setError(null);
    if (estaElegida(img)) {
      setSeleccion((prev) => prev.filter((s) => !mismaImagen(s, img)));
      return;
    }
    if (seleccion.length >= MAX_IMAGENES_INGRESO) {
      setError(`Ya elegiste ${MAX_IMAGENES_INGRESO} imágenes. Quita una para agregar otra.`);
      return;
    }
    setSeleccion((prev) => [...prev, img]);
  };

  const moverImagen = (indice: number, direccion: -1 | 1) => {
    setSeleccion((prev) => {
      const destino = indice + direccion;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  };

  const quitarImagen = (indice: number) => {
    setMensajeExito(null);
    setSeleccion((prev) => prev.filter((_, i) => i !== indice));
  };

  const subirPropia = async (archivo: File) => {
    setSubiendo(true);
    setError(null);
    setMensajeExito(null);
    try {
      // Reduce el lado mayor a 1400 px en el navegador (en fotos verticales, el alto).
      const reducido = await reducirImagenVoucher(archivo, MAX_LADO_SUBIDA_PX, 0.85);
      const url = await pantallaIngresoApi.subirImagen(reducido);
      const nueva: ImagenIngresoConfig = { tipo: 'archivo', valor: url };
      setPropias((prev) => [...prev, nueva]);
      setSeleccion((prev) =>
        prev.length < MAX_IMAGENES_INGRESO ? [...prev, nueva] : prev,
      );
    } catch (err) {
      setError(
        err instanceof ErrorApi
          ? err.message
          : 'No se pudo subir la imagen. Prueba con una foto más liviana.',
      );
    } finally {
      setSubiendo(false);
    }
  };

  const handleSolicitarGuardar = () => {
    setError(null);
    setMensajeExito(null);
    if (seleccion.length === 0) {
      setError('Elige al menos una imagen para la pantalla de ingreso.');
      return;
    }
    if (frase.trim().length > MAX_FRASE_INGRESO) {
      setError(`La frase no puede superar ${MAX_FRASE_INGRESO} caracteres.`);
      return;
    }
    setConfirmarGuardar(true);
  };

  const handleConfirmarGuardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const guardado = await pantallaIngresoApi.guardar({
        imagenes: seleccion,
        frase: frase.trim(),
      });
      setSeleccion(guardado.imagenes);
      setFrase(guardado.frase);
      setConfirmarGuardar(false);
      setMensajeExito('Pantalla de ingreso actualizada. Se verá así en la próxima visita.');
    } catch (err) {
      setError(
        err instanceof ErrorApi
          ? err.message
          : 'No se pudo guardar la pantalla de ingreso',
      );
      setConfirmarGuardar(false);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div data-testid="tarjeta-pantalla-ingreso-cargando" style={estiloTarjeta}>
        <Cargando mensaje="Cargando pantalla de ingreso..." />
      </div>
    );
  }

  return (
    <div data-testid="tarjeta-pantalla-ingreso" style={estiloTarjeta}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'var(--cp-sand, #E3D6C6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '14px',
            color: 'var(--cp-navy, #0B2C3E)',
          }}
        >
          IMG
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--cp-navy, #0B2C3E)' }}>
            Pantalla de ingreso
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--cp-soft, #2C4C5D)', marginTop: '2px' }}>
            Imágenes del carrusel y frase de la pantalla /admin/ingresar. Hasta {MAX_IMAGENES_INGRESO} imágenes.
          </div>
        </div>
      </div>

      {/* Imágenes elegidas, en orden */}
      <CampoConfig id="ingreso-carrusel" style={estiloSeccion}>
        <div style={estiloTituloSeccion}>
          Imágenes elegidas ({seleccion.length} de {MAX_IMAGENES_INGRESO}, en este orden)
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cp-soft, #2C4C5D)' }}>
          Estas fotos rotan en la pantalla de ingreso del personal, en este orden. Subir y Bajar cambian el orden; Quitar la saca del carrusel sin borrarla del sistema.
        </div>
        {seleccion.length === 0 && (
          <div style={{ fontSize: '12.5px', color: 'var(--cp-soft, #2C4C5D)' }}>
            Todavía no elegiste imágenes. Marca al menos una abajo.
          </div>
        )}
        {seleccion.map((img, indice) => (
          <div
            key={`${img.tipo}-${img.valor}`}
            data-testid="imagen-ingreso-elegida"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              background: 'var(--cp-white, #FFFFFF)',
              border: '1px solid var(--cp-line, #E3D6C6)',
              borderRadius: '10px',
              padding: '8px',
            }}
          >
            <img src={urlImagenIngreso(img)} alt="" loading="lazy" width={56} height={72} style={estiloMiniatura} />
            <span style={{ flex: '1 1 160px', fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy, #0B2C3E)' }}>
              {img.tipo === 'defecto'
                ? NOMBRES_FABRICA[img.valor] || img.valor
                : `Foto propia ${indice + 1}`}
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <Boton
                variante="secundario"
                tamano="pequeno"
                disabled={indice === 0 || guardando}
                onClick={() => moverImagen(indice, -1)}
                aria-label={`Subir la imagen ${indice + 1} en el orden`}
              >
                Subir
              </Boton>
              <Boton
                variante="secundario"
                tamano="pequeno"
                disabled={indice === seleccion.length - 1 || guardando}
                onClick={() => moverImagen(indice, 1)}
                aria-label={`Bajar la imagen ${indice + 1} en el orden`}
              >
                Bajar
              </Boton>
              <Boton
                variante="texto"
                tamano="pequeno"
                disabled={guardando}
                onClick={() => quitarImagen(indice)}
                aria-label={`Quitar la imagen ${indice + 1} del carrusel`}
              >
                Quitar
              </Boton>
            </div>
          </div>
        ))}
      </CampoConfig>

      {/* Biblioteca: fábrica y propias */}
      <CampoConfig id="ingreso-biblioteca" style={estiloSeccion}>
        <div style={estiloTituloSeccion}>Biblioteca de imágenes</div>
        <div style={{ fontSize: '12px', color: 'var(--cp-soft, #2C4C5D)' }}>
          Marca o desmarca para usar o quitar una imagen. Quitarla no la borra del sistema.
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '10px',
          }}
        >
          {disponibles.map((img) => {
            const elegida = estaElegida(img);
            const nombre =
              img.tipo === 'defecto'
                ? NOMBRES_FABRICA[img.valor] || img.valor
                : 'Foto propia';
            return (
              <label
                key={`${img.tipo}-${img.valor}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '8px',
                  borderRadius: '10px',
                  background: 'var(--cp-white, #FFFFFF)',
                  border: `1.5px solid ${elegida ? 'var(--cp-orange, #E67929)' : 'var(--cp-line, #E3D6C6)'}`,
                  cursor: guardando ? 'default' : 'pointer',
                  fontSize: '12px',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 700,
                }}
              >
                <img src={urlImagenIngreso(img)} alt="" loading="lazy" width={120} height={150} style={{ ...estiloMiniatura, width: '100%', height: 'auto', aspectRatio: '4 / 5' }} />
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="checkbox"
                    checked={elegida}
                    disabled={guardando}
                    onChange={() => alternarImagen(img)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  {nombre}
                </span>
              </label>
            );
          })}
        </div>

        <CampoConfig id="ingreso-subir-foto">
          <label
            htmlFor="pantalla-ingreso-subir"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: '44px',
              padding: '0 16px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              color: 'var(--cp-navy, #0B2C3E)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: subiendo || guardando ? 'default' : 'pointer',
              opacity: subiendo || guardando ? 0.6 : 1,
            }}
          >
            {subiendo ? 'Subiendo imagen...' : 'Subir foto propia'}
          </label>
          <input
            id="pantalla-ingreso-subir"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={subiendo || guardando}
            style={{ display: 'none' }}
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              e.target.value = '';
              if (archivo) void subirPropia(archivo);
            }}
          />
          <div style={{ fontSize: '11.5px', color: 'var(--cp-soft, #2C4C5D)', marginTop: '6px' }}>
            Sube una foto JPG, PNG o WebP; se reduce en el navegador antes de subirla, queda en la biblioteca y se agrega al carrusel si hay lugar (máximo {MAX_IMAGENES_INGRESO}).
          </div>
        </CampoConfig>
      </CampoConfig>

      {/* Frase */}
      <div style={estiloSeccion}>
        <CampoAyuda
          id="pantalla-ingreso-frase"
          etiqueta="Frase de la pantalla"
          ayuda={`Texto de bienvenida que ve el personal al ingresar. ${frase.length} de ${MAX_FRASE_INGRESO} caracteres. Si la dejas vacía se usa la frase por defecto.`}
          efecto="Cambia el texto que ven todos los usuarios en la pantalla de ingreso desde su siguiente visita. No afecta el inicio de sesión."
          ejemplo={FRASE_INGRESO_DEFECTO}
          unidad="caracteres"
          rango={`hasta ${MAX_FRASE_INGRESO}`}
          porDefecto={FRASE_INGRESO_DEFECTO}
          cfgId="ingreso-frase"
        >
          <input
            type="text"
            maxLength={MAX_FRASE_INGRESO}
            value={frase}
            disabled={guardando}
            onChange={(e) => setFrase(e.target.value)}
            placeholder={FRASE_INGRESO_DEFECTO}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '44px',
              borderRadius: '8px',
              border: '1.5px solid var(--cp-line, #E3D6C6)',
              background: 'var(--cp-white, #FFFFFF)',
              padding: '0 10px',
              fontSize: '13px',
            }}
          />
        </CampoAyuda>
      </div>

      <CampoConfig id="ingreso-guardar" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Boton
          variante="primario"
          cargando={guardando}
          disabled={subiendo}
          onClick={handleSolicitarGuardar}
          data-testid="btn-guardar-pantalla-ingreso"
        >
          Guardar pantalla de ingreso
        </Boton>
      </CampoConfig>

      {mensajeExito && (
        <div role="status" style={{ color: 'var(--cp-green, #2F7A45)', fontSize: '12.5px', fontWeight: 700 }}>
          {mensajeExito}
        </div>
      )}

      {error && (
        <div role="alert" style={{ color: 'var(--cp-rust, #B2500F)', fontSize: '12.5px', fontWeight: 700 }}>
          {error}
        </div>
      )}

      <Confirmar
        abierto={confirmarGuardar}
        titulo="¿Guardar la pantalla de ingreso?"
        mensaje={`Se mostrarán ${seleccion.length} imagen${seleccion.length === 1 ? '' : 'es'} en el orden elegido y la frase "${frase.trim() || FRASE_INGRESO_DEFECTO}".`}
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={handleConfirmarGuardar}
        alCancelar={() => setConfirmarGuardar(false)}
      />
    </div>
  );
}
