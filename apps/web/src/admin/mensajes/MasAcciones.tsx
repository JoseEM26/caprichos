import { DetalleConversacion } from './mensajesTipos';
import { esUsuarioWhatsApp } from './utilidadesChat';

export interface MasAccionesProps {
  detalle: DetalleConversacion;
  mensajeCopiado: string | null;
  onMarcarAtendido: () => void;
  onCopiarProductos: () => void;
  onCopiarCelular: () => void;
}

/** Menú «Más acciones»: marcar atendido, copiar y abrir en WhatsApp. */
export function MasAcciones({ detalle, mensajeCopiado, onMarcarAtendido, onCopiarProductos, onCopiarCelular }: MasAccionesProps) {
  return (
    <details className="cv-more">
      <summary>Más acciones</summary>
      <div className="cv-moreb">
        {detalle.estado !== 'atendido' && <button onClick={onMarcarAtendido}>Marcar atendido</button>}
        <button onClick={onCopiarProductos}>Copiar solo productos</button>
        {!esUsuarioWhatsApp(detalle) && (
          <>
            <button onClick={onCopiarCelular}>Copiar celular</button>
            <a href={`https://wa.me/51${detalle.telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
              Abrir en WhatsApp
            </a>
          </>
        )}
      </div>
      {mensajeCopiado && (
        <div
          role="status"
          style={{
            whiteSpace: 'pre-line',
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--cp-green)',
            padding: '0 10px 8px',
          }}
        >
          {mensajeCopiado}
        </div>
      )}
    </details>
  );
}
