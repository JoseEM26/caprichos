import { CampoConfig } from './CampoConfig';
import { CATALOGO } from './catalogo';

/** Ayuda visible de un ajuste del catálogo que no es un solo input (interruptor, botón, bloque del mapa). Es destino del buscador. */
export function AyudaBloque({ id }: { id: string }) {
  const e = CATALOGO.find((x) => x.id === id);
  if (!e) return null;
  const meta = [e.unidad && `Unidad: ${e.unidad}`, e.rango && `Rango: ${e.rango}`, e.porDefecto && `Por defecto: ${e.porDefecto}`].filter(Boolean).join(' · ');
  return (
    <CampoConfig id={id}>
      <div className="cfg-ayuda-texto">
        <strong>{e.titulo}.</strong> {e.descripcion}
        {e.ejemplo && <span className="cfg-ayuda-meta">Ejemplo: {e.ejemplo}</span>}
        {meta && <span className="cfg-ayuda-meta">{meta}</span>}
        {e.efecto && <span className="cfg-ayuda-meta">Qué pasa si lo cambias: {e.efecto}</span>}
      </div>
    </CampoConfig>
  );
}
