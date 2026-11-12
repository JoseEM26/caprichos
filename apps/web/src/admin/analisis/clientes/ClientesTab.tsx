import { useState } from 'react';
import { EstadoError } from '../../../comun/EstadoError';
import { Cargando } from '../../../comun/Cargando';
import { BarrasHorizontales, PanelDetalle, TarjetaAnalisis, TarjetaIndicador, consultaDe, ddmm, sumarDias, useConsultaAnalisis, type PropsPestanaAnalisis } from '../comun';
import type { RespuestaClientes } from './tipos';

const num = (n: number) => n.toLocaleString('es-PE');
const dec = (n: number | null | undefined, d = 1) => (n == null ? 'Sin dato' : n.toLocaleString('es-PE', { maximumFractionDigits: d }));
const soles = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number | null) => (n == null ? 'Sin dato' : `${dec(n)} %`);
const semana = (iso: string) => `${ddmm(iso)} al ${ddmm(sumarDias(iso, 6))}`;
const dias = (n: number | null) => (n == null ? 'Sin dato' : `${dec(n)} ${n === 1 ? 'día' : 'días'}`);

/** Pestaña «Clientes»: nuevos y recurrentes, embudo de la carta, puntos y calificaciones. Solo agregados. */
export function ClientesTab({ filtros }: PropsPestanaAnalisis) {
  const { datos, estado, mensaje, recargar } = useConsultaAnalisis<RespuestaClientes>(
    `/admin/analisis/clientes?${consultaDe(filtros, ['modalidad', 'canal', 'turno'])}`,
  );
  return (
    <div className="an">
      {estado === 'cargando' && !datos && <Cargando mensaje="Calculando clientes" />}
      {estado === 'error' && !datos && <EstadoError titulo="No se pudo analizar a los clientes" mensaje={mensaje || 'Prueba de nuevo en unos segundos.'} alReintentar={recargar} />}
      {datos && <Contenido d={datos} alReintentar={recargar} />}
    </div>
  );
}

function Contenido({ d, alReintentar }: { d: RespuestaClientes; alReintentar: () => void }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const c = d.clientes;
  const e = d.calificaciones.encuestas;
  const dm = d.calificaciones.demora;
  return (
    <>
      <div className="an-rejilla an-rejilla--kpi">
        <TarjetaIndicador titulo="Clientes que pidieron" valor={num(c.total)} detalle={c.pedidosSinIdentificar ? `${num(c.pedidosSinIdentificar)} pedidos sin cuenta ni celular` : 'Por cuenta o celular'} />
        <TarjetaIndicador titulo="Nuevos" valor={num(c.nuevos)} detalle="Su primer pedido fue en este período" />
        <TarjetaIndicador titulo="Recurrentes" valor={num(c.recurrentes)} detalle={c.total ? `${pct(c.pctRecurrentes)} de los clientes` : 'Sin dato'} />
        <TarjetaIndicador titulo="Regresan cada" valor={dias(d.regreso.medianaDias)} detalle={d.regreso.n ? `Mediana de ${num(d.regreso.n)} reencuentros` : 'Aún nadie repitió pedido'} />
      </div>
      {d.truncado && (
        <p className="an-error-fechas" role="status">
          Hay más de {num(d.limite)} clientes en el rango: se leyó una parte. Acorta las fechas para ver todo.
        </p>
      )}

      <div className="an-rejilla">
        <TarjetaAnalisis
          id="an-cli-semanas"
          titulo="Nuevos y recurrentes por semana"
          subtitulo="Cada cliente cuenta una vez por semana en que pidió (semana de lunes a domingo, hora de Lima)."
          estado={d.semanas.length ? 'ok' : 'vacio'}
          vacio="No hay pedidos de clientes identificados en este período."
          tabla={{ cabecera: ['Semana', 'Nuevos', 'Recurrentes'], filas: d.semanas.map((s) => [semana(s.semana), s.nuevos, s.recurrentes]) }}
        >
          <BarrasHorizontales
            descripcion="Clientes por semana, nuevos y recurrentes"
            filas={d.semanas.map((s) => ({ id: s.semana, nombre: semana(s.semana), valor: s.nuevos + s.recurrentes, texto: `${s.nuevos} nuevos · ${s.recurrentes} recurrentes` }))}
          />
        </TarjetaAnalisis>

        <TarjetaAnalisis
          id="an-cli-regreso"
          titulo="Cada cuánto regresan"
          subtitulo={`Días entre un pedido y el anterior del mismo cliente. Mediana ${dias(d.regreso.medianaDias)}, el 10 % que más tarda ${dias(d.regreso.p90Dias)}.`}
          estado={d.regreso.n ? 'ok' : 'vacio'}
          vacio="Todavía no hay clientes que hayan repetido pedido en este período."
          tabla={{ cabecera: ['Tramo', 'Reencuentros'], filas: d.regreso.tramos.map((t) => [t.nombre, t.n]) }}
        >
          <BarrasHorizontales descripcion="Reencuentros por tramo de días" filas={d.regreso.tramos.map((t) => ({ id: t.nombre, nombre: t.nombre, valor: t.n, texto: num(t.n) }))} />
        </TarjetaAnalisis>
      </div>

      <TarjetaAnalisis
        id="an-cli-embudo"
        titulo="Embudo de la carta"
        subtitulo="Solo pedidos hechos en la carta web. Toca un paso para ver qué falta guardar."
        estado={d.embudo.pasos[0].n ? 'ok' : 'vacio'}
        vacio="No hubo pedidos de la carta en este período."
        alReintentar={alReintentar}
        tabla={{
          cabecera: ['Paso', 'Pedidos', 'Del paso anterior', 'De los creados'],
          filas: d.embudo.pasos.map((p) => [p.nombre, p.n, pct(p.pctDelAnterior), pct(p.pctDeCreados)]),
        }}
      >
        <BarrasHorizontales
          descripcion="Pedidos de la carta en cada paso"
          alElegir={(id) => setAbierto((a) => (a === id ? null : id))}
          elegida={abierto}
          filas={d.embudo.pasos.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            detalle: p.pctDelAnterior == null ? undefined : `${pct(p.pctDelAnterior)} del paso anterior`,
            valor: p.n,
            texto: num(p.n),
          }))}
        />
        <p className="an-sub">Anulados aparte: {num(d.embudo.anulados)}.</p>
        {abierto && (
          <PanelDetalle titulo={d.embudo.pasos.find((p) => p.id === abierto)?.nombre ?? 'Paso'} alCerrar={() => setAbierto(null)}>
            <p>Antes de «Pedidos creados» el sistema todavía no guarda:</p>
            <ul>
              {d.embudo.noSeGuarda.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </PanelDetalle>
        )}
      </TarjetaAnalisis>

      <div className="an-rejilla an-rejilla--kpi">
        <TarjetaIndicador titulo="Puntos emitidos" valor={dec(d.puntos.emitidos, 0)} detalle="Netos de reversas" />
        <TarjetaIndicador titulo="Puntos canjeados" valor={dec(d.puntos.canjeados, 0)} detalle={d.puntos.pctCanjeado == null ? 'Sin dato' : `${pct(d.puntos.pctCanjeado)} de lo emitido`} />
        <TarjetaIndicador titulo="Saldo vivo" valor={dec(d.puntos.saldoVivo, 0)} detalle={`${num(d.puntos.cuentasConSaldo)} cuentas con saldo`} />
        <TarjetaIndicador titulo="Costo del programa" valor={soles(d.puntos.costoCanjeadoPen)} detalle={`Canjeado en el período. Pendiente si todo el saldo se canjea: ${soles(d.puntos.costoPendientePen)}`} />
      </div>
      <TarjetaAnalisis
        id="an-cli-puntos"
        titulo="Puntos por semana"
        subtitulo="1 punto equivale a S/ 1 de descuento."
        estado={d.puntos.semanas.length ? 'ok' : 'vacio'}
        vacio="No hubo movimientos de puntos en este período."
        tabla={{ cabecera: ['Semana', 'Emitidos', 'Canjeados'], filas: d.puntos.semanas.map((s) => [semana(s.semana), s.emitidos, s.canjeados]) }}
      >
        <BarrasHorizontales
          descripcion="Puntos emitidos y canjeados por semana"
          filas={d.puntos.semanas.map((s) => ({ id: s.semana, nombre: semana(s.semana), valor: Math.max(s.emitidos, s.canjeados, 0), texto: `${dec(s.emitidos, 0)} emitidos · ${dec(s.canjeados, 0)} canjeados` }))}
        />
      </TarjetaAnalisis>

      <div className="an-rejilla an-rejilla--kpi">
        <TarjetaIndicador titulo="Puntaje de posventa" valor={e.promedio == null ? 'Sin dato' : `${dec(e.promedio, 2)} de 5`} detalle={`${num(e.respondidas)} respuestas`} />
        <TarjetaIndicador titulo="Respondieron" valor={pct(e.pctRespuesta)} detalle={`${num(e.respondidas)} de ${num(e.enviadas)} encuestas enviadas`} />
        <TarjetaIndicador titulo="Reseñas de Google" valor={d.calificaciones.google.promedio == null ? 'Sin dato' : `${dec(d.calificaciones.google.promedio, 2)} de 5`} detalle={`${num(d.calificaciones.google.n)} reseñas publicadas`} />
      </div>
      <div className="an-rejilla">
        <TarjetaAnalisis
          id="an-cli-encuesta"
          titulo="Puntaje promedio por semana"
          subtitulo="Encuestas de posventa respondidas por WhatsApp (sin las de prueba)."
          estado={e.semanas.length ? 'ok' : 'vacio'}
          vacio="Nadie respondió la encuesta en este período."
          tabla={{ cabecera: ['Semana', 'Respuestas', 'Promedio'], filas: e.semanas.map((s) => [semana(s.semana), s.respuestas, s.promedio]) }}
        >
          <BarrasHorizontales
            descripcion="Puntaje promedio de posventa por semana, de 1 a 5"
            filas={e.semanas.map((s) => ({ id: s.semana, nombre: semana(s.semana), detalle: `${s.respuestas} respuestas`, valor: s.promedio, texto: dec(s.promedio, 2), meta: 5 }))}
          />
        </TarjetaAnalisis>
        <TarjetaAnalisis
          id="an-cli-demora"
          titulo="¿Calificó peor quien esperó de más?"
          subtitulo="Compara el puntaje de pedidos entregados dentro y fuera de la espera máxima que se les prometió."
          estado={dm.conDemora.n + dm.sinDemora.n ? 'ok' : 'vacio'}
          vacio="No hay respuestas de pedidos con espera prometida y hora de entrega."
          tabla={{
            cabecera: ['Grupo', 'Respuestas', 'Promedio'],
            filas: [
              ['Entregado a tiempo', dm.sinDemora.n, dm.sinDemora.promedio ?? 'Sin dato'],
              ['Entregado con demora', dm.conDemora.n, dm.conDemora.promedio ?? 'Sin dato'],
            ],
          }}
        >
          <BarrasHorizontales
            descripcion="Puntaje promedio según si hubo demora"
            filas={[
              { id: 'a_tiempo', nombre: 'Entregado a tiempo', detalle: `${dm.sinDemora.n} respuestas`, valor: dm.sinDemora.promedio, texto: dec(dm.sinDemora.promedio, 2), meta: 5 },
              { id: 'demora', nombre: 'Entregado con demora', detalle: `${dm.conDemora.n} respuestas`, valor: dm.conDemora.promedio, texto: dec(dm.conDemora.promedio, 2), meta: 5 },
            ]}
          />
        </TarjetaAnalisis>
      </div>
    </>
  );
}
