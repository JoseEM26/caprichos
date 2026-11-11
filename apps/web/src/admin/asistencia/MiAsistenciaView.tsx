import { useEffect, useId, useState } from 'react';
import {
  MiHoy,
  MiPropina,
  miHoy as cargarMiHoy,
  miPropinas,
  miResumen as cargarMiResumen,
  MiResumen,
} from './asistenciaApi';
import { TarjetaGanado } from './TarjetaGanado';
import { CorreccionesAsistencia, type PedidoCorreccion } from './CorreccionesAsistencia';
import { MiVacaciones } from './MiVacaciones';
import { MiCalendario } from './MiCalendario';
import { MisPagos } from './MisPagos';
import { MarcarAsistente } from './MarcarAsistente';
import { miInconsistencias } from './correccionesApi';
import { ETIQUETA_ACCION, ETIQUETA_LINEA, horasMin, normalizarTipo, sugerirSiguiente, type TipoMarcaElegido } from './tiposMarca';
import { BotonInstalarApp } from '../../pwa/BotonInstalarApp';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Insignia } from '../../comun/Insignia';
import { BarraPestanas, PanelesPestanas, type PestanaModal } from '../../comun/ModalConPestanas';
import { useSesion } from '../../comun/sesion';
import './asistencia.css';
import './miAsistencia.css';

/** Lo que el API de «hoy» agrega (contrato de la asistencia con tipos de marca); todo opcional para convivir con el API viejo. */
type HoyExt = MiHoy & {
  siguienteSugerido?: TipoMarcaElegido | null;
  almuerzoMin?: number | null;
};
const horaDe = (m: any): string => m.hora ?? horaCorta(m.momento);
const aMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Horas ganadas hoy (el almuerzo cuenta): de la primera entrada a la salida, o a ahora si sigue en el local. */
export function horasGanadasHoy(marcas: any[], ahoraHHmm: string): number | null {
  const v = marcas.filter((m) => !m.duplicada);
  const ent = v.find((m) => normalizarTipo(m.tipo) === 'ENTRADA') ?? (v[0] && normalizarTipo(v[0].tipo) === null ? v[0] : undefined);
  if (!ent) return null;
  const sal = [...v].reverse().find((m) => normalizarTipo(m.tipo) === 'SALIDA');
  const fin = aMin(sal ? horaDe(sal) : ahoraHHmm);
  const ini = aMin(horaDe(ent));
  return fin >= ini ? fin - ini : fin + 1440 - ini;
}

const horaCorta = (iso: string) => new Date(iso).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false });

const MESES_TEXTO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const mensajeDe = (e: unknown, fallback: string): string => {
  const x = e as any;
  return x?.mensaje ?? x?.response?.mensaje ?? x?.message ?? fallback;
};

export type PestanaMiAsistencia = 'marcar' | 'periodo' | 'calendario' | 'pagos';
const PESTANAS_IDS: PestanaMiAsistencia[] = ['marcar', 'periodo', 'calendario', 'pagos'];
const esPestana = (v: unknown): v is PestanaMiAsistencia => PESTANAS_IDS.includes(v as PestanaMiAsistencia);

/** Id de la persona para recordar su pestaña en este equipo (sin sesión, una clave común). */
function usarIdSesion(): string {
  try { return useSesion().usuario?.partyId ?? 'sin-sesion'; } catch { return 'sin-sesion'; }
}

/** Pestaña de arranque: la de la URL (?pestana=), si no la última de esta persona en este equipo, si no «Marcar». */
function pestanaInicial(clave: string): PestanaMiAsistencia {
  try {
    const url = new URLSearchParams(window.location.search).get('pestana');
    if (esPestana(url)) return url;
  } catch { /* sin URL */ }
  try {
    const guardada = window.localStorage.getItem(clave);
    if (esPestana(guardada)) return guardada;
  } catch { /* sin almacenamiento */ }
  return 'marcar';
}

const VER_PROPINAS = 3;

export function MiAsistenciaView() {
  const claveGuardada = `mi-asistencia-pestana:${usarIdSesion()}`;
  const base = useId();
  const [pestana, setPestana] = useState<PestanaMiAsistencia>(() => pestanaInicial(claveGuardada));
  const [hoy, setHoy] = useState<MiHoy | null>(null);
  const [propinas, setPropinas] = useState<MiPropina[]>([]);
  const [verTodasPropinas, setVerTodasPropinas] = useState(false);
  const [resumen, setResumen] = useState<MiResumen | null>(null);
  const [porCorregir, setPorCorregir] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pedido, setPedido] = useState<PedidoCorreccion | null>(null);

  const recargar = async () => {
    try {
      setHoy(await cargarMiHoy());
      // Mis propinas: solo mi parte de los repartos aprobados o pagados. Si falla, no se muestra.
      setPropinas(await miPropinas().catch(() => []));
      setResumen(await cargarMiResumen().catch(() => null));
      setPorCorregir((await miInconsistencias().catch(() => [])).length);
      setError(null);
    } catch (e) {
      setError(mensajeDe(e, 'No pudimos cargar tu asistencia.'));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void recargar();
  }, []);

  const cambiarPestana = (id: string) => {
    if (!esPestana(id)) return;
    setPestana(id);
    try { window.localStorage.setItem(claveGuardada, id); } catch { /* sin almacenamiento */ }
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('pestana', id);
      window.history.replaceState(window.history.state, '', u);
    } catch { /* sin historial */ }
  };

  if (cargando) return <Cargando mensaje="Cargando tu asistencia…" />;
  if (!hoy) {
    return (
      <div role="alert" className="ma-resultado ma-resultado--error">
        <strong>No pudimos cargar tu asistencia</strong>
        <span>{error ?? 'Revisa tu conexión e intenta otra vez.'}</span>
        <Boton type="button" variante="secundario" onClick={() => { setCargando(true); void recargar(); }}>Reintentar</Boton>
      </div>
    );
  }

  const h = hoy as HoyExt;
  const validas = h.marcas.filter((m) => !m.duplicada);
  const sugerido: TipoMarcaElegido | null = h.siguienteSugerido !== undefined
    ? h.siguienteSugerido
    : sugerirSiguiente(validas.map((m) => m.tipo));
  const sinUbicacion = hoy.localConUbicacion === false;
  const horaLima = new Date(hoy.ahora).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false });
  const ganadoHoy = horasGanadasHoy(h.marcas, horaLima);
  const almuerzoMin = h.almuerzoMin ?? null;
  const porPagar = propinas.filter((p) => !p.pagadoEn).length;
  const propinasVistas = verTodasPropinas ? propinas : propinas.slice(0, VER_PROPINAS);

  const panelMarcar = (
    <>
      {sinUbicacion && (
        <div role="alert" className="as-aviso as-aviso--alerta" data-testid="aviso-sin-ubicacion">
          El administrador aún no configuró la ubicación del local. Todavía no puedes marcar; avísale.
        </div>
      )}
      {hoy.interpretacion && hoy.interpretacion.alertas.length > 0 && (
        <div role="status" className="as-aviso as-aviso--alerta">
          {hoy.interpretacion.alertas.join(' · ')}. Si hay un error, pide la corrección en la pestaña Calendario.
        </div>
      )}
      <MarcarAsistente sugerido={sugerido} puedeMarcar={!sinUbicacion} activo={pestana === 'marcar'} alRegistrar={recargar} />
      <section className="ma-card" data-testid="mi-dia" aria-label="Mi día">
        <h3>Mi día</h3>
        {validas.length === 0
          ? <p className="ma-vas">Todavía no marcas nada hoy. Cuando llegues, marca tu entrada.</p>
          : (
            <ol className="ma-dia" aria-label="Marcas de mi día">
              {h.marcas.map((m, i) => {
                const t = normalizarTipo(m.tipo);
                return (
                  <li key={m.id ?? i} style={m.duplicada ? { textDecoration: 'line-through' } : undefined}>
                    <b>{horaDe(m)}</b> {t ? ETIQUETA_LINEA[t] : 'Marca'}
                    {t === 'ALMUERZO_VUELTA' && almuerzoMin != null && <small> (almuerzo {almuerzoMin} min, pagado)</small>}
                    {m.duplicada && ' (unida a la anterior)'}
                  </li>
                );
              })}
            </ol>
          )}
        {ganadoHoy !== null && <p className="ma-vas" data-testid="horas-hoy">Horas ganadas hoy: <strong>{horasMin(ganadoHoy)}</strong> (el almuerzo cuenta)</p>}
      </section>
    </>
  );

  const panelPeriodo = (
    <>
      {resumen ? (
        <section aria-label="Mi período" className="ma-lista">
          <h3 className="as-sub">Mi {resumen.modalidad === 'SEMANAL' ? 'semana' : 'mes'} ({resumen.periodo.desde} a {resumen.periodo.hasta})</h3>
          <div className="ma-card">
            <div>Horas programadas: <strong>{resumen.programadasH} h</strong></div>
            <div>Horas trabajadas: <strong>{resumen.trabajadasH} h</strong></div>
            <div>Tardanzas: <strong>{resumen.tardanzas}</strong>{resumen.tardanzaMin > 0 ? ` (${resumen.tardanzaMin} min)` : ''}</div>
            {resumen.faltas > 0 && <div>Faltas: <strong>{resumen.faltas}</strong></div>}
            {resumen.jornadasPorRevisar > 0 && <div>Jornadas por revisar con el administrador: <strong>{resumen.jornadasPorRevisar}</strong></div>}
          </div>
        </section>
      ) : (
        <div data-testid="periodo-vacio">
          <EstadoVacio
            titulo="Todavía no hay resumen de tu período"
            descripcion="Puede que aún no tengas turnos o que no pudimos cargarlo."
            accion={<Boton type="button" variante="secundario" onClick={() => void recargar()}>Reintentar</Boton>}
          />
        </div>
      )}
      <TarjetaGanado />
      <MiVacaciones />
      {propinas.length > 0 && (
        <section aria-label="Mis propinas" className="ma-lista">
          <h3 className="as-sub">Mis propinas</h3>
          {propinasVistas.map((p) => (
            <div key={`${p.anio}-${p.mes}`} className="ma-item">
              <span>
                <b>{MESES_TEXTO[p.mes - 1]} {p.anio}</b>
                <small>{p.horas.toFixed(2)} h · {p.porcentaje.toFixed(2)} %</small>
              </span>
              <strong>S/ {p.monto.toFixed(2)}</strong>
              <Insignia variante={p.pagadoEn ? 'exito' : 'aviso'}>{p.pagadoEn ? `Pagado (${p.pagadoMedio ?? 'sin medio'})` : 'Por pagar'}</Insignia>
            </div>
          ))}
          {propinas.length > VER_PROPINAS && (
            <Boton type="button" variante="texto" onClick={() => setVerTodasPropinas((v) => !v)}>
              {verTodasPropinas ? 'Ver menos' : `Ver ${propinas.length - VER_PROPINAS} más`}
            </Boton>
          )}
        </section>
      )}
    </>
  );

  const pestanas: PestanaModal[] = [
    { id: 'marcar', etiqueta: 'Marcar', contenido: panelMarcar },
    { id: 'periodo', etiqueta: 'Período', insignia: porPagar > 0 ? porPagar : null, contenido: panelPeriodo },
    {
      id: 'calendario', etiqueta: 'Calendario', insignia: porCorregir > 0 ? porCorregir : null, insigniaError: porCorregir > 0,
      contenido: (
        <>
          <CorreccionesAsistencia pedido={pedido} alAbrir={setPedido} alCerrar={() => setPedido(null)} />
          <MiCalendario alPedirCorreccion={(jornada) => setPedido({ jornada })} />
        </>
      ),
    },
    { id: 'pagos', etiqueta: 'Pagos', contenido: <MisPagos /> },
  ];

  return (
    <div className="ma-vista">
      <BotonInstalarApp />
      <div className="ma-cab">
        <section className="ma-estado" aria-label="Estado de hoy">
          <span className="ma-fecha">Hoy {hoy.jornada} · {horaLima}</span>
          <div data-testid="estado-hoy" className="ma-estado-txt">
            {h.marcas.length === 0
              ? <>Te falta marcar: <strong>Entrada</strong></>
              : sugerido
                ? <>Lo siguiente: <strong>{ETIQUETA_ACCION[sugerido]}</strong></>
                : <>Terminaste tu día. <strong>¡Gracias!</strong></>}
          </div>
          <div className="ma-turno">
            {hoy.turno
              ? <>Tu turno: {hoy.turno.entrada} a {hoy.turno.salida}{hoy.turno.almuerzo ? ` (almuerzo ${hoy.turno.almuerzo})` : ''}</>
              : 'Hoy no tienes turno programado.'}
          </div>
          {pestana !== 'marcar' && sugerido && !sinUbicacion && (
            <button type="button" className="ma-ir-marcar" onClick={() => cambiarPestana('marcar')}>Ir a marcar</button>
          )}
        </section>
        <BarraPestanas pestanas={pestanas} activa={pestana} alCambiar={cambiarPestana} base={base} etiqueta="Secciones de Mi asistencia" />
      </div>
      <PanelesPestanas pestanas={pestanas} activa={pestana} base={base} />
    </div>
  );
}
