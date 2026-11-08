import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useInRouterContext } from 'react-router-dom';
import { almacenApi, type EventoHistorial, type GrupoHistorial, type HistorialProductoRespuesta } from './almacenApi';
import { Icono } from '../../comun/Icono';
import { EstadoError } from '../../comun/EstadoError';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { ErrorApi } from '../../comun/api';
import { useDialogoAccesible } from '../../comun/useDialogoAccesible';
import { useRecargaEnVivo } from './useRecargaEnVivo';
import './apertura-dia.css';

type Dia = 'hoy' | 'ayer' | '7' | 'fecha';
const CHIPS: Array<{ valor: GrupoHistorial | ''; texto: string }> = [
  { valor: '', texto: 'Todo' },
  { valor: 'subidas', texto: 'Subidas' },
  { valor: 'pedidos', texto: 'Pedidos' },
  { valor: 'mermas', texto: 'Mermas' },
  { valor: 'ajustes', texto: 'Ajustes' },
];
const DIAS: Array<{ valor: Dia; texto: string }> = [
  { valor: 'hoy', texto: 'Hoy' },
  { valor: 'ayer', texto: 'Ayer' },
  { valor: '7', texto: '7 días' },
  { valor: 'fecha', texto: 'Otra fecha' },
];
const ICONO_GRUPO: Record<string, string> = { subidas: 'stock', pedidos: 'compras', mermas: 'alerta', ajustes: 'historial' };

const hoyLima = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
const restarDias = (fecha: string, n: number) => new Date(Date.parse(`${fecha}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
const conSigno = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** Rango de fechas (Lima) de cada opción del selector de día. */
export function rangoDe(dia: Dia, fecha: string, hoy = hoyLima()): { desde: string; hasta: string } {
  if (dia === 'ayer') return { desde: restarDias(hoy, 1), hasta: restarDias(hoy, 1) };
  if (dia === '7') return { desde: restarDias(hoy, 6), hasta: hoy };
  if (dia === 'fecha' && fecha) return { desde: fecha, hasta: fecha };
  return { desde: hoy, hasta: hoy };
}

function EnlacePedido({ enlace, codigo }: { enlace: string; codigo: string }) {
  const enRouter = useInRouterContext();
  const texto = `Abrir pedido ${codigo}`;
  return enRouter ? (
    <Link to={enlace} className="hp-enlace" aria-label={texto}>
      {codigo} · Abrir pedido
    </Link>
  ) : (
    <a href={enlace} className="hp-enlace" aria-label={texto}>
      {codigo} · Abrir pedido
    </a>
  );
}

function Evento({ e, conSabor }: { e: EventoHistorial; conSabor: boolean }) {
  const positivo = e.cantidad >= 0;
  const p = e.pedido;
  return (
    <li className="hp-evento" data-testid="historial-evento">
      <div className="hp-hora" aria-label={`A las ${e.hora}`}>
        {e.hora}
      </div>
      <div className="hp-cuerpo">
        <div className="hp-tipo">
          <Icono nombre={ICONO_GRUPO[e.grupo] ?? 'historial'} tamano={16} aria-hidden="true" />
          <span>{e.etiqueta}</span>
          {conSabor && e.sabor && <span className="hp-sabor">{e.sabor}</span>}
        </div>
        {p && (
          <div className="hp-detalle">
            <EnlacePedido enlace={p.enlace} codigo={p.codigo} />
            <span> · {p.anulado ? `anulado${p.devuelto ? ` · devuelto +${p.devuelto}` : ''}` : p.estado.toLowerCase()}</span>
            <span> · {p.modalidad.toLowerCase()}</span>
            {p.cliente && <span> · {p.cliente}</span>}
          </div>
        )}
        {!e.origenRegistrado && <div className="hp-detalle">Origen no registrado</div>}
        {e.detalle && <div className="hp-detalle">{e.detalle}</div>}
        <div className="hp-detalle">{e.por ? `Por ${e.por}` : 'Quién: no registrado'}</div>
      </div>
      <div className="hp-numeros">
        <div className={`hp-cant ${positivo ? 'hp-cant--mas' : 'hp-cant--menos'}`}>
          {conSigno(e.cantidad)} <span className="hp-cant-texto">{positivo ? 'entra' : 'sale'}</span>
        </div>
        <div className="hp-saldo">Saldo {e.saldoDespues}</div>
      </div>
    </li>
  );
}

interface ModalProps {
  productoId: string;
  nombre: string;
  saborId?: string;
  alCerrar: () => void;
}

function ModalHistorial({ productoId, nombre, saborId, alCerrar }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const alTeclado = useDialogoAccesible(ref, alCerrar);
  const [dia, setDia] = useState<Dia>('hoy');
  const [fecha, setFecha] = useState('');
  const [sabor, setSabor] = useState(saborId ?? '');
  const [tipo, setTipo] = useState<GrupoHistorial | ''>('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<HistorialProductoRespuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filtros = useRef({ dia, fecha, sabor, tipo, pagina });
  filtros.current = { dia, fecha, sabor, tipo, pagina };

  const cargar = useCallback(
    async (silencioso = false) => {
      const f = filtros.current;
      if (!silencioso) setCargando(true);
      try {
        const r = await almacenApi.historialProducto(productoId, { ...rangoDe(f.dia, f.fecha), sabor: f.sabor, tipo: f.tipo, pagina: f.pagina });
        // Si cambiaron los filtros mientras llegaba la respuesta, esta ya no vale
        const a = filtros.current;
        if (a.dia !== f.dia || a.fecha !== f.fecha || a.sabor !== f.sabor || a.tipo !== f.tipo || a.pagina !== f.pagina) return;
        setDatos(r);
        setError(null);
      } catch (err) {
        if (!silencioso || !datos) setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar el historial.');
      } finally {
        if (!silencioso) setCargando(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productoId],
  );

  useEffect(() => {
    void cargar(false);
  }, [cargar, dia, fecha, sabor, tipo, pagina]);
  useRecargaEnVivo(() => void cargar(true));

  const cambiar = <T,>(set: (v: T) => void) => (v: T) => {
    setPagina(1);
    set(v);
  };
  const r = datos?.resumen;
  const rango = datos ? (datos.desde === datos.hasta ? datos.desde : `${datos.desde} al ${datos.hasta}`) : '';
  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.porPagina)) : 1;
  const sabores = datos?.producto.sabores ?? [];

  return createPortal(
    <div className="hp-fondo" onClick={alCerrar}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Historial de ${nombre}`}
        className="hp-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={alTeclado}
        tabIndex={-1}
      >
        <header className="hp-cab">
          <div>
            <h2 className="hp-titulo">Historial · {nombre}</h2>
            <div className="hp-sub">{rango || 'Cargando…'}</div>
          </div>
          <button type="button" className="hp-cerrar" onClick={alCerrar} aria-label="Cerrar historial" data-foco-inicial>
            <Icono nombre="cerrar" tamano={18} aria-hidden="true" /> Cerrar
          </button>
        </header>

        <div className="hp-cuerpo-modal">
          {r && (
            <>
              <div className="hp-resumen" aria-label="Resumen del rango">
                <span>Inicio <b>{r.inicio}</b></span>
                <span className="hp-mas">Subido <b>+{r.subido}</b></span>
                <span className="hp-menos">Vendido <b>{r.vendido}</b></span>
                <span className="hp-menos">Mermas <b>{r.mermas}</b></span>
                <span>Ajustes <b>{conSigno(r.ajustes)}</b></span>
                <span className="hp-saldo-final">Saldo <b>{r.saldo}</b></span>
              </div>
              {!r.cuadra && (
                <div role="alert" className="hp-aviso">
                  Diferencia sin explicar: {r.diferencia > 0 ? '+' : ''}{r.diferencia} (el conteo de apertura no coincide con los movimientos).
                </div>
              )}
              {datos?.truncado && <div className="hp-aviso">Hay más movimientos de los que se pueden mostrar: acorta el rango.</div>}
            </>
          )}

          <div className="hp-filtros">
            <div role="group" aria-label="Tipo de movimiento" className="hp-chips">
              {CHIPS.map((c) => (
                <button key={c.valor || 'todo'} type="button" className="hp-chip" aria-pressed={tipo === c.valor} onClick={() => cambiar(setTipo)(c.valor)}>
                  {c.texto}
                </button>
              ))}
            </div>
            <div role="group" aria-label="Día" className="hp-chips">
              {DIAS.map((d) => (
                <button key={d.valor} type="button" className="hp-chip" aria-pressed={dia === d.valor} onClick={() => cambiar(setDia)(d.valor)}>
                  {d.texto}
                </button>
              ))}
              {dia === 'fecha' && (
                <input type="date" aria-label="Fecha del historial" className="hp-campo" max={hoyLima()} value={fecha} onChange={(e) => cambiar(setFecha)(e.target.value)} />
              )}
            </div>
            {sabores.length > 0 && (
              <select aria-label="Sabor" className="hp-campo" value={sabor} onChange={(e) => cambiar(setSabor)(e.target.value)}>
                <option value="">Todos los sabores</option>
                {sabores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          {cargando && !datos ? (
            <p role="status" className="hp-estado">Cargando historial…</p>
          ) : error && !datos ? (
            <EstadoError mensaje={error} alReintentar={() => void cargar(false)} />
          ) : datos && datos.eventos.length === 0 ? (
            <EstadoVacio titulo={dia === 'hoy' ? 'Sin movimientos hoy' : 'Sin movimientos en este día'} mensaje="Cuando haya subidas, pedidos o mermas aparecerán aquí." />
          ) : (
            datos && (
              <>
                {error && <div role="alert" className="hp-aviso">{error}</div>}
                <ol className="hp-lista">
                  {datos.eventos.map((e) => (
                    <Evento key={e.id} e={e} conSabor={!sabor} />
                  ))}
                </ol>
                {totalPaginas > 1 && (
                  <div className="hp-paginas">
                    <button type="button" className="hp-chip" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
                    <span>Página {pagina} de {totalPaginas}</span>
                    <button type="button" className="hp-chip" disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface Props {
  productoId: string;
  saborId?: string;
  /** Nombre completo para etiquetas («DONA · Fresa»). */
  nombre: string;
}

/** «Historial» de un producto (o de un sabor): abre un modal con sus movimientos del día, pedido por pedido. */
export function HistorialProductoBoton({ productoId, saborId, nombre }: Props) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" className="ap-historial-boton" aria-label={`Ver historial de ${nombre}`} title="Historial" onClick={() => setAbierto(true)}>
        <Icono nombre="reloj" tamano={18} aria-hidden="true" />
        <span className="ap-historial-texto">Historial</span>
      </button>
      {abierto && <ModalHistorial productoId={productoId} saborId={saborId} nombre={nombre} alCerrar={() => setAbierto(false)} />}
    </>
  );
}
