import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Insignia } from '../../comun/Insignia';
import { ModalFormulario } from '../../comun/ModalFormulario';
import { jornadaActual } from './jornada';
import { Plegable } from './Plegable';
import { DIAS_SEMANA, TarifaEspecialDia, TarifaEspecialRegla, crearTarifaEspecial, editarTarifaEspecial, listarTarifasEspeciales, soles } from './planillaApi';

const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;

export const TEXTO_AYUDA_TARIFA = 'Desde esa hora y ese día se paga a esta tarifa en vez del valor hora normal. Las horas anteriores siguen normales. Si el día es feriado se aplica solo esta tarifa.';

/** Insignia de un día con tarifa especial («Tarifa especial S/ 15.00/h desde 19:00»). */
export function InsigniaTarifaEspecial({ t }: { t: Pick<TarifaEspecialDia, 'desdeHora' | 'tarifaHora'> }) {
  return <Insignia variante="acento">Tarifa especial {soles(t.tarifaHora)}/h desde {t.desdeHora}</Insignia>;
}

interface Borrador { diaSemana: number; desdeHora: string; tarifaHora: string; vigenteDesde: string; vigenteHasta: string; nota: string }
const borradorNuevo = (): Borrador => ({ diaSemana: 0, desdeHora: '19:00', tarifaHora: '15.00', vigenteDesde: jornadaActual(), vigenteHasta: '', nota: '' });
const borradorDe = (r: TarifaEspecialRegla): Borrador => ({
  diaSemana: r.diaSemana, desdeHora: r.desdeHora, tarifaHora: r.tarifaHora.toFixed(2), vigenteDesde: r.vigenteDesde, vigenteHasta: r.vigenteHasta ?? '', nota: r.nota ?? '',
});

/** Errores de la pantalla que el servidor no detecta: tarifa positiva, hora HH:MM y fin no antes del inicio. */
function errorBorrador(b: Borrador): string | null {
  if (!(Number(b.tarifaHora.replace(',', '.')) > 0)) return 'La tarifa por hora debe ser mayor que cero.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.desdeHora)) return 'Indica la hora desde la que rige (HH:MM).';
  if (!b.vigenteDesde) return 'Indica desde qué fecha rige.';
  if (b.vigenteHasta && b.vigenteHasta < b.vigenteDesde) return 'La fecha «hasta» no puede ser anterior a «desde».';
  return null;
}

function Tarifas({ partyId, onCambio, onError, onOk }: { partyId: number; onCambio: () => void; onError: (m: string | null) => void; onOk: (m: string | null) => void }) {
  const [reglas, setReglas] = useState<TarifaEspecialRegla[] | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  // edit: id null = regla nueva
  const [edit, setEditar] = useState<{ id: number | null; b: Borrador; ini: string } | null>(null);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const setEdit = (v: { id: number | null; b: Borrador } | null) => { setErrorGuardar(null); setEditar(v && { ...v, ini: JSON.stringify(v.b) }); };
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await listarTarifasEspeciales(partyId);
      setReglas(r.reglas);
      setErrorCarga(null);
    } catch (e) {
      setErrorCarga(mensajeDe(e, 'No pudimos cargar las tarifas especiales.'));
    }
  }, [partyId]);
  useEffect(() => { void cargar(); }, [cargar]);

  const guardar = async () => {
    if (!edit) return;
    const { id, b } = edit;
    const datos = { diaSemana: b.diaSemana, desdeHora: b.desdeHora, tarifaHora: Number(b.tarifaHora.replace(',', '.')), vigenteDesde: b.vigenteDesde, vigenteHasta: b.vigenteHasta, nota: b.nota.trim() };
    setOcupado(true);
    try {
      if (id === null) await crearTarifaEspecial({ partyId, ...datos });
      else await editarTarifaEspecial(id, datos);
      onError(null);
      onOk(id === null ? 'Tarifa especial agregada.' : 'Tarifa especial guardada.');
      setEdit(null);
      await cargar();
      onCambio();
    } catch (e) {
      const m = mensajeDe(e, 'No se pudo guardar la tarifa especial.');
      setErrorGuardar(m);
      onError(m);
    } finally {
      setOcupado(false);
    }
  };

  const cambiarActiva = async (r: TarifaEspecialRegla) => {
    setOcupado(true);
    try {
      await editarTarifaEspecial(r.id, { activa: !r.activa });
      onError(null);
      onOk(r.activa ? 'Tarifa especial desactivada.' : 'Tarifa especial activada.');
      await cargar();
      onCambio();
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo cambiar la tarifa especial.'));
    } finally {
      setOcupado(false);
    }
  };

  const set = (campo: keyof Borrador, valor: string | number) => setEditar((e) => (e ? { ...e, b: { ...e.b, [campo]: valor } } : e));
  const errorForm = edit ? errorBorrador(edit.b) : null;

  if (errorCarga) return <p role="alert" className="as-ayuda">{errorCarga}</p>;
  if (!reglas) return <Cargando mensaje="Cargando tarifas especiales" />;

  return (
    <div className="pp-seccion" style={{ display: 'grid', gap: 10 }}>
      <p className="as-ayuda">{TEXTO_AYUDA_TARIFA}</p>
      {reglas.length === 0 ? <small className="as-nota">Esta persona no tiene tarifas especiales.</small> : (
        <ul className="pl-filas">
          {reglas.map((r) => (
            <li key={r.id} className="pl-fila" style={{ display: 'grid', justifyItems: 'stretch', opacity: r.activa ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span><Insignia variante={r.activa ? 'exito' : 'neutro'}>{r.activa ? 'Activa' : 'Inactiva'}</Insignia> {DIAS_SEMANA[r.diaSemana]} desde {r.desdeHora}</span>
                <strong>{soles(r.tarifaHora)}/h</strong>
              </div>
              <small className="as-nota">
                Vigente desde {r.vigenteDesde}{r.vigenteHasta ? ` hasta ${r.vigenteHasta}` : ' sin fecha de fin'}{r.nota ? ` · ${r.nota}` : ''}
              </small>
              <div className="as-acciones">
                <Boton type="button" variante="secundario" tamano="pequeno" disabled={ocupado} onClick={() => setEdit({ id: r.id, b: borradorDe(r) })}>Editar</Boton>
                <Boton type="button" variante="texto" tamano="pequeno" disabled={ocupado} onClick={() => void cambiarActiva(r)}>{r.activa ? 'Desactivar' : 'Activar'}</Boton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {edit && (
        <ModalFormulario
          titulo={edit.id === null ? 'Agregar tarifa especial' : 'Editar tarifa especial'}
          sucio={JSON.stringify(edit.b) !== edit.ini}
          bloqueado={ocupado}
          alCerrar={() => setEdit(null)}
          alEnviar={(e: FormEvent) => { e.preventDefault(); if (!errorForm) void guardar(); }}
          pie={<>
            <Boton type="button" variante="secundario" onClick={() => setEdit(null)} disabled={ocupado}>Cancelar</Boton>
            <Boton type="submit" disabled={ocupado || !!errorForm}>{edit.id === null ? 'Agregar tarifa especial' : 'Guardar cambios'}</Boton>
          </>}
        >
          <div className="as-form">
            <label className="as-campo">Día
              <select value={edit.b.diaSemana} onChange={(e) => set('diaSemana', Number(e.target.value))}>
                {DIAS_SEMANA.map((n, i) => <option key={n} value={i}>{n}</option>)}
              </select>
            </label>
            <label className="as-campo">Desde la hora <input type="time" value={edit.b.desdeHora} onChange={(e) => set('desdeHora', e.target.value)} /></label>
            <label className="as-campo">Tarifa por hora (S/) <input type="number" min="0.01" step="0.01" inputMode="decimal" value={edit.b.tarifaHora} onChange={(e) => set('tarifaHora', e.target.value)} /></label>
            <label className="as-campo">Vigente desde <input type="date" value={edit.b.vigenteDesde} onChange={(e) => set('vigenteDesde', e.target.value)} /></label>
            <label className="as-campo">Vigente hasta (opcional) <input type="date" value={edit.b.vigenteHasta} min={edit.b.vigenteDesde} onChange={(e) => set('vigenteHasta', e.target.value)} /></label>
          </div>
          <label className="as-campo">Nota (opcional)
            <input maxLength={200} value={edit.b.nota} onChange={(e) => set('nota', e.target.value)} />
          </label>
          {errorForm && <small className="as-nota" role="status">{errorForm}</small>}
          {errorGuardar && <div role="alert" className="as-aviso as-aviso--error">{errorGuardar}</div>}
        </ModalFormulario>
      )}
      {!edit && (
        <div className="as-acciones">
          <Boton type="button" variante="secundario" disabled={ocupado} onClick={() => setEdit({ id: null, b: borradorNuevo() })}>Agregar tarifa especial</Boton>
        </div>
      )}
    </div>
  );
}

/** Sección plegable «Tarifas especiales» de la pantalla de la persona (se carga al abrirla). */
export function SeccionTarifasEspeciales(props: { partyId: number; onCambio: () => void; onError: (m: string | null) => void; onOk: (m: string | null) => void }) {
  return (
    <Plegable titulo="Tarifas especiales" resumen="Ej.: domingos desde las 19:00" perezoso>
      <Tarifas {...props} />
    </Plegable>
  );
}
