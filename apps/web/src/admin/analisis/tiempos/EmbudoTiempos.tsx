import { useState } from 'react';
import { BarrasHorizontales, PanelDetalle, Semaforo, TarjetaAnalisis, textoMinutos, type FilaBarra } from '../comun';
import { FALTANTES } from './faltantes';
import type { EtapaResumen } from './tipos';

const pedidos = (n: number) => `${n} ${n === 1 ? 'pedido' : 'pedidos'}`;

/** Recorrido del pedido: una barra por etapa con promedio, mediana, meta y semáforo; la más lenta resaltada. */
export function EmbudoTiempos({
  etapas,
  masLenta,
  modalidad,
  entran,
}: {
  etapas: EtapaResumen[];
  masLenta: string | null;
  modalidad: string;
  entran: number;
}) {
  const [elegida, setElegida] = useState<string | null>(null);
  // Con una modalidad filtrada se ocultan las etapas que son de otra modalidad
  const visibles = etapas.filter((e) => !(modalidad && e.modalidades && !e.modalidades.includes(modalidad)));
  const filas: FilaBarra[] = visibles.map((e) => ({
    id: e.codigo,
    nombre: `${e.paso}. ${e.nombre}`,
    detalle: e.sinDato ? undefined : `Mediana ${textoMinutos(e.mediana)} · ${pedidos(e.n)}`,
    valor: e.promedio,
    texto: e.sinDato ? 'Sin dato' : `Prom. ${textoMinutos(e.promedio)}`,
    meta: e.meta,
    semaforo: e.semaforo,
    destacada: e.codigo === masLenta,
  }));
  const detalle = visibles.find((e) => e.codigo === elegida) ?? null;
  const conDatos = visibles.some((e) => !e.sinDato);

  return (
    <TarjetaAnalisis
      id="an-embudo"
      titulo="Recorrido del pedido"
      subtitulo={`1. Entran ${pedidos(entran)}. Toca una etapa para ver su detalle.`}
      estado={conDatos ? 'ok' : 'vacio'}
      vacio="Todavía no hay pedidos con tiempos en este período."
      tabla={{
        cabecera: ['Etapa', 'Pedidos', 'Promedio (min)', 'Mediana (min)', 'Más lento 10% (min)', 'Máximo (min)', 'Meta (min)', 'Semáforo'],
        filas: visibles.map((e) => [
          `${e.paso}. ${e.nombre}`,
          e.n,
          e.promedio ?? 'Sin dato',
          e.mediana ?? 'Sin dato',
          e.p90 ?? 'Sin dato',
          e.maximo ?? 'Sin dato',
          e.meta,
          e.semaforo === 'verde' ? 'En meta' : e.semaforo === 'ambar' ? 'Cerca de la meta' : e.semaforo === 'rojo' ? 'Pasada de la meta' : 'Sin dato',
        ]),
      }}
    >
      <BarrasHorizontales
        filas={filas}
        descripcion="Minutos promedio de cada etapa del pedido, con su meta"
        alElegir={(id) => setElegida((a) => (a === id ? null : id))}
        elegida={elegida}
      />
      {detalle && (
        <PanelDetalle titulo={`${detalle.paso}. ${detalle.nombre}`} alCerrar={() => setElegida(null)}>
          <p className="an-sub">{detalle.detalle}</p>
          <dl className="an-datos">
            <div><dt>Pedidos</dt><dd>{detalle.n}</dd></div>
            <div><dt>Promedio</dt><dd>{textoMinutos(detalle.promedio)}</dd></div>
            <div><dt>Mediana</dt><dd>{textoMinutos(detalle.mediana)}</dd></div>
            <div><dt>El 10% más lento</dt><dd>{textoMinutos(detalle.p90)}</dd></div>
            <div><dt>Máximo</dt><dd>{textoMinutos(detalle.maximo)}</dd></div>
            <div><dt>Meta</dt><dd>{detalle.meta} min</dd></div>
          </dl>
          <Semaforo nivel={detalle.semaforo} />
          {detalle.sinDato && <p className="an-sub">{FALTANTES[detalle.codigo]}</p>}
          {!detalle.compite && <p className="an-sub">Esta etapa espera horas por diseño: no entra en «Más lenta».</p>}
        </PanelDetalle>
      )}
    </TarjetaAnalisis>
  );
}
