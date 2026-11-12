import { EstadoError } from '../../../comun/EstadoError';
import { Cargando } from '../../../comun/Cargando';
import { TarjetaIndicador, consultaDe, textoMinutos, useConsultaAnalisis, type PropsPestanaAnalisis } from '../comun';
import { ComparativoAreas } from './ComparativoAreas';
import { EmbudoTiempos } from './EmbudoTiempos';
import { MetasTiempos } from './MetasTiempos';
import { NO_SE_GUARDA } from './faltantes';
import { PedidosAtascados } from './PedidosAtascados';
import type { RespuestaTiempos } from './tipos';

/** Pestaña «Tiempos»: cuánto tarda cada etapa del pedido, las áreas de cocina, lo atascado y las metas. */
export function TiemposTab({ filtros, esAdmin }: PropsPestanaAnalisis) {
  const { datos, estado, mensaje, recargar } = useConsultaAnalisis<RespuestaTiempos>(
    `/admin/analisis/tiempos?${consultaDe(filtros, ['modalidad', 'canal', 'turno'])}`,
  );

  return (
    <div className="an">
      <PedidosAtascados />
      {estado === 'cargando' && !datos && <Cargando mensaje="Calculando tiempos" />}
      {estado === 'error' && !datos && <EstadoError titulo="No se pudieron calcular los tiempos" mensaje={mensaje || 'Prueba de nuevo en unos segundos.'} alReintentar={recargar} />}
      {datos && (
        <>
          <div className="an-rejilla an-rejilla--kpi">
            <TarjetaIndicador titulo="Pedidos medidos" valor={String(datos.pedidos.considerados)} detalle={`${datos.pedidos.enCurso} aún en curso`} />
            <TarjetaIndicador
              titulo="Etapa más lenta"
              valor={datos.etapas.find((e) => e.codigo === datos.etapaMasLenta)?.nombre ?? 'Sin dato'}
              detalle={textoMinutos(datos.etapas.find((e) => e.codigo === datos.etapaMasLenta)?.promedio)}
            />
            <TarjetaIndicador
              titulo="Anulados (aparte)"
              valor={String(datos.anulados.n)}
              detalle={datos.anulados.n ? `Tardaron ${textoMinutos(datos.anulados.minutosPromedio)} en anularse` : 'No entran en los promedios'}
            />
          </div>
          {datos.truncado && (
            <p className="an-error-fechas" role="status">
              Hay más de {datos.limite} pedidos en el rango: se leyeron los más recientes. Acorta las fechas para ver todo.
            </p>
          )}
          <div className="an-rejilla">
            <EmbudoTiempos etapas={datos.etapas} masLenta={datos.etapaMasLenta} modalidad={filtros.modalidad} entran={datos.pedidos.entran} />
            <ComparativoAreas areas={datos.areas} />
          </div>
          <MetasTiempos etapas={datos.etapas} esAdmin={esAdmin} alGuardar={recargar} />
          <details className="an-tarjeta">
            <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', fontWeight: 800, cursor: 'pointer' }}>
              Qué todavía no se guarda
            </summary>
            <ul>
              {NO_SE_GUARDA.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
