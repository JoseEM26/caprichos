export interface AreaCocinaOpcion {
  id: string;
  nombre: string;
}

export interface SeccionAreasCocinaProps {
  disponibles: AreaCocinaOpcion[];
  valor: string[];
  alCambiar: (areaIds: string[]) => void;
  deshabilitado?: boolean;
}

/** Áreas que atiende un usuario con rol Cocina. Sin ninguna marcada, ve todas las áreas. */
export function SeccionAreasCocina({ disponibles, valor, alCambiar, deshabilitado }: SeccionAreasCocinaProps) {
  const alternar = (id: string, marcada: boolean) => {
    alCambiar(marcada ? [...valor.filter((x) => x !== id), id] : valor.filter((x) => x !== id));
  };
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: '12px 0' }}>
      <legend style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>Áreas que atiende</legend>
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {disponibles.map((a) => (
          <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={valor.includes(a.id)}
              disabled={deshabilitado}
              onChange={(e) => alternar(a.id, e.target.checked)}
            />
            {a.nombre}
          </label>
        ))}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--cp-muted, #6b6b6b)' }}>
        Sin marcar ninguna: ve todas las áreas.
      </p>
    </fieldset>
  );
}
