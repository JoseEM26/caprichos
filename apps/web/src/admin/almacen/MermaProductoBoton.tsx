import { useState, type CSSProperties } from 'react';
import { almacenApi, type MotivoMermaProducto } from './almacenApi';
import { Boton } from '../../comun/Boton';
import { ErrorApi } from '../../comun/api';

export const MOTIVOS_MERMA: Array<{ valor: MotivoMermaProducto; etiqueta: string }> = [
  { valor: 'VENCIDO', etiqueta: 'Vencido' },
  { valor: 'DANADO', etiqueta: 'Dañado' },
  { valor: 'SE_CAYO', etiqueta: 'Se cayó' },
  { valor: 'OTRO', etiqueta: 'Otro' },
];

/** Error de la merma antes de enviarla, o null si está bien. La cantidad es un entero de 1 hasta el saldo. */
export function errorMerma(cantidadTexto: string, saldo: number, motivo: MotivoMermaProducto, nota: string): string | null {
  const t = cantidadTexto.trim();
  if (!/^\d+$/.test(t) || Number(t) < 1) return 'Escribe cuántas botas (un número entero de 1 o más).';
  if (Number(t) > saldo) return `Solo hay ${saldo}. No puedes botar más de lo que hay.`;
  if (motivo === 'OTRO' && !nota.trim()) return 'Si el motivo es Otro, escribe una nota.';
  return null;
}

interface Props {
  productoId: string;
  saborId?: string;
  /** Nombre completo para mensajes y etiquetas accesibles («DONA · Fresa»). */
  nombre: string;
  saldo: number;
  /** Se llama tras una merma registrada (para recargar la pantalla). */
  alRegistrar: () => void;
}

/**
 * «Botar a merma» de un producto o de un sabor: cantidad, motivo y nota (obligatoria si es Otro).
 * Sin código de supervisor: Cocina la registra y queda auditada (quién y cuándo).
 */
export function MermaProductoBoton({ productoId, saborId, nombre, saldo, alRegistrar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState<MotivoMermaProducto>('VENCIDO');
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cerrar = () => {
    setAbierto(false);
    setCantidad('');
    setNota('');
    setMotivo('VENCIDO');
    setError(null);
  };

  const confirmar = async () => {
    const problema = errorMerma(cantidad, saldo, motivo, nota);
    if (problema) {
      setError(problema);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const res = await almacenApi.mermaProducto({
        productoId,
        ...(saborId ? { saborId } : {}),
        cantidad: Number(cantidad.trim()),
        motivo,
        ...(motivo === 'OTRO' ? { nota: nota.trim() } : {}),
      });
      setExito(`Botado a merma: ${Number(cantidad.trim())}. Quedan ${res.saldo}.`);
      cerrar();
      alRegistrar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo registrar la merma. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  if (!abierto) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button
          type="button"
          aria-label={`Botar a merma ${nombre}`}
          onClick={() => {
            setExito(null);
            setAbierto(true);
          }}
          disabled={saldo <= 0}
          style={botonSecundario}
        >
          Botar a merma
        </button>
        {exito && (
          <span role="status" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-navy)' }}>
            {exito}
          </span>
        )}
      </div>
    );
  }

  const esOtro = motivo === 'OTRO';
  return (
    <div
      role="group"
      aria-label={`Botar a merma ${nombre}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px dashed var(--cp-rust)', borderRadius: 10, padding: 10 }}
    >
      <label style={etiqueta}>
        Cantidad a botar
        <input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          aria-label={`Cantidad a botar de ${nombre}`}
          style={campo}
        />
      </label>
      <label style={etiqueta}>
        Motivo
        <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoMermaProducto)} style={campo} aria-label={`Motivo de la merma de ${nombre}`}>
          {MOTIVOS_MERMA.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.etiqueta}
            </option>
          ))}
        </select>
      </label>
      {esOtro && (
        <label style={etiqueta}>
          Nota (obligatoria)
          <input type="text" maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} aria-label={`Nota de la merma de ${nombre}`} style={campo} />
        </label>
      )}
      {error && (
        <span role="alert" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-rust)' }}>
          {error}
        </span>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Boton tamano="normal" onClick={() => void confirmar()} cargando={enviando} deshabilitado={enviando}>
          Confirmar merma
        </Boton>
        <button type="button" onClick={cerrar} style={botonSecundario}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

const etiqueta: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--cp-navy)' };
const campo: CSSProperties = {
  minHeight: 40,
  boxSizing: 'border-box',
  borderRadius: 8,
  border: '1.5px solid var(--cp-navy)',
  background: 'var(--cp-white)',
  color: 'var(--cp-navy)',
  padding: '0 8px',
  fontSize: 15,
  fontWeight: 600,
};
const botonSecundario: CSSProperties = {
  minHeight: 40,
  padding: '0 14px',
  borderRadius: 9999,
  border: '1.5px solid var(--cp-rust)',
  background: 'transparent',
  color: 'var(--cp-rust)',
  fontFamily: 'Montserrat, sans-serif',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
  alignSelf: 'flex-start',
};
