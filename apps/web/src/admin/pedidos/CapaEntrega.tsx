import { AvisoSinCelular, tieneCelularReal, TEXTO_SIN_CELULAR_PEDIDO } from '../../comun/AvisoSinCelular';
import { useState } from 'react';
import { HistorialAuditoria, horaCorta } from './HistorialAuditoria';
import { SeccionUbicacionPedido } from './SeccionUbicacionPedido';
import { MapaUbicacion } from '../../comun/mapa/MapaUbicacion';
import { PruebaEntregaFallida } from './PruebaEntregaFallida';
import { PlanoMesaResaltada } from '../salon/componentes/PlanoMesaResaltada';
import { canalLabel } from './PedidosAdminView';
import { BotonAbrirChatCliente } from '../mensajes/BotonAbrirChatCliente';
import { SeccionComprobantesPedido } from './SeccionComprobantesPedido';
import type { Pedido } from './pedidosApi';

export interface CapaEntregaProps {
  pedido: Pedido;
  esDelivery: boolean;
  esMesa: boolean;
  puedeCorregirCliente: boolean;
  alCorregirCliente: () => void;
  alUbicar: () => void;
  alActualizar: () => void;
}

/** Ruta del repartidor: Asignado, Salió, Llegó y Entregado, con la hora si se conoce. */
function pasosRuta(pedido: Pedido): Array<{ n: string; hecho: boolean; hora: string }> {
  const est = String(pedido.estado || '').toUpperCase();
  const entregado = est === 'ENTREGADO';
  const salio = entregado || est === 'EN_CAMINO' || est === 'RUTA';
  const horaDe = (estado: string) => {
    const h = (pedido.historial ?? []).find((x) => x.estado_nuevo === estado);
    return h ? horaCorta(h.en) : '';
  };
  const llego = entregado || !!pedido.prueba_entrega?.llego_en;
  return [
    { n: 'Asignado', hecho: !!pedido.repartidor_party_id, hora: '' },
    { n: 'Salió', hecho: salio, hora: horaDe('EN_CAMINO') },
    { n: 'Llegó', hecho: llego, hora: pedido.prueba_entrega?.llego_en ? horaCorta(pedido.prueba_entrega.llego_en) : '' },
    { n: 'Entregado', hecho: entregado, hora: horaDe('ENTREGADO') },
  ];
}

/** Capa 3: cliente (con Copiar), entrega (dirección, mapa, ubicación, repartidor y ruta; croquis si es de mesa) e historial plegado. */
export function CapaEntrega({ pedido, esDelivery, esMesa, puedeCorregirCliente, alCorregirCliente, alUbicar, alActualizar }: CapaEntregaProps) {
  const [copiado, setCopiado] = useState('');
  const lat = pedido.entrega_lat;
  const lng = pedido.entrega_lng;
  const conCoords = lat != null && lng != null && lat !== '' && lng !== '';
  const mozo = pedido.cobroMozo?.mozo;
  const repartidor = (pedido as Pedido & { repartidor?: { nombre?: string | null } | null }).repartidor?.nombre || pedido.prueba_entrega?.repartidor;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(String(pedido.cliente_telefono));
      setCopiado('Copiado');
    } catch {
      setCopiado('No se pudo copiar');
    }
  };

  return (
    <>
      <div className="dp-grid dp-grid-ent">
        <section className="dp-sec" aria-label="Cliente">
          <h3 className="dp-sec-titulo">Cliente</h3>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20, overflowWrap: 'anywhere' }}>
            {pedido.cliente_nombre?.trim() || 'Cliente'}
          </div>
          <div className="dp-fila">
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--cp-navy, #0B2C3E)' }}>{pedido.cliente_telefono || 'Sin teléfono'}</span>
            {pedido.cliente_telefono && (
              <button type="button" className="dp-btn" onClick={copiar}>
                Copiar
              </button>
            )}
          </div>
          {!tieneCelularReal(pedido.cliente_telefono) && !pedido.es_personal && (
            <AvisoSinCelular texto={TEXTO_SIN_CELULAR_PEDIDO}>
              {puedeCorregirCliente && (
                <button type="button" className="dp-btn" onClick={alCorregirCliente}>
                  Agregar celular
                </button>
              )}
            </AvisoSinCelular>
          )}
          {copiado && (
            <span role="status" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-green, #2F7A45)' }}>
              {copiado}
            </span>
          )}
          <div className="dp-fila" style={{ fontSize: 14 }}>
            <span>Canal</span>
            <strong>{canalLabel(pedido.canal)}</strong>
          </div>
          {mozo && (
            <div className="dp-fila" style={{ fontSize: 14 }}>
              <span>Tomado por</span>
              <strong>{mozo}</strong>
            </div>
          )}
          <BotonAbrirChatCliente telefono={pedido.cliente_telefono} nombre={pedido.cliente_nombre} respaldoWa estilo={{ alignSelf: 'flex-start' }} />
          <h3 className="dp-sec-titulo">Comprobantes</h3>
          <SeccionComprobantesPedido pedido={pedido} />
          {puedeCorregirCliente && (
            <button type="button" className="dp-btn" style={{ alignSelf: 'flex-start' }} onClick={alCorregirCliente}>
              Corregir datos del cliente
            </button>
          )}
        </section>

        <section className="dp-sec" aria-label="Entrega">
          <h3 className="dp-sec-titulo">Entrega</h3>
          {esMesa && <PlanoMesaResaltada pedidoId={pedido.id} mesaNombre={pedido.mesa_nombre} />}
          {!esMesa && !esDelivery && <div style={{ fontSize: 17, fontWeight: 700 }}>Recoge en el local.</div>}
          {esDelivery && (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{pedido.entrega_direccion || 'Sin dirección registrada'}</div>
              {pedido.entrega_referencia && <div style={{ fontSize: 14.5, color: 'var(--cp-soft, #2C4C5D)' }}>Ref.: {pedido.entrega_referencia}</div>}
              <div className="dp-fila" style={{ fontSize: 14 }}>
                <span>Zona y envío</span>
                <strong>
                  {pedido.zona?.nombre ?? 'Sin zona'} · S/ {Number(pedido.envio || 0).toFixed(2)}
                </strong>
              </div>
              {!conCoords ? (
                <button type="button" className="dp-btn" style={{ background: 'rgb(255, 241, 201)', alignSelf: 'flex-start' }} onClick={alUbicar}>
                  Ubicar en el mapa (falta la ubicación)
                </button>
              ) : (
                <>
                <div data-testid="mapa-entrega-pedido">
                  <MapaUbicacion
                    punto={{ lat: Number(lat), lng: Number(lng) }}
                    soloLectura
                    altura={240}
                    ajustarA="punto"
                    etiqueta={`Mapa de entrega de ${pedido.codigo}`}
                  />
                </div>
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontWeight: 800, color: 'var(--cp-teal, #2C6E7F)', textDecoration: 'underline', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
                  >
                    Abrir en mapa grande
                  </a>
                  <button type="button" className="dp-btn" onClick={alUbicar}>
                    Corregir ubicación en el mapa
                  </button>
                </span>
                </>
              )}
              <SeccionUbicacionPedido
                pedidoId={String(pedido.id)}
                codigo={pedido.codigo}
                estado={pedido.estado}
                lat={conCoords ? Number(lat) : null}
                lng={conCoords ? Number(lng) : null}
                direccion={pedido.entrega_direccion}
                alActualizar={alActualizar}
              />
              <div className="dp-ruta" data-testid="ruta-repartidor" aria-label="Ruta del repartidor">
                {pasosRuta(pedido).map((p, i) => (
                  <div key={p.n} className={`dp-ruta-paso ${p.hecho ? 'dp-ruta-hecho' : 'dp-ruta-pendiente'}`} data-testid={`ruta-${p.n.toLowerCase()}`} data-hecho={p.hecho ? 'si' : 'no'}>
                    <span className="dp-ruta-punto">{p.hecho ? '✓' : i + 1}</span>
                    <span>{p.n}</span>
                    {p.hora && <span style={{ fontWeight: 600, fontSize: 12 }}>{p.hora}</span>}
                  </div>
                ))}
              </div>
              <div className="dp-fila" style={{ fontSize: 14 }}>
                <span>Repartidor</span>
                <strong>{repartidor || (pedido.repartidor_party_id ? 'Asignado' : 'Sin asignar')}</strong>
              </div>
            </>
          )}
          <PruebaEntregaFallida prueba={pedido.prueba_entrega} />
        </section>
      </div>
      <HistorialAuditoria eventos={pedido.eventos} />
    </>
  );
}
