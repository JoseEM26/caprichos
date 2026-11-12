import { Boton } from '../../../comun/Boton';
import { BarrasHorizontales, TarjetaAnalisis, textoMinutos, useConsultaAnalisis } from '../comun';
import type { RespuestaVivo } from './tipos';

/** Pedidos en cola por área de cocina ahora. Se actualiza por socket y cada 30 s; el semáforo mide a la comanda más antigua. */
export function CargaVivo() {
  const { datos, estado, recargar } = useConsultaAnalisis<RespuestaVivo>('/admin/analisis/demanda/vivo', {
    cadaMs: 30_000,
    eventos: ['pedido:estado', 'pedido:progreso', 'cocina:comanda'],
  });
  const areas = datos?.areas ?? [];
  return (
    <TarjetaAnalisis
      id="an-vivo"
      titulo="Carga de cocina ahora"
      subtitulo="Pedidos esperando en cada área. El semáforo mide a la comanda más antigua contra la meta de cocina."
      estado={estado === 'cargando' && !datos ? 'cargando' : estado === 'error' && !datos ? 'error' : areas.length ? 'ok' : 'vacio'}
      vacio="No hay áreas de cocina activas."
      alReintentar={recargar}
      acciones={
        <Boton variante="secundario" tamano="pequeno" onClick={recargar}>
          Actualizar
        </Boton>
      }
      tabla={{
        cabecera: ['Área', 'En cola', 'Más antigua (min)', 'Meta (min)'],
        filas: areas.map((a) => [a.nombre, a.enCola, a.masAntiguaMin ?? 'Sin cola', a.meta]),
      }}
    >
      <BarrasHorizontales
        descripcion="Pedidos en cola por área de cocina"
        etiquetaDestacada="Más cargada"
        filas={areas.map((a) => ({
          id: a.nombre,
          nombre: a.nombre,
          detalle: a.enCola ? `Más antigua: ${textoMinutos(a.masAntiguaMin)}` : 'Sin cola',
          valor: a.enCola,
          texto: `${a.enCola} ${a.enCola === 1 ? 'pedido' : 'pedidos'}`,
          semaforo: a.enCola ? a.semaforo : 'verde',
          destacada: a.enCola > 0 && a.enCola === Math.max(...areas.map((x) => x.enCola)) && areas.length > 1,
        }))}
      />
    </TarjetaAnalisis>
  );
}
