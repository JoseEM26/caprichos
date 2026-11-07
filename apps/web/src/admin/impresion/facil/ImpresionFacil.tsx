import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EquipoEstadoImpresion, EstadoAdminImpresion, RolImpresora } from '@caprichos/compartido';
import { useSesion } from '../../../comun/sesion';
import { useEventos } from '../../../comun/socket';
import { Cargando } from '../../../comun/Cargando';
import { Confirmar } from '../../../comun/Confirmar';
import { ErrorApi } from '../../../comun/api';
import { impresionApi, type EquipoMapa, type MapaImpresionDatos, type ReglasMapa, type TrabajoImpresionAdmin } from '../impresionApi';
import { ImpresorasDelEquipo } from '../ImpresorasDelEquipo';
import { PanelInstalarPrograma } from '../PanelInstalarPrograma';
import { VistaPieza } from '../mapa/VistaPiezaEjemplo';
import {
  ATAJOS,
  COLUMNAS,
  avisosDeArmado,
  cambioAlTocar,
  celdaExiste,
  celdaMarcada,
  estadoDePC,
  estadoDeTrabajo,
  filasVisibles,
  fraseSaleEn,
  lineasDePC,
  motivoDeTrabajo,
  piezaDeTrabajo,
  type ClaveFila,
  type ColumnaId,
} from './logicaFacil';
import '../mapa/mapa-impresion.css';
import './impresion-facil.css';

const NOMBRE_LUZ = { verde: 'Lista', ambar: 'Atención', rojo: 'Revisar' } as const;

/**
 * Configuración › Impresión en 3 pasos: tus computadoras, qué se imprime y probar.
 * Las reglas son UNA para todo el local; cada computadora solo dice qué impresoras tiene y de qué área se encarga.
 */
export function ImpresionFacil({ alVistaAvanzada }: { alVistaAvanzada: () => void }) {
  const { tiene, usuario } = useSesion();
  const esAdmin = (usuario?.rol || '').toUpperCase() === 'ADMIN';
  const puedeEditar = esAdmin || tiene('configuracion/editar');

  const [mapa, setMapa] = useState<MapaImpresionDatos | null>(null);
  const [estado, setEstado] = useState<EstadoAdminImpresion | null>(null);
  const [trabajos, setTrabajos] = useState<TrabajoImpresionAdmin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [instalar, setInstalar] = useState(false);
  const [confirmarReemplazo, setConfirmarReemplazo] = useState<{ equipoId: string; areaId: string | null; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [m, e, t] = await Promise.all([
        impresionApi.obtenerMapa(),
        impresionApi.obtenerEstado(),
        impresionApi.listarTrabajos({ limite: 10 }).catch(() => ({ items: [] as TrabajoImpresionAdmin[] })),
      ]);
      setMapa(m);
      setEstado(e);
      setTrabajos(t.items);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudo consultar el estado de impresión.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
    const cada = setInterval(() => void cargar(), 10000);
    return () => clearInterval(cada);
  }, [cargar]);
  useEventos('impresion:cola', cargar);
  useEventos('impresion:estado', cargar);

  const guardarReglas = async (cambio: Partial<ReglasMapa>, textoOk: string) => {
    if (!mapa || !puedeEditar) return;
    setGuardando(true);
    try {
      await impresionApi.guardarReglasImpresion(cambio);
      setAviso({ tipo: 'ok', texto: textoOk });
      await cargar();
    } catch (err: any) {
      setAviso({ tipo: 'error', texto: `No se guardó el cambio. ${err?.message ?? ''}`.trim() });
    } finally {
      setGuardando(false);
    }
  };

  const cambiarArea = async (equipoId: string, areaId: string | null, reemplazar = false) => {
    if (!mapa) return;
    const nombreArea = areaId === null ? 'Caja' : mapa.areas.find((a) => a.id === areaId)?.nombre ?? 'el área';
    const pc = mapa.equipos.find((e) => e.deviceKeyId === equipoId)?.nombre ?? 'La computadora';
    try {
      const r = reemplazar ? await impresionApi.asignarAreaEquipo(equipoId, areaId, true) : await impresionApi.asignarAreaEquipo(equipoId, areaId);
      setAviso({ tipo: 'ok', texto: [`${pc} ahora imprime lo de ${nombreArea}.`, ...r.avisos].join(' ') });
      await cargar();
    } catch (err: any) {
      const ocupada = err instanceof ErrorApi && err.codigo === 'AREA_OCUPADA' ? (err.detalles as any)?.ocupadoPor : null;
      if (ocupada) {
        setConfirmarReemplazo({
          equipoId,
          areaId,
          texto: `${nombreArea} ya la atiende «${ocupada.nombre}». Si sigues, «${ocupada.nombre}» deja de imprimir y «${pc}» ocupa su lugar.`,
        });
        return;
      }
      setAviso({ tipo: 'error', texto: `No se guardó el cambio. ${err?.message ?? ''}`.trim() });
    }
  };

  const avisos = useMemo(() => (mapa ? avisosDeArmado(mapa) : []), [mapa]);

  if (cargando && !mapa) return <Cargando mensaje="Consultando tus computadoras de impresión..." />;

  return (
    <div className="if-pagina" data-testid="impresion-facil">
      <section className="if-como" aria-labelledby="if-como-t" data-cfg-id="impresion-como-funciona" tabIndex={-1}>
        <h3 id="if-como-t">Cómo funciona</h3>
        <ul>
          <li>Las reglas (qué se imprime) son UNA sola para todo el local.</li>
          <li>Cada computadora solo dice qué impresoras tiene y de qué se encarga.</li>
          <li>Si una PC está apagada, sus papeles esperan y salen al encenderla.</li>
          <li>Si un área no tiene PC, sale en Caja.</li>
        </ul>
      </section>

      {error && (
        <div role="alert" className="if-alerta if-alerta--rojo">
          {error}
        </div>
      )}
      {avisos.length > 0 && (
        <div role="alert" className="if-alerta if-alerta--rojo" data-testid="aviso-armado">
          <strong>Revisa esto:</strong>
          <ul>
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {aviso && (
        <div role={aviso.tipo === 'error' ? 'alert' : 'status'} className={`if-alerta ${aviso.tipo === 'error' ? 'if-alerta--rojo' : 'if-alerta--verde'}`}>
          {aviso.texto}
        </div>
      )}

      {/* PASO 1 */}
      <section className="if-paso" aria-labelledby="if-p1" data-testid="paso-1" data-cfg-id="impresion-paso-computadoras" tabIndex={-1}>
        <h3 id="if-p1">
          <span className="if-num" aria-hidden="true">1</span> Tus computadoras
        </h3>
        <p className="if-sub">Cada computadora con el programa de impresión. Elige sus impresoras y de qué se encarga.</p>
        {mapa && mapa.equipos.length === 0 && <p className="if-vacio">Todavía no hay ninguna computadora. Pulsa «Agregar otra computadora».</p>}
        <div className="if-pcs">
          {mapa?.equipos.map((eq) => (
            <TarjetaPC
              key={eq.deviceKeyId}
              eq={eq}
              detalle={estado?.equipos?.find((x) => x.deviceKeyId === eq.deviceKeyId)}
              mapa={mapa}
              puedeEditar={puedeEditar}
              pendientes={mapa.colaPendientePorEquipo.find((c) => c.deviceKeyId === eq.deviceKeyId)?.pendientes ?? 0}
              alElegirArea={(areaId) => void cambiarArea(eq.deviceKeyId, areaId)}
              alRecargar={() => void cargar()}
            />
          ))}
        </div>
        <button type="button" className="if-grande" data-testid="agregar-pc" onClick={() => setInstalar(true)}>
          + Agregar otra computadora
        </button>
      </section>

      {/* PASO 2 */}
      {mapa && <PasoQueSeImprime mapa={mapa} puedeEditar={puedeEditar} guardando={guardando} alGuardar={guardarReglas} />}

      {/* PASO 3 */}
      <PasoProbar mapa={mapa} estado={estado} trabajos={trabajos} puedeEditar={puedeEditar} alCambiar={() => void cargar()} />

      <p className="if-avanzada">
        <button type="button" className="if-enlace" data-testid="vista-avanzada" onClick={alVistaAvanzada}>
          Vista avanzada
        </button>{' '}
        (mapa, equipos y cola completa, por si necesitas más detalle)
      </p>

      {instalar && <PanelInstalarPrograma alCerrar={() => setInstalar(false)} />}
      <Confirmar
        abierto={!!confirmarReemplazo}
        titulo="Reemplazar la computadora de esa área"
        mensaje={confirmarReemplazo?.texto ?? ''}
        textoSi="Sí, reemplazar"
        textoNo="No"
        alConfirmar={() => {
          const c = confirmarReemplazo;
          setConfirmarReemplazo(null);
          if (c) void cambiarArea(c.equipoId, c.areaId, true);
        }}
        alCancelar={() => setConfirmarReemplazo(null)}
      />
    </div>
  );
}

function TarjetaPC({
  eq,
  detalle,
  mapa,
  puedeEditar,
  pendientes,
  alElegirArea,
  alRecargar,
}: {
  eq: EquipoMapa;
  detalle?: EquipoEstadoImpresion;
  mapa: MapaImpresionDatos;
  puedeEditar: boolean;
  pendientes: number;
  alElegirArea: (areaId: string | null) => void;
  alRecargar: () => void;
}) {
  const [cambiando, setCambiando] = useState(false);
  const nombres = {
    TICKETERA: detalle?.impresoras?.TICKETERA?.impresoraNombre,
    ETIQUETERA: detalle?.impresoras?.ETIQUETERA?.impresoraNombre,
  };
  const est = estadoDePC(eq, pendientes);
  const lineas = lineasDePC(eq, nombres);
  return (
    <article className="if-pc" data-testid={`pc-${eq.deviceKeyId}`} aria-label={eq.nombre}>
      <header className="if-pc-cab">
        <h4>{eq.nombre}</h4>
        <span className={`if-luz if-luz--${est.luz}`} data-testid={`luz-${eq.deviceKeyId}`} data-nivel={est.luz}>
          <span className="if-luz-punto" aria-hidden="true" />
          {NOMBRE_LUZ[est.luz]}
        </span>
      </header>
      <p className="if-pc-estado" data-testid={`estado-pc-${eq.deviceKeyId}`}>
        {est.texto}
      </p>
      <ul className="if-pc-impresoras">
        {lineas.map((l) => (
          <li key={l.rol} className={`if-imp if-imp--${l.nivel}`}>
            {l.texto}
          </li>
        ))}
      </ul>
      <label className="if-campo">
        <span>Esta PC imprime lo de:</span>
        <select
          data-testid={`area-${eq.deviceKeyId}`}
          value={eq.areaId ?? ''}
          disabled={!puedeEditar}
          onChange={(e) => alElegirArea(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">Caja</option>
          {mapa.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </label>
      {detalle && (
        <>
          <button type="button" className="if-sec" aria-expanded={cambiando} onClick={() => setCambiando((v) => !v)}>
            {cambiando ? 'Cerrar' : 'Cambiar impresoras'}
          </button>
          {cambiando && <ImpresorasDelEquipo equipo={detalle} alCambiar={alRecargar} />}
        </>
      )}
    </article>
  );
}

function PasoQueSeImprime({
  mapa,
  puedeEditar,
  guardando,
  alGuardar,
}: {
  mapa: MapaImpresionDatos;
  puedeEditar: boolean;
  guardando: boolean;
  alGuardar: (cambio: Partial<ReglasMapa>, textoOk: string) => Promise<void>;
}) {
  const r = mapa.reglas;
  const [ejemplo, setEjemplo] = useState<ClaveFila | null>(null);
  const [atajo, setAtajo] = useState<string | null>(null);
  const elegido = ATAJOS.find((a) => a.id === atajo) ?? null;
  return (
    <section className="if-paso" aria-labelledby="if-p2" data-testid="paso-2" data-cfg-id="impresion-paso-que-se-imprime" tabIndex={-1}>
      <h3 id="if-p2">
        <span className="if-num" aria-hidden="true">2</span> Qué se imprime
      </h3>
      <p className="if-sub">Marca con ✓ lo que quieres que salga en cada tipo de pedido. Vale para todo el local.</p>

      <div className="if-atajos" role="group" aria-label="Atajos">
        {ATAJOS.map((a) => (
          <button key={a.id} type="button" className="if-atajo" data-testid={`atajo-${a.id}`} disabled={!puedeEditar || guardando} onClick={() => setAtajo(a.id)}>
            {a.titulo}
          </button>
        ))}
      </div>

      <div className="if-tabla-caja">
        <table className="if-tabla">
          <caption className="if-solo-lector">Qué se imprime según el tipo de pedido</caption>
          <thead>
            <tr>
              <th scope="col">Pieza</th>
              {COLUMNAS.map((c) => (
                <th key={c.id} scope="col" className="if-col">
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filasVisibles(r).map((f) => (
              <FilaTabla
                key={f.clave}
                fila={f.clave}
                titulo={f.titulo}
                que={f.que}
                saleEn={fraseSaleEn(f.clave, mapa)}
                reglas={r}
                deshabilitado={!puedeEditar || guardando}
                ejemploAbierto={ejemplo === f.clave}
                pieza={f.pieza}
                alVerEjemplo={() => setEjemplo(ejemplo === f.clave ? null : f.clave)}
                alTocar={(col) => void alGuardar(cambioAlTocar(r, f.clave, col), 'Guardado.')}
              />
            ))}
          </tbody>
        </table>
      </div>
      {!puedeEditar && <p className="if-sub">Solo quien tiene permiso de configuración puede cambiar esto.</p>}

      <Confirmar
        abierto={!!elegido}
        titulo={elegido?.titulo ?? ''}
        mensaje={`${elegido?.ayuda ?? ''} Se cambian las casillas de la tabla; no se mueve ninguna computadora.`}
        textoSi="Sí, usar este"
        textoNo="No"
        alConfirmar={() => {
          const a = elegido;
          setAtajo(null);
          if (a) void alGuardar(a.reglas, `Listo: «${a.titulo}».`);
        }}
        alCancelar={() => setAtajo(null)}
      />
    </section>
  );
}

function FilaTabla({
  fila,
  titulo,
  que,
  saleEn,
  reglas,
  deshabilitado,
  ejemploAbierto,
  pieza,
  alVerEjemplo,
  alTocar,
}: {
  fila: ClaveFila;
  titulo: string;
  que: string;
  saleEn: string;
  reglas: ReglasMapa;
  deshabilitado: boolean;
  ejemploAbierto: boolean;
  pieza: Parameters<typeof VistaPieza>[0]['clave'];
  alVerEjemplo: () => void;
  alTocar: (col: ColumnaId) => void;
}) {
  return (
    <>
      <tr data-testid={`fila-${fila}`}>
        <th scope="row" className="if-pieza">
          <span className="if-pieza-nombre">{titulo}</span>
          <span className="if-pieza-que">{que}</span>
          <span className="if-pieza-sale">{saleEn}</span>
          <button type="button" className="if-enlace" aria-expanded={ejemploAbierto} onClick={alVerEjemplo}>
            {ejemploAbierto ? 'Ocultar ejemplo' : 'Ver ejemplo'}
          </button>
        </th>
        {COLUMNAS.map((c) => {
          if (!celdaExiste(fila, c.id)) {
            return (
              <td key={c.id} className="if-celda if-celda--na">
                <span aria-label="No aplica">—</span>
              </td>
            );
          }
          const marcada = celdaMarcada(reglas, fila, c.id);
          const fija = fila === 'PAGO';
          return (
            <td key={c.id} className="if-celda">
              <label className="if-check" title={fija ? 'Siempre sale' : undefined}>
                <input
                  type="checkbox"
                  data-testid={`celda-${fila}-${c.id}`}
                  checked={marcada}
                  disabled={fija || deshabilitado}
                  onChange={() => alTocar(c.id)}
                  aria-label={`${titulo}: ${c.titulo}`}
                />
                <span className="if-check-caja" aria-hidden="true">{marcada ? '✓' : ''}</span>
              </label>
            </td>
          );
        })}
      </tr>
      {ejemploAbierto && (
        <tr>
          <td colSpan={4} className="if-ejemplo">
            <VistaPieza clave={pieza} />
          </td>
        </tr>
      )}
    </>
  );
}

function PasoProbar({
  mapa,
  estado,
  trabajos,
  puedeEditar,
  alCambiar,
}: {
  mapa: MapaImpresionDatos | null;
  estado: EstadoAdminImpresion | null;
  trabajos: TrabajoImpresionAdmin[];
  puedeEditar: boolean;
  alCambiar: () => void;
}) {
  const [resultados, setResultados] = useState<string[] | null>(null);
  const [probando, setProbando] = useState(false);
  const [aReintentar, setAReintentar] = useState<TrabajoImpresionAdmin | null>(null);
  const [errorReintento, setErrorReintento] = useState<string | null>(null);

  const probarTodo = async () => {
    if (!mapa) return;
    setProbando(true);
    const out: string[] = [];
    for (const eq of mapa.equipos) {
      const det = estado?.equipos?.find((x) => x.deviceKeyId === eq.deviceKeyId);
      for (const rol of eq.maquinas as RolImpresora[]) {
        const que = rol === 'TICKETERA' ? 'ticket' : 'sticker';
        const impresoraId = det?.impresoras?.[rol]?.impresoraId;
        if (!impresoraId) {
          out.push(`${eq.nombre}: no elegiste impresora de ${rol === 'TICKETERA' ? 'tickets' : 'stickers'}, no se probó.`);
          continue;
        }
        try {
          await impresionApi.pruebaImpresion(rol, impresoraId, eq.deviceKeyId);
          out.push(`${eq.nombre}: prueba de ${que} enviada.`);
        } catch (err: any) {
          out.push(`${eq.nombre}: no se pudo probar el ${que}. ${err?.message ?? ''}`.trim());
        }
      }
    }
    if (out.length === 0) out.push('No hay impresoras que probar. Agrega una computadora primero.');
    setResultados(out);
    setProbando(false);
    alCambiar();
  };

  const reintentar = async () => {
    const t = aReintentar;
    setAReintentar(null);
    if (!t) return;
    try {
      await impresionApi.reintentarTrabajo(t.id);
      setErrorReintento(null);
      alCambiar();
    } catch (err: any) {
      setErrorReintento(err?.message || 'No se pudo reintentar.');
    }
  };

  const pcDe = (t: TrabajoImpresionAdmin): { nombre: string; conectada: boolean | null } => {
    const areaId = t.destinoAreaId ?? null;
    const eq = mapa?.equipos.find((e) => (e.areaId ?? null) === areaId);
    return { nombre: eq?.nombre ?? (areaId === null ? 'Caja' : 'PC del área'), conectada: eq ? eq.conectado : null };
  };

  return (
    <section className="if-paso" aria-labelledby="if-p3" data-testid="paso-3" data-cfg-id="impresion-paso-probar" tabIndex={-1}>
      <h3 id="if-p3">
        <span className="if-num" aria-hidden="true">3</span> Probar
      </h3>
      <p className="if-sub">Imprime una hoja de prueba en cada impresora. Dice «PRUEBA — no es un pedido»: no cuenta como venta.</p>
      <button type="button" className="if-grande" data-testid="probar-todo" disabled={!puedeEditar || probando || !mapa} onClick={() => void probarTodo()}>
        {probando ? 'Enviando pruebas…' : 'Imprimir una prueba en cada impresora'}
      </button>
      {resultados && (
        <ul className="if-resultados" role="status" data-testid="resultados-prueba">
          {resultados.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}

      <h4 className="if-lista-t">Lo último que se imprimió</h4>
      {errorReintento && (
        <div role="alert" className="if-alerta if-alerta--rojo">
          {errorReintento}
        </div>
      )}
      {trabajos.length === 0 ? (
        <p className="if-vacio" data-testid="ultimos-trabajos">Todavía no se imprimió nada.</p>
      ) : (
        <ul className="if-trabajos" data-testid="ultimos-trabajos">
          {trabajos.map((t) => {
            const est = estadoDeTrabajo(t.estado);
            const pc = pcDe(t);
            const motivo = motivoDeTrabajo(t, pc.conectada);
            const puedeReintentar = ['FALLIDO', 'VENCIDO'].includes(t.estado);
            return (
              <li key={t.id} className="if-trabajo" data-testid={`trabajo-${t.id}`}>
                <div className="if-trabajo-fila">
                  <strong>{piezaDeTrabajo(t)}</strong>
                  <span className="if-trabajo-pedido">{t.pedidoCodigo ? `Pedido ${t.pedidoCodigo}` : 'Sin pedido'}</span>
                  <span className="if-trabajo-pc">en {pc.nombre}</span>
                  <span className={`if-estado if-estado--${est.id}`}>{est.texto}</span>
                </div>
                {motivo && <div className="if-trabajo-motivo">{motivo}</div>}
                {puedeReintentar && puedeEditar && (
                  <button type="button" className="if-sec" onClick={() => setAReintentar(t)}>
                    Reintentar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Confirmar
        abierto={!!aReintentar}
        titulo="¿Reintentar este papel?"
        mensaje="Vuelve a la cola y sale otra vez en su computadora."
        textoSi="Sí, reintentar"
        textoNo="No"
        alConfirmar={() => void reintentar()}
        alCancelar={() => setAReintentar(null)}
      />
    </section>
  );
}
