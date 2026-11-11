import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  desactivarEnlacePantalla,
  estadoEnlacePantalla,
  EstadoEnlacePantalla,
  generarEnlacePantalla,
  ConfigAsistenciaAdmin,
  ETIQUETA_ESTADO,
  FilaHoy,
  obtenerConfigAsistencia,
  reiniciarCelular,
  reporteHoy,
} from './asistenciaApi';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { Tarjeta } from '../../comun/Tarjeta';
import { PlanillaTab } from './PlanillaTab';
import { CalendarioTab } from './CalendarioTab';
import { calendarioFilas } from './calendarioApi';
import { contadorSolicitudes } from './correccionesApi';
import { ConfiguracionAsistenciaTab } from './ConfiguracionAsistenciaTab';
import { coincide } from './buscar';
import './asistencia.css';

type Pestana = 'hoy' | 'calendario' | 'planilla' | 'config';
/** Enlaces viejos (?pestana=cronograma, feriados, pantalla…) caen en la pestaña que ahora los reúne. */
const PESTANA_ANTIGUA: Record<string, Pestana> = { cronograma: 'calendario', solicitudes: 'calendario', mes: 'calendario', marcas: 'calendario', feriados: 'config', pantalla: 'hoy' };
const PESTANAS: Pestana[] = ['hoy', 'calendario', 'planilla', 'config'];
const pestanaDe = (v: string | null): Pestana | null => (v && (PESTANAS.includes(v as Pestana) ? (v as Pestana) : PESTANA_ANTIGUA[v])) || null;
type Avisar = (m: string | null) => void;

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

export function AsistenciaAdminView() {
  // Enlace directo (lo usa Capri): /admin/asistencia?pestana=config abre esa pestaña
  const [params, setParams] = useSearchParams();
  const deUrl = pestanaDe(params.get('pestana'));
  const [pestana, setPestana] = useState<Pestana>(deUrl ?? 'hoy');
  useEffect(() => {
    if (deUrl) setPestana(deUrl);
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
    ['calendario', pendientes > 0 ? `Calendario (${pendientes})` : 'Calendario'],
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
      {pestana === 'calendario' && <CalendarioTab onError={setError} onOk={setMensaje} alCambiar={contar} />}
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

/** Lo que el reporte de hoy trae (o completamos con el calendario) para las columnas de almuerzo. */
type FilaHoyExt = FilaHoy & { almuerzoSalida?: string | null; almuerzoVuelta?: string | null; almuerzoMin?: number | null };

function HoyTab({ onError, onOk }: { onError: Avisar; onOk: Avisar }) {
  const [filas, setFilas] = useState<FilaHoyExt[] | null>(null);
  const [jornada, setJornada] = useState('');
  const [buscar, setBuscar] = useState('');
  const [estadoSel, setEstadoSel] = useState('');
  const [reiniciando, setReiniciando] = useState<FilaHoyExt | null>(null);
  const [errorReinicio, setErrorReinicio] = useState<string | null>(null);
  const [verPantalla, setVerPantalla] = useState(false);
  const cargar = async () => {
    try {
      const r = await reporteHoy();
      // Las columnas de almuerzo salen del calendario si el reporte de hoy aún no las trae
      const extra = r.filas.some((f: FilaHoyExt) => f.almuerzoSalida !== undefined)
        ? null
        : await calendarioFilas({ desde: r.jornada, hasta: r.jornada }).catch(() => null);
      setFilas(r.filas.map((f: FilaHoyExt) => {
        const c = extra?.filas.find((x) => x.partyId === String(f.partyId));
        return c ? { ...f, almuerzoSalida: c.almuerzoSalida, almuerzoVuelta: c.almuerzoVuelta, almuerzoMin: c.almuerzoMin } : f;
      }));
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
  const reiniciar = async () => {
    if (!reiniciando) return;
    try {
      await reiniciarCelular(reiniciando.partyId);
      onOk(`Celular de ${reiniciando.nombre} reiniciado. Debe volver a marcar desde su celular nuevo.`);
      setReiniciando(null);
      setErrorReinicio(null);
    } catch (e) {
      setErrorReinicio(mensajeDe(e, 'No se pudo reiniciar el celular.'));
    }
  };
  if (!filas) return <Cargando mensaje="Cargando" />;
  const cuenta = (...e: string[]) => filas.filter((f) => e.includes(f.estado)).length;
  const visibles = filas.filter((f) => coincide(f.nombre, buscar) && (!estadoSel || f.estado === estadoSel));
  return (
    <>
      <div className="as-hoy-cab">
        <h3 className="as-sub">Jornada {jornada}</h3>
        <Boton type="button" variante="secundario" tamano="pequeno" aria-expanded={verPantalla} onClick={() => setVerPantalla((v) => !v)}>Pantalla del QR</Boton>
      </div>
      {verPantalla && <EnlacePantalla onError={onError} onOk={onOk} />}
      <div className="as-resumen as-resumen--compacto" aria-label="Resumen del día">
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
      <p className="as-ayuda">La asistencia de cada persona queda ligada al primer celular desde el que marca. Si cambió de celular, pulsa “Reiniciar celular”: su próxima marca registrará el nuevo.</p>
      {visibles.length === 0 ? (
        <EstadoVacio titulo="Nadie coincide" descripcion="Cambia la búsqueda o el estado." />
      ) : (
        <div className="as-tabla-wrap">
          <table className="as-tabla as-tabla--tarjetas as-tabla--hoy">
            <thead>
              <tr><th>Persona</th><th>Turno</th><th>Entrada</th><th>Salida a almorzar</th><th>Vuelta</th><th>Almuerzo (min)</th><th>Salida</th><th>Estado</th><th>Trabajado</th><th /></tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.partyId}>
                  <td data-label="Persona" className="as-nombre">{f.nombre}</td>
                  <td data-label="Turno" className="as-num">{f.turno ? `${f.turno.entrada}-${f.turno.salida}` : '—'}</td>
                  <td data-label="Entrada" className="as-num">{f.entrada ?? '—'}</td>
                  <td data-label="Salida a almorzar" className="as-num">{f.almuerzoSalida ?? '—'}</td>
                  <td data-label="Vuelta" className="as-num">{f.almuerzoVuelta ?? '—'}</td>
                  <td data-label="Almuerzo (min)" className="as-num">{f.almuerzoMin ?? '—'}</td>
                  <td data-label="Salida" className="as-num">{f.salida ?? '—'}</td>
                  <td data-label="Estado">
                    <span><Chip estado={f.estado} />{f.alertas.length > 0 && <small className="as-nota">{f.alertas.join('; ')}</small>}</span>
                  </td>
                  <td data-label="Trabajado" className="as-num">{(f.trabajadaMin / 60).toFixed(2)} h</td>
                  <td data-label="">
                    <Boton type="button" variante="secundario" tamano="pequeno" aria-label={`Reiniciar celular de ${f.nombre}`} onClick={() => { setErrorReinicio(null); setReiniciando(f); }}>Reiniciar celular</Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Confirmar
        abierto={reiniciando !== null}
        titulo="¿Reiniciar el celular?"
        mensaje={reiniciando ? `¿Borrar el celular de ${reiniciando.nombre}? Podrá marcar desde un celular nuevo; el actual dejará de valer.` : ''}
        textoSi="Sí, reiniciar"
        textoNo="No"
        focoInicialNo
        error={errorReinicio}
        alConfirmar={reiniciar}
        alCancelar={() => setReiniciando(null)}
      />
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
