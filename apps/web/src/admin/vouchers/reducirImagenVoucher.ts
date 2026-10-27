/**
 * Reduce una imagen a máximo 1600px (ancho o alto) conservando su relación de aspecto
 * y codificándola en JPEG con calidad 0.85 en el navegador.
 */
export async function reducirImagenVoucher(
  archivo: File | Blob,
  maxDimension: number = 1600,
  calidad: number = 0.85,
): Promise<Blob> {
  // Entornos sin soporte de DOM / canvas / createObjectURL (p. ej. SSR o Node sin canvas)
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return archivo;
  }

  return new Promise<Blob>((resolve) => {
    // Si no hay createImageBitmap ni FileReader/Image, devolver original
    if (typeof FileReader === 'undefined' && typeof createImageBitmap === 'undefined') {
      return resolve(archivo);
    }

    const objectUrl = URL.createObjectURL(archivo);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width <= 0 || height <= 0) {
        return resolve(archivo);
      }

      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve(archivo);
      }

      ctx.drawImage(img, 0, 0, width, height);

      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(archivo);
            }
          },
          'image/jpeg',
          calidad,
        );
      } else {
        // Fallback si toBlob no está disponible
        resolve(archivo);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(archivo);
    };

    img.src = objectUrl;
  });
}
