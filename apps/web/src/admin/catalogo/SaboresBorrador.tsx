import { useState } from 'react';
import { FotoMini, InterruptorImagenes } from '../../comun/FotoMini';
import type { SaborItem } from './catalogoApi';

interface Props {
  sabores: SaborItem[];
  onChange: (sabores: SaborItem[]) => void;
  mostrarImagenes: boolean;
  onMostrarImagenes: (v: boolean) => void;
}

/**
 * Sabores de un producto que aún no existe (opcional). Cada sabor puede llevar su foto: se sube ya, con un id de archivo
 * que no depende del producto, y ese id viaja en el payload de creación.
 */
export function SaboresBorrador({ sabores, onChange, mostrarImagenes, onMostrarImagenes }: Props) {
  const [nuevo, setNuevo] = useState('');
  const agregar = () => {
    const nombre = nuevo.trim();
    if (!nombre || sabores.some((s) => s.nombre.toLowerCase() === nombre.toLowerCase())) return;
    onChange([...sabores, { nombre, activo: true }]);
    setNuevo('');
  };
  return (
    <section aria-label="Sabores del producto nuevo" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>Sabores (opcional)</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="eo-input" aria-label="Nuevo sabor" placeholder="Ej. Vainilla" value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }} />
        <button type="button" className="eo-btn" onClick={agregar}>+ Agregar sabor</button>
      </div>
      {sabores.length > 0 && (
        <InterruptorImagenes marcado={mostrarImagenes} texto="Mostrar imágenes de los sabores" alCambiar={onMostrarImagenes} />
      )}
      {sabores.map((s, i) => (
        <div key={s.nombre} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{s.nombre}</span>
          {mostrarImagenes && (
            <FotoMini etiqueta={s.nombre} url={s.fotoUrl}
              alCambiar={(f) => onChange(sabores.map((x, k) => (k === i ? { ...x, fotoArchivoId: f?.id ?? null, fotoUrl: f?.url ?? null } : x)))} />
          )}
          <button type="button" className="eo-btn eo-mini" aria-label={`Quitar sabor ${s.nombre}`} onClick={() => onChange(sabores.filter((_, k) => k !== i))}>
            Quitar
          </button>
        </div>
      ))}
    </section>
  );
}
