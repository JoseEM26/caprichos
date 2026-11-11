import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { TarjetaCumpleanos } from './TarjetaCumpleanos';
import { BarrasHorizontales, BarrasVerticales, LineaTiempo, RepartoPartes, TarjetaGrafico, type EstadoGrafico } from './graficos';
import './escritorio.css';

/** Respuesta del escritorio del ADMIN. Lo marcado con «?» solo existe para ADMIN: el servidor no lo manda a otros. */
interface Parte {
  n: string;
  c: string;
  pedidos: number;
  pct: number;
  monto?: string;
  valor?: number;
}
export interface ResumenAdmin {
  kpisS: { n: string; v: string; dTxt?: string; dCol?: string }[];
  rechazados: number;
  porCobrar?: string;
  peak?: string;
  legend: Parte[];
  modalidades: Parte[];
  pagos?: Parte[];
  porHora: { hora: number; pedidos: number; monto?: string; valor?: number }[];
  porDiaSemana: { dia: string; pedidos: number; monto?: string; valor?: number }[];
  porDia: { fecha: string; pedidos: number; entregaMin: number; monto?: string; valor?: number }[];
  porEstado: { estado: string; n: number }[];
  tops2: { n: string; unidades: number; monto?: string; valor?: number }[];
  cats2?: { n: string; c: string; unidades: number; monto?: string; valor?: number }[];
  pending: { n: string; v: number; view: string }[];
  metaEntregaMin: number;
}

const PERIODOS = [
  { id: 'hoy', nombre: 'Hoy' },
  { id: 'sem', nombre: '7 días' },
  { id: 'mes', nombre: '30 días' },
  { id: 'trim', nombre: '90 días' },
  { id: 'anio', nombre: 'Este año' },
  { id: 'rango', nombre: 'Elegir fechas' },
] as const;

const CANALES = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'salon', nombre: 'Salón' },
  { id: 'delivery', nombre: 'Delivery' },
  { id: 'web', nombre: 'Web' },
  { id: 'whatsapp', nombre: 'WhatsApp' },
] as const;

const NOMBRE_ESTADO: Record<string, string> = {
  NUEVO: 'Por confirmar',
  COLA: 'En cola',
  PREPARANDO: 'Preparando',
  LISTO: 'Listo',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Anulado',
};
const COLOR_ESTADO: Record<string, string> = {
  NUEVO: '#D99E39',
  COLA: '#E67929',
  PREPARANDO: '#B2500F',
  LISTO: '#8B5CF6',
  EN_CAMINO: '#3B82F6',
  ENTREGADO: '#2B824E',
  RECHAZADO: '#6B7280',
  ANULADO: '#6B7280',
};

const hoyLima = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
const sumarDias = (iso: string, dias: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
};
const corto = (n: number) => `s/ ${Math.round(n).toLocaleString('en-US')}`;
const ddmm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Rango de fechas de cada período (la jornada es el día de Lima). */
function rangoDe(periodo: string, hoy: string, desde: string, hasta: string): { desde: string; hasta: string } {
  if (periodo === 'hoy') return { desde: hoy, hasta: hoy };
  if (periodo === 'sem') return { desde: sumarDias(hoy, -6), hasta: hoy };
  if (periodo === 'trim') return { desde: sumarDias(hoy, -89), hasta: hoy };
  if (periodo === 'anio') return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
  if (periodo === 'rango') return { desde: desde || sumarDias(hoy, -29), hasta: hasta || hoy };
  return { desde: sumarDias(hoy, -29), hasta: hoy };
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details className="esc-seccion" open>
      <summary>{titulo}</summary>
      <div className="esc-rejilla">{children}</div>
    </details>
  );
}

/** Escritorio del ADMIN: filtros en la dirección (se comparten y sobreviven a recargar), KPIs y gráficos del período. */
export function EscritorioAdminView() {
  const { usuario } = useSesion();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const hoy = useMemo(() => hoyLima(), []);

  const periodoUrl = params.get('periodo') ?? 'mes';
  const periodo = PERIODOS.some((p) => p.id === periodoUrl) ? periodoUrl : 'mes';
  const canalUrl = params.get('canal') ?? 'todos';
  const canal = CANALES.some((c) => c.id === canalUrl) ? canalUrl : 'todos';
  const { desde, hasta } = rangoDe(periodo, hoy, params.get('desde') ?? '', params.get('hasta') ?? '');
  const errorFechas = desde > hasta ? 'La fecha inicial no puede ser después de la final.' : '';

  const cambiar = (cambios: Record<string, string>) => {
    const nuevo = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v) nuevo.set(k, v);
      else nuevo.delete(k);
    }
    setParams(nuevo, { replace: true });
  };

  const [datos, setDatos] = useState<ResumenAdmin | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'error' | 'ok'>('cargando');

  const cargar = useCallback(() => {
    if (errorFechas) return () => undefined;
    let vigente = true;
    setEstado('cargando');
    api
      .get<ResumenAdmin>(`/admin/informes/resumen?desde=${desde}&hasta=${hasta}&canal=${canal}`)
      .then((r) => {
        if (!vigente) return;
        setDatos(r);
        setEstado('ok');
      })
      .catch(() => vigente && setEstado('error'));
    return () => {
      vigente = false;
    };
  }, [desde, hasta, canal, errorFechas]);

  useEffect(() => cargar(), [cargar]);

  const nombres = usuario?.nombres || 'Administrador';
  const dias = Math.max(1, Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) + 1);
  const rangoTexto = `Del ${ddmm(desde)}/${desde.slice(0, 4)} al ${ddmm(hasta)}/${hasta.slice(0, 4)} · ${plural(dias, 'día', 'días')}${canal === 'todos' ? '' : ` · solo ${CANALES.find((c) => c.id === canal)?.nombre}`}`;

  // Estado de cada gráfico: cargando la primera vez, error si falló y no hay datos previos, vacío si no hay filas
  const estadoDe = (hayFilas: boolean): EstadoGrafico => (estado === 'cargando' && !datos ? 'cargando' : estado === 'error' && !datos ? 'error' : hayFilas ? 'ok' : 'vacio');
  const d = datos;
  const delDia = d?.porDia ?? [];
  const conEntrega = delDia.filter((x) => x.entregaMin > 0);
  const estados = (d?.porEstado ?? []).map((e) => ({ n: NOMBRE_ESTADO[e.estado] ?? e.estado, c: COLOR_ESTADO[e.estado] ?? '#6B7280', v: e.n }));
  const totalEstados = estados.reduce((a, e) => a + e.v, 0);
  const parte = (p: Parte) => ({ n: p.n, c: p.c, pct: p.pct, dato: `${plural(p.pedidos, 'pedido', 'pedidos')}${p.monto ? ` · ${p.monto}` : ''}` });

  return (
    <div className="esc">
      <p className="esc-saludo">Hola, {nombres}. Este es tu escritorio de Administrador.</p>

      <TarjetaCumpleanos />

      <section className="esc-filtros" aria-label="Filtros del escritorio">
        <p className="esc-rango">{rangoTexto}</p>
        <div className="esc-filtros__grupo">
          <span className="esc-filtros__etiqueta" id="esc-f-per">PERÍODO</span>
          <div className="esc-fichas" role="group" aria-labelledby="esc-f-per">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="esc-ficha"
                aria-pressed={periodo === p.id}
                onClick={() => cambiar({ periodo: p.id === 'mes' ? '' : p.id, ...(p.id === 'rango' ? { desde, hasta } : { desde: '', hasta: '' }) })}
              >
                {p.nombre}
              </button>
            ))}
          </div>
        </div>
        {periodo === 'rango' && (
          <div className="esc-fechas">
            <label>
              Desde
              <input type="date" value={desde} max={hoy} onChange={(e) => cambiar({ desde: e.target.value })} />
            </label>
            <label>
              Hasta
              <input type="date" value={hasta} max={hoy} onChange={(e) => cambiar({ hasta: e.target.value })} />
            </label>
          </div>
        )}
        {errorFechas && <div className="esc-error" role="alert">{errorFechas}</div>}
        <div className="esc-filtros__grupo">
          <span className="esc-filtros__etiqueta" id="esc-f-canal">CANAL</span>
          <div className="esc-fichas" role="group" aria-labelledby="esc-f-canal">
            {CANALES.map((c) => (
              <button key={c.id} type="button" className="esc-ficha" aria-pressed={canal === c.id} onClick={() => cambiar({ canal: c.id === 'todos' ? '' : c.id })}>
                {c.nombre}
              </button>
            ))}
          </div>
        </div>
      </section>

      {estado === 'error' && d && (
        <div className="esc-estado esc-estado--error" role="alert">
          No se pudo actualizar. Se muestran los últimos datos cargados.
        </div>
      )}

      <div className="esc-rejilla esc-rejilla--kpi" aria-label="Cifras del período">
        {(d?.kpisS ?? [{ n: 'VENTAS', v: '…' }, { n: 'PEDIDOS', v: '…' }, { n: 'TICKET PROMEDIO', v: '…' }, { n: 'TIEMPO DE ENTREGA', v: '…' }]).map((k) => (
          <div className="esc-kpi" key={k.n}>
            <span className="esc-kpi__nombre">{k.n}</span>
            <span className="esc-kpi__valor">{k.v}</span>
            {'dTxt' in k && k.dTxt && (
              <span className="esc-kpi__nota" style={{ color: k.dCol }}>
                {k.dTxt}
              </span>
            )}
          </div>
        ))}
        {d && d.porCobrar && (
          <div className="esc-kpi">
            <span className="esc-kpi__nombre">POR COBRAR</span>
            <span className="esc-kpi__valor">{d.porCobrar}</span>
            <span className="esc-kpi__nota" style={{ color: 'var(--cp-soft)' }}>{plural(d.rechazados, 'pedido rechazado o anulado', 'pedidos rechazados o anulados')}</span>
          </div>
        )}
      </div>

      <Seccion titulo="Ventas">
          <TarjetaGrafico
            id="g-dia"
            titulo="Ventas por día"
            subtitulo={d?.peak ?? 'Lo vendido cada día del período'}
            estado={estadoDe(delDia.length > 0)}
            ancha
            tabla={{ cabecera: ['Día', 'Pedidos', 'Ventas'], filas: delDia.map((x) => [ddmm(x.fecha), x.pedidos, x.monto ?? '']) }}
          >
            <LineaTiempo
              puntos={delDia.map((x) => ({ etiqueta: ddmm(x.fecha), valor: x.valor ?? 0, texto: `${x.monto} · ${plural(x.pedidos, 'pedido', 'pedidos')}` }))}
              descripcion={`Ventas por día. ${d?.peak ?? ''}`}
              formatoY={corto}
            />
          </TarjetaGrafico>
        <TarjetaGrafico
          id="g-hora"
          titulo="Pedidos por hora del día"
          subtitulo="A qué hora entran más pedidos (hora de Lima)"
          estado={estadoDe((d?.porHora.length ?? 0) > 0)}
          tabla={{ cabecera: ['Hora', 'Pedidos', 'Ventas'], filas: (d?.porHora ?? []).map((x) => [`${x.hora}:00`, x.pedidos, x.monto ?? '']) }}
        >
          <BarrasVerticales
            datos={(d?.porHora ?? []).map((x) => ({ etiqueta: String(x.hora), valor: x.pedidos, texto: String(x.pedidos) }))}
            descripcion={`Pedidos por hora: ${(d?.porHora ?? []).map((x) => `${x.hora} horas, ${x.pedidos}`).join('; ')}`}
          />
        </TarjetaGrafico>
        <TarjetaGrafico
          id="g-semana"
          titulo="Ventas por día de la semana"
          subtitulo="Qué días se vende más"
          estado={estadoDe((d?.porDiaSemana ?? []).some((x) => x.pedidos > 0))}
          tabla={{ cabecera: ['Día', 'Pedidos', 'Ventas'], filas: (d?.porDiaSemana ?? []).map((x) => [x.dia, x.pedidos, x.monto ?? '']) }}
        >
          <BarrasVerticales
            datos={(d?.porDiaSemana ?? []).map((x) => ({ etiqueta: x.dia, valor: x.valor ?? 0, texto: corto(x.valor ?? 0) }))}
            descripcion={`Ventas por día de la semana: ${(d?.porDiaSemana ?? []).map((x) => `${x.dia} ${x.monto}`).join('; ')}`}
          />
        </TarjetaGrafico>
        <TarjetaGrafico
          id="g-canal"
          titulo="Ventas por canal"
          subtitulo="Por dónde llegan las ventas"
          estado={estadoDe((d?.legend ?? []).some((x) => x.pedidos > 0))}
        >
          <RepartoPartes partes={(d?.legend ?? []).map(parte)} descripcion={`Ventas por canal: ${(d?.legend ?? []).map((x) => `${x.n} ${x.pct} por ciento`).join('; ')}`} />
        </TarjetaGrafico>
        <TarjetaGrafico
          id="g-modalidad"
          titulo="Ventas por modalidad"
          subtitulo="En el local, para llevar o delivery"
          estado={estadoDe((d?.modalidades ?? []).some((x) => x.pedidos > 0))}
        >
          <RepartoPartes partes={(d?.modalidades ?? []).map(parte)} descripcion={`Ventas por modalidad: ${(d?.modalidades ?? []).map((x) => `${x.n} ${x.pct} por ciento`).join('; ')}`} />
        </TarjetaGrafico>
        <TarjetaGrafico
          id="g-pago"
          titulo="Ventas por medio de pago"
          subtitulo="Cómo pagaron los clientes (cobros vigentes)"
          estado={estadoDe((d?.pagos ?? []).length > 0)}
          vacio="Todavía no hay cobros en este período."
        >
          <RepartoPartes partes={(d?.pagos ?? []).map(parte)} descripcion={`Ventas por medio de pago: ${(d?.pagos ?? []).map((x) => `${x.n} ${x.pct} por ciento`).join('; ')}`} />
        </TarjetaGrafico>
      </Seccion>

      <Seccion titulo="Productos">
        <TarjetaGrafico
          id="g-cat"
          titulo="Ventas por categoría"
          subtitulo="Qué parte de la carta deja más"
          estado={estadoDe((d?.cats2 ?? []).length > 0)}
        >
          <BarrasHorizontales
            filas={(d?.cats2 ?? []).map((c) => ({ n: c.n, valor: c.valor ?? 0, texto: `${c.monto} · ${c.unidades} u.`, c: c.c }))}
            descripcion="Ventas por categoría"
          />
        </TarjetaGrafico>
        <TarjetaGrafico
          id="g-top"
          titulo="Productos más pedidos"
          subtitulo="Los 8 con más unidades vendidas"
          estado={estadoDe((d?.tops2 ?? []).length > 0)}
        >
          <BarrasHorizontales
            filas={(d?.tops2 ?? []).map((t) => ({ n: t.n, valor: t.unidades, texto: `${t.unidades} u. · ${t.monto}` }))}
            descripcion="Productos más pedidos por unidades"
          />
        </TarjetaGrafico>
      </Seccion>

      <Seccion titulo="Operación">
        <TarjetaGrafico
          id="g-entrega"
          titulo="Tiempo de entrega por día"
          subtitulo={`Minutos desde que entra el pedido hasta que se entrega · meta ${d?.metaEntregaMin ?? 13} min`}
          estado={estadoDe(conEntrega.length > 0)}
          vacio="Sin pedidos entregados en este período."
          tabla={{ cabecera: ['Día', 'Minutos'], filas: conEntrega.map((x) => [ddmm(x.fecha), x.entregaMin]) }}
        >
          <LineaTiempo
            puntos={conEntrega.map((x) => ({ etiqueta: ddmm(x.fecha), valor: x.entregaMin, texto: `${x.entregaMin} min` }))}
            descripcion={`Tiempo de entrega por día, meta ${d?.metaEntregaMin ?? 13} minutos`}
            formatoY={(n) => `${Math.round(n)} min`}
            meta={{ valor: d?.metaEntregaMin ?? 13, texto: `Línea verde: meta de ${d?.metaEntregaMin ?? 13} min` }}
          />
        </TarjetaGrafico>
        <TarjetaGrafico id="g-estado" titulo="Pedidos por estado" subtitulo="En qué quedaron los pedidos del período" estado={estadoDe(totalEstados > 0)}>
          <RepartoPartes
            partes={estados.map((e) => ({ n: e.n, c: e.c, pct: totalEstados ? Math.round((e.v / totalEstados) * 100) : 0, dato: plural(e.v, 'pedido', 'pedidos') }))}
            descripcion={`Pedidos por estado: ${estados.map((e) => `${e.n} ${e.v}`).join('; ')}`}
          />
        </TarjetaGrafico>
        <section className="esc-tarjeta" aria-labelledby="esc-ahora">
          <div>
            <h3 id="esc-ahora">Para hacer ahora</h3>
            <p className="esc-subtitulo">Lo que está pendiente en el local, sin importar el período</p>
          </div>
          <div className="esc-cifras">
            {(d?.pending ?? []).map((p) => (
              <button key={p.n} type="button" className="esc-cifra" onClick={() => navigate(p.view)} aria-label={`${p.n}: ${p.v}. Ver la lista`}>
                <span className={`esc-cifra__valor${p.v > 0 ? ' esc-cifra__valor--alerta' : ''}`}>{p.v}</span>
                <span className="esc-cifra__nombre">{p.n}</span>
              </button>
            ))}
            {!d && <div className="esc-esqueleto" role="status" aria-label="Cargando pendientes" />}
          </div>
        </section>
      </Seccion>
    </div>
  );
}
