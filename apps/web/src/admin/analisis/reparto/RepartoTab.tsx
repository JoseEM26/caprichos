import { useState } from 'react';
import { Cargando } from '../../../comun/Cargando';
import { EstadoError } from '../../../comun/EstadoError';
import { Boton } from '../../../comun/Boton';
import {
  BarrasHorizontales,
  MapaDeCalor,
  PanelDetalle,
  TarjetaAnalisis,
  TarjetaIndicador,
  consultaDe,
  textoMinutos,
  useConsultaAnalisis,
  type PropsPestanaAnalisis,
} from '../comun';
import { fechaHoraLima, num, soles } from './formato';
import type { RespuestaPorRendir, RespuestaReparto, ZonaReparto } from './tipos';

const NOMBRE_TURNO: Record<string, string> = { MANANA: 'Mañana', TARDE: 'Tarde', NOCHE: 'Noche' };

const masLenta = (zonas: ZonaReparto[]) =>
  zonas.filter((z) => z.minutosPromedio != null).sort((a, b) => (b.minutosPromedio as number) - (a.minutosPromedio as number))[0]?.id;

/** Pestaña «Reparto»: entregas por zona (tabla y calor), productividad por repartidor y efectivo por rendir. */
export function RepartoTab({ filtros, esAdmin }: PropsPestanaAnalisis) {
  const { datos, estado, mensaje, recargar } = useConsultaAnalisis<RespuestaReparto>(`/admin/analisis/reparto?${consultaDe(filtros, ['canal', 'turno'])}`);
  const rendir = useConsultaAnalisis<RespuestaPorRendir>('/admin/analisis/reparto/por-rendir', { cadaMs: 60_000, eventos: ['pedido:estado'] });
  const [zonaElegida, setZonaElegida] = useState<string | null>(null);
  const zona = datos?.zonas.find((z) => z.id === zonaElegida) ?? null;

  return (
    <div className="an">
      <EfectivoPorRendir consulta={rendir} />
      {estado === 'cargando' && !datos && <Cargando mensaje="Calculando el reparto" />}
      {estado === 'error' && !datos && <EstadoError titulo="No se pudo calcular el reparto" mensaje={mensaje || 'Prueba de nuevo en unos segundos.'} alReintentar={recargar} />}
      {datos && (
        <>
          <div className="an-rejilla an-rejilla--kpi">
            <TarjetaIndicador titulo="Pedidos delivery" valor={String(datos.totales.pedidos)} detalle={datos.totales.sinZona ? `${datos.totales.sinZona} sin zona guardada` : 'Todos con zona'} />
            <TarjetaIndicador titulo="Entregas hechas" valor={String(datos.totales.entregas)} detalle={`${datos.productividad.repartidores} repartidor(es)`} />
            <TarjetaIndicador
              titulo="Entregas por hora trabajada"
              valor={num(datos.productividad.entregasPorHora, 2)}
              detalle={datos.productividad.horasTrabajadas == null ? 'Falta asistencia marcada' : `${num(datos.productividad.horasTrabajadas)} h marcadas`}
            />
            <TarjetaIndicador titulo="Tiempo por entrega" valor={textoMinutos(datos.productividad.minutosPorEntrega)} detalle="Desde que sale hasta que entrega" />
          </div>
          {datos.truncado && (
            <p className="an-error-fechas" role="status">
              Hay más de {datos.limite} pedidos en el rango: se leyeron los más recientes. Acorta las fechas para ver todo.
            </p>
          )}
          <div className="an-rejilla">
            <TarjetaAnalisis
              id="an-zonas"
              titulo="Entregas por zona"
              subtitulo="Tiempo promedio desde que entra el pedido hasta que se entrega, contra la promesa máxima de la zona."
              estado={datos.zonas.length ? 'ok' : 'vacio'}
              vacio="No hubo pedidos delivery con zona en este período."
              tabla={{
                cabecera: ['Zona', 'Pedidos', 'Entregados', 'Promedio (min)', 'Mediana (min)', 'Promesa (min)'],
                filas: datos.zonas.map((z) => [z.zona, z.pedidos, z.entregados, z.minutosPromedio ?? 'Sin dato', z.minutosMediana ?? 'Sin dato', z.metaMin ?? 'Sin promesa']),
              }}
            >
              <BarrasHorizontales
                descripcion="Minutos promedio de entrega de cada zona, con la promesa máxima de la zona"
                etiquetaDestacada="Más lenta"
                elegida={zonaElegida}
                alElegir={(id) => setZonaElegida((a) => (a === id ? null : id))}
                filas={datos.zonas.map((z) => ({
                  id: z.id,
                  nombre: z.zona,
                  detalle: `${z.pedidos} ${z.pedidos === 1 ? 'pedido' : 'pedidos'} · ${z.entregados} entregados`,
                  valor: z.minutosPromedio,
                  texto: z.entregados ? `Prom. ${textoMinutos(z.minutosPromedio)}` : 'Sin dato',
                  meta: z.metaMin ?? undefined,
                  semaforo: z.semaforo,
                  destacada: datos.zonas.length > 1 && z.id === masLenta(datos.zonas),
                }))}
              />
              {zona && (
                <PanelDetalle titulo={zona.zona} alCerrar={() => setZonaElegida(null)}>
                  <DetalleZona zona={zona} turnos={datos.turnos} />
                </PanelDetalle>
              )}
            </TarjetaAnalisis>
            <TarjetaAnalisis
              id="an-calor-zonas"
              titulo="Dónde y cuándo se pide"
              subtitulo="Pedidos delivery por zona y turno. Más oscuro, más pedidos (el número manda)."
              estado={datos.zonas.length ? 'ok' : 'vacio'}
              vacio="Sin pedidos por zona en este período."
            >
              <MapaDeCalor
                descripcion="Pedidos delivery por zona y turno"
                filas={datos.zonas.map((z) => z.zona)}
                columnas={datos.turnos.map((t) => NOMBRE_TURNO[t] ?? t)}
                valores={datos.zonas.map((z) => z.porTurno)}
              />
            </TarjetaAnalisis>
          </div>
          <ProductividadRepartidores datos={datos} esAdmin={esAdmin} />
        </>
      )}
    </div>
  );
}

function DetalleZona({ zona, turnos }: { zona: ZonaReparto; turnos: string[] }) {
  return (
    <ul className="an-lista">
      <li>
        <span className="an-lista__texto">
          <strong>Tiempos de entrega</strong>
          <span>
            Mediana {textoMinutos(zona.minutosMediana)} · 9 de cada 10 entregas en {textoMinutos(zona.minutosP90)}
          </span>
          <span className="an-sub">{zona.metaMin ? `Promesa máxima de la zona: ${zona.metaMin} min` : 'La zona no tiene promesa de minutos guardada.'}</span>
        </span>
      </li>
      <li>
        <span className="an-lista__texto">
          <strong>Tarifa</strong>
          <span>
            {soles(zona.tarifa)}
            {zona.activa ? '' : ' · zona desactivada'}
          </span>
        </span>
      </li>
      <li>
        <span className="an-lista__texto">
          <strong>Pedidos por turno</strong>
          <span>{turnos.map((t, i) => `${NOMBRE_TURNO[t] ?? t}: ${zona.porTurno[i] ?? 0}`).join(' · ')}</span>
        </span>
      </li>
    </ul>
  );
}

function ProductividadRepartidores({ datos, esAdmin }: { datos: RespuestaReparto; esAdmin: boolean }) {
  const p = datos.productividad;
  const filas = p.porPersona ?? [];
  return (
    <TarjetaAnalisis
      id="an-repartidores"
      titulo="Productividad de repartidores"
      subtitulo="Entregas por hora marcada en asistencia y minutos por entrega (salida a entrega)."
      estado={p.entregas ? 'ok' : 'vacio'}
      vacio="Todavía no hay entregas con repartidor en este período."
    >
      {esAdmin && datos.porPersonaVisible ? (
        <div className="an-alt">
          <div className="an-alt__tabla">
            <table>
              <caption className="an-solo-lector">Productividad por repartidor</caption>
              <thead>
                <tr>
                  <th scope="col">Repartidor</th>
                  <th scope="col">Entregas</th>
                  <th scope="col">Min por entrega</th>
                  <th scope="col">Horas marcadas</th>
                  <th scope="col">Entregas por hora</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <th scope="row">{f.nombre}</th>
                    <td>{f.entregas}</td>
                    <td>{textoMinutos(f.minutosPorEntrega)}</td>
                    <td>{f.horasTrabajadas == null ? 'Sin dato' : num(f.horasTrabajadas)}</td>
                    <td>{f.entregasPorHora == null ? 'Sin dato' : num(f.entregasPorHora, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="an-sub">El detalle por repartidor lo ve solo el Administrador. Aquí se muestra el total del equipo.</p>
      )}
    </TarjetaAnalisis>
  );
}

function EfectivoPorRendir({ consulta }: { consulta: ReturnType<typeof useConsultaAnalisis<RespuestaPorRendir>> }) {
  const { datos, estado, recargar } = consulta;
  return (
    <TarjetaAnalisis
      id="an-rendir"
      titulo="Efectivo por rendir"
      subtitulo={`Efectivo contra entrega de los últimos ${datos?.ventanaDias ?? 92} días que los repartidores aún no liquidan en Caja. Se actualiza solo.`}
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
            <TarjetaIndicador
              titulo="Pendiente de liquidar"
              valor={soles(datos.total)}
              semaforo={datos.total > 0 ? 'ambar' : 'verde'}
              detalle={datos.total > 0 ? `${datos.repartidoresConSaldo} repartidor(es) · ${datos.pedidosPendientes} pedido(s)` : 'Todo liquidado'}
            />
            <TarjetaIndicador titulo="Pendiente desde" valor={datos.desde ? fechaHoraLima(datos.desde) : 'Sin pendientes'} detalle="Entrega más antigua sin liquidar" />
          </div>
          {datos.porPersona && datos.porPersona.length > 0 && (
            <ul className="an-lista">
              {datos.porPersona.map((f) => (
                <li key={f.id}>
                  <span className="an-lista__texto">
                    <strong>{f.nombre}</strong>
                    <span>
                      {soles(f.pendiente)} en {f.pedidos} {f.pedidos === 1 ? 'pedido' : 'pedidos'} · desde {fechaHoraLima(f.desde)}
                    </span>
                  </span>
                  <a className="an-enlace" href="/admin/cierre" aria-label={`Liquidar a ${f.nombre} en Cierre`}>
                    Ir a liquidar
                  </a>
                </li>
              ))}
            </ul>
          )}
          {!datos.porPersonaVisible && datos.total > 0 && <p className="an-sub">El detalle por repartidor lo ve solo el Administrador.</p>}
        </>
      )}
    </TarjetaAnalisis>
  );
}
