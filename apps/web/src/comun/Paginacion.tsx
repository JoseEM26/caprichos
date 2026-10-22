import { Boton } from './Boton';

export interface PaginacionProps {
  pagina: number;
  totalPaginas: number;
  alCambiarPagina: (nuevaPagina: number) => void;
  totalRegistros?: number;
  tamanoPagina?: number;
}

export function Paginacion({
  pagina,
  totalPaginas,
  alCambiarPagina,
  totalRegistros,
  tamanoPagina,
}: PaginacionProps) {
  if (totalPaginas <= 1 && (!totalRegistros || totalRegistros <= 0)) {
    return null;
  }

  const inicio = tamanoPagina ? (pagina - 1) * tamanoPagina + 1 : undefined;
  const fin =
    tamanoPagina && totalRegistros
      ? Math.min(pagina * tamanoPagina, totalRegistros)
      : undefined;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 4px',
        borderTop: '1px solid var(--cp-line)',
      }}
    >
      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        {totalRegistros !== undefined && inicio !== undefined && fin !== undefined ? (
          <span>
            Mostrando {inicio} a {fin} de {totalRegistros} resultados
          </span>
        ) : (
          <span>
            Página {pagina} de {Math.max(totalPaginas, 1)}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Boton
          variante="secundario"
          tamano="pequeno"
          disabled={pagina <= 1}
          onClick={() => alCambiarPagina(pagina - 1)}
          aria-label="Página anterior"
        >
          Anterior
        </Boton>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            padding: '0 8px',
            color: 'var(--cp-navy)',
          }}
        >
          {pagina} / {Math.max(totalPaginas, 1)}
        </span>
        <Boton
          variante="secundario"
          tamano="pequeno"
          disabled={pagina >= totalPaginas}
          onClick={() => alCambiarPagina(pagina + 1)}
          aria-label="Página siguiente"
        >
          Siguiente
        </Boton>
      </div>
    </div>
  );
}
