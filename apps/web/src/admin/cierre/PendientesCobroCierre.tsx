import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ModalCobrar } from '../pedidos/ModalCobrar';
import { ModalAnular } from '../pedidos/ModalAnular';
import { pedidosApi, Pedido } from '../pedidos/pedidosApi';
import { cierreApi, PendienteCobro } from './cierreApi';
import { ErrorApi } from '../../comun/api';
import { CampoCodigoSupervisor } from '../../comun/CampoCodigoSupervisor';
import { EstadoError } from '../../comun/EstadoError';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';
import { usePideCodigo } from '../../comun/usePideCodigo';
import './pendientes-cierre.css';

/** Grupos que se pueden enfocar desde un aviso del cierre. «cola» y «antiguos» son filtros. */
export type GrupoFoco = 'cobrar' | 'coordinados' | 'cola' | 'antiguos';
export interface FocoPendientes {
  grupo: GrupoFoco;
  /** Cambia en cada pulsación para repetir el enfoque aunque sea el mismo grupo */
  n: number;
}

export interface PendientesCobroCierreProps {
  esAdmin: boolean;
  pendientes: PendienteCobro[];
  setPendientes: (lista: PendienteCobro[]) => void;
  alCambiarTurno: () => void;
  /** Error al cargar la lista del admin: muestra Reintentar */
  errorLista?: boolean;
  alReintentar?: () => void;
  /** Pide enfocar un grupo (lo abre y hace scroll hasta el panel) */
  foco?: FocoPendientes | null;
}

const PAGINA = 30;
const ESTADOS_COLA = ['COLA', 'PREPARANDO', 'LISTO'];
const ETIQUETA_ESTADO: Record<string, string> = {
  COLA: 'En cola',
  PREPARANDO: 'Preparando',
  LISTO: 'Listo',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  ANULADO: 'Anulado',
};

type Grupo = 'cobrar' | 'coordinados';
type Chip = 'todos' | 'cobrar' | 'cola' | 'coordinados' | 'antiguos';

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Día calendario en Lima (AAAA-MM-DD), para saber si un pedido es de un día anterior */
const diaLima = (f: string | Date) => new Date(f).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

const soles = (v: number) => `S/ ${v.toFixed(2)}`;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esCoordinado = (p: PendienteCobro) => p.pagoEstado === 'COORDINADO';
const sumaTotal = (lista: PendienteCobro[]) => lista.reduce((s, p) => s + Number(p.total || 0), 0);

/** Conteos y montos del resumen, sobre la lista completa (sin filtros) */
export function resumenPendientes(lista: PendienteCobro[], hoy = diaLima(new Date())) {
  const cobrar = lista.filter((p) => !esCoordinado(p));
  const coordinados = lista.filter(esCoordinado);
  const cola = lista.filter((p) => ESTADOS_COLA.includes(p.estado));
  const antiguos = lista.filter((p) => diaLima(p.fecha) < hoy);
  return {
    total: { n: lista.length, monto: sumaTotal(lista) },
    cobrar: { n: cobrar.length, monto: sumaTotal(cobrar) },
    coordinados: { n: coordinados.length, monto: sumaTotal(coordinados) },
    cola: { n: cola.length },
    antiguos: { n: antiguos.length },
  };
}

/** Filtro por chip y buscador (código o nombre), más antiguo primero */
export function filtrarPendientes(lista: PendienteCobro[], chip: Chip, texto: string, hoy = diaLima(new Date())) {
  const q = norm(texto.trim());
  return lista
    .filter((p) => {
      if (chip === 'cobrar' && esCoordinado(p)) return false;
      if (chip === 'coordinados' && !esCoordinado(p)) return false;
      if (chip === 'cola' && !ESTADOS_COLA.includes(p.estado)) return false;
      if (chip === 'antiguos' && !(diaLima(p.fecha) < hoy)) return false;
      if (q && !norm(p.codigo).includes(q) && !norm(p.clienteNombre ?? '').includes(q)) return false;
      return true;
    })
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
}

const TITULO_GRUPO: Record<Grupo, string> = {
  cobrar: 'Por cobrar',
  coordinados: 'Coordinados sin liquidar',
};

/** Aviso que bloquea el cierre: cuenta los pedidos y enlaza cada motivo a su grupo del panel */
export function AvisoBloqueoCierre({
  pedidos,
  alVerGrupo,
}: {
  pedidos: PendienteCobro[];
  alVerGrupo: (grupo: GrupoFoco) => void;
}) {
  const r = resumenPendientes(pedidos);
  return (
    <div className="pdc-avisos" aria-label="Pedidos que bloquean el cierre">
      <button
        type="button"
        className="pdc-boton pdc-boton-oscuro"
        onClick={() => alVerGrupo(r.cobrar.n > 0 ? 'cobrar' : 'coordinados')}
      >
        Ver {r.total.n} pedidos sin resolver
      </button>
      {r.cobrar.n > 0 && (
        <button type="button" className="pdc-boton pdc-boton-secundario" onClick={() => alVerGrupo('cobrar')}>
          Por cobrar: {r.cobrar.n}
        </button>
      )}
      {r.coordinados.n > 0 && (
        <button type="button" className="pdc-boton pdc-boton-secundario" onClick={() => alVerGrupo('coordinados')}>
          Coordinados por confirmar: {r.coordinados.n}
        </button>
      )}
    </div>
  );
}

/**
 * Pedidos sin cobrar de cualquier día que impiden cerrar la caja (RN-CAP-079). Cada uno se cobra
 * en la caja que se cierra («Cobrar ahora») o se anula con motivo y PIN («Anular con motivo»). Un cajero
 * ve la lista solo con el PIN de supervisor.
 */
export function PendientesCobroCierre({
  esAdmin,
  pendientes,
  setPendientes,
  alCambiarTurno,
  errorLista = false,
  alReintentar,
  foco = null,
}: PendientesCobroCierreProps) {
  const [codigo, setCodigo] = useState('');
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [pedidoCobrar, setPedidoCobrar] = useState<Pedido | null>(null);
  const [pendienteAnular, setPendienteAnular] = useState<PendienteCobro | null>(null);
  const [pedidoAnular, setPedidoAnular] = useState<Pedido | null>(null);
  const [chip, setChip] = useState<Chip>('todos');
  const [texto, setTexto] = useState('');
  const [abiertos, setAbiertos] = useState<Partial<Record<Grupo, boolean>>>({});
  const [visibles, setVisibles] = useState<Record<Grupo, number>>({ cobrar: PAGINA, coordinados: PAGINA });
  const seccionRef = useRef<HTMLElement>(null);

  // ADMIN y SUPERVISOR no escriben código (el servidor los deja pasar): ven la lista de entrada
  const pideCodigo = usePideCodigo();
  const mostrarLista = esAdmin || !pideCodigo || desbloqueado;
  const hoy = diaLima(new Date());

  const resumen = useMemo(() => resumenPendientes(pendientes, hoy), [pendientes, hoy]);
  const filtrados = useMemo(() => filtrarPendientes(pendientes, chip, texto, hoy), [pendientes, chip, texto, hoy]);
  const grupos = useMemo(() => {
    const lista: { clave: Grupo; items: PendienteCobro[] }[] = [
      { clave: 'cobrar', items: filtrados.filter((p) => !esCoordinado(p)) },
      { clave: 'coordinados', items: filtrados.filter(esCoordinado) },
    ];
    return lista.filter((g) => g.items.length > 0);
  }, [filtrados]);

  // Por defecto solo abre el primer grupo con elementos; el usuario puede abrir o plegar cualquiera
  const primerGrupo = grupos[0]?.clave;
  const estaAbierto = (g: Grupo) => abiertos[g] ?? g === primerGrupo;

  // Enfoque pedido desde un aviso del cierre: abre el grupo (o filtro) y hace scroll hasta el panel
  useEffect(() => {
    if (!foco || !mostrarLista) return;
    if (foco.grupo === 'cola' || foco.grupo === 'antiguos') {
      setChip(foco.grupo);
    } else {
      setChip('todos');
      setAbiertos((a) => ({ ...a, [foco.grupo]: true }));
    }
    const el = seccionRef.current;
    if (el) {
      el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      el.focus();
    }
    // Solo reacciona a una nueva solicitud de enfoque
  }, [foco?.n]);

  const verConCodigo = async () => {
    if (!/^\d{6}$/.test(codigo.trim())) {
      setError('El código del supervisor debe ser de exactamente 6 dígitos numéricos.');
      return;
    }
    setCargando(true);
    setError('');
    try {
      const lista = await cierreApi.listarPendientesDeCobro(codigo);
      setPendientes(lista);
      setDesbloqueado(true);
    } catch (err: unknown) {
      if (err instanceof ErrorApi) {
        if (err.codigo === 'CODIGO_INVALIDO' || err.codigo === 'PIN_INVALIDO') {
          setError('Código del supervisor inválido. Pídelo nuevamente a la supervisora.');
        } else if (err.codigo === 'CODIGO_BLOQUEADO' || err.codigo === 'PIN_BLOQUEADO') {
          setError(err.message || 'Demasiados intentos con el código del supervisor. Espera 1 min o pide al administrador que lo desbloquee.');
        } else if (err.codigo === 'SUPERVISOR_SIN_CONFIGURAR') {
          setError('El local aún no tiene configurado el código de supervisor. El administrador debe generarlo desde su pantalla.');
        } else {
          setError(err.message);
        }
      } else {
        setError('No se pudo cargar la lista. Intenta de nuevo.');
      }
    } finally {
      setCodigo('');
      setCargando(false);
    }
  };

  const quitar = (id: number) => setPendientes(pendientes.filter((p) => p.id !== id));

  const cobrarAhora = async (p: PendienteCobro) => {
    setError('');
    try {
      setPedidoCobrar(await pedidosApi.obtenerPorId(p.id));
    } catch (err: unknown) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo abrir el cobro del pedido.');
    }
  };

  // El detalle (líneas, cliente, total) va al diálogo de anular; si no carga, se anula igual con lo básico
  const abrirAnular = async (p: PendienteCobro) => {
    setError('');
    try {
      setPedidoAnular(await pedidosApi.obtenerPorId(p.id));
    } catch {
      setPedidoAnular(null);
    }
    setPendienteAnular(p);
  };

  const cerrarAnular = () => {
    setPendienteAnular(null);
    setPedidoAnular(null);
  };

  // Función (no componente): así el input de búsqueda no se desmonta al escribir
  const envolver = (children: ReactNode) => (
    <section id="pendientes-cierre" ref={seccionRef} tabIndex={-1} className="pdc-panel pdc-foco" aria-label="Pedidos pendientes del cierre">
      {children}
      {pedidoCobrar && (
        <ModalCobrar
          pedido={pedidoCobrar}
          alCerrar={() => setPedidoCobrar(null)}
          cobrar={(dto) => cierreApi.cobrarPendiente(pedidoCobrar.id, dto)}
          alCobrarExitoso={() => {
            quitar(Number(pedidoCobrar.id));
            setPedidoCobrar(null);
            alCambiarTurno();
          }}
        />
      )}
      {pendienteAnular && (
        <ModalAnular
          pedidoId={pendienteAnular.id}
          codigoPedido={pendienteAnular.codigo}
          pedido={pedidoAnular}
          alCerrar={cerrarAnular}
          alAnularExitoso={() => {
            quitar(pendienteAnular.id);
            cerrarAnular();
            alCambiarTurno();
          }}
        />
      )}
    </section>
  );

  if (!mostrarLista) {
    return envolver(
      <>
        <div className="pdc-titulo">Pedidos sin cobrar: impiden cerrar la caja</div>
        <div style={{ fontSize: 13 }}>
          Ingresa el código del supervisor para ver los pedidos sin cobrar de cualquier día.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <CampoCodigoSupervisor
              id="codigo-supervisor-pendientes"
              valor={codigo}
              onChange={(v) => {
                setCodigo(v);
                setError('');
              }}
              error={error}
              etiqueta="Código del supervisor (6 dígitos)"
              ayuda="Pídelo a la supervisora: lo ve en su pantalla y cambia cada 30 segundos"
            />
          </div>
          <button
            type="button"
            className="pdc-boton pdc-boton-oscuro"
            onClick={verConCodigo}
            disabled={cargando}
            style={{ marginTop: 24 }}
          >
            {cargando ? 'Verificando…' : 'Ver pedidos'}
          </button>
        </div>
      </>
    );
  }

  if (errorLista && pendientes.length === 0) {
    return envolver(
      <>
        <EstadoError
          titulo="No se pudieron cargar los pedidos pendientes"
          mensaje="Revisa la conexión y vuelve a intentarlo."
          alReintentar={alReintentar}
        />
      </>
    );
  }

  if (pendientes.length === 0) {
    return envolver(
      <>
        <div className="pdc-vacio" role="status">Todo al día: no hay pedidos pendientes.</div>
      </>
    );
  }

  return envolver(
    <>
      <div className="pdc-titulo">Pedidos sin cobrar: impiden cerrar la caja</div>

      <div className="pdc-resumen">
        <div className="pdc-tarjeta">
          <span>Por cobrar: <b>{resumen.cobrar.n}</b></span>
          <span>{soles(resumen.cobrar.monto)}</span>
        </div>
        <div className="pdc-tarjeta">
          <span>En cocina/cola: <b>{resumen.cola.n}</b></span>
          <span>Pedidos sin entregar</span>
        </div>
        <div className="pdc-tarjeta">
          <span>Coordinados sin liquidar: <b>{resumen.coordinados.n}</b></span>
          <span>{soles(resumen.coordinados.monto)}</span>
        </div>
        <div className="pdc-tarjeta pdc-tarjeta-total">
          <span>Total que bloquea el cierre: <b>{resumen.total.n}</b></span>
          <span>{soles(resumen.total.monto)}</span>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ color: 'var(--cp-rust, #B2500F)', fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}

      <BarraFiltros>
        <div className="pdc-buscador">
          <input
            type="search"
            aria-label="Buscar pedido por código o nombre del cliente"
            placeholder="Buscar por código o nombre"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <FiltroCombo
          etiqueta="Filtrar"
          valor={chip}
          valorPorDefecto="todos"
          opciones={[
            { valor: 'todos', etiqueta: 'Todos', cantidad: pendientes.length },
            { valor: 'cobrar', etiqueta: 'Por cobrar', cantidad: resumen.cobrar.n },
            { valor: 'cola', etiqueta: 'En cola', cantidad: resumen.cola.n },
            { valor: 'coordinados', etiqueta: 'Coordinados', cantidad: resumen.coordinados.n },
            { valor: 'antiguos', etiqueta: 'Antiguos de días anteriores', cantidad: resumen.antiguos.n },
          ]}
          alCambiar={(v) => setChip(v as Chip)}
        />
      </BarraFiltros>

      <div className="pdc-lista">
        {grupos.length === 0 && <div className="pdc-vacio">Ningún pedido coincide con el filtro o la búsqueda.</div>}
        {grupos.map((g) => {
          const abierto = estaAbierto(g.clave);
          const visiblesGrupo = g.items.slice(0, visibles[g.clave]);
          const restantes = g.items.length - visiblesGrupo.length;
          return (
            <div className="pdc-grupo" key={g.clave}>
              <button
                type="button"
                id={`pdc-grupo-${g.clave}`}
                className="pdc-grupo-cab"
                aria-expanded={abierto}
                aria-controls={`pdc-panel-${g.clave}`}
                onClick={() => setAbiertos((a) => ({ ...a, [g.clave]: !abierto }))}
              >
                <span>
                  {TITULO_GRUPO[g.clave]} · {g.items.length} · {soles(sumaTotal(g.items))}
                </span>
                <span aria-hidden="true">{abierto ? '▾' : '▸'}</span>
              </button>
              {abierto && (
                <div id={`pdc-panel-${g.clave}`} role="region" aria-label={TITULO_GRUPO[g.clave]}>
                  {visiblesGrupo.map((p) => {
                    const antiguo = diaLima(p.fecha) < hoy;
                    const sinNombre = !p.clienteNombre;
                    return (
                      <div className="pdc-fila" key={p.id}>
                        <span className="pdc-codigo">{p.codigo}</span>
                        <span className={sinNombre ? 'pdc-cliente pdc-sin-nombre' : 'pdc-cliente'}>
                          {p.clienteNombre || 'Sin nombre'}
                        </span>
                        <span className="pdc-meta">
                          <span>{p.modalidad}</span>
                          <span>{ETIQUETA_ESTADO[p.estado] ?? p.estado}</span>
                          <span className={antiguo ? 'pdc-antiguo' : undefined}>
                            {fechaCorta(p.fecha)}
                            {antiguo ? ' · día anterior' : ''}
                          </span>
                        </span>
                        <span className="pdc-total">{soles(Number(p.total || 0))}</span>
                        <span className="pdc-acciones">
                          <button type="button" className="pdc-boton pdc-boton-primario" onClick={() => cobrarAhora(p)}>
                            Cobrar ahora
                          </button>
                          <button type="button" className="pdc-boton pdc-boton-peligro" onClick={() => abrirAnular(p)}>
                            Anular con motivo
                          </button>
                        </span>
                      </div>
                    );
                  })}
                  {restantes > 0 && (
                    <button
                      type="button"
                      className="pdc-ver-mas"
                      onClick={() => setVisibles((v) => ({ ...v, [g.clave]: v[g.clave] + PAGINA }))}
                    >
                      Ver más ({restantes} restantes)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
