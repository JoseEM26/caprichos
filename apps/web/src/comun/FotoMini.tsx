import { useSubidaArchivo } from './useSubidaArchivo';
import { IndicadorSubida } from './IndicadorSubida';
import { clienteFetch } from './api';

export interface FotoSubida {
  id: string;
  url: string;
}

export interface FotoMiniProps {
  /** Texto para lectores de pantalla y botones, p. ej. «Grande» o «Almendra». */
  etiqueta: string;
  url?: string | null;
  deshabilitado?: boolean;
  /** Foto nueva subida, o null al quitarla. */
  alCambiar: (foto: FotoSubida | null) => void;
}

/** Sube un archivo de imagen al servidor (misma ruta que usan el producto y la oferta). */
export function subirArchivoImagen(archivo: File): Promise<FotoSubida> {
  const datos = new FormData();
  datos.append('archivo', archivo);
  return clienteFetch<FotoSubida>('/admin/archivos', { method: 'POST', body: datos });
}

/** Foto opcional pequeña: miniatura + «Subir foto» / «Quitar». Sin foto propia, la carta usa la del producto o combo. */
export function FotoMini({ etiqueta, url, deshabilitado, alCambiar }: FotoMiniProps) {
  const subida = useSubidaArchivo();
  const elegir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    void subida.ejecutar(async () => alCambiar(await subirArchivoImagen(archivo)));
  };
  return (
    <span className="foto-mini" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {url && <img src={url} alt={`Foto de ${etiqueta}`} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />}
      <label className="eo-btn eo-mini" aria-label={`${url ? 'Cambiar' : 'Subir'} foto de ${etiqueta}`}>
        {subida.subiendo ? 'Subiendo…' : url ? 'Cambiar foto' : 'Subir foto'}
        <input type="file" accept="image/*" onChange={elegir} disabled={deshabilitado || subida.subiendo} style={{ display: 'none' }} />
      </label>
      {url && (
        <button type="button" className="eo-btn eo-mini" aria-label={`Quitar foto de ${etiqueta}`} disabled={deshabilitado} onClick={() => alCambiar(null)}>
          Quitar foto
        </button>
      )}
      <IndicadorSubida estado={subida.estado} error={subida.error} onReintentar={subida.reintentar} />
    </span>
  );
}

/** Interruptor «Mostrar imágenes» (mismas clases que el resto de interruptores del admin). */
export function InterruptorImagenes({ marcado, texto = 'Mostrar imágenes', deshabilitado, alCambiar }: { marcado: boolean; texto?: string; deshabilitado?: boolean; alCambiar: (v: boolean) => void }) {
  return (
    <label className="eo-interruptor">
      <input type="checkbox" checked={marcado} disabled={deshabilitado} onChange={(e) => alCambiar(e.target.checked)} />
      <span className="eo-pista" aria-hidden="true" />
      <span className="eo-interruptor-texto">{texto}</span>
    </label>
  );
}
