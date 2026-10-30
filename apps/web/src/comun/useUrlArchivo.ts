import { useEffect, useState } from 'react';

/** URL local (blob:) para mostrar un archivo elegido y aún no subido; se libera al cambiar o desmontar. */
export function useUrlArchivo(archivo: File | Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!archivo) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(archivo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [archivo]);
  return url;
}
