import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  desactivarEnlacePantalla,
  estadoEnlacePantalla,
  EstadoEnlacePantalla,
  generarEnlacePantalla,
  ConfigAsistenciaAdmin,
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO,
  FilaHoy,
  FilaMes,
  MarcaAdmin,
  ResumenMes,
  csvDeFilas,
  corregirMarca,
  guardarConfigAsistencia,
  listarMarcas,
  obtenerConfigAsistencia,
  reiniciarCelular,
  revisarMarca,
  reporteHoy,
  reporteMes,
  TipoMarca,
} from './asistenciaApi';
import { obtenerBlobAutenticado } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { Tarjeta } from '../../comun/Tarjeta';
import { PlanillaTab } from './PlanillaTab';
import { CronogramaTab } from './CronogramaTab';
import { SolicitudesTab } from './SolicitudesTab';
import { contadorSolicitudes } from './correccionesApi';
import { FeriadosTab } from './FeriadosTab';
import { MapaUbicacion } from '../../comun/mapa/MapaUbicacion';
import { BuscadorDireccion } from '../../comun/mapa/BuscadorDireccion';
import { SEDE_DEFECTO } from '../../comun/mapa/sedeDefecto';
import './asistencia.css';

type Pestana = 'hoy' | 'cronograma' | 'solicitudes' | 'mes' | 'marcas' | 'planilla' | 'feriados' | 'config' | 'pantalla';
type Avisar = (m: string | null) => void;

const ahoraLima = () => {
  const d = new Date(Date.now() - 5 * 3600_000);
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
};

const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;

const varianteEstado: Record<string, VarianteInsignia> = {
  CUMPLIO: 'exito',
  TARDANZA: 'aviso',
  SALIO_ANTES: 'aviso',
  SALIO_DESPUES: 'neutro',
  FALTA: 'peligro',
  INCOMPLETO: 'peligro',
  A_REVISAR: 'acento',
  DESCANSO: 'neutro',
  SIN_EVALUAR: 'neutro',
};

function Chip({ estado }: { estado: string }) {
  return <Insignia variante={varianteEstado[estado] ?? 'neutro'}>{ETIQUETA_ESTADO[estado] ?? estado}</Insignia>;
}

const SIN_UBICACION = 'Aún no configuras la ubicación del local: nadie podrá marcar';

const PESTANAS: Pestana[] = ['hoy', 'cronograma', 'solicitudes', 'mes', 'marcas', 'planilla', 'feriados', 'config', 'pantalla'];

export function AsistenciaAdminView() {
  // Enlace directo (lo usa Capri): /admin/asistencia?pestana=config abre esa pestaña
  const [params, setParams] = useSearchParams();
  const deUrl = params.get('pestana') as Pestana | null;
  const [pestana, setPestana] = useState<Pestana>(deUrl && PESTANAS.includes(deUrl) ? deUrl : 'hoy');
  useEffect(() => {
    if (deUrl && PESTANAS.includes(deUrl)) setPestana(deUrl);
  }, [deUrl]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cfg, setCfg] = useState<ConfigAsistenciaAdmin | null>(null);
  useEffect(() => {
    obtenerConfigAsistencia().then(setCfg).catch((e) => setError(mensajeDe(e, 'No pudimos cargar la configuración.')));
  }, []);
  // Contador de solicitudes de corrección pendientes (en la pestaña)
  const [pendientes, setPendientes] = useState(0);
  const contar = useCallback(() => { contadorSolicitudes().then((r) => setPendientes(r.pendientes)).catch(() => undefined); }, []);
  useEffect(() => { contar(); }, [contar, pestana]);
  const cambiar = (k: Pestana) => {
    setPestana(k);
    setParams((prev) => { const n = new URLSearchParams(prev); n.set('pestana', k); return n; }, { replace: true });
    setMensaje(null);
    setError(null);
  };
  const tabs: Array<[Pestana, string]> = [
    ['hoy', 'Hoy'],
    ['cronograma', 'Cronograma'],
    ['solicitudes', pendientes > 0 ? `Solicitudes de corrección (${pendientes})` : 'Solicitudes de corrección'],
    ['mes', 'Mensual'],
    ['marcas', 'Marcas y selfies'],
    ['planilla', 'Planilla'],
    ['feriados', 'Feriados'],
    ['config', 'Configuración'],
    ['pantalla', 'Pantalla del QR'],
  ];
  const sinUbicacion = cfg !== null && (cfg.localLat === null || cfg.localLng === null);
  return (
    <div className="as-vista">
      <div role="tablist" aria-label="Secciones de asistencia" className="as-tabs">
        {tabs.map(([k, t]) => (
          <button key={k} type="button" role="tab" className="as-tab" aria-selected={pestana === k} onClick={() => cambiar(k)}>
            {t}
          </button>
        ))}
      </div>
      {sinUbicacion && (
        <div role="alert" className="as-aviso as-aviso--alerta" data-testid="aviso-sin-ubicacion">
          {SIN_UBICACION}.{' '}
          {pestana !== 'config' && (
            <button type="button" className="as-enlace" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }} onClick={() => cambiar('config')}>
              Configurarla ahora
            </button>
          )}
        </div>
      )}
      {mensaje && <div role="status" className="as-aviso as-aviso--ok">{mensaje}</div>}
      {error && <div role="alert" className="as-aviso as-aviso--error">{error}</div>}
      {pestana === 'hoy' && <HoyTab onError={setError} onOk={setMensaje} />}
      {pestana === 'cronograma' && <CronogramaTab onError={setError} onOk={setMensaje} />}
      {pestana === 'solicitudes' && <SolicitudesTab onError={setError} onOk={setMensaje} alCambiar={contar} />}
      {pestana === 'mes' && <MesTab onError={setError} />}
      {pestana === 'marcas' && <MarcasTab onError={setError} onOk={setMensaje} />}
      {pestana === 'planilla' && <PlanillaTab onError={setError} onOk={setMensaje} />}
      {pestana === 'feriados' && <FeriadosTab onError={setError} onOk={setMensaje} />}
      {pestana === 'config' && <ConfigTab cfg={cfg} setCfg={setCfg} onError={setError} onOk={setMensaje} />}
      {pestana === 'pantalla' && <EnlacePantalla onError={setError} onOk={setMensaje} />}
    </div>
  );
}

function Cifra({ n, texto, tono }: { n: number; texto: string; tono?: 'ok' | 'tarde' | 'falta' }) {
  return (
    <div className={`as-cifra${tono ? ` as-cifra--${tono}` : ''}`}>
      <strong>{n}</strong>
      <span>{texto}</span>
    </div>
  );
}

function HoyTab({ onError, onOk }: { onError: Avisar; onOk: Avisar }) {
  const [filas, setFilas] = useState<FilaHoy[] | null>(null);
  const [jornada, setJornada] = useState('');
  const [buscar, setBuscar] = useState('');
  const [estadoSel, setEstadoSel] = useState('');
  const cargar = async () => {
    try {
      const r = await reporteHoy();
      setFilas(r.filas);
      setJornada(r.jornada);
      onError(null);
    } catch (e) {
      onError(mensajeDe(e, 'No pudimos cargar el día.'));
    }
  };
  useEffect(() => {
    void cargar();
    const i = setInterval(() => void cargar(), 60_000);
    return () => clearInterval(i);
  }, []);
  const reiniciar = async (partyId: number) => {
    try {
      await reiniciarCelular(partyId);
      onOk('Vínculo de celular reiniciado. La persona debe volver a marcar desde su celular.');
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo reiniciar el celular.'));
    }
  };
  if (!filas) return <Cargando mensaje="Cargando" />;
  const cuenta = (...e: string[]) => filas.filter((f) => e.includes(f.estado)).length;
  const q = buscar.trim().toLowerCase();
  const visibles = filas.filter((f) => (!q || f.nombre.toLowerCase().includes(q)) && (!estadoSel || f.estado === estadoSel));
  return (
    <>
      <h3 className="as-sub">Jornada {jornada}</h3>
      <div className="as-resumen" aria-label="Resumen del día">
        <Cifra n={filas.length} texto="Personas" />
        <Cifra n={filas.filter((f) => f.entrada).length} texto="Ya marcaron entrada" tono="ok" />
        <Cifra n={cuenta('TARDANZA')} texto="Llegaron tarde" tono="tarde" />
        <Cifra n={cuenta('FALTA')} texto="Faltas" tono="falta" />
        <Cifra n={cuenta('A_REVISAR', 'INCOMPLETO')} texto="Por revisar" tono="tarde" />
      </div>
      <div className="as-filtros">
        <label className="as-campo as-grow">
          Buscar persona
          <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Nombre" />
        </label>
        <label className="as-campo">
          Estado
          <select value={estadoSel} onChange={(e) => setEstadoSel(e.target.value)}>
            <option value="">Todos</option>
            {Object.keys(ETIQUETA_ESTADO).map((k) => <option key={k} value={k}>{ETIQUETA_ESTADO[k]}</option>)}
          </select>
        </label>
      </div>
      {visibles.length === 0 ? (
        <EstadoVacio titulo="Nadie coincide" descripcion="Cambia la búsqueda o el estado." />
      ) : (
        <div className="as-tabla-wrap">
          <table className="as-tabla as-tabla--tarjetas">
            <thead>
              <tr><th>Persona</th><th>Turno</th><th>Entrada</th><th>Salida</th><th>Estado</th><th>Trabajado</th><th /></tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.partyId}>
                  <td data-label="Persona" className="as-nombre">{f.nombre}</td>
                  <td data-label="Turno" className="as-num">{f.turno ? `${f.turno.entrada}-${f.turno.salida}` : '—'}</td>
                  <td data-label="Entrada" className="as-num">{f.entrada ?? '—'}</td>
                  <td data-label="Salida" className="as-num">{f.salida ?? '—'}</td>
                  <td data-label="Estado">
                    <span><Chip estado={f.estado} />{f.alertas.length > 0 && <small className="as-nota">{f.alertas.join('; ')}</small>}</span>
                  </td>
                  <td data-label="Trabajado" className="as-num">{(f.trabajadaMin / 60).toFixed(2)} h</td>
                  <td data-label="">
                    <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => void reiniciar(f.partyId)}>Reiniciar celular</Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function MesTab({ onError }: { onError: Avisar }) {
  const hoy = ahoraLima();
  const [anio, setAnio] = useState(hoy.anio);
  const [mes, setMes] = useState(hoy.mes);
  const [filas, setFilas] = useState<FilaMes[]>([]);
  const [resumen, setResumen] = useState<ResumenMes[]>([]);
  const [cargando, setCargando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const r = await reporteMes(anio, mes);
      setFilas(r.filas);
      setResumen(r.personas);
      onError(null);
    } catch (e) {
      onError(mensajeDe(e, 'No pudimos cargar el mes.'));
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => { void cargar(); }, [anio, mes]);

  const descargar = () => {
    const blob = new Blob([csvDeFilas(filas)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asistencia-${anio}-${String(mes).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="as-filtros">
        <label className="as-campo" style={{ width: 110 }}>Año <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></label>
        <label className="as-campo" style={{ width: 90 }}>Mes <input type="number" min={1} max={12} value={mes} onChange={(e) => setMes(Number(e.target.value))} /></label>
        <Boton type="button" variante="secundario" onClick={descargar} disabled={filas.length === 0}>Exportar CSV</Boton>
        {cargando && <span role="status" className="as-ayuda">Calculando…</span>}
      </div>
      <h3 className="as-sub">Totales por persona</h3>
      <div className="as-tabla-wrap">
        <table className="as-tabla as-tabla--tarjetas">
          <thead><tr><th>Persona</th><th>Programadas (h)</th><th>Trabajadas (h)</th><th>Días trabajados</th></tr></thead>
          <tbody>
            {resumen.map((p) => (
              <tr key={p.partyId}>
                <td data-label="Persona" className="as-nombre">{p.nombre}</td>
                <td data-label="Programadas (h)" className="as-num">{p.programadasH}</td>
                <td data-label="Trabajadas (h)" className="as-num">{p.trabajadasH}</td>
                <td data-label="Días trabajados" className="as-num">{p.diasTrabajados}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="as-sub">Detalle por día</h3>
      {filas.length === 0 && !cargando ? (
        <EstadoVacio titulo="Sin registros" descripcion="Este mes todavía no tiene jornadas evaluadas." />
      ) : (
        <div className="as-tabla-wrap">
          <table className="as-tabla as-tabla--tarjetas">
            <thead><tr><th>Persona</th><th>Día</th><th>Estado</th><th>Trabajado (h)</th><th>Tardanza (min)</th><th>Salida antes (min)</th><th>Extra (min)</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={`${f.partyId}-${f.jornada}`}>
                  <td data-label="Persona" className="as-nombre">{f.nombre}</td>
                  <td data-label="Día" className="as-num">{f.jornada}</td>
                  <td data-label="Estado"><Chip estado={f.estado} /></td>
                  <td data-label="Trabajado (h)" className="as-num">{(f.trabajadaMin / 60).toFixed(2)}</td>
                  <td data-label="Tardanza (min)" className="as-num">{f.tardanzaMin}</td>
                  <td data-label="Salida antes (min)" className="as-num">{f.salioAntesMin}</td>
                  <td data-label="Extra (min)" className="as-num">{f.extraMin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function MarcasTab({ onError, onOk }: { onError: Avisar; onOk: Avisar }) {
  const [marcas, setMarcas] = useState<MarcaAdmin[]>([]);
  const [foto, setFoto] = useState<{ id: number; url: string } | null>(null);
  const [form, setForm] = useState({ partyId: '', jornada: '', tipo: 'SALIDA' as TipoMarca, momento: '', motivo: '' });
  const [revisando, setRevisando] = useState<{ marca: MarcaAdmin; accion: 'aprobar' | 'anular'; motivo: string } | null>(null);

  const cargar = async () => {
    try {
      setMarcas(await listarMarcas({}));
      onError(null);
    } catch (e) {
      onError(mensajeDe(e, 'No pudimos cargar las marcas.'));
    }
  };
  useEffect(() => { void cargar(); }, []);

  const verFoto = async (id: number) => {
    try {
      setFoto({ id, url: await obtenerBlobAutenticado(`/admin/asistencia/marcas/${id}/selfie`) });
    } catch (e) {
      onError(mensajeDe(e, 'La foto ya no está disponible.'));
    }
  };

  const confirmarRevision = async () => {
    if (!revisando) return;
    try {
      await revisarMarca(revisando.marca.id, revisando.accion, revisando.motivo.trim());
      onOk(revisando.accion === 'aprobar' ? 'Marca aprobada: desde ahora cuenta en la planilla.' : 'Marca anulada: ya no cuenta. El registro se conserva.');
      setRevisando(null);
      await cargar();
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo registrar la revisión.'));
    }
  };

  const corregir = async () => {
    try {
      // momento = fecha y hora de reloj de Lima (UTC-5)
      await corregirMarca({
        partyId: Number(form.partyId),
        jornada: form.jornada,
        tipo: form.tipo,
        momento: `${form.momento}:00-05:00`,
        motivo: form.motivo,
      });
      onOk('Corrección registrada. La marca original no se modificó.');
      setForm({ ...form, motivo: '' });
      await cargar();
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo registrar la corrección.'));
    }
  };

  return (
    <>
      <Tarjeta titulo="Corrección de una marca" subtitulo="Queda como un registro nuevo, con motivo. La marca original no se modifica.">
        <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'grid', gap: 12 }}>
          <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Corrección (queda como registro nuevo, con motivo)</legend>
          <div className="as-form">
            <label className="as-campo">ID de la persona
              <input placeholder="ID de la persona" aria-label="ID de la persona" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })} />
            </label>
            <label className="as-campo">Jornada <input type="date" value={form.jornada} onChange={(e) => setForm({ ...form, jornada: e.target.value })} /></label>
            <label className="as-campo">Tipo
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoMarca })}>
                {(Object.keys(ETIQUETA_TIPO) as TipoMarca[]).map((t) => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)}
              </select>
            </label>
            <label className="as-campo">Fecha y hora real <input type="datetime-local" value={form.momento} onChange={(e) => setForm({ ...form, momento: e.target.value })} /></label>
          </div>
          <label className="as-campo">Motivo
            <textarea placeholder="Motivo (mínimo 10 caracteres)" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
          </label>
          <div className="as-acciones">
            <Boton type="button" onClick={() => void corregir()} disabled={form.motivo.trim().length < 10 || !form.partyId || !form.jornada || !form.momento}>
              Registrar corrección
            </Boton>
          </div>
        </fieldset>
      </Tarjeta>

      {revisando && (
        <Tarjeta
          titulo={`${revisando.accion === 'aprobar' ? 'Aprobar' : 'Anular'} la marca de ${revisando.marca.nombre}`}
          subtitulo={`${ETIQUETA_TIPO[revisando.marca.tipo]} · ${new Date(revisando.marca.momento).toLocaleString('es-PE', { timeZone: 'America/Lima' })}`}
        >
          <label className="as-campo">Motivo
            <textarea placeholder="Motivo (mínimo 10 caracteres)" value={revisando.motivo} onChange={(e) => setRevisando({ ...revisando, motivo: e.target.value })} />
          </label>
          <div className="as-acciones">
            <Boton type="button" variante="secundario" onClick={() => setRevisando(null)}>Cancelar</Boton>
            <Boton type="button" onClick={() => void confirmarRevision()} disabled={revisando.motivo.trim().length < 10}>
              {revisando.accion === 'aprobar' ? 'Aprobar marca' : 'Anular marca'}
            </Boton>
          </div>
        </Tarjeta>
      )}

      {foto && (
        <Tarjeta titulo={`Selfie de la marca ${foto.id}`} accion={<Boton type="button" variante="secundario" tamano="pequeno" onClick={() => setFoto(null)}>Cerrar foto</Boton>}>
          <img src={foto.url} alt={`Selfie de la marca ${foto.id}`} className="as-selfie" />
        </Tarjeta>
      )}

      {marcas.length === 0 ? (
        <EstadoVacio titulo="Sin marcas" descripcion="Cuando el equipo marque, aparecerán aquí con su distancia y selfie." />
      ) : (
        <div className="as-tabla-wrap">
          <table className="as-tabla as-tabla--tarjetas">
            <thead><tr><th>Persona</th><th>Jornada</th><th>Tipo</th><th>Hora</th><th>Estado</th><th>Distancia</th><th>Precisión</th><th>Origen</th><th /></tr></thead>
            <tbody>
              {marcas.map((m) => (
                <tr key={m.id}>
                  <td data-label="Persona" className="as-nombre">{m.nombre}</td>
                  <td data-label="Jornada" className="as-num">{m.jornada}</td>
                  <td data-label="Tipo">{ETIQUETA_TIPO[m.tipo]}</td>
                  <td data-label="Hora" className="as-num">{new Date(m.momento).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</td>
                  <td data-label="Estado">
                    <span>
                      {m.estado === 'A_REVISAR' ? <Insignia variante="acento" title={m.alertas ?? ''}>A revisar</Insignia>
                        : m.estado === 'ANULADA' ? <Insignia variante="peligro">Anulada</Insignia>
                        : m.estado === 'APROBADA' ? <Insignia variante="exito">Aprobada</Insignia>
                        : <Insignia variante="exito">Válida</Insignia>}
                      {m.alertas && m.estado === 'A_REVISAR' && <small className="as-nota">{m.alertas}</small>}
                      {m.motivo && <small className="as-nota">{m.motivo}</small>}
                      {m.revisadoMotivo && <small className="as-nota">Revisión: {m.revisadoMotivo}</small>}
                    </span>
                  </td>
                  <td data-label="Distancia" className="as-num">{m.distanciaM ?? '—'} m</td>
                  <td data-label="Precisión" className="as-num">{m.precisionM ?? '—'} m</td>
                  <td data-label="Origen">{m.origen === 'CORRECCION' ? 'Corrección' : m.origen === 'WEB' ? 'Usuario y contraseña' : 'Celular'}</td>
                  <td data-label="">
                    {m.tieneSelfie && <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => void verFoto(m.id)}>Ver selfie</Boton>}
                    {m.estado === 'A_REVISAR' && <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => setRevisando({ marca: m, accion: 'aprobar', motivo: '' })}>Aprobar</Boton>}
                    {m.estado !== 'ANULADA' && <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => setRevisando({ marca: m, accion: 'anular', motivo: '' })}>Anular</Boton>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const PRECISION_BUENA_M = 30;
/** Peor que esto es ubicación por internet (IP/wifi): no sirve para fijar el punto del local. */
const PRECISION_INUTIL_M = 100;

/** Precisión legible: metros, o km si pasa de 1000. */
export const formatearPrecision = (m: number): string =>
  m >= 1000 ? `${(m / 1000).toLocaleString('es-PE', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`;

function ConfigTab({ cfg, setCfg, onError, onOk }: { cfg: ConfigAsistenciaAdmin | null; setCfg: (c: ConfigAsistenciaAdmin) => void; onError: Avisar; onOk: Avisar }) {
  const [leyendo, setLeyendo] = useState(false);
  const [precision, setPrecision] = useState<number | null>(null);
  if (!cfg) return <Cargando mensaje="Cargando" />;
  const campo = (k: keyof ConfigAsistenciaAdmin, etiqueta: string, ayuda: string) => (
    <label className="as-campo">
      {etiqueta}
      <input
        type="number"
        step="any"
        value={cfg[k] ?? ''}
        onChange={(e) => setCfg({ ...cfg, [k]: e.target.value === '' ? null : Number(e.target.value) })}
      />
      <small>{ayuda}</small>
    </label>
  );
  const guardar = async () => {
    try {
      setCfg(await guardarConfigAsistencia(cfg));
      onOk('Configuración guardada.');
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo guardar.'));
    }
  };
  const usarMiUbicacion = () => {
    if (!navigator.geolocation) {
      onError('Este equipo no permite leer la ubicación. Escribe las coordenadas a mano.');
      return;
    }
    setLeyendo(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLeyendo(false);
        if (p.coords.accuracy > PRECISION_INUTIL_M) {
          setPrecision(null);
          onOk(null);
          onError(`Este equipo no tiene GPS preciso (precisión ${formatearPrecision(p.coords.accuracy)}, parece ubicación por internet). Mueve el punto en el mapa o usa tu celular dentro del local.`);
          return;
        }
        setPrecision(p.coords.accuracy);
        setCfg({ ...cfg, localLat: Number(p.coords.latitude.toFixed(6)), localLng: Number(p.coords.longitude.toFixed(6)) });
        onError(null);
        onOk('Ubicación tomada. Revísala en el mapa y pulsa «Guardar configuración».');
      },
      () => {
        setLeyendo(false);
        onError('No pudimos leer tu ubicación. Activa la ubicación y da permiso al navegador.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  const moverPunto = (p: { lat: number; lng: number }) =>
    setCfg({ ...cfg, localLat: Number(p.lat.toFixed(6)), localLng: Number(p.lng.toFixed(6)) });
  const conUbicacion = cfg.localLat !== null && cfg.localLng !== null;
  return (
    <>
      {!conUbicacion && (
        <div role="alert" className="as-aviso as-aviso--alerta">{SIN_UBICACION}.</div>
      )}
      <div className="as-grilla">
        <Tarjeta titulo="Ubicación del local" subtitulo="El punto desde el que se mide la distancia al marcar.">
          <div className="as-form">
            {campo('localLat', 'Latitud del local', 'Ej. -12.046374')}
            {campo('localLng', 'Longitud del local', 'Ej. -77.042793')}
          </div>
          <BuscadorDireccion onElegir={(p) => moverPunto(p)} />
          <MapaUbicacion
            punto={conUbicacion ? { lat: cfg.localLat as number, lng: cfg.localLng as number } : null}
            onCambiar={moverPunto}
            altura={320}
            etiqueta="Mapa para marcar la ubicación del local"
            local={conUbicacion ? null : SEDE_DEFECTO}
            ajustarA={conUbicacion ? 'punto' : 'local'}
            radioM={cfg.radioM ?? undefined}
          />
          <p className="as-ayuda">
            {conUbicacion ? 'Arrastra el punto o toca el mapa para moverlo.' : 'Toca el mapa para colocar el punto del local: hasta entonces no se guarda ninguno.'}
          </p>
          <p className="as-ayuda" data-testid="texto-regla">
            La asistencia se mide desde este punto: el trabajador debe estar a {cfg.radioM ?? '—'} m o menos (radio) y con el GPS del celular con precisión mejor que {cfg.precisionMaxM ?? '—'} m.
          </p>
          <div className="as-acciones">
            <Boton type="button" variante="oscuro" cargando={leyendo} onClick={usarMiUbicacion}>Usar mi ubicación actual</Boton>
            {conUbicacion && (
              <a className="as-enlace" href={`https://www.google.com/maps?q=${cfg.localLat},${cfg.localLng}`} target="_blank" rel="noreferrer">
                Ver en Google Maps
              </a>
            )}
          </div>
          <p className="as-ayuda">Para usar tu ubicación, tienes que estar dentro del local, de preferencia al centro y con el GPS activado.</p>
          {precision !== null && (
            <div role="status" className={`as-aviso ${precision > PRECISION_BUENA_M ? 'as-aviso--alerta' : 'as-aviso--ok'}`}>
              Precisión obtenida: {formatearPrecision(precision)}.
              {precision > PRECISION_BUENA_M && ` Es peor que ${PRECISION_BUENA_M} m: sal a un lugar abierto y vuelve a intentar, o corrige las coordenadas a mano.`}
            </div>
          )}
        </Tarjeta>
        <Tarjeta titulo="Marcas" subtitulo="Cuándo se acepta una marca.">
          <div style={{ display: 'grid', gap: 12 }}>
            {campo('radioM', 'Radio del local (m)', 'A cuántos metros del punto del local se puede marcar. Hoy: 10.')}
            {campo('toleranciaMin', 'Tolerancia de tardanza (min)', 'Minutos después de la hora de entrada que aún no cuentan como tardanza. Hoy: 5.')}
            {campo('pagoTardanzaPct', 'Tardanza pagada al (%)', 'Porcentaje del valor hora con que se pagan los minutos de tardanza (ya es el descuento). Hoy: 50.')}
            {campo('dobleMarcaMin', 'Doble marca: unir marcas a menos de (min)', 'Marcas muy seguidas se unen: cuenta la primera y la otra se muestra tachada. 0 = no unir. Hoy: 3.')}
            {campo('solicitudDiasMax', 'Días para pedir corrección', 'Hasta cuántos días atrás la persona puede pedir que se corrija su asistencia (y se le avisa de inconsistencias). Hoy: 7.')}
            {campo('precisionMaxM', 'Precisión GPS máxima aceptada (m)', 'Si el GPS del celular es peor que esto (número más alto), se le pide reintentar.')}
          </div>
        </Tarjeta>
        <Tarjeta titulo="Selfies" subtitulo="Privacidad de las fotos.">
          {campo('retencionDias', 'Días que se guardan las selfies', 'Pasado este plazo la foto se borra; la marca se conserva.')}
        </Tarjeta>
      </div>
      <div className="as-acciones">
        <Boton type="button" onClick={() => void guardar()}>Guardar configuración</Boton>
      </div>
    </>
  );
}

/** Enlace secreto de la pantalla del local (tablet sin cuenta). El token en claro se muestra una sola vez. */
function EnlacePantalla({ onError, onOk }: { onError: Avisar; onOk: Avisar }) {
  const [estado, setEstado] = useState<EstadoEnlacePantalla | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    estadoEnlacePantalla().then(setEstado).catch((e) => onError(mensajeDe(e, 'No pudimos leer el enlace de la pantalla.')));
  }, []);
  const generar = async () => {
    try {
      const r = await generarEnlacePantalla();
      setUrl(`${window.location.origin}${r.ruta}`);
      setEstado({ activo: true, generadoEn: r.generadoEn });
      onOk(estado?.activo ? 'Enlace regenerado. El anterior ya no funciona.' : 'Enlace generado.');
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo generar el enlace.'));
    }
  };
  const desactivar = async () => {
    try {
      setEstado(await desactivarEnlacePantalla());
      setUrl(null);
      onOk('Enlace desactivado.');
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo desactivar el enlace.'));
    }
  };
  const copiar = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      onOk('Enlace copiado.');
    } catch {
      onError('No se pudo copiar. Selecciona el enlace y cópialo a mano.');
    }
  };
  if (!estado) return <Cargando mensaje="Cargando enlace…" />;
  return (
    <section aria-label="Enlace de la pantalla">
      <Tarjeta
        titulo="Pantalla del QR (tablet del local)"
        subtitulo="Una pantalla fija muestra el código que cambia cada 30 segundos. No pide usuario ni contraseña."
        accion={<Insignia variante={estado.activo ? 'exito' : 'neutro'}>{estado.activo ? 'Activo' : 'Sin enlace'}</Insignia>}
      >
        <div className="as-aviso as-aviso--alerta">
          Cualquiera con este enlace ve el código. Guárdalo solo en la tablet del local y no lo compartas.
        </div>
        {url && (
          <div style={{ display: 'grid', gap: 8 }}>
            <label className="as-campo">Enlace de la pantalla
              <input readOnly value={url} aria-label="Enlace de la pantalla" onFocus={(e) => e.currentTarget.select()} />
              <small>Se muestra solo ahora. Si lo pierdes, genera uno nuevo.</small>
            </label>
            <div className="as-acciones"><Boton type="button" variante="oscuro" onClick={() => void copiar()}>Copiar</Boton></div>
          </div>
        )}
        <div className="as-acciones">
          <Boton type="button" onClick={() => void generar()}>
            {estado.activo ? 'Regenerar' : 'Generar enlace de la pantalla'}
          </Boton>
          {estado.activo && <Boton type="button" variante="peligro" onClick={() => void desactivar()}>Desactivar</Boton>}
        </div>
        {estado.activo && estado.generadoEn && (
          <p className="as-ayuda">Enlace activo desde {new Date(estado.generadoEn).toLocaleString('es-PE')}. Regenerar invalida el anterior.</p>
        )}
      </Tarjeta>
    </section>
  );
}
