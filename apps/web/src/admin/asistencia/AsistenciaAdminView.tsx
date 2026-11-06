import { useEffect, useState } from 'react';
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
  guardarConfigAsistencia,
  listarMarcas,
  obtenerConfigAsistencia,
  reiniciarCelular,
  reporteHoy,
  reporteMes,
  TipoMarca,
} from './asistenciaApi';
import { obtenerBlobAutenticado } from '../../comun/api';

type Pestana = 'hoy' | 'mes' | 'marcas' | 'config';

const ahoraLima = () => {
  const d = new Date(Date.now() - 5 * 3600_000);
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
};

const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;

const colorEstado: Record<string, string> = {
  CUMPLIO: '#2e7d32',
  TARDANZA: '#ef6c00',
  SALIO_ANTES: '#ef6c00',
  SALIO_DESPUES: '#1565c0',
  FALTA: '#c62828',
  INCOMPLETO: '#ad1457',
  A_REVISAR: '#6a1b9a',
  DESCANSO: '#757575',
  SIN_EVALUAR: '#9e9e9e',
};

function Chip({ estado }: { estado: string }) {
  return (
    <span style={{ background: colorEstado[estado] ?? '#555', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 12 }}>
      {ETIQUETA_ESTADO[estado] ?? estado}
    </span>
  );
}

export function AsistenciaAdminView() {
  const [pestana, setPestana] = useState<Pestana>('hoy');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tabs: Array<[Pestana, string]> = [['hoy', 'Hoy'], ['mes', 'Mensual'], ['marcas', 'Marcas y correcciones'], ['config', 'Configuración']];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <nav aria-label="Secciones de asistencia" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map(([k, t]) => (
          <button key={k} type="button" aria-pressed={pestana === k} onClick={() => setPestana(k)}>
            {t}
          </button>
        ))}
      </nav>
      {mensaje && <div role="status">{mensaje}</div>}
      {error && <div role="alert">{error}</div>}
      {pestana === 'hoy' && <HoyTab onError={setError} onOk={setMensaje} />}
      {pestana === 'mes' && <MesTab onError={setError} />}
      {pestana === 'marcas' && <MarcasTab onError={setError} onOk={setMensaje} />}
      {pestana === 'config' && <ConfigTab onError={setError} onOk={setMensaje} />}
    </div>
  );
}

function HoyTab({ onError, onOk }: { onError: (m: string | null) => void; onOk: (m: string | null) => void }) {
  const [filas, setFilas] = useState<FilaHoy[] | null>(null);
  const [jornada, setJornada] = useState('');
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
  if (!filas) return <div role="status">Cargando…</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <h3 style={{ margin: 0 }}>Jornada {jornada}</h3>
      <table>
        <thead>
          <tr><th>Persona</th><th>Turno</th><th>Entrada</th><th>Salida</th><th>Estado</th><th>Trabajado</th><th /></tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.partyId}>
              <td>{f.nombre}</td>
              <td>{f.turno ? `${f.turno.entrada}-${f.turno.salida}` : '—'}</td>
              <td>{f.entrada ?? '—'}</td>
              <td>{f.salida ?? '—'}</td>
              <td><Chip estado={f.estado} /> {f.alertas.length > 0 && <small>{f.alertas.join('; ')}</small>}</td>
              <td>{(f.trabajadaMin / 60).toFixed(2)} h</td>
              <td><button type="button" onClick={() => void reiniciar(f.partyId)}>Reiniciar celular</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MesTab({ onError }: { onError: (m: string | null) => void }) {
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
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label>Año <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ width: 90 }} /></label>
        <label>Mes <input type="number" min={1} max={12} value={mes} onChange={(e) => setMes(Number(e.target.value))} style={{ width: 60 }} /></label>
        <button type="button" onClick={descargar} disabled={filas.length === 0}>Exportar CSV</button>
        {cargando && <span role="status">Calculando…</span>}
      </div>
      <h3 style={{ margin: 0 }}>Totales por persona</h3>
      <table>
        <thead><tr><th>Persona</th><th>Programadas (h)</th><th>Trabajadas (h)</th><th>Días trabajados</th></tr></thead>
        <tbody>
          {resumen.map((p) => (
            <tr key={p.partyId}><td>{p.nombre}</td><td>{p.programadasH}</td><td>{p.trabajadasH}</td><td>{p.diasTrabajados}</td></tr>
          ))}
        </tbody>
      </table>
      <h3 style={{ margin: 0 }}>Detalle por día</h3>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Persona</th><th>Día</th><th>Estado</th><th>Trabajado (h)</th><th>Tardanza (min)</th><th>Salida antes (min)</th><th>Extra (min)</th></tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={`${f.partyId}-${f.jornada}`}>
                <td>{f.nombre}</td><td>{f.jornada}</td><td><Chip estado={f.estado} /></td>
                <td>{(f.trabajadaMin / 60).toFixed(2)}</td><td>{f.tardanzaMin}</td><td>{f.salioAntesMin}</td><td>{f.extraMin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MarcasTab({ onError, onOk }: { onError: (m: string | null) => void; onOk: (m: string | null) => void }) {
  const [marcas, setMarcas] = useState<MarcaAdmin[]>([]);
  const [foto, setFoto] = useState<{ id: number; url: string } | null>(null);
  const [form, setForm] = useState({ partyId: '', jornada: '', tipo: 'SALIDA' as TipoMarca, momento: '', motivo: '' });

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
    <div style={{ display: 'grid', gap: 16 }}>
      <fieldset style={{ display: 'grid', gap: 8, maxWidth: 560 }}>
        <legend>Corrección (queda como registro nuevo, con motivo)</legend>
        <input placeholder="ID de la persona" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })} />
        <label>Jornada <input type="date" value={form.jornada} onChange={(e) => setForm({ ...form, jornada: e.target.value })} /></label>
        <label>Tipo
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoMarca })}>
            {(Object.keys(ETIQUETA_TIPO) as TipoMarca[]).map((t) => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)}
          </select>
        </label>
        <label>Fecha y hora real <input type="datetime-local" value={form.momento} onChange={(e) => setForm({ ...form, momento: e.target.value })} /></label>
        <textarea placeholder="Motivo (mínimo 10 caracteres)" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
        <button type="button" onClick={() => void corregir()} disabled={form.motivo.trim().length < 10 || !form.partyId || !form.jornada || !form.momento}>
          Registrar corrección
        </button>
      </fieldset>

      {foto && (
        <div>
          <img src={foto.url} alt={`Selfie de la marca ${foto.id}`} style={{ maxWidth: 240, borderRadius: 8 }} />
          <button type="button" onClick={() => setFoto(null)}>Cerrar foto</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Persona</th><th>Jornada</th><th>Tipo</th><th>Hora</th><th>Estado</th><th>Distancia</th><th>Precisión</th><th>Origen</th><th /></tr></thead>
          <tbody>
            {marcas.map((m) => (
              <tr key={m.id}>
                <td>{m.nombre}</td><td>{m.jornada}</td><td>{ETIQUETA_TIPO[m.tipo]}</td>
                <td>{new Date(m.momento).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</td>
                <td>{m.estado === 'A_REVISAR' ? <span title={m.alertas ?? ''}>A revisar</span> : 'Válida'}{m.motivo ? ` · ${m.motivo}` : ''}</td>
                <td>{m.distanciaM ?? '—'} m</td><td>{m.precisionM ?? '—'} m</td><td>{m.origen === 'CORRECCION' ? 'Corrección' : 'Celular'}</td>
                <td>{m.tieneSelfie && <button type="button" onClick={() => void verFoto(m.id)}>Ver selfie</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConfigTab({ onError, onOk }: { onError: (m: string | null) => void; onOk: (m: string | null) => void }) {
  const [cfg, setCfg] = useState<ConfigAsistenciaAdmin | null>(null);
  useEffect(() => {
    obtenerConfigAsistencia().then(setCfg).catch((e) => onError(mensajeDe(e, 'No pudimos cargar la configuración.')));
  }, []);
  if (!cfg) return <div role="status">Cargando…</div>;
  const campo = (k: keyof ConfigAsistenciaAdmin, etiqueta: string) => (
    <label style={{ display: 'grid', gap: 4 }}>
      {etiqueta}
      <input
        type="number"
        step="any"
        value={cfg[k] ?? ''}
        onChange={(e) => setCfg({ ...cfg, [k]: e.target.value === '' ? null : Number(e.target.value) })}
      />
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
  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
      {campo('radioM', 'Radio del local (m)')}
      {campo('toleranciaMin', 'Tolerancia de tardanza (min)')}
      {campo('precisionMaxM', 'Precisión GPS máxima aceptada (m)')}
      {campo('retencionDias', 'Días que se guardan las selfies')}
      {campo('localLat', 'Latitud del local')}
      {campo('localLng', 'Longitud del local')}
      <button type="button" onClick={() => void guardar()}>Guardar configuración</button>
    </div>
  );
}
