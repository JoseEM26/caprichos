import { Boton } from '../../../comun/Boton';
import { Semaforo, TarjetaAnalisis, textoMinutos, useConsultaAnalisis } from '../comun';
import type { RespuestaAtascados } from './tipos';

const MODALIDAD: Record<string, string> = { MESA: 'Mesa', COMER_LOCAL: 'Comer en local', RECOGER: 'Para llevar', DELIVERY: 'Delivery' };

/** Pedidos en vivo que llevan en su etapa más minutos que la meta. Se actualiza por socket y cada 30 s. */
export function PedidosAtascados() {
  const { datos, estado, recargar } = useConsultaAnalisis<RespuestaAtascados>('/admin/analisis/tiempos/atascados', {
    cadaMs: 30_000,
    eventos: ['pedido:estado', 'pedido:progreso', 'cocina:comanda'],
  });
  const items = datos?.items ?? [];
  return (
    <TarjetaAnalisis
      id="an-atascados"
      titulo="Pedidos atascados ahora"
      subtitulo="Llevan en su etapa más minutos que la meta (últimas 24 horas). Se actualiza solo."
      estado={estado === 'cargando' && !datos ? 'cargando' : estado === 'error' && !datos ? 'error' : items.length ? 'ok' : 'vacio'}
      vacio="Ningún pedido está atascado. Todo va dentro de las metas."
      alReintentar={recargar}
      acciones={
        <Boton variante="secundario" tamano="pequeno" onClick={recargar}>
          Actualizar
        </Boton>
      }
    >
      {datos && datos.total > items.length && <p className="an-sub">Se muestran los {items.length} más pasados de {datos.total}.</p>}
      <ul className="an-lista">
        {items.map((i) => (
          <li key={i.id}>
            <span className="an-lista__texto">
              <strong>
                {i.codigo} · {MODALIDAD[i.modalidad] ?? i.modalidad}
                {i.mesa ? ` · ${i.mesa}` : ''}
              </strong>
              <span>
                {i.etapaNombre}: lleva {textoMinutos(i.minutos)} (meta {i.meta} min, {i.veces} veces)
              </span>
              {i.areasPendientes.length > 0 && <span className="an-sub">Falta: {i.areasPendientes.join(', ')}</span>}
            </span>
            <Semaforo nivel={i.semaforo} />
            <a className="an-enlace" href={i.enlace} aria-label={`Abrir pedido ${i.codigo}`}>
              Abrir
            </a>
          </li>
        ))}
      </ul>
    </TarjetaAnalisis>
  );
}
