import { BarrasHorizontales, TarjetaAnalisis, textoMinutos } from '../comun';
import type { AreaResumen } from './tipos';

/** Las áreas de cocina lado a lado: minutos desde que el pedido pasa a cocina hasta que el área marca Listo. */
export function ComparativoAreas({ areas }: { areas: AreaResumen[] }) {
  const masLenta = areas.filter((a) => a.promedio != null).sort((a, b) => (b.promedio as number) - (a.promedio as number))[0]?.nombre;
  return (
    <TarjetaAnalisis
      id="an-areas"
      titulo="Cocina por área"
      subtitulo="Desde que pasa a cocina hasta que el área marca Listo."
      estado={areas.length ? 'ok' : 'vacio'}
      vacio="Ninguna área de cocina tuvo pedidos en este período."
      tabla={{
        cabecera: ['Área', 'Pedidos', 'Promedio (min)', 'Mediana (min)', 'Máximo (min)', 'Meta (min)'],
        filas: areas.map((a) => [a.nombre, a.n, a.promedio ?? 'Sin dato', a.mediana ?? 'Sin dato', a.maximo ?? 'Sin dato', a.meta]),
      }}
    >
      <BarrasHorizontales
        descripcion="Minutos promedio de cada área de cocina, con la meta de cocina"
        etiquetaDestacada="Más lenta"
        filas={areas.map((a) => ({
          id: a.nombre,
          nombre: a.nombre,
          detalle: a.n ? `Mediana ${textoMinutos(a.mediana)} · ${a.n} ${a.n === 1 ? 'pedido' : 'pedidos'}` : undefined,
          valor: a.promedio,
          texto: a.n ? `Prom. ${textoMinutos(a.promedio)}` : 'Sin dato',
          meta: a.meta,
          semaforo: a.semaforo,
          destacada: areas.length > 1 && a.nombre === masLenta,
        }))}
      />
    </TarjetaAnalisis>
  );
}
