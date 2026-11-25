/** Miniatura compacta de una opción, sabor o tamaño; sin foto no dibuja nada. */
export function Miniatura({ url, tamano = 32 }: { url?: string | null; tamano?: number }) {
  if (!url) return null;
  return <img src={url} alt="" width={tamano} height={tamano} loading="lazy" data-testid="miniatura" style={{ width: tamano, height: tamano, borderRadius: 8, objectFit: 'cover', flex: 'none' }} />;
}
