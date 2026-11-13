import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClienteItem } from './tipos';
import {
  listarClientes,
  listarParticipantesSorteo,
  exportarClientesExcel,
  cambiarEstadoCliente,
  type FiltrosClientes,
} from './clientesApi';
import { ModalNuevoCliente } from './ModalNuevoCliente';
import { ModalFichaCliente } from './ModalFichaCliente';
import { ModalEditarCliente } from './ModalEditarCliente';
import { InsigniaGasta, InsigniaVerificacion } from './InsigniasVerificacion';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';
import { Paginacion } from '../../comun/Paginacion';
import { useSesion } from '../../comun/sesion';
import { SorteoEnVivo, type ParticipanteSorteo } from './sorteos/SorteoEnVivo';

type Vista = 'tarjetas' | 'tabla';
const TAMANOS = [24, 48, 96] as const;
const CLAVE_VISTA = 'caprichos.clientes.vista';
const CLAVE_TAMANO = 'caprichos.clientes.tamano';

const leerLocal = (clave: string): string | null => {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
};
const guardarLocal = (clave: string, valor: string) => {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    // sin almacenamiento: vale solo en esta sesión
  }
};

/** Todos los filtros de la pantalla. Los números van como texto para poder escribirlos con calma. */
interface EstadoFiltros {
  tipo: string;
  credito: string;
  registro: string;
  verif: string;
  gasta: string;
  periodo: 'siempre' | 'hoy' | 'semana' | 'mes';
  desde: string;
  hasta: string;
  pedidosMin: string;
  pedidosMax: string;
  consumoMin: string;
  consumoMax: string;
  puntosMin: string;
  puntosMax: string;
  conPuntos: string;
  sinCompraDias: string;
  cumpleMes: boolean;
  canal: string;
  orden: string;
}

const SIN_FILTROS: EstadoFiltros = {
  tipo: 'Todos',
  credito: 'Todos',
  registro: 'Todos',
  verif: 'todos',
  gasta: 'Todos',
  periodo: 'siempre',
  desde: '',
  hasta: '',
  pedidosMin: '',
  pedidosMax: '',
  consumoMin: '',
  consumoMax: '',
  puntosMin: '',
  puntosMax: '',
  conPuntos: 'todos',
  sinCompraDias: '',
  cumpleMes: false,
  canal: 'todos',
  orden: 'reciente',
};

const num = (t: string): number | undefined => {
  const n = t.trim() === '' ? NaN : Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** Pasa el estado de la pantalla a los parámetros del API (los mismos para lista, Excel y sorteo). */
function aFiltrosApi(f: EstadoFiltros, busqueda: string): FiltrosClientes {
  return {
    q: busqueda.trim() || undefined,
    tipo: f.tipo !== 'Todos' ? f.tipo : undefined,
    creditoPersonal: f.credito !== 'Todos' ? f.credito : undefined,
    estado: f.registro !== 'Todos' ? f.registro : undefined,
    verificacion: f.verif as 'verificados' | 'sin_verificar' | 'todos',
    gastaPuntos: f.gasta === 'Sí',
    periodo: f.periodo !== 'siempre' ? f.periodo : undefined,
    desde: f.desde || undefined,
    hasta: f.hasta || undefined,
    pedidosMin: num(f.pedidosMin),
    pedidosMax: num(f.pedidosMax),
    consumoMin: num(f.consumoMin),
    consumoMax: num(f.consumoMax),
    puntosMin: num(f.puntosMin),
    puntosMax: num(f.puntosMax),
    conPuntos: f.conPuntos === 'si' || f.conPuntos === 'no' ? f.conPuntos : undefined,
    sinCompraDias: num(f.sinCompraDias),
    cumpleMes: f.cumpleMes || undefined,
    canal: f.canal !== 'todos' ? (f.canal as FiltrosClientes['canal']) : undefined,
    orden: f.orden !== 'reciente' ? (f.orden as FiltrosClientes['orden']) : undefined,
  };
}

const PERIODOS: Array<{ valor: EstadoFiltros['periodo']; etiqueta: string }> = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'semana', etiqueta: 'Esta semana' },
  { valor: 'mes', etiqueta: 'Este mes' },
  { valor: 'siempre', etiqueta: 'Desde siempre' },
];
const RECURRENCIA: Array<{ id: string; etiqueta: string; min: string; max: string }> = [
  { id: 'todos', etiqueta: 'Todos', min: '', max: '' },
  { id: 'nuevos', etiqueta: 'Nuevos (1 pedido)', min: '1', max: '1' },
  { id: 'recurrentes', etiqueta: 'Recurrentes (2+)', min: '2', max: '' },
  { id: 'frecuentes', etiqueta: 'Frecuentes (5+)', min: '5', max: '' },
];
const ORDENES = [
  { valor: 'reciente', etiqueta: 'Más nuevos' },
  { valor: 'pedidos', etiqueta: 'Más compras' },
  { valor: 'consumo', etiqueta: 'Más consumo' },
  { valor: 'puntos', etiqueta: 'Más puntos' },
  { valor: 'ultima', etiqueta: 'Última compra' },
  { valor: 'nombre', etiqueta: 'Nombre' },
];
const CANALES: Record<string, string> = { CARTA: 'Carta', WHATSAPP: 'WhatsApp', CAJA: 'Caja', MOZO: 'Mozo' };

const soles = (n: number | undefined) => `S/ ${(n ?? 0).toFixed(2)}`;
const fechaCorta = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const estiloChip = (activo: boolean): React.CSSProperties => ({
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 9999,
  border: '1.5px solid var(--cp-navy)',
  background: activo ? 'var(--cp-navy)' : 'transparent',
  color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

const estiloInputNum: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 44,
  borderRadius: 10,
  border: '1.5px solid var(--cp-line)',
  background: 'var(--cp-cream)',
  color: 'var(--cp-navy)',
  padding: '0 10px',
  fontSize: 14,
};

function useEsAdmin(): boolean {
  try {
    const { usuario } = useSesion();
    return usuario?.rol?.toUpperCase() === 'ADMIN';
  } catch {
    return false;
  }
}

/** Dos casillas «desde / hasta» con su título. */
function Rango(props: { titulo: string; min: string; max: string; alCambiar: (min: string, max: string) => void; paso?: string }) {
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0, flex: '1 1 220px', minWidth: 0 }}>
      <legend style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)', padding: 0, marginBottom: 4 }}>{props.titulo}</legend>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="number" inputMode="decimal" min={0} step={props.paso ?? '1'} aria-label={`${props.titulo} desde`} placeholder="Desde" value={props.min} onChange={(e) => props.alCambiar(e.target.value, props.max)} style={estiloInputNum} />
        <input type="number" inputMode="decimal" min={0} step={props.paso ?? '1'} aria-label={`${props.titulo} hasta`} placeholder="Hasta" value={props.max} onChange={(e) => props.alCambiar(props.min, e.target.value)} style={estiloInputNum} />
      </div>
    </fieldset>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--cp-soft)' }}>{titulo}</div>
      <div style={{ fontSize: 13, lineHeight: '18px', overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  );
}

export function ClientesAdminView() {
  const esAdmin = useEsAdmin();
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(1);
  const [pagina, setPagina] = useState(1);

  // Vista y tamaño de página: se recuerdan en este equipo
  const [vista, setVistaEstado] = useState<Vista>(() => (leerLocal(CLAVE_VISTA) === 'tabla' ? 'tabla' : 'tarjetas'));
  const [limite, setLimiteEstado] = useState<number>(() => {
    const g = Number(leerLocal(CLAVE_TAMANO));
    return (TAMANOS as readonly number[]).includes(g) ? g : 24;
  });
  const setVista = (v: Vista) => {
    setVistaEstado(v);
    guardarLocal(CLAVE_VISTA, v);
  };
  const setLimite = (n: number) => {
    setLimiteEstado(n);
    guardarLocal(CLAVE_TAMANO, String(n));
  };

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [f, setF] = useState<EstadoFiltros>(SIN_FILTROS);
  const cambiar = (parcial: Partial<EstadoFiltros>) => setF((a) => ({ ...a, ...parcial }));
  const [contadores, setContadores] = useState<{ verificados: number; sinVerificar: number; gastanPuntos: number } | null>(null);

  // Modales
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [clienteFicha, setClienteFicha] = useState<ClienteItem | null>(null);
  const [clienteEditar, setClienteEditar] = useState<ClienteItem | null>(null);

  // Confirmación de activar/desactivar
  const [confirmarEstado, setConfirmarEstado] = useState<{
    cliente: ClienteItem;
    nuevoEstado: boolean;
  } | null>(null);
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  // Excel y sorteo
  const [exportando, setExportando] = useState(false);
  const [preparandoSorteo, setPreparandoSorteo] = useState(false);
  const [aviso, setAviso] = useState('');
  const [sorteo, setSorteo] = useState<{ participantes: ParticipanteSorteo[]; filtrosTexto: string } | null>(null);

  const filtrosApi = useMemo(() => aFiltrosApi(f, busqueda), [f, busqueda]);
  const claveFiltros = JSON.stringify(filtrosApi);
  const pedido = useRef(0);

  const cargarDatos = (pg: number = pagina) => {
    const mio = ++pedido.current;
    setCargando(true);
    listarClientes({ ...filtrosApi, orden: filtrosApi.orden ?? 'reciente', pagina: pg, limite })
      .then((res) => {
        if (mio !== pedido.current) return; // llegó una respuesta más nueva
        setClientes(res.items);
        setContadores(res.contadores ?? null);
        setTotal(res.total);
        setPaginas(res.paginas || 1);
        setPagina(res.pagina || 1);
      })
      .catch(() => {
        if (mio !== pedido.current) return;
        setClientes([]);
        setTotal(0);
        setPaginas(1);
      })
      .finally(() => {
        if (mio === pedido.current) setCargando(false);
      });
  };

  // Cada cambio de filtro, orden o tamaño vuelve a la página 1 (los números esperan a que termines de escribir)
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      cargarDatos(1);
      return;
    }
    const t = setTimeout(() => cargarDatos(1), 300);
    return () => clearTimeout(t);
  }, [claveFiltros, limite]);

  // Etiquetas de lo que está filtrado, cada una con su forma de quitarla
  const activos = useMemo(() => {
    const l: Array<{ id: string; texto: string; quitar: Partial<EstadoFiltros> }> = [];
    if (busqueda.trim()) l.push({ id: 'q', texto: `Búsqueda: ${busqueda.trim()}`, quitar: {} });
    if (f.tipo !== 'Todos') l.push({ id: 'tipo', texto: `Tipo: ${f.tipo}`, quitar: { tipo: 'Todos' } });
    if (f.credito !== 'Todos') l.push({ id: 'credito', texto: `Crédito del personal: ${f.credito}`, quitar: { credito: 'Todos' } });
    if (f.registro !== 'Todos') l.push({ id: 'registro', texto: `Registro: ${f.registro}`, quitar: { registro: 'Todos' } });
    if (f.verif !== 'todos') l.push({ id: 'verif', texto: f.verif === 'verificados' ? 'Verificados' : 'Sin verificar', quitar: { verif: 'todos' } });
    if (f.gasta !== 'Todos') l.push({ id: 'gasta', texto: 'Pueden gastar sus puntos', quitar: { gasta: 'Todos' } });
    if (f.desde || f.hasta) l.push({ id: 'fechas', texto: `Fechas: ${f.desde || '…'} a ${f.hasta || '…'}`, quitar: { desde: '', hasta: '' } });
    else if (f.periodo !== 'siempre') l.push({ id: 'periodo', texto: PERIODOS.find((p) => p.valor === f.periodo)!.etiqueta, quitar: { periodo: 'siempre' } });
    if (f.pedidosMin || f.pedidosMax) l.push({ id: 'pedidos', texto: `Pedidos: ${f.pedidosMin || '0'} a ${f.pedidosMax || 'más'}`, quitar: { pedidosMin: '', pedidosMax: '' } });
    if (f.consumoMin || f.consumoMax) l.push({ id: 'consumo', texto: `Consumo: S/ ${f.consumoMin || '0'} a ${f.consumoMax || 'más'}`, quitar: { consumoMin: '', consumoMax: '' } });
    if (f.puntosMin || f.puntosMax) l.push({ id: 'puntos', texto: `Puntos: ${f.puntosMin || '0'} a ${f.puntosMax || 'más'}`, quitar: { puntosMin: '', puntosMax: '' } });
    if (f.conPuntos !== 'todos') l.push({ id: 'conPuntos', texto: f.conPuntos === 'si' ? 'Con puntos' : 'Sin puntos', quitar: { conPuntos: 'todos' } });
    if (f.sinCompraDias) l.push({ id: 'dormidos', texto: `Sin comprar hace más de ${f.sinCompraDias} días`, quitar: { sinCompraDias: '' } });
    if (f.cumpleMes) l.push({ id: 'cumple', texto: 'Cumplen años este mes', quitar: { cumpleMes: false } });
    if (f.canal !== 'todos') l.push({ id: 'canal', texto: `Canal: ${CANALES[f.canal]}`, quitar: { canal: 'todos' } });
    return l;
  }, [f, busqueda]);

  const textoFiltros = activos.length ? activos.map((a) => a.texto).join(' · ') : 'Todos los clientes';
  const hayFiltros = activos.length > 0;

  const recurrenciaActual =
    RECURRENCIA.find((r) => r.min === f.pedidosMin && r.max === f.pedidosMax)?.id ?? 'otra';
  const numFiltrosPanel = [
    f.tipo !== 'Todos', f.credito !== 'Todos', f.registro !== 'Todos', f.verif !== 'todos', f.gasta !== 'Todos',
    Boolean(f.desde || f.hasta), Boolean(f.consumoMin || f.consumoMax), Boolean(f.puntosMin || f.puntosMax),
    f.conPuntos !== 'todos', Boolean(f.sinCompraDias), f.cumpleMes, f.canal !== 'todos',
    recurrenciaActual === 'otra',
  ].filter(Boolean).length;

  const limpiarFiltros = () => {
    setF(SIN_FILTROS);
    setBusqueda('');
  };

  const descargarExcel = async () => {
    setExportando(true);
    setAviso('');
    try {
      const url = await exportarClientesExcel(filtrosApi);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clientes-${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setAviso('No se pudo descargar el Excel. Prueba otra vez.');
    } finally {
      setExportando(false);
    }
  };

  const abrirSorteo = async () => {
    setPreparandoSorteo(true);
    setAviso('');
    try {
      const r = await listarParticipantesSorteo(filtrosApi);
      if (!r.participantes.length) setAviso('Nadie con celular cumple estos filtros. No hay a quién sortear.');
      else setSorteo({ participantes: r.participantes, filtrosTexto: textoFiltros });
    } catch {
      setAviso('No se pudo preparar el sorteo. Prueba otra vez.');
    } finally {
      setPreparandoSorteo(false);
    }
  };

  const ejecutarCambioEstado = async () => {
    if (!confirmarEstado) return;
    setGuardandoEstado(true);
    try {
      await cambiarEstadoCliente(confirmarEstado.cliente.id, confirmarEstado.nuevoEstado);
      setConfirmarEstado(null);
      cargarDatos(pagina);
    } catch {
      setConfirmarEstado(null);
    } finally {
      setGuardandoEstado(false);
    }
  };

  const cambiarPagina = (p: number) => {
    setPagina(p);
    cargarDatos(p);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      {/* 1. Nota explicativa */}
      <div
        style={{
          border: '1px solid var(--cp-line)',
          background: 'var(--cp-white)',
          borderRadius: 12,
          padding: '12px 14px',
          fontSize: 13,
          lineHeight: '19px',
        }}
      >
        <b>Nota.</b> Historial de quienes piden. Quien compra como invitado no suma puntos; quien crea
        cuenta (correo, cumpleaños y su visto bueno para guardar sus datos) suma puntos: el % del
        total que se define en Configuración. Nunca se obliga a crear cuenta.
      </div>

      {/* 2. Botón Nuevo Cliente */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => setModalNuevoAbierto(true)}
          style={{
            minHeight: 48,
            padding: '0 18px',
            border: 0,
            borderRadius: 12,
            background: 'var(--cp-orange)',
            color: 'var(--cp-navy)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          + Nuevo cliente
        </button>
      </div>

      {/* 3. Comentarios de los clientes */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '2px solid var(--cp-orange)',
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16 }}>
          Comentarios de los clientes
        </div>
        <div style={{ fontSize: 13, lineHeight: '19px', color: 'var(--cp-soft)' }}>
          Llegan desde &quot;¿Cómo te fue en Caprichos?&quot; al final de la carta virtual. Las quejas
          se avisan al correo del dueño (Configuración del local). Nada se elimina: se marca como
          atendido.
        </div>
        <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
          Todavía no hay comentarios. Escribe uno desde la carta para ver cómo llega.
        </div>
      </div>

      {/* 4. Buscador y filtros */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: 12,
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label htmlFor="t-q" style={{ position: 'absolute', left: -9999 }}>
            Buscar
          </label>
          <input
            id="t-q"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o celular"
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              boxSizing: 'border-box',
              minHeight: 44,
              borderRadius: 9999,
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-cream)',
              color: 'var(--cp-navy)',
              padding: '0 14px',
              fontSize: 14,
            }}
          />
          <button
            type="button"
            onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
            aria-expanded={filtrosAbiertos}
            style={{ ...estiloChip(filtrosAbiertos || numFiltrosPanel > 0), flex: 'none', display: 'inline-flex', gap: 6, alignItems: 'center' }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 5h18l-7 8v6l-4 2v-8z" />
            </svg>
            Más filtros
            {numFiltrosPanel > 0 && (
              <span
                style={{
                  minWidth: 20,
                  height: 20,
                  boxSizing: 'border-box',
                  borderRadius: 10,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 5px',
                }}
              >
                {numFiltrosPanel}
              </span>
            )}
          </button>
        </div>

        {/* Filtros rápidos: cuántas veces compran y en qué fechas */}
        <div role="group" aria-label="Cuántas veces compran" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {RECURRENCIA.map((r) => (
            <button key={r.id} type="button" aria-pressed={recurrenciaActual === r.id} onClick={() => cambiar({ pedidosMin: r.min, pedidosMax: r.max })} style={estiloChip(recurrenciaActual === r.id)}>
              {r.etiqueta}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Fechas de compra" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PERIODOS.map((p) => {
            const on = !f.desde && !f.hasta && f.periodo === p.valor;
            return (
              <button key={p.valor} type="button" aria-pressed={on} onClick={() => cambiar({ periodo: p.valor, desde: '', hasta: '' })} style={estiloChip(on)}>
                {p.etiqueta}
              </button>
            );
          })}
        </div>

        {/* Panel de filtros desplegable */}
        {filtrosAbiertos && (
          <div style={{ borderTop: '1px solid var(--cp-line)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <BarraFiltros>
              <FiltroCombo etiqueta="Tipo" valor={f.tipo} opciones={['Todos', 'Persona', 'Empresa', 'Personal'].map((o) => ({ valor: o, etiqueta: o }))} alCambiar={(v) => cambiar({ tipo: v })} />
              <FiltroCombo etiqueta="Crédito del personal" valor={f.credito} opciones={['Todos', 'Sí', 'No'].map((o) => ({ valor: o, etiqueta: o }))} alCambiar={(v) => cambiar({ credito: v })} />
              <FiltroCombo etiqueta="Registro" valor={f.registro} opciones={['Todos', 'Activos', 'Desactivados'].map((o) => ({ valor: o, etiqueta: o }))} alCambiar={(v) => cambiar({ registro: v })} />
              <FiltroCombo
                etiqueta="Verificación"
                valor={f.verif}
                opciones={[
                  { valor: 'todos', etiqueta: 'Todos' },
                  { valor: 'verificados', etiqueta: `Verificados${contadores ? ` (${contadores.verificados})` : ''}` },
                  { valor: 'sin_verificar', etiqueta: `Sin verificar${contadores ? ` (${contadores.sinVerificar})` : ''}` },
                ]}
                alCambiar={(v) => cambiar({ verif: v })}
              />
              <FiltroCombo
                etiqueta="Pueden gastar sus puntos"
                valor={f.gasta}
                opciones={[
                  { valor: 'Todos', etiqueta: 'Todos' },
                  { valor: 'Sí', etiqueta: `Sí${contadores ? ` (${contadores.gastanPuntos})` : ''}` },
                ]}
                alCambiar={(v) => cambiar({ gasta: v })}
              />
              <FiltroCombo
                etiqueta="Puntos"
                valor={f.conPuntos}
                opciones={[{ valor: 'todos', etiqueta: 'Todos' }, { valor: 'si', etiqueta: 'Con puntos' }, { valor: 'no', etiqueta: 'Sin puntos' }]}
                alCambiar={(v) => cambiar({ conPuntos: v })}
              />
              <FiltroCombo
                etiqueta="Canal"
                valor={f.canal}
                opciones={[{ valor: 'todos', etiqueta: 'Todos' }, ...Object.entries(CANALES).map(([valor, etiqueta]) => ({ valor, etiqueta }))]}
                alCambiar={(v) => cambiar({ canal: v })}
              />
            </BarraFiltros>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Rango titulo="Pedidos" min={f.pedidosMin} max={f.pedidosMax} alCambiar={(a, b) => cambiar({ pedidosMin: a, pedidosMax: b })} />
              <Rango titulo="Consumo (S/)" paso="0.01" min={f.consumoMin} max={f.consumoMax} alCambiar={(a, b) => cambiar({ consumoMin: a, consumoMax: b })} />
              <Rango titulo="Puntos" min={f.puntosMin} max={f.puntosMax} alCambiar={(a, b) => cambiar({ puntosMin: a, puntosMax: b })} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
              Pedidos y consumo cuentan solo los pedidos cobrados dentro de las fechas elegidas.
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <label style={{ flex: '1 1 150px', fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>
                Compraron desde
                <input type="date" value={f.desde} max={f.hasta || undefined} onChange={(e) => cambiar({ desde: e.target.value })} style={{ ...estiloInputNum, display: 'block', marginTop: 4 }} />
              </label>
              <label style={{ flex: '1 1 150px', fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>
                Compraron hasta
                <input type="date" value={f.hasta} min={f.desde || undefined} onChange={(e) => cambiar({ hasta: e.target.value })} style={{ ...estiloInputNum, display: 'block', marginTop: 4 }} />
              </label>
              <label style={{ flex: '1 1 190px', fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>
                Sin comprar hace más de (días)
                <input type="number" inputMode="numeric" min={1} placeholder="Ej. 30" value={f.sinCompraDias} onChange={(e) => cambiar({ sinCompraDias: e.target.value })} style={{ ...estiloInputNum, display: 'block', marginTop: 4 }} />
              </label>
              <label style={{ flex: '1 1 190px', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
                <input type="checkbox" checked={f.cumpleMes} onChange={(e) => cambiar({ cumpleMes: e.target.checked })} style={{ width: 22, height: 22 }} />
                Cumplen años este mes
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setFiltrosAbiertos(false)}
                style={{ minHeight: 44, padding: '0 16px', border: 0, borderRadius: 10, background: 'var(--cp-navy)', color: 'var(--cp-cream)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Listo
              </button>
            </div>
          </div>
        )}

        {/* Filtros puestos, cada uno se quita con un toque */}
        {hayFiltros && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }} aria-label="Filtros puestos">
            {activos.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-label={`Quitar filtro ${a.texto}`}
                onClick={() => (a.id === 'q' ? setBusqueda('') : cambiar(a.quitar))}
                style={{ minHeight: 44, padding: '0 12px', borderRadius: 9999, border: '1px solid var(--cp-line)', background: 'var(--cp-sand)', color: 'var(--cp-navy)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {a.texto} ✕
              </button>
            ))}
            <button
              type="button"
              onClick={limpiarFiltros}
              style={{ minHeight: 44, padding: '0 10px', border: 0, background: 'transparent', color: 'var(--cp-rust)', fontWeight: 700, fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {/* Resultados, orden, vista y acciones */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, color: 'var(--cp-soft)', fontWeight: 600 }}>
            {total} {total === 1 ? 'resultado' : 'resultados'}
          </div>
          <BarraFiltros>
            <FiltroCombo etiqueta="Ordenar" valor={f.orden} opciones={ORDENES} alCambiar={(v) => cambiar({ orden: v })} />
            <FiltroCombo
              etiqueta="Por página"
              valor={String(limite)}
              opciones={TAMANOS.map((n) => ({ valor: String(n), etiqueta: String(n) }))}
              alCambiar={(v) => setLimite(Number(v))}
            />
            <div role="group" aria-label="Vista" style={{ display: 'flex', gap: 4 }}>
              <button type="button" aria-pressed={vista === 'tarjetas'} onClick={() => setVista('tarjetas')} style={estiloChip(vista === 'tarjetas')}>
                Tarjetas
              </button>
              <button type="button" aria-pressed={vista === 'tabla'} onClick={() => setVista('tabla')} style={estiloChip(vista === 'tabla')}>
                Tabla
              </button>
            </div>
          </BarraFiltros>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            onClick={abrirSorteo}
            disabled={total === 0 || preparandoSorteo}
            style={{ ...estiloChip(false), borderColor: 'var(--cp-orange)', background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, opacity: total === 0 ? 0.45 : 1, cursor: total === 0 ? 'not-allowed' : 'pointer' }}
          >
            {preparandoSorteo ? 'Preparando…' : '🎉 Sorteo en vivo'}
          </button>
          {esAdmin && (
            <button
              type="button"
              onClick={descargarExcel}
              disabled={total === 0 || exportando}
              style={{ ...estiloChip(false), opacity: total === 0 ? 0.45 : 1, cursor: total === 0 ? 'not-allowed' : 'pointer' }}
            >
              {exportando ? 'Descargando…' : 'Descargar Excel'}
            </button>
          )}
        </div>
        {aviso && (
          <div role="status" style={{ fontSize: 13, color: 'var(--cp-rust)', fontWeight: 600 }}>
            {aviso}
          </div>
        )}
      </div>

      {/* 5. Lista de clientes */}
      {cargando ? (
        <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 12, padding: 24, textAlign: 'center', color: 'var(--cp-soft)' }}>
          Cargando clientes...
        </div>
      ) : clientes.length === 0 ? (
        <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 12, padding: 24, textAlign: 'center', color: 'var(--cp-soft)' }}>
          Nada coincide con los filtros.
        </div>
      ) : vista === 'tabla' ? (
        <div
          style={{ overflowX: 'auto', maxWidth: '100%', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 12 }}
          tabIndex={0}
          aria-label="Tabla de clientes, se desliza de lado"
        >
          <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--cp-sand)', textAlign: 'left' }}>
                {['Nombre', 'Celular', 'Pedidos', 'Consumo', 'Puntos', 'Última compra', 'Verificado'].map((h, i) => (
                  <th key={h} scope="col" style={{ padding: '10px 12px', fontWeight: 800, whiteSpace: 'nowrap', textAlign: i >= 2 && i <= 4 ? 'right' : 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr
                  key={c.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver historial de ${c.nombre}`}
                  onClick={() => setClienteFicha(c)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setClienteFicha(c);
                    }
                  }}
                  style={{ borderTop: '1px solid var(--cp-line)', cursor: 'pointer', opacity: c.activo ? 1 : 0.6, minHeight: 44 }}
                >
                  <td style={{ padding: '12px', fontWeight: 700 }}>
                    {c.nombre}
                    {!c.activo && <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--cp-soft)' }}>(Desactivado)</span>}
                  </td>
                  <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{c.telefono || '—'}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{c.pedidos}</td>
                  <td style={{ padding: '12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{soles(c.consumo)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{c.puntos}</td>
                  <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{fechaCorta(c.ultimaCompra)}</td>
                  <td style={{ padding: '12px' }}>{c.verificado ? 'Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(270px, 100%), 1fr))',
            gap: 12,
          }}
        >
          {clientes.map((c) => {
            const off = !c.activo;
            return (
              <div
                key={c.id}
                style={{
                  background: 'var(--cp-white)',
                  border: '1px solid var(--cp-line)',
                  borderRadius: 12,
                  boxShadow: '0 6px 18px rgba(11,44,62,0.10)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  opacity: off ? 0.6 : 1,
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, lineHeight: '21px', minWidth: 0, overflowWrap: 'anywhere' }}>
                    {c.nombre}
                  </div>
                  {off && (
                    <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, borderRadius: 9999, padding: '2px 10px', background: 'var(--cp-line)', color: 'var(--cp-soft)' }}>
                      Desactivado
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <InsigniaVerificacion cliente={c} />
                  <InsigniaGasta cliente={c} saldo={c.puntos} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 12px' }}>
                  <Dato titulo="Tipo">{c.tipo}</Dato>
                  <Dato titulo="Teléfono">{c.telefono || '—'}</Dato>
                  <Dato titulo="Correo (opcional)">{c.correo || 'sin correo'}</Dato>
                  <Dato titulo="Cumpleaños">{c.cumpleanos || '—'}</Dato>
                  <Dato titulo="Pedidos">{c.pedidos}</Dato>
                  <Dato titulo="Consumo">{soles(c.consumo)}</Dato>
                  <Dato titulo="Puntos">{c.puntos}</Dato>
                  <Dato titulo="Última compra">{fechaCorta(c.ultimaCompra)}</Dato>
                  <Dato titulo="Crédito del personal">{c.creditoPersonal ? 'Sí' : 'No'}</Dato>
                  <Dato titulo="Envío fijo (s/)">{c.envioFijo !== null && c.envioFijo !== undefined ? String(c.envioFijo) : '—'}</Dato>
                  <Dato titulo="Descuento de envío (%)">{c.descuentoEnvio !== null && c.descuentoEnvio !== undefined ? String(c.descuentoEnvio) : '—'}</Dato>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => setClienteEditar(c)}
                    style={{ flex: 1, minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 12, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmarEstado({ cliente: c, nuevoEstado: off })}
                    style={{ flex: 1, minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 12, background: off ? 'var(--cp-orange)' : 'transparent', color: 'var(--cp-navy)', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {off ? 'Activar' : 'Desactivar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setClienteFicha(c)}
                    style={{ flex: 1.2, minHeight: 44, border: 0, borderRadius: 12, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Ver historial
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Nota de que nada se elimina */}
      <div style={{ fontSize: 12, color: 'var(--cp-soft)', textAlign: 'center' }}>
        Aquí no se elimina nada: los registros se desactivan y se pueden volver a activar.
      </div>

      {/* 7. Paginación (en tarjetas y en tabla) */}
      {total > 0 && (
        <Paginacion pagina={pagina} totalPaginas={paginas} alCambiarPagina={cambiarPagina} totalRegistros={total} tamanoPagina={limite} />
      )}

      {sorteo && <SorteoEnVivo participantes={sorteo.participantes} filtrosTexto={sorteo.filtrosTexto} alCerrar={() => setSorteo(null)} />}

      {/* Modales */}
      <ModalNuevoCliente
        abierto={modalNuevoAbierto}
        alCerrar={() => setModalNuevoAbierto(false)}
        alGuardarExitoso={() => cargarDatos(1)}
      />

      <ModalFichaCliente
        abierto={!!clienteFicha}
        cliente={clienteFicha}
        alCerrar={() => setClienteFicha(null)}
        alPuntosActualizados={() => cargarDatos(pagina)}
      />

      <ModalEditarCliente
        abierto={!!clienteEditar}
        cliente={clienteEditar}
        alCerrar={() => setClienteEditar(null)}
        alGuardarExitoso={() => cargarDatos(pagina)}
      />

      {/* Confirmación Activar / Desactivar */}
      {confirmarEstado && (
        <>
          <div
            onClick={() => !guardandoEstado && setConfirmarEstado(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 80,
              background: 'rgba(11,44,62,0.6)',
            }}
          />
          <div
            role="alertdialog"
            aria-label="Confirmar acción"
            style={{
              position: 'fixed',
              zIndex: 90,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(420px, calc(100% - 24px))',
              background: 'var(--cp-cream)',
              borderRadius: 20,
              boxShadow: '0 20px 50px rgba(11,44,62,0.45)',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 20,
                lineHeight: '26px',
              }}
            >
              ¿{confirmarEstado.nuevoEstado ? 'Activar' : 'Desactivar'} &quot;{confirmarEstado.cliente.nombre}&quot;?
            </div>
            <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--cp-soft)' }}>
              {confirmarEstado.nuevoEstado
                ? 'Volverá a estar activo.'
                : 'Quedará desactivado. No se elimina y se puede activar de nuevo.'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={ejecutarCambioEstado}
                disabled={guardandoEstado}
                style={{
                  flex: 1,
                  minHeight: 52,
                  border: 0,
                  borderRadius: 12,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setConfirmarEstado(null)}
                disabled={guardandoEstado}
                style={{
                  flex: 1,
                  minHeight: 52,
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: 12,
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                No
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
