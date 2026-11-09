import { useCallback, useEffect, useMemo, useState } from 'react';
import { TAMANO_BEBIDA_DEFECTO, TAMANO_GENERAL_DEFECTO, type EstadoAdminImpresion } from '@caprichos/compartido';
import { useSesion } from '../../../comun/sesion';
import { useEventos } from '../../../comun/socket';
import { Cargando } from '../../../comun/Cargando';
import { Confirmar } from '../../../comun/Confirmar';
import { impresionApi, type MapaImpresionDatos, type ReglasMapa, type TrabajoImpresionAdmin } from '../impresionApi';
import { ListaTrabajos, type PestanaMaquina } from '../ListaTrabajos';
import { ColaImpresion } from '../ColaImpresion';
import { PanelInstalarPrograma } from '../PanelInstalarPrograma';
import { TarjetaEquipo } from './TarjetaEquipo';
import { TarjetaCompacta } from './TarjetaCompacta';
import type { VersionPublicada } from '../versionPrograma';
import { PanelVistaPrevia, type PcPrevia } from './PanelVistaPrevia';
import { configDe } from './logicaEquipo';
import { tamanoEfectivo } from '@caprichos/compartido';
import { esNueva, ordenarEquipos } from './logicaEquipo';
import { contadorEquipos, equiposDelListado } from './logicaListado';
import { VistaPieza } from '../mapa/VistaPiezaEjemplo';
import {
  ATAJOS,
  COLUMNAS,
  avisosDeArmado,
  cambioAlTocar,
  celdaExiste,
  celdaMarcada,
  filasVisibles,
  fraseSaleEn,
  type ClaveFila,
  type ColumnaId,
} from './logicaFacil';
import '../mapa/mapa-impresion.css';
import './impresion-facil.css';
import './listado-equipos.css';

/**
 * Configuración › Impresión: una tarjeta compacta por computadora (su configuración completa, en una ventana), las reglas
 * generales del local en un card aparte y plegado, y lo último que se imprimió. Cada computadora se prueba por separado.
 * Las reglas del local son el punto de partida («Usar lo general») y el CUÁNDO (en mesa, llevar, delivery) de cada pieza.
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
  const [ultimaVersion, setUltimaVersion] = useState<VersionPublicada | null>(null);
  useEffect(() => {
    // Sin archivo publicado o sin red: simplemente no hay insignia
    Promise.resolve().then(() => impresionApi.ultimaVersionPrograma()).then((r) => setUltimaVersion(r?.publicada ?? null)).catch(() => {});
  }, []);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [previa, setPrevia] = useState<{ pcId: string | null; n: number }>({ pcId: null, n: 0 });

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

  const avisos = useMemo(() => (mapa ? avisosDeArmado(mapa) : []), [mapa]);
  const detalles = estado?.equipos ?? [];
  const equiposOrdenados = useMemo(
    () => ordenarEquipos(detalles, (id) => detalles.find((d) => d.deviceKeyId === id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [estado],
  );
  const nuevas = detalles.filter((d) => esNueva(d));
  const listado = useMemo(() => equiposDelListado(equiposOrdenados), [equiposOrdenados]);
  const areasSimples = useMemo(() => mapa?.areas.map((a) => ({ id: a.id, nombre: a.nombre })) ?? [], [mapa]);
  const tamanosLocal = estado?.tamanosLocal ?? { bebida: TAMANO_BEBIDA_DEFECTO, general: TAMANO_GENERAL_DEFECTO };
  const pcsPrevia = useMemo<PcPrevia[]>(
    () =>
      listado.items.map(({ equipo }) => {
        const cfg = configDe(equipo);
        return { id: equipo.deviceKeyId, nombre: equipo.nombre, bebida: tamanoEfectivo(cfg.tamanoBebida, tamanosLocal.bebida), general: tamanoEfectivo(cfg.tamanoGeneral, tamanosLocal.general) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listado],
  );
  const equipoAbierto = listado.items.find((i) => i.equipo.deviceKeyId === abierta) ?? null;

  if (cargando && !mapa) return <Cargando mensaje="Consultando tus computadoras de impresión..." />;

  return (
    <div className="if-pagina" data-testid="impresion-facil">
      <section className="if-como" aria-labelledby="if-como-t" data-cfg-id="impresion-como-funciona" tabIndex={-1}>
        <h3 id="if-como-t">Cómo funciona</h3>
        <ul>
          <li>Cada computadora se configura por separado: tú decides si tiene ticketera, etiquetera o las dos, y qué imprime de cada área.</li>
          <li>Una PC nueva no imprime nada hasta que la configures.</li>
          <li>Si una PC está apagada, sus papeles esperan y salen al encenderla.</li>
          <li>Si ninguna PC imprime algo, ese papel espera en la cola y te avisamos aquí.</li>
        </ul>
      </section>

      {error && (
        <div role="alert" className="if-alerta if-alerta--rojo">
          {error}
        </div>
      )}
      {nuevas.length > 0 && (
        <div role="alert" className="if-alerta if-alerta--rojo" data-testid="aviso-nuevas">
          {nuevas.length === 1
            ? `«${nuevas[0].nombre}» es nueva y falta configurar: no imprime nada hasta que elijas qué hará.`
            : `Hay ${nuevas.length} computadoras nuevas por configurar: no imprimen nada hasta que elijas qué hará cada una.`}
        </div>
      )}
      {(estado?.sinReceptor ?? 0) > 0 && (
        <div role="alert" className="if-alerta if-alerta--rojo" data-testid="aviso-sin-receptor">
          Ninguna PC imprime {estado!.sinReceptor === 1 ? 'un papel que está esperando' : `${estado!.sinReceptor} papeles que están esperando`}. Configura una PC para que los reciba y saldrán solos.
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

      {/* TUS COMPUTADORAS */}
      <section className="if-paso" aria-labelledby="if-p1" data-testid="paso-1" data-cfg-id="impresion-paso-computadoras" tabIndex={-1}>
        <div className="if-cab">
          <div>
            <h3 id="if-p1">Tus computadoras</h3>
            <p className="if-sub" data-testid="contador-pcs">{contadorEquipos(listado.items.map((i) => i.equipo))}</p>
          </div>
          <button type="button" className="if-sec" data-testid="agregar-pc" onClick={() => setInstalar(true)}>
            + Agregar computadora
          </button>
        </div>
        {listado.items.length === 0 && <p className="if-vacio">Todavía no hay ninguna computadora. Pulsa «Agregar computadora».</p>}
        <div className="ic-grilla" data-testid="lista-pcs">
          {listado.items.map(({ equipo, duplicadoDe }) => (
            <div key={equipo.deviceKeyId} className="ic-envoltura">
              <TarjetaCompacta equipo={equipo} areas={areasSimples} duplicadoDe={duplicadoDe} alAbrir={() => setAbierta(equipo.deviceKeyId)} ultimaVersion={ultimaVersion} />
              <button type="button" className="ic-ver" data-testid={`ver-ejemplos-${equipo.deviceKeyId}`} aria-label={`Ver ejemplos de lo que imprime ${equipo.nombre}`} onClick={() => setPrevia((p) => ({ pcId: equipo.deviceKeyId, n: p.n + 1 }))}>
                👁 Ver ejemplos
              </button>
            </div>
          ))}
        </div>
        {listado.ocultas > 0 && <p className="if-sub" data-testid="pcs-ocultas">{listado.ocultas === 1 ? 'Hay 1 computadora antigua guardada' : `Hay ${listado.ocultas} computadoras antiguas guardadas`} (repetidas o reemplazadas): no se muestran aquí y nada se borró. Están en la Vista avanzada.</p>}
      </section>
      <PanelVistaPrevia pcs={pcsPrevia} pcId={previa.pcId} abrir={previa.n} />
      {equipoAbierto && (
        <TarjetaEquipo
          key={equipoAbierto.equipo.deviceKeyId}
          equipo={equipoAbierto.equipo}
          areas={areasSimples}
          categorias={mapa?.categorias ?? []}
          configsOtras={listado.items.filter((o) => o.equipo.deviceKeyId !== abierta).map((o) => o.equipo.config).filter((c): c is NonNullable<typeof c> => !!c)}
          tamanosLocal={tamanosLocal}
          puedeEditar={puedeEditar}
          pendientes={equipoAbierto.equipo.pendientes}
          duplicadoDe={equipoAbierto.duplicadoDe}
          ultimaVersion={ultimaVersion}
          alRecargar={() => void cargar()}
          alAviso={(tipo, texto) => setAviso({ tipo, texto })}
          alCancelar={() => setAbierta(null)}
        />
      )}

      {/* REGLAS GENERALES (card aparte, plegado) */}
      {mapa && <PasoQueSeImprime mapa={mapa} puedeEditar={puedeEditar} guardando={guardando} alGuardar={guardarReglas} />}

      {/* ÚLTIMAS IMPRESIONES */}
      <PasoUltimos mapa={mapa} trabajos={trabajos} puedeEditar={puedeEditar} alCambiar={() => void cargar()} />

      <p className="if-avanzada">
        <button type="button" className="if-enlace" data-testid="vista-avanzada" onClick={alVistaAvanzada}>
          Vista avanzada
        </button>{' '}
        (mapa, equipos y cola completa, por si necesitas más detalle)
      </p>

      {instalar && <PanelInstalarPrograma alCerrar={() => setInstalar(false)} />}
    </div>
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
    <section className="if-paso if-reglas" aria-labelledby="if-p2" data-testid="paso-2" data-cfg-id="impresion-paso-que-se-imprime" tabIndex={-1}>
     <details data-testid="reglas-plegado">
      <summary>
        <h3 id="if-p2">Reglas generales del local</h3>
        <span className="if-sub">Punto de partida para PC nuevas y en qué tipo de pedido sale cada cosa</span>
      </summary>
      <p className="if-sub">Sirven para dos cosas: son lo que copia una PC cuando pulsas «Usar lo general», y dicen en qué tipo de pedido (en mesa, para llevar, delivery) sale cada papel. Qué papeles y de qué áreas imprime cada computadora lo decide su propia configuración.</p>

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
     </details>
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

function PasoUltimos({
  mapa,
  trabajos,
  puedeEditar,
  alCambiar,
}: {
  mapa: MapaImpresionDatos | null;
  trabajos: TrabajoImpresionAdmin[];
  puedeEditar: boolean;
  alCambiar: () => void;
}) {
  const [aReintentar, setAReintentar] = useState<TrabajoImpresionAdmin | null>(null);
  const [errorReintento, setErrorReintento] = useState<string | null>(null);
  const [pestana, setPestana] = useState<PestanaMaquina>('TODO');
  const [verCola, setVerCola] = useState(false);
  const { tiene, usuario } = useSesion();
  const puedeReimprimir = (usuario?.rol || '').toUpperCase() === 'ADMIN' || tiene('pedidos/cambiar_estado');

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
      <h3 id="if-p3">Lo último que se imprimió</h3>
      <p className="if-sub">Para probar una impresora, abre su computadora y entra en «Probar»: cada una tiene sus propias pruebas.</p>
      {errorReintento && (
        <div role="alert" className="if-alerta if-alerta--rojo">
          {errorReintento}
        </div>
      )}
      <ListaTrabajos
        trabajos={trabajos.map((t) => ({ ...t, equipoNombre: t.equipoNombre ?? pcDe(t).nombre }))}
        pestana={pestana}
        alCambiarPestana={setPestana}
        puedeReimprimir={puedeReimprimir}
        puedeReintentar={puedeEditar}
        alReimprimir={async (cuerpo) => {
          const r = await impresionApi.reimprimirTrabajos(cuerpo);
          alCambiar();
          return r;
        }}
        alReintentar={(t) => setAReintentar(t)}
        pcConectada={(t) => pcDe(t).conectada}
        testIdLista="ultimos-trabajos"
        vacio="Todavía no se imprimió nada."
      />
      <button type="button" className="lt-enlace" onClick={() => setVerCola(true)}>Ver toda la cola</button>
      {verCola && <ColaImpresion alCerrar={() => { setVerCola(false); alCambiar(); }} />}
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
