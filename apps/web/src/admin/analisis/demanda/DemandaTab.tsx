import { useState } from 'react';
import { EstadoError } from '../../../comun/EstadoError';
import { Cargando } from '../../../comun/Cargando';
import { Boton } from '../../../comun/Boton';
import { BarrasHorizontales, ListaRanking, MapaDeCalor, PanelDetalle, TarjetaAnalisis, TarjetaIndicador, consultaDe, textoMinutos, useConsultaAnalisis, type PropsPestanaAnalisis } from '../comun';
import { CargaVivo } from './CargaVivo';
import type { RespuestaDemanda } from './tipos';

const pct = (n: number | null) => (n == null ? 'Sin dato' : `${String(n).replace('.', ',')} %`);
const hh = (h: number) => `${String(h).padStart(2, '0')}h`;

/** Pestaña «Demanda»: cuándo piden, cuánta carga hay en cocina ahora, si se cumple lo prometido y qué se anula. */
export function DemandaTab({ filtros }: PropsPestanaAnalisis) {
  const { datos, estado, mensaje, recargar } = useConsultaAnalisis<RespuestaDemanda>(
    `/admin/analisis/demanda?${consultaDe(filtros, ['modalidad', 'canal', 'turno'])}`,
  );
  const [verQuien, setVerQuien] = useState(false);

  return (
    <div className="an">
      <CargaVivo />
      {estado === 'cargando' && !datos && <Cargando mensaje="Calculando la demanda" />}
      {estado === 'error' && !datos && <EstadoError titulo="No se pudo calcular la demanda" mensaje={mensaje || 'Prueba de nuevo en unos segundos.'} alReintentar={recargar} />}
      {datos && <Contenido datos={datos} verQuien={verQuien} setVerQuien={setVerQuien} />}
    </div>
  );
}

function Contenido({ datos, verQuien, setVerQuien }: { datos: RespuestaDemanda; verQuien: boolean; setVerQuien: (v: boolean) => void }) {
  const { mapa, cumplimiento: c, anulados: a } = datos;
  const horasConDatos = mapa.valores.flatMap((fila) => fila.map((n, h) => (n > 0 ? h : -1))).filter((h) => h >= 0);
  const desde = horasConDatos.length ? Math.min(...horasConDatos) : 0;
  const hasta = horasConDatos.length ? Math.max(...horasConDatos) : -1;
  const horas = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);

  return (
    <>
      <div className="an-rejilla an-rejilla--kpi">
        <TarjetaIndicador titulo="Pedidos" valor={String(datos.pedidos.validos)} detalle="Sin anulados ni rechazados" />
        <TarjetaIndicador
          titulo="Hora más pedida"
          valor={mapa.pico ? `${mapa.pico.dia} ${hh(mapa.pico.hora)}` : 'Sin dato'}
          detalle={mapa.pico ? `${mapa.pico.pedidos} ${mapa.pico.pedidos === 1 ? 'pedido' : 'pedidos'}` : undefined}
        />
        <TarjetaIndicador titulo="Cumplieron el tiempo prometido" valor={pct(c.porcentaje)} detalle={c.sinDato ? 'Aún no hay delivery con tiempo prometido' : `${c.cumplieron} de ${c.evaluados} delivery`} />
        <TarjetaIndicador titulo="Anulados" valor={String(a.n)} detalle={a.porcentaje == null ? 'Sin pedidos' : `${pct(a.porcentaje)} de los pedidos`} />
      </div>
      {datos.truncado && (
        <p className="an-error-fechas" role="status">
          Hay más de {datos.limite} pedidos en el rango: se leyeron los más recientes. Acorta las fechas para ver todo.
        </p>
      )}

      <TarjetaAnalisis
        id="an-mapa"
        titulo="Cuándo piden"
        subtitulo="Pedidos por día de la semana y hora de Lima (según la hora en que entró el pedido)."
        estado={horas.length ? 'ok' : 'vacio'}
        vacio="No hubo pedidos en este período."
        tabla={{
          cabecera: ['Día', ...horas.map(hh)],
          filas: mapa.dias.map((d, i) => [d, ...horas.map((h) => mapa.valores[i][h])]),
        }}
      >
        <MapaDeCalor
          descripcion="Pedidos por día de la semana y hora"
          filas={mapa.dias}
          columnas={horas.map(hh)}
          valores={mapa.valores.map((fila) => horas.map((h) => fila[h]))}
        />
      </TarjetaAnalisis>

      <div className="an-rejilla">
        <TarjetaAnalisis
          id="an-cumple"
          titulo="Tiempo prometido al cliente"
          subtitulo="Delivery entregados que llegaron dentro del máximo prometido al salir."
          estado={c.sinDato ? 'vacio' : 'ok'}
          vacio="Sin dato: solo el delivery guarda un tiempo prometido (al salir el repartidor). Mesa y para llevar no lo guardan."
        >
          <BarrasHorizontales
            descripcion="Delivery que cumplió el tiempo prometido"
            etiquetaDestacada=""
            filas={[
              { id: 'ok', nombre: 'Cumplieron', valor: c.cumplieron, texto: `${c.cumplieron} (${pct(c.porcentaje)})`, semaforo: 'verde' },
              { id: 'tarde', nombre: 'Llegaron tarde', valor: c.evaluados - c.cumplieron, texto: String(c.evaluados - c.cumplieron), semaforo: c.evaluados - c.cumplieron ? 'rojo' : 'verde' },
            ]}
          />
          {c.retrasoPromedioMin != null && <p className="an-sub">Los que llegaron tarde se pasaron {textoMinutos(c.retrasoPromedioMin)} en promedio.</p>}
          <p className="an-sub">
            Sin medir: {c.deliverySinPromesa} delivery sin tiempo prometido guardado y {c.otrasModalidadesSinDato} entregas de otras modalidades.
          </p>
        </TarjetaAnalisis>

        <TarjetaAnalisis
          id="an-anulados"
          titulo="Pedidos anulados"
          subtitulo={a.n ? `${a.n} anulados (${pct(a.porcentaje)}). Tardaron ${textoMinutos(a.minutos.promedio)} en anularse.` : undefined}
          estado={a.n ? 'ok' : 'vacio'}
          vacio="No hubo pedidos anulados en este período."
          tabla={{ cabecera: ['Motivo', 'Cantidad', '%'], filas: a.motivos.map((m) => [m.motivo, m.n, m.porcentaje ?? 'Sin dato']) }}
          acciones={
            <Boton variante="secundario" tamano="pequeno" onClick={() => setVerQuien(!verQuien)} aria-expanded={verQuien}>
              Quién anula
            </Boton>
          }
        >
          <ListaRanking
            descripcion="Motivos de anulación"
            items={a.motivos.map((m) => ({ id: m.motivo, nombre: m.motivo, valor: m.n, texto: `${m.n} (${pct(m.porcentaje)})` }))}
          />
          <BarrasHorizontales
            descripcion="Etapa en que se anuló el pedido"
            etiquetaDestacada=""
            filas={a.etapas.map((e) => ({ id: e.etapa, nombre: e.etapa, valor: e.n, texto: `${e.n} (${pct(e.porcentaje)})` }))}
          />
          {verQuien && (
            <PanelDetalle titulo="Quién anuló" alCerrar={() => setVerQuien(false)}>
              <ul className="an-lista">
                {a.quienes.map((q) => (
                  <li key={q.nombre}>
                    <span className="an-lista__texto">
                      <strong>{q.nombre}</strong>
                      <span>
                        {q.n} {q.n === 1 ? 'pedido' : 'pedidos'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </PanelDetalle>
          )}
          {a.rechazados > 0 && <p className="an-sub">Además, {a.rechazados} pedidos rechazados (no entran en la demanda).</p>}
        </TarjetaAnalisis>
      </div>
    </>
  );
}
