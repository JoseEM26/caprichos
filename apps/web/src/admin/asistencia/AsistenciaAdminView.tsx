import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ConfigAsistenciaAdmin,
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO,
  FilaHoy,
  FilaMes,
  MarcaAdmin,
  ResumenMes,
  csvDeFilas,
  corregirMarca,
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
import { ConfiguracionAsistenciaTab } from './ConfiguracionAsistenciaTab';
import { coincide } from './buscar';
import { jornadaActual, useUltimaPeticion } from './jornada';
import './asistencia.css';

type Pestana = 'hoy' | 'cronograma' | 'solicitudes' | 'mes' | 'marcas' | 'planilla' | 'config';
type Avisar = (m: string | null) => void;

const ahoraLima = () => {
  const j = jornadaActual();
  return { anio: Number(j.slice(0, 4)), mes: Number(j.slice(5, 7)) };
};
const sumarDiasIso = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const MAX_MARCAS = 500; // el servidor corta aquí (asistencia.service listarMarcas)

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

const PESTANAS: Pestana[] = ['hoy', 'cronograma', 'solicitudes', 'mes', 'marcas', 'planilla', 'config'];

export function AsistenciaAdminView() {
  // Enlace directo (lo usa Capri): /admin/asistencia?pestana=config abre esa pestaña
  const [params, setParams] = useSearchParams();
  // Feriados y Pantalla del QR ahora viven dentro de Configuración (los enlaces viejos siguen funcionando)
  const crudo = params.get('pestana');
  const deUrl = (crudo === 'feriados' || crudo === 'pantalla' ? 'config' : crudo) as Pestana | null;
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
    ['config', 'Configuración'],
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
      {pestana === 'config' && <ConfiguracionAsistenciaTab onError={setError} onOk={setMensaje} alGuardar={setCfg} />}
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
  const visibles = filas.filter((f) => coincide(f.nombre, buscar) && (!estadoSel || f.estado === estadoSel));
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
  // Lo que se escribe (puede estar a medias); solo un valor válido pasa a anio/mes y pide al servidor
  const [anioTxt, setAnioTxt] = useState(String(hoy.anio));
  const [mesTxt, setMesTxt] = useState(String(hoy.mes));
  const [filas, setFilas] = useState<FilaMes[]>([]);
  const [resumen, setResumen] = useState<ResumenMes[]>([]);
  const [cargando, setCargando] = useState(false);
  const nueva = useUltimaPeticion();

  const anioOk = /^\d{4}$/.test(anioTxt) && Number(anioTxt) >= 2020 && Number(anioTxt) <= 2100;
  const mesOk = /^\d{1,2}$/.test(mesTxt) && Number(mesTxt) >= 1 && Number(mesTxt) <= 12;
  useEffect(() => { if (anioOk) setAnio(Number(anioTxt)); }, [anioTxt, anioOk]);
  useEffect(() => { if (mesOk) setMes(Number(mesTxt)); }, [mesTxt, mesOk]);

  useEffect(() => {
    const vigente = nueva();
    setCargando(true);
    reporteMes(anio, mes)
      .then((r) => {
        if (!vigente()) return;
        setFilas(r.filas);
        setResumen(r.personas);
        onError(null);
      })
      .catch((e) => vigente() && onError(mensajeDe(e, 'No pudimos cargar el mes.')))
      .finally(() => vigente() && setCargando(false));
  }, [anio, mes]);

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
        <label className="as-campo" style={{ width: 110 }}>Año <input type="number" min={2020} max={2100} value={anioTxt} aria-invalid={!anioOk} onChange={(e) => setAnioTxt(e.target.value)} /></label>
        <label className="as-campo" style={{ width: 90 }}>Mes <input type="number" min={1} max={12} value={mesTxt} aria-invalid={!mesOk} onChange={(e) => setMesTxt(e.target.value)} /></label>
        <Boton type="button" variante="secundario" onClick={descargar} disabled={filas.length === 0}>Exportar CSV</Boton>
        {cargando && <span role="status" className="as-ayuda">Calculando…</span>}
        {(!anioOk || !mesOk) && <span role="alert" className="as-ayuda">Año entre 2020 y 2100 y mes de 1 a 12: mientras tanto se muestra {String(mes).padStart(2, '0')}/{anio}.</span>}
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
  // Filtros enviados al servidor: por defecto, los últimos 7 días (jornada de Lima)
  const [desde, setDesde] = useState(() => sumarDiasIso(jornadaActual(), -6));
  const [hasta, setHasta] = useState(() => jornadaActual());
  const [personaTxt, setPersonaTxt] = useState('');
  const [cargandoMarcas, setCargandoMarcas] = useState(true);
  const nueva = useUltimaPeticion();
  const partyId = /^\d+$/.test(personaTxt.trim()) ? Number(personaTxt.trim()) : undefined;
  const rangoMalo = !!desde && !!hasta && desde > hasta;

  const cargar = async () => {
    if (rangoMalo) return;
    const vigente = nueva();
    setCargandoMarcas(true);
    try {
      const r = await listarMarcas({ ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}), ...(partyId ? { partyId } : {}) });
      if (!vigente()) return;
      setMarcas(r);
      onError(null);
    } catch (e) {
      if (vigente()) onError(mensajeDe(e, 'No pudimos cargar las marcas.'));
    } finally {
      if (vigente()) setCargandoMarcas(false);
    }
  };
  useEffect(() => { setMarcas([]); void cargar();
  }, [desde, hasta, partyId]);

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

      <Tarjeta titulo="Filtrar marcas" subtitulo="Por defecto, los últimos 7 días. Se piden al servidor.">
        <div className="as-filtros">
          <label className="as-campo">Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label className="as-campo">Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          <label className="as-campo">ID de la persona
            <input inputMode="numeric" placeholder="Todas" aria-label="Filtrar por ID de persona" value={personaTxt} onChange={(e) => setPersonaTxt(e.target.value)} />
          </label>
        </div>
        {rangoMalo && <p role="alert" className="as-ayuda">«Desde» no puede ser posterior a «Hasta».</p>}
        {personaTxt.trim() !== '' && partyId === undefined && <p role="alert" className="as-ayuda">El ID de la persona son solo números; mientras tanto se muestran todas.</p>}
        {marcas.length >= MAX_MARCAS && <p role="status" className="as-ayuda">Se muestran solo las {MAX_MARCAS} marcas más recientes: acota las fechas o elige una persona para ver el resto.</p>}
      </Tarjeta>

      {marcas.length === 0 ? (
        cargandoMarcas ? <Cargando mensaje="Cargando marcas" /> :
        <EstadoVacio titulo="Sin marcas" descripcion="Ninguna marca en ese rango. Cambia las fechas o la persona." />
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
                  <td data-label="Origen">{m.origen === 'CORRECCION' ? 'Corrección' : m.origen === 'WEB' ? 'Usuario y contraseña' : m.origen === 'MANUAL' ? 'Manual (solo GPS)' : 'Celular'}</td>
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

