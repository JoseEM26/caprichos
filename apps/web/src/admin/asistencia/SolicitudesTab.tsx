import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Confirmar } from '../../comun/Confirmar';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Insignia } from '../../comun/Insignia';
import { Tarjeta } from '../../comun/Tarjeta';
import { Bandeja, ETIQUETA_ROL, ResultadoLote, bandejaCorrecciones, loteCorrecciones } from './correccionesApi';
import './cronograma.css';

type Avisar = (m: string | null) => void;
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;
const hoyLima = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
const sumarDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const MAX_LOTE = 200;

type Clase = 'WEB' | 'CELULAR' | 'DOBLE' | 'SOLICITUD';
interface Item {
  clave: string;
  tipo: 'MARCA' | 'SOLICITUD';
  id: number;
  partyId: number;
  nombre: string;
  roles: string[];
  jornada: string;
  clase: Clase;
  texto: string;
  rara: boolean;
}
const ETIQUETA_CLASE: Record<Clase, string> = {
  WEB: 'Marca manual (usuario y contraseña)',
  CELULAR: 'Marca con alertas de GPS',
  DOBLE: 'Doble marca',
  SOLICITUD: 'Solicitud de corrección',
};

function aItems(b: Bandeja): Item[] {
  const marcas: Item[] = b.marcas.map((m) => ({
    clave: `M${m.id}`, tipo: 'MARCA', id: m.id, partyId: m.partyId, nombre: m.nombre, roles: m.roles, jornada: m.jornada, clase: m.clase,
    texto: `${m.hora} ${m.rol ? ETIQUETA_ROL[m.rol] : 'marca'}${m.alertas ? ` — ${m.alertas}` : ''}`, rara: m.cantidadesRaras,
  }));
  const sols: Item[] = b.solicitudes.map((s) => ({
    clave: `S${s.id}`, tipo: 'SOLICITUD', id: s.id, partyId: s.partyId, nombre: s.nombre ?? `Persona ${s.partyId}`, roles: s.roles ?? [], jornada: s.jornada, clase: 'SOLICITUD',
    texto: `${s.items.map((i) => `${i.hora} ${ETIQUETA_ROL[i.tipo]}`).join(', ')} — «${s.motivo}»`, rara: false,
  }));
  return [...sols, ...marcas].sort((a, b) => b.jornada.localeCompare(a.jornada) || a.nombre.localeCompare(b.nombre));
}

/** Bandeja del admin: solicitudes de corrección y marcas por revisar, con selección múltiple y acciones en lote. */
export function SolicitudesTab({ onError, onOk, alCambiar }: { onError: Avisar; onOk: Avisar; alCambiar?: () => void }) {
  const [bandeja, setBandeja] = useState<Bandeja | null>(null);
  const [tipo, setTipo] = useState<'' | Clase>('');
  const [personas, setPersonas] = useState<string[]>([]);
  const [rol, setRol] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState<'APROBAR' | 'RECHAZAR' | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [errorLote, setErrorLote] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoLote | null>(null);

  const cargar = useCallback(async () => {
    try {
      setBandeja(await bandejaCorrecciones());
      onError(null);
    } catch (e) {
      onError(mensajeDe(e, 'No pudimos cargar la bandeja.'));
    }
  }, [onError]);
  useEffect(() => { void cargar(); }, [cargar]);

  const items = useMemo(() => (bandeja ? aItems(bandeja) : []), [bandeja]);
  const visibles = useMemo(
    () => items.filter((i) =>
      (!tipo || i.clase === tipo) &&
      (personas.length === 0 || personas.includes(String(i.partyId))) &&
      (!rol || i.roles.includes(rol)) &&
      (!desde || i.jornada >= desde) &&
      (!hasta || i.jornada <= hasta)),
    [items, tipo, personas, rol, desde, hasta],
  );
  const opcionesPersona = useMemo(() => [...new Map(items.map((i) => [i.partyId, i.nombre])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [items]);
  const roles = useMemo(() => [...new Set(items.flatMap((i) => i.roles))].sort(), [items]);
  const elegidos = items.filter((i) => sel.has(i.clave));
  const todosVisibles = visibles.length > 0 && visibles.every((i) => sel.has(i.clave));

  const atajo = (d: string, h: string) => { setDesde(d); setHasta(h); };
  const hoy = hoyLima();
  const lunes = sumarDias(hoy, -((new Date(`${hoy}T00:00:00Z`).getUTCDay() + 6) % 7));
  const alternar = (c: string) => setSel((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const marcarVisibles = (v: boolean) => setSel((s) => { const n = new Set(s); visibles.forEach((i) => (v ? n.add(i.clave) : n.delete(i.clave))); return n; });

  const resumenElegidos = () => {
    const quienes = [...new Set(elegidos.map((i) => i.nombre))];
    const fechas = elegidos.map((i) => i.jornada).sort();
    return `${elegidos.length} ${elegidos.length === 1 ? 'ítem' : 'ítems'} de ${quienes.length > 3 ? `${quienes.slice(0, 3).join(', ')} y ${quienes.length - 3} más` : quienes.join(', ')} · del ${fechas[0]} al ${fechas[fechas.length - 1]}`;
  };

  const ejecutar = async () => {
    if (!confirmar) return;
    setOcupado(true);
    setErrorLote(null);
    try {
      const r = await loteCorrecciones({
        accion: confirmar,
        ...(confirmar === 'RECHAZAR' ? { motivo: motivo.trim() } : {}),
        items: elegidos.map((i) => ({ tipo: i.tipo, id: i.id })),
      });
      setResultado(r);
      setConfirmar(null);
      setMotivo('');
      setSel(new Set());
      onOk(`${confirmar === 'APROBAR' ? 'Aprobadas' : 'Rechazadas/anuladas'}: ${r.ok} de ${r.total}.${r.fallidas ? ` ${r.fallidas} no se pudieron procesar (ver abajo).` : ''}`);
      await cargar();
      alCambiar?.();
    } catch (e) {
      setErrorLote(mensajeDe(e, 'No se pudo procesar el lote.'));
    } finally {
      setOcupado(false);
    }
  };

  if (!bandeja) return <Cargando mensaje="Cargando solicitudes" />;
  return (
    <div className="cr-vista">
      <Tarjeta titulo="Solicitudes de corrección y marcas por revisar" subtitulo="Compara con las cámaras y aprueba o rechaza varias de una vez. Una solicitud no cuenta hasta que la apruebas.">
        <div className="cr-filtros" role="group" aria-label="Filtros">
          <label className="as-campo">Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value as '' | Clase)}>
              <option value="">Todos</option>
              {(Object.keys(ETIQUETA_CLASE) as Clase[]).map((c) => <option key={c} value={c}>{ETIQUETA_CLASE[c]}</option>)}
            </select>
          </label>
          <label className="as-campo">Persona(s)
            <select multiple size={3} value={personas} onChange={(e) => setPersonas([...e.target.selectedOptions].map((o) => o.value))}>
              {opcionesPersona.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
            </select>
          </label>
          <label className="as-campo">Rol
            <select value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="">Todos</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="as-campo">Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label className="as-campo">Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
        </div>
        <div className="cr-atajos" role="group" aria-label="Atajos de fechas">
          <Boton type="button" variante="secundario" onClick={() => atajo(hoy, hoy)}>Hoy</Boton>
          <Boton type="button" variante="secundario" onClick={() => atajo(sumarDias(hoy, -1), hoy)}>Últimos 2 días</Boton>
          <Boton type="button" variante="secundario" onClick={() => atajo(sumarDias(hoy, -2), hoy)}>Últimos 3 días</Boton>
          <Boton type="button" variante="secundario" onClick={() => atajo(lunes, hoy)}>Toda la semana</Boton>
          <Boton type="button" variante="texto" onClick={() => { atajo('', ''); setTipo(''); setPersonas([]); setRol(''); }}>Quitar filtros</Boton>
        </div>
      </Tarjeta>

      {bandeja.sinSolicitud.length > 0 && (
        <Tarjeta titulo="Jornadas con inconsistencia sin solicitud" subtitulo="Nadie ha pedido corregirlas todavía: puedes recordárselo a la persona. También bloquean «Marcar pagado».">
          <ul className="cr-alertas">
            {bandeja.sinSolicitud.map((s) => <li key={`${s.partyId}${s.jornada}`}><b>{s.nombre}</b> · {s.jornada}: {s.texto}</li>)}
          </ul>
        </Tarjeta>
      )}

      {visibles.length === 0 ? (
        <EstadoVacio titulo="Nada por revisar" descripcion={items.length ? 'Ningún ítem cumple los filtros.' : 'No hay solicitudes ni marcas pendientes.'} />
      ) : (
        <div className="as-tabla-wrap">
          <table className="as-tabla as-tabla--tarjetas">
            <thead>
              <tr>
                <th>
                  <label className="cr-check">
                    <input type="checkbox" checked={todosVisibles} onChange={(e) => marcarVisibles(e.target.checked)} aria-label="Seleccionar todo lo visible" />
                    Todo lo visible ({visibles.length})
                  </label>
                </th>
                <th>Persona</th><th>Jornada</th><th>Tipo</th><th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((i) => (
                <tr key={i.clave}>
                  <td data-label="Elegir">
                    <label className="cr-check">
                      <input type="checkbox" checked={sel.has(i.clave)} onChange={() => alternar(i.clave)} aria-label={`Elegir ${ETIQUETA_CLASE[i.clase]} de ${i.nombre} del ${i.jornada}`} />
                    </label>
                  </td>
                  <td data-label="Persona">{i.nombre}<small style={{ display: 'block' }}>{i.roles.join(' · ')}</small></td>
                  <td data-label="Jornada" className="as-num">{i.jornada}</td>
                  <td data-label="Tipo"><Insignia variante={i.clase === 'SOLICITUD' ? 'acento' : i.clase === 'DOBLE' ? 'neutro' : 'aviso'}>{ETIQUETA_CLASE[i.clase]}</Insignia>{i.rara && <small style={{ display: 'block' }}>Cantidad rara de marcas</small>}</td>
                  <td data-label="Detalle">{i.texto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {elegidos.length > 0 && (
        <div className="cr-lote" role="region" aria-label="Acciones en lote">
          <strong>{elegidos.length} seleccionadas</strong>
          {elegidos.length > MAX_LOTE && <span role="alert">Máximo {MAX_LOTE} por vez: quita algunas.</span>}
          <Boton type="button" disabled={elegidos.length > MAX_LOTE} onClick={() => { setErrorLote(null); setConfirmar('APROBAR'); }}>Aprobar seleccionadas</Boton>
          <Boton type="button" variante="peligro" disabled={elegidos.length > MAX_LOTE} onClick={() => { setErrorLote(null); setConfirmar('RECHAZAR'); }}>Rechazar/anular seleccionadas</Boton>
          <Boton type="button" variante="texto" onClick={() => setSel(new Set())}>Quitar selección</Boton>
        </div>
      )}

      {resultado && (
        <Tarjeta titulo={`Resultado: ${resultado.ok} de ${resultado.total}`} subtitulo={resultado.fallidas ? `${resultado.fallidas} no se pudieron procesar` : 'Todo se procesó'}>
          <ul className="cr-resultado cr-alertas" aria-label="Resultado por ítem">
            {resultado.resultados.map((r) => (
              <li key={`${r.tipo}${r.id}`} className={r.ok ? 'ok' : 'mal'}>
                {r.tipo === 'MARCA' ? 'Marca' : 'Solicitud'} #{r.id}: {r.ok ? 'listo' : r.mensaje}
              </li>
            ))}
          </ul>
          <Boton type="button" variante="texto" onClick={() => setResultado(null)}>Cerrar resultado</Boton>
        </Tarjeta>
      )}

      <Confirmar
        abierto={confirmar !== null}
        titulo={confirmar === 'APROBAR' ? '¿Aprobar las seleccionadas?' : '¿Rechazar/anular las seleccionadas?'}
        mensaje={resumenElegidos()}
        textoSi={confirmar === 'APROBAR' ? 'Sí, aprobar' : 'Sí, rechazar'}
        textoNo="No"
        peligro={confirmar === 'RECHAZAR'}
        cargando={ocupado}
        error={errorLote}
        deshabilitarConfirmar={confirmar === 'RECHAZAR' && motivo.trim().length < 10}
        alConfirmar={ejecutar}
        alCancelar={() => setConfirmar(null)}
      >
        {confirmar === 'APROBAR' && <p className="as-ayuda">Las solicitudes crean sus marcas; las marcas por revisar pasan a contar. Lo que no se pueda (período pagado, ya resuelta) se te dirá por cada ítem.</p>}
        {confirmar === 'RECHAZAR' && (
          <label className="as-campo">Un solo motivo para todas (mínimo 10 caracteres)
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
          </label>
        )}
      </Confirmar>
    </div>
  );
}
