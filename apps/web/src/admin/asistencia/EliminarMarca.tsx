import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { ETIQUETA_TIPO_CAL } from './calendarioApi';
import { revisarMarca } from './asistenciaApi';
import type { CronoMarca } from './correccionesApi';

const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;

/** Eliminar una entrada o salida (solo ADMIN): la marca deja de contar, pero la fila queda en el historial con quién, cuándo y por qué. */
export function EliminarMarca({ marca, alVolver, alEliminar, onError }: {
  marca: CronoMarca; alVolver: () => void; alEliminar: () => Promise<void>; onError: (m: string | null) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nombre = ETIQUETA_TIPO_CAL[marca.rol ?? ''] ?? 'Marca';
  const eliminar = async () => {
    setOcupado(true);
    setError(null);
    try {
      await revisarMarca(marca.id, 'anular', motivo.trim());
      onError(null);
      await alEliminar();
      alVolver();
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo eliminar la marca.'));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="ca-correccion" aria-label={`Eliminar la marca de las ${marca.hora}`}>
      <Boton type="button" variante="texto" onClick={alVolver}>← Volver a las marcas</Boton>
      <h4>Eliminar: {nombre} de las {marca.hora}</h4>
      <label className="as-campo">Motivo (mínimo 10 caracteres)
        <input value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
      </label>
      <small className="as-ayuda">La marca ya no cuenta: las horas, la tardanza y el sueldo del período se recalculan. La fila queda en el historial y en Auditoría con tu nombre y el motivo.</small>
      {error && <div role="alert" className="as-aviso as-aviso--error">{error}</div>}
      <div className="as-acciones">
        <Boton type="button" variante="peligro" disabled={motivo.trim().length < 10 || ocupado} onClick={() => void eliminar()}>{ocupado ? 'Eliminando…' : 'Eliminar marca'}</Boton>
        <Boton type="button" variante="secundario" onClick={alVolver}>Cancelar</Boton>
      </div>
    </section>
  );
}
