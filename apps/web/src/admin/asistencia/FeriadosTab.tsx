import { useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Insignia } from '../../comun/Insignia';
import { jornadaActual, useUltimaPeticion } from './jornada';
import { Feriado, crearFeriado, editarFeriado, listarFeriados } from './planillaApi';

type Avisar = (m: string | null) => void;
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;
const anioHoy = () => Number(jornadaActual().slice(0, 4));

/** Feriados (solo ADMIN): las horas trabajadas en un feriado activo se pagan a valor hora × recargo. Se desactivan, no se borran. */
export function FeriadosTab({ onError, onOk }: { onError: Avisar; onOk: Avisar }) {
  const [anio, setAnio] = useState(anioHoy());
  const [lista, setLista] = useState<Feriado[] | null>(null);
  const [fecha, setFecha] = useState('');
  const [nombre, setNombre] = useState('');
  const [recargo, setRecargo] = useState('2');
  const [ocupado, setOcupado] = useState(false);

  const nueva = useUltimaPeticion();
  const cargar = useCallback(() => {
    const vigente = nueva();
    listarFeriados(anio)
      .then((l) => vigente() && setLista(l))
      .catch((e) => vigente() && onError(mensajeDe(e, 'No pudimos cargar los feriados.')));
  }, [anio, onError, nueva]);
  useEffect(() => { setLista(null); cargar(); }, [cargar]);

  const ejecutar = async (f: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    onError(null);
    try {
      await f();
      onOk(ok);
      cargar();
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo guardar.'));
    } finally {
      setOcupado(false);
    }
  };

  const agregar = async (e: React.FormEvent) => {
    e.preventDefault();
    await ejecutar(() => crearFeriado({ fecha, nombre, recargo: Number(recargo) }), 'Feriado agregado.');
    setFecha('');
    setNombre('');
  };

  return (
    <div className="as-vista">
      <p className="as-ayuda">
        Las horas trabajadas en un feriado activo se pagan a valor hora × recargo (normal ×2). Un período ya pagado no se recalcula. Los feriados no se borran: se desactivan.
      </p>
      <form onSubmit={(e) => void agregar(e)} className="as-form-fila" aria-label="Agregar feriado">
        <label className="as-campo">Fecha<input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
        <label className="as-campo">Nombre<input required minLength={2} maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
        <label className="as-campo">Recargo (×)<input type="number" min={1} max={5} step="0.25" required value={recargo} onChange={(e) => setRecargo(e.target.value)} /></label>
        <Boton type="submit" disabled={ocupado || !fecha || nombre.trim().length < 2}>Agregar</Boton>
      </form>
      <label className="as-campo">
        Año
        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
          {[anioHoy() - 1, anioHoy(), anioHoy() + 1, anioHoy() + 2].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      {!lista ? <Cargando mensaje="Cargando" /> : lista.length === 0 ? <EstadoVacio titulo="Sin feriados en este año" descripcion="Agrega los que correspondan arriba." /> : (
        <div className="as-tabla-wrap">
          <table className="as-tabla">
            <thead><tr><th>Fecha</th><th>Nombre</th><th>Recargo</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {lista.map((f) => (
                <tr key={f.id}>
                  <td data-label="Fecha" className="as-num">{f.fecha}</td>
                  <td data-label="Nombre">{f.nombre}</td>
                  <td data-label="Recargo">
                    <input
                      type="number" min={1} max={5} step="0.25" defaultValue={f.recargo} aria-label={`Recargo de ${f.nombre} ${f.fecha}`} style={{ width: 70 }}
                      onBlur={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= 5 && v !== f.recargo) void ejecutar(() => editarFeriado(f.id, { recargo: v }), 'Recargo actualizado.'); }}
                    />
                  </td>
                  <td data-label="Estado"><Insignia variante={f.activo ? 'exito' : 'neutro'}>{f.activo ? 'Activo' : 'Desactivado'}</Insignia></td>
                  <td data-label="Acciones">
                    <Boton type="button" variante="secundario" tamano="pequeno" disabled={ocupado} onClick={() => void ejecutar(() => editarFeriado(f.id, { activo: !f.activo }), f.activo ? 'Feriado desactivado.' : 'Feriado activado.')}>
                      {f.activo ? 'Desactivar' : 'Activar'}
                    </Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
