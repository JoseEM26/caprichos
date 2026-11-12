import { Boton } from '../../../comun/Boton';
import { TarjetaAnalisis, TarjetaIndicador, useConsultaAnalisis } from '../comun';
import { fechaHoraLima, soles } from '../reparto/formato';
import type { ListaHuecos, RespuestaHuecos } from './tipos';

const MODALIDAD: Record<string, string> = { MESA: 'Mesa', COMER_LOCAL: 'Comer en local', RECOGER: 'Para llevar', LLEVAR: 'Para llevar', DELIVERY: 'Delivery' };

function Lista({ titulo, lista, enlace, accion }: { titulo: string; lista: ListaHuecos; enlace: string; accion: string }) {
  if (!lista.total) return null;
  return (
    <details className="an-alt" open={lista.total <= 5}>
      <summary>
        {titulo} ({lista.total})
      </summary>
      <ul className="an-lista">
        {lista.items.map((p) => (
          <li key={p.id}>
            <span className="an-lista__texto">
              <strong>
                {p.codigo} · {MODALIDAD[p.modalidad] ?? p.modalidad}
              </strong>
              <span>
                {p.estado} · {soles(p.total)} · desde {fechaHoraLima(p.fecha)}
              </span>
            </span>
            <a className="an-enlace" href={enlace} aria-label={`${accion} el pedido ${p.codigo}`}>
              {accion}
            </a>
          </li>
        ))}
      </ul>
      {lista.total > lista.items.length && <p className="an-sub">Se muestran los {lista.items.length} más antiguos de {lista.total}.</p>}
    </details>
  );
}

/** Tablero permanente de huecos (sin fechas): lo que hoy queda sin cobrar o sin terminar. Se actualiza solo. */
export function TableroHuecos() {
  const { datos, estado, recargar } = useConsultaAnalisis<RespuestaHuecos>('/admin/analisis/equipo/huecos', {
    cadaMs: 30_000,
    eventos: ['pedido:estado'],
  });
  const total = datos ? datos.sinCobrar.total + datos.sinTerminar.total + datos.entregadosSinCobrar.total : 0;
  const tarjeta = (titulo: string, l: ListaHuecos, detalle: string) => (
    <TarjetaIndicador
      titulo={titulo}
      valor={String(l.total)}
      semaforo={l.total ? 'rojo' : 'verde'}
      detalle={l.total ? `El más antiguo: ${fechaHoraLima(l.antiguo)}` : detalle}
    />
  );
  return (
    <TarjetaAnalisis
      id="an-huecos"
      titulo="Huecos ahora"
      subtitulo="De cualquier día, sin filtro de fechas. Lo mismo que bloquea el Cierre de caja. Se actualiza solo."
      estado={estado === 'cargando' && !datos ? 'cargando' : estado === 'error' && !datos ? 'error' : 'ok'}
      alReintentar={recargar}
      acciones={
        <Boton variante="secundario" tamano="pequeno" onClick={recargar}>
          Actualizar
        </Boton>
      }
    >
      {datos && (
        <>
          <div className="an-rejilla an-rejilla--kpi">
            {tarjeta('Pedidos sin cobrar', datos.sinCobrar, 'Todo cobrado')}
            {tarjeta('Pedidos sin terminar', datos.sinTerminar, 'Nada pendiente')}
            {tarjeta('Entregados sin cobrar', datos.entregadosSinCobrar, 'Ninguno')}
          </div>
          {total === 0 && (
            <p className="an-sub" role="status">
              No hay huecos: todo pedido está cobrado y terminado.
            </p>
          )}
          <Lista titulo="Pedidos sin cobrar" lista={datos.sinCobrar} enlace="/admin/cierre" accion="Cobrar" />
          <Lista titulo="Pedidos sin terminar" lista={datos.sinTerminar} enlace="/admin/caja" accion="Abrir" />
          <Lista titulo="Entregados sin cobrar" lista={datos.entregadosSinCobrar} enlace="/admin/cierre" accion="Cobrar" />
        </>
      )}
    </TarjetaAnalisis>
  );
}
