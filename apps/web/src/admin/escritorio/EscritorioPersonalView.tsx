import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { moduloVisible } from '../../comun/permisosPuro';
import { useNotificaciones } from '../useNotificaciones';
import { MODULOS } from '../modulos';
import { TarjetaCumpleanos } from './TarjetaCumpleanos';
import { BarrasVerticales, RepartoPartes, TarjetaGrafico } from './graficos';
import './escritorio.css';

/** Lo que el servidor manda al personal que no es ADMIN: solo conteos, horarios y estados, y solo los bloques que su permiso alcanza. */
export interface EscritorioPersonal {
  generadoEn: string;
  pedidos?: {
    porConfirmar: number;
    enPreparacion: number;
    enCola: number;
    listos: number;
    enReparto: number;
    noEntregados: number;
    atrasados: number;
    tiempoCocinaMin: number | null;
    metaCocinaMin: number;
    porHora: { hora: number; pedidos: number }[];
  };
  reparto?: { propio: boolean; disponibles: number; enCamino: number; entregadosHoy: number };
  stockBajo?: { cantidad: number; insumos: string[] };
  reservas?: { cantidadHoy: number; proximas: { nombre: string; personas: number; hora: string }[] };
  mesas?: { cantidad: number; ocupadas: number; libres: number };
  caja?: { estado: 'ABIERTA' | 'CERRADA' | 'SIN_ABRIR' };
}

const TEXTO_CAJA = { ABIERTA: 'Abierta', CERRADA: 'Cerrada', SIN_ABRIR: 'Sin abrir hoy' } as const;
const CADA_MS = 30000;
const MAX_ACCESOS = 8;

/** Cifra grande; es un botón hacia su lista solo si la persona tiene ese módulo. */
function Cifra({ etiqueta, valor, ruta, alerta, ir }: { etiqueta: string; valor: number | string; ruta?: string; alerta?: boolean; ir?: (r: string) => void }) {
  const contenido = (
    <>
      <span className={`esc-cifra__valor${alerta ? ' esc-cifra__valor--alerta' : ''}`}>{valor}</span>
      <span className="esc-cifra__nombre">{etiqueta}</span>
    </>
  );
  return ruta ? (
    <button type="button" className="esc-cifra" aria-label={`${etiqueta}: ${valor}. Ver la lista`} onClick={() => ir?.(ruta)}>
      {contenido}
    </button>
  ) : (
    <div className="esc-cifra">{contenido}</div>
  );
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Escritorio de todo el personal que no es ADMIN (cajero, mozo, cocina, almacén, repartidor, supervisor y sus
 * combinaciones): operación del día sin dinero. Sin datos de su rol, mensaje claro y accesos a sus módulos.
 */
export function EscritorioPersonalView() {
  const { usuario, tiene } = useSesion();
  const navigate = useNavigate();
  const resumen = useNotificaciones();
  const [datos, setDatos] = useState<EscritorioPersonal | null>(null);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setDatos(await api.get<EscritorioPersonal>('/admin/escritorio/mio'));
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void cargar();
    const cada = setInterval(() => void cargar(), CADA_MS);
    return () => clearInterval(cada);
  }, [cargar]);

  const accesos = useMemo(
    () => MODULOS.filter((m) => m.clave !== 'escritorio' && moduloVisible(m, tiene)).slice(0, MAX_ACCESOS),
    [tiene],
  );
  const ruta = (permiso: string, destino: string) => (tiene(permiso) ? destino : undefined);

  const avisosSinLeer = resumen.notificaciones.filter((n) => !n.leida).length;
  const p = datos?.pedidos;
  const r = datos?.reparto;
  const hayBloques = !!(p || r || datos?.stockBajo || datos?.reservas || datos?.mesas || datos?.caja);
  const nombre = usuario?.nombres || 'equipo';

  const estados = p
    ? [
        { n: 'Por confirmar', c: '#D99E39', v: p.porConfirmar },
        { n: 'En cola', c: '#E67929', v: p.enCola },
        { n: 'Preparando', c: '#B2500F', v: p.enPreparacion },
        { n: 'Listos', c: '#8B5CF6', v: p.listos },
        { n: 'En reparto', c: '#3B82F6', v: p.enReparto },
      ]
    : [];

  return (
    <div className="esc">
      <p className="esc-saludo">Hola, {nombre}. Este es tu escritorio: solo muestra lo que corresponde a tu trabajo.</p>

      <TarjetaCumpleanos />

      {error && (
        <div role="alert" className="esc-estado esc-estado--error">
          No se pudo cargar el escritorio. Se vuelve a intentar en unos segundos.
        </div>
      )}
      {!datos && !error && <div className="esc-esqueleto" role="status" aria-label="Cargando el escritorio" />}

      {datos && !hayBloques && (
        <section className="esc-tarjeta" aria-labelledby="esc-vacio">
          <h3 id="esc-vacio">Tu escritorio no tiene cifras</h3>
          <p className="esc-subtitulo">Para tu trabajo no hace falta un resumen. Entra directo a lo tuyo:</p>
        </section>
      )}

      {p && (
        <section className="esc-seccion" aria-labelledby="esc-h-pedidos">
          <h2 id="esc-h-pedidos" style={{ fontSize: 16, margin: '0 0 6px' }}>Pedidos</h2>
          <div className="esc-cifras">
            <Cifra etiqueta="Por confirmar" valor={p.porConfirmar} ruta={ruta('caja/ver', '/admin/caja')} ir={navigate} />
            <Cifra etiqueta="En cola" valor={p.enCola} ruta={ruta('cocina/ver', '/admin/cocina')} ir={navigate} />
            <Cifra etiqueta="En preparación" valor={p.enPreparacion} ruta={ruta('cocina/ver', '/admin/cocina')} ir={navigate} />
            <Cifra etiqueta="Listos" valor={p.listos} ruta={ruta('caja/ver', '/admin/caja')} ir={navigate} />
            <Cifra etiqueta="En reparto" valor={p.enReparto} ruta={ruta('repartos/ver', '/admin/repartos')} ir={navigate} />
            <Cifra etiqueta="Atrasados (más de 13 min)" valor={p.atrasados} alerta={p.atrasados > 0} ruta={ruta('cocina/ver', '/admin/cocina')} ir={navigate} />
          </div>
          <div className="esc-rejilla">
            <TarjetaGrafico
              id="p-cola"
              titulo="Cola por estado"
              subtitulo="Pedidos que todavía no llegaron al cliente"
              estado={p.noEntregados > 0 ? 'ok' : 'vacio'}
              vacio="No hay pedidos pendientes. Todo al día."
              tabla={{ cabecera: ['Estado', 'Pedidos'], filas: estados.map((e) => [e.n, e.v]) }}
            >
              <RepartoPartes
                partes={estados.map((e) => ({ n: e.n, c: e.c, pct: Math.round((e.v / p.noEntregados) * 100), dato: plural(e.v, 'pedido', 'pedidos') }))}
                descripcion={`Cola por estado: ${estados.map((e) => `${e.n} ${e.v}`).join('; ')}`}
              />
            </TarjetaGrafico>
            <TarjetaGrafico
              id="p-hora"
              titulo="Pedidos por hora de hoy"
              subtitulo={p.tiempoCocinaMin ? `En cocina tardan ${p.tiempoCocinaMin} min en promedio · meta ${p.metaCocinaMin} min` : 'A qué hora entraron los pedidos hoy'}
              estado={p.porHora.length > 0 ? 'ok' : 'vacio'}
              vacio="Todavía no entran pedidos hoy."
              tabla={{ cabecera: ['Hora', 'Pedidos'], filas: p.porHora.map((h) => [`${h.hora}:00`, h.pedidos]) }}
            >
              <BarrasVerticales
                datos={p.porHora.map((h) => ({ etiqueta: String(h.hora), valor: h.pedidos }))}
                descripcion={`Pedidos por hora de hoy: ${p.porHora.map((h) => `${h.hora} horas, ${h.pedidos}`).join('; ')}`}
              />
            </TarjetaGrafico>
          </div>
        </section>
      )}

      {r && (
        <section className="esc-seccion" aria-labelledby="esc-h-reparto">
          <h2 id="esc-h-reparto" style={{ fontSize: 16, margin: '0 0 6px' }}>{r.propio ? 'Mis repartos' : 'Reparto'}</h2>
          <div className="esc-cifras">
            <Cifra etiqueta="Disponibles para tomar" valor={r.disponibles} ruta={ruta('repartos/ver', '/admin/repartos')} ir={navigate} />
            <Cifra etiqueta={r.propio ? 'Mis pedidos en camino' : 'En camino'} valor={r.enCamino} ruta={ruta('repartos/ver', '/admin/repartos')} ir={navigate} />
            <Cifra etiqueta={r.propio ? 'Entregados por mí hoy' : 'Entregados hoy'} valor={r.entregadosHoy} />
          </div>
        </section>
      )}

      {datos?.stockBajo && (
        <section className="esc-tarjeta" aria-labelledby="esc-h-stock">
          <h3 id="esc-h-stock">Insumos con stock bajo</h3>
          {datos.stockBajo.cantidad === 0 ? (
            <p className="esc-subtitulo">Ningún insumo está por agotarse.</p>
          ) : (
            <>
              <p className="esc-subtitulo">{plural(datos.stockBajo.cantidad, 'insumo por agotarse', 'insumos por agotarse')}. Los más bajos:</p>
              <ul className="esc-lista">
                {datos.stockBajo.insumos.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              {(tiene('compras/ver') || tiene('stock/ver')) && (
                <button type="button" className="esc-acceso" onClick={() => navigate(tiene('compras/ver') ? '/admin/compras?tab=pedir' : '/admin/stock')}>
                  {tiene('compras/ver') ? 'Pedir al proveedor' : 'Ir al stock'}
                </button>
              )}
            </>
          )}
        </section>
      )}

      {datos?.reservas && (
        <section className="esc-tarjeta" aria-labelledby="esc-h-reservas">
          <h3 id="esc-h-reservas">Reservas de hoy</h3>
          <div className="esc-cifras">
            <Cifra etiqueta="Reservas para hoy" valor={datos.reservas.cantidadHoy} ruta={ruta('reservas/ver', '/admin/reservas')} ir={navigate} />
          </div>
          {datos.reservas.proximas.length === 0 ? (
            <p className="esc-subtitulo">No quedan reservas para hoy.</p>
          ) : (
            <ul className="esc-lista">
              {datos.reservas.proximas.map((x, i) => (
                <li key={`${x.hora}-${i}`}>
                  <b>{x.hora}</b> · {x.nombre} · {plural(x.personas, 'persona', 'personas')}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {datos?.mesas && datos.caja && (
        <section className="esc-tarjeta" aria-labelledby="esc-h-salon">
          <h3 id="esc-h-salon">Salón y caja</h3>
          <div className="esc-cifras">
            <Cifra etiqueta={`Mesas ocupadas de ${datos.mesas.cantidad}`} valor={datos.mesas.ocupadas} ruta={ruta('plano/ver', '/admin/plano')} ir={navigate} />
            <Cifra etiqueta="Mesas libres" valor={datos.mesas.libres} ruta={ruta('plano/ver', '/admin/plano')} ir={navigate} />
            <Cifra etiqueta="Caja de hoy" valor={TEXTO_CAJA[datos.caja.estado]} />
          </div>
        </section>
      )}

      {datos && tiene('notificaciones/ver') && (
        <section className="esc-tarjeta" aria-labelledby="esc-h-avisos">
          <h3 id="esc-h-avisos">Avisos</h3>
          <div className="esc-cifras">
            <Cifra
              etiqueta={avisosSinLeer === 1 ? 'Aviso sin leer' : 'Avisos sin leer'}
              valor={avisosSinLeer}
              ruta="/admin/notificaciones"
              ir={navigate}
            />
          </div>
        </section>
      )}

      {datos && !hayBloques && accesos.length > 0 && (
        <div className="esc-accesos">
          {accesos.map((m) => (
            <button key={m.clave} type="button" className="esc-acceso" onClick={() => navigate(m.ruta)}>
              {m.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
