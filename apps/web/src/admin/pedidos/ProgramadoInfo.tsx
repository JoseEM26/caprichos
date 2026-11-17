import { useId, useState, type ReactNode } from 'react';
import type { LineaPedido, Pedido } from './pedidosApi';
import { esCargoLibre } from './ModalCargoLibre';
import { paraCuandoDe, textoPagoProgramado } from './programado';
import './programado.css';


/**
 * Franja «PROGRAMADO · para mañana 17/11 · 5:00 p. m. · faltan 1 d 23 h». Texto + color + icono (no solo color):
 * ámbar si es hoy y ya está cerca, rojo si es hoy y ya pasó la hora. Sin fecha pactada no sale.
 */
export function ChipProgramado({ pedido, ahora }: { pedido: Pick<Pedido, 'estado' | 'programado_para' | 'total' | 'pago_estado' | 'adelanto_total'>; ahora?: Date }) {
  const pc = paraCuandoDe(pedido, ahora);
  if (!pc) return null;
  const pago = pc.programado ? textoPagoProgramado(pedido) : null;
  const icono = pc.nivel === 'vencido' ? '⚠️' : pc.nivel === 'cerca' ? '⏰' : '📅';
  return (
    <span className="pg-franja" data-testid="chip-programado" data-nivel={pc.nivel} data-otro-dia={pc.otroDia ? '1' : '0'}>
      <span className="pg-linea">
        <span aria-hidden="true">{icono}</span>
        <strong>{pc.programado ? 'PROGRAMADO' : 'PEDIDO'}</strong>
        <span>· {pc.cuando}</span>
      </span>
      {pc.faltan && (
        <span className="pg-faltan" data-testid="programado-faltan">
          {pc.nivel === 'vencido' ? 'Ya pasó la hora: ' : ''}
          {pc.faltan}
        </span>
      )}
      {pago && <span className="pg-pago" data-testid="pago-programado">{pago}</span>}
    </span>
  );
}

/** Líneas «Servicio o producto» libres del pedido (cargo libre). */
export const cargosLibres = (lineas: LineaPedido[] = []): LineaPedido[] => lineas.filter((l) => esCargoLibre(l));

/**
 * Bloque destacado «SERVICIO / ENCARGO» de la tarjeta: la descripción completa (varias líneas, sin cortar) aparte de los
 * productos de la carta. Null si el pedido no tiene cargos libres.
 */
export function BloqueEncargoTarjeta({ lineas }: { lineas: LineaPedido[] }) {
  const cargos = cargosLibres(lineas);
  if (cargos.length === 0) return null;
  return (
    <span className="pg-encargos" data-testid="encargos-tarjeta">
      {cargos.map((l, i) => (
        <span key={String(l.id ?? i)} className="pg-encargo">
          <span className="pg-encargo-rotulo">🎂 SERVICIO / ENCARGO</span>
          <span className="pg-encargo-texto" data-testid="encargo-texto">{l.cantidad > 1 ? `${l.cantidad}× ` : ''}{l.nombre}</span>
        </span>
      ))}
    </span>
  );
}
