import { MouseEvent, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Insignia } from '../../comun/Insignia';
import { MapaUbicacion } from '../../comun/mapa/MapaUbicacion';
import { BuscadorDireccion } from '../../comun/mapa/BuscadorDireccion';
import { SEDE_DEFECTO } from '../../comun/mapa/sedeDefecto';
import {
  ConfigAsistenciaAdmin,
  EstadoEnlacePantalla,
  desactivarEnlacePantalla,
  estadoEnlacePantalla,
  generarEnlacePantalla,
  guardarConfigAsistencia,
  obtenerConfigAsistencia,
} from './asistenciaApi';
import { FeriadosTab } from './FeriadosTab';
import { Plegable } from './Plegable';
import './planilla.css';

type Avisar = (m: string | null) => void;
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;

const SIN_UBICACION = 'Aún no configuras la ubicación del local: nadie podrá marcar';
const PRECISION_BUENA_M = 30;
/** Peor que esto es ubicación por internet (IP/wifi): no sirve para fijar el punto del local. */
const PRECISION_INUTIL_M = 100;
export const PENALIDAD_DEFECTO = 100;
const PENALIDAD_MAX = 500;

/** Precisión legible: metros, o km si pasa de 1000. */
export const formatearPrecision = (m: number): string =>
  m >= 1000 ? `${(m / 1000).toLocaleString('es-PE', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`;

const SECCIONES = [
  ['horario', 'Horario y tolerancia'],
  ['ubicacion', 'Ubicación del local'],
  ['marcado', 'Selfies y marcado'],
  ['pago', 'Pago y valor hora'],
  ['quien', 'Quién marca'],
  ['feriados', 'Feriados'],
  ['pantalla', 'Pantalla del QR'],
] as const;

/**
 * Configuración de asistencia en una sola página: índice con anclas y secciones plegables
 * (Horario y tolerancia, Ubicación, Selfies y marcado, Pago, Quién marca, Feriados, Pantalla del QR).
 * Carga y guarda su propia configuración; `alGuardar` avisa al padre (p. ej. para quitar el aviso de «sin ubicación»).
 */
export function ConfiguracionAsistenciaTab({ onError, onOk, alGuardar }: { onError: Avisar; onOk: Avisar; alGuardar?: (c: ConfigAsistenciaAdmin) => void }) {
  const [cfg, setCfg] = useState<ConfigAsistenciaAdmin | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [precision, setPrecision] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    obtenerConfigAsistencia().then(setCfg).catch((e) => onError(mensajeDe(e, 'No pudimos cargar la configuración.')));
  }, []);

  if (!cfg) return <Cargando mensaje="Cargando configuración" />;

  const penalidad = cfg.tardanzaPenalidadPct ?? PENALIDAD_DEFECTO;
  const penalidadMala = !Number.isFinite(penalidad) || penalidad < 0 || penalidad > PENALIDAD_MAX;
  const conUbicacion = cfg.localLat !== null && cfg.localLng !== null;

  const campo = (k: keyof ConfigAsistenciaAdmin, etiqueta: string, ayuda: string, extra: { min?: number; max?: number; valor?: number | null } = {}) => (
    <label className="as-campo">
      {etiqueta}
      <input
        type="number"
        step="any"
        min={extra.min}
        max={extra.max}
        value={(extra.valor !== undefined ? extra.valor : (cfg[k] as number | null | undefined)) ?? ''}
        onChange={(e) => setCfg({ ...cfg, [k]: e.target.value === '' ? null : Number(e.target.value) })}
      />
      <small>{ayuda}</small>
    </label>
  );

  const guardar = async () => {
    if (penalidadMala) { onError(`La penalidad por tardanza va de 0 a ${PENALIDAD_MAX} %.`); return; }
    setGuardando(true);
    try {
      // pagoTardanzaPct (antiguo «tardanza pagada») ya no se edita ni se envía.
      const g = await guardarConfigAsistencia({ ...cfg, pagoTardanzaPct: undefined, tardanzaPenalidadPct: penalidad });
      setCfg(g);
      alGuardar?.(g);
      onError(null);
      onOk('Configuración guardada.');
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo guardar.'));
    } finally {
      setGuardando(false);
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

  // Ancla: abre la sección (si estaba plegada) y baja hasta ella
  const irA = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(`cfg-${id}`);
    if (el instanceof HTMLDetailsElement) el.open = true;
    el?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  };

  return (
    <div className="pl-cfg">
      <nav aria-label="Secciones de la configuración" className="pl-indice">
        {SECCIONES.map(([id, t]) => <a key={id} href={`#cfg-${id}`} onClick={irA(id)}>{t}</a>)}
      </nav>
      {!conUbicacion && <div role="alert" className="as-aviso as-aviso--alerta">{SIN_UBICACION}.</div>}

      <Plegable id="cfg-horario" titulo="Horario y tolerancia" resumen={`Tolerancia ${cfg.toleranciaMin} min · penalidad ${penalidad} %`} abierta>
        <p className="as-ayuda">El horario de cada persona (entrada, salida y break) se pone en Usuarios, pestaña Horario. Por defecto es de 13:30 a 22:30. Aquí van las reglas generales.</p>
        <div className="as-form">
          {campo('toleranciaMin', 'Tolerancia de tardanza (min)', 'Minutos después de la hora de entrada que aún no cuentan como tardanza. Hoy: 5.', { min: 0 })}
          <label className="as-campo">
            Penalidad por tardanza (%)
            <input type="number" step="1" min={0} max={PENALIDAD_MAX} value={cfg.tardanzaPenalidadPct ?? ''} placeholder={String(PENALIDAD_DEFECTO)}
              aria-invalid={penalidadMala} onChange={(e) => setCfg({ ...cfg, tardanzaPenalidadPct: e.target.value === '' ? undefined : Number(e.target.value) })} />
            <small>
              La hora tarde no se paga y además se cobra una penalidad: este % del valor de ese tiempo, proporcional a los minutos. {PENALIDAD_DEFECTO} = el mismo valor del tiempo perdido; 0 = no se cobra penalidad. De 0 a {PENALIDAD_MAX}.
            </small>
            {penalidadMala && <small role="alert" style={{ color: 'var(--cp-rust)' }}>Escribe un número de 0 a {PENALIDAD_MAX}.</small>}
          </label>
        </div>
        <p className="as-ayuda" data-testid="ejemplo-penalidad">
          Ejemplo: llega 30 min tarde y su hora vale S/ 10. No se le pagan esos 30 min (S/ 5) y se le cobra una penalidad de S/ {(5 * (penalidadMala ? PENALIDAD_DEFECTO : penalidad) / 100).toFixed(2)}.
        </p>
      </Plegable>

      <Plegable id="cfg-ubicacion" titulo="Ubicación del local" resumen={conUbicacion ? <Insignia variante="exito">Lista</Insignia> : <Insignia variante="aviso">Falta</Insignia>} abierta={!conUbicacion}>
        <p className="as-ayuda">El punto desde el que se mide la distancia al marcar.</p>
        <div className="as-form">
          {campo('localLat', 'Latitud del local', 'Ej. -12.046374')}
          {campo('localLng', 'Longitud del local', 'Ej. -77.042793')}
        </div>
        <BuscadorDireccion onElegir={(p) => moverPunto(p)} />
        <MapaUbicacion
          punto={conUbicacion ? { lat: cfg.localLat as number, lng: cfg.localLng as number } : null}
          onCambiar={moverPunto}
          altura={300}
          etiqueta="Mapa para marcar la ubicación del local"
          local={conUbicacion ? null : SEDE_DEFECTO}
          ajustarA={conUbicacion ? 'punto' : 'local'}
          radioM={cfg.radioM ?? undefined}
        />
        <p className="as-ayuda">
          {conUbicacion ? 'Arrastra el punto o toca el mapa para moverlo.' : 'Toca el mapa para colocar el punto del local: hasta entonces no se guarda ninguno.'}
        </p>
        <div className="as-form">
          {campo('radioM', 'Radio del local (m)', 'A cuántos metros del punto del local se puede marcar. Hoy: 10.')}
          {campo('precisionMaxM', 'Precisión GPS máxima aceptada (m)', 'Si el GPS del celular es peor que esto (número más alto), se le pide reintentar.')}
        </div>
        <p className="as-ayuda" data-testid="texto-regla">
          La asistencia se mide desde este punto: el trabajador debe estar a {cfg.radioM ?? '—'} m o menos (radio) y con el GPS del celular con precisión mejor que {cfg.precisionMaxM ?? '—'} m.
        </p>
        <div className="as-acciones">
          <Boton type="button" variante="oscuro" cargando={leyendo} onClick={usarMiUbicacion}>Usar mi ubicación actual</Boton>
          {conUbicacion && (
            <a className="as-enlace" href={`https://www.google.com/maps?q=${cfg.localLat},${cfg.localLng}`} target="_blank" rel="noreferrer">Ver en Google Maps</a>
          )}
        </div>
        <p className="as-ayuda">Para usar tu ubicación, tienes que estar dentro del local, de preferencia al centro y con el GPS activado.</p>
        {precision !== null && (
          <div role="status" className={`as-aviso ${precision > PRECISION_BUENA_M ? 'as-aviso--alerta' : 'as-aviso--ok'}`}>
            Precisión obtenida: {formatearPrecision(precision)}.
            {precision > PRECISION_BUENA_M && ` Es peor que ${PRECISION_BUENA_M} m: sal a un lugar abierto y vuelve a intentar, o corrige las coordenadas a mano.`}
          </div>
        )}
      </Plegable>

      <Plegable id="cfg-marcado" titulo="Selfies y marcado" resumen={`Selfies ${cfg.retencionDias} días`}>
        <div className="as-form">
          {campo('retencionDias', 'Días que se guardan las selfies', 'Pasado este plazo la foto se borra; la marca se conserva.')}
          {campo('dobleMarcaMin', 'Doble marca: unir marcas a menos de (min)', 'Marcas muy seguidas se unen: cuenta la primera y la otra se muestra tachada. 0 = no unir. Hoy: 3.')}
          {campo('solicitudDiasMax', 'Días para pedir corrección', 'Hasta cuántos días atrás la persona puede pedir que se corrija su asistencia. Hoy: 7.')}
        </div>
        <p className="as-ayuda">Se marca con el QR de la pantalla del local (tipo de marca: entrada, salida, ida y vuelta del almuerzo). Marcar el almuerzo es opcional.</p>
      </Plegable>

      <Plegable id="cfg-pago" titulo="Pago y valor hora" resumen={`Extra ×${cfg.multiplicadorExtra}`}>
        <div className="as-form">
          {campo('multiplicadorExtra', 'Hora extra aprobada: multiplicador', 'Se paga a valor hora × este número (solo si el admin la aprueba). Hoy: 1.25.')}
          {campo('diasMesDefecto', 'Valor hora: días del mes (general)', 'Sueldo mensual ÷ estos días ÷ horas por día. Se puede cambiar por persona en Usuarios. Hoy: 24.')}
          {campo('horasDiaDefecto', 'Valor hora: horas por día (general)', 'Hoy: 9. Se puede cambiar por persona (ej. 8).')}
          {campo('netflixSemanal', 'Netflix: descuento semanal (S/)', 'Monto por semana que se descuenta a quien lo paga. Otros servicios extra se ponen por persona en la Planilla.')}
        </div>
        <p className="as-ayuda">El break se paga: cuenta como horas trabajadas.</p>
      </Plegable>

      <Plegable id="cfg-quien" titulo="Quién marca" resumen="Todos menos el Administrador">
        <p className="as-ayuda">La asistencia es obligatoria para todos los roles (incluidos Supervisor y Contador), menos el Administrador. Quién marca se decide por el rol de cada usuario en Usuarios.</p>
      </Plegable>

      <Plegable id="cfg-feriados" titulo="Feriados" resumen="Horas al doble (×2)" perezoso>
        <FeriadosTab onError={onError} onOk={onOk} />
      </Plegable>

      <Plegable id="cfg-pantalla" titulo="Pantalla del QR (tablet del local)" perezoso>
        <EnlacePantalla onError={onError} onOk={onOk} />
      </Plegable>

      <div className="pl-guardar">
        <Boton type="button" cargando={guardando} onClick={() => void guardar()}>Guardar configuración</Boton>
        <small className="as-nota">Guarda Horario, Ubicación, Selfies y Pago. Los feriados y la pantalla del QR se guardan solos.</small>
      </div>
    </div>
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
    <section aria-label="Enlace de la pantalla" style={{ display: 'grid', gap: 10 }}>
      <p className="as-ayuda">Una pantalla fija muestra el código que cambia cada 30 segundos. No pide usuario ni contraseña. <Insignia variante={estado.activo ? 'exito' : 'neutro'}>{estado.activo ? 'Activo' : 'Sin enlace'}</Insignia></p>
      <div className="as-aviso as-aviso--alerta">Cualquiera con este enlace ve el código. Guárdalo solo en la tablet del local y no lo compartas.</div>
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
        <Boton type="button" onClick={() => void generar()}>{estado.activo ? 'Regenerar' : 'Generar enlace de la pantalla'}</Boton>
        {estado.activo && <Boton type="button" variante="peligro" onClick={() => void desactivar()}>Desactivar</Boton>}
      </div>
      {estado.activo && estado.generadoEn && (
        <p className="as-ayuda">Enlace activo desde {new Date(estado.generadoEn).toLocaleString('es-PE')}. Regenerar invalida el anterior.</p>
      )}
    </section>
  );
}
