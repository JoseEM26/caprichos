import type { EquipoEstadoImpresion } from '@caprichos/compartido';
import { configDe, haceCuanto } from './logicaEquipo';
import { resumenConfig } from './logicaListado';

/**
 * Una PC en una sola tarjeta compacta: nombre, estado, IP, versión y un resumen de lo que imprime en chips.
 * Toda la tarjeta es un botón: abre la ventana con TODA su configuración.
 */
export function TarjetaCompacta({
  equipo,
  areas,
  duplicadoDe,
  alAbrir,
}: {
  equipo: EquipoEstadoImpresion;
  areas: { id: string; nombre: string }[];
  duplicadoDe?: { nombre: string } | null;
  alAbrir: () => void;
}) {
  const cfg = configDe(equipo);
  const chips = resumenConfig(cfg, areas);
  const estado = !equipo.conectado ? `Sin conexión · ${haceCuanto(equipo.ultimoLatido)}` : cfg.pausado ? 'En pausa' : 'Conectada';
  const tono = !equipo.conectado ? 'off' : cfg.pausado ? 'pausa' : 'on';
  const ip = equipo.ipLocal?.[0];
  return (
    <button
      type="button"
      className={`ic-card${!cfg.configurado ? ' ic-card--nueva' : ''}`}
      data-testid={`card-${equipo.deviceKeyId}`}
      aria-label={`Configurar ${equipo.nombre}. ${estado}.`}
      onClick={alAbrir}
    >
      <span className="ic-fila">
        <span className="ic-nombre">{equipo.nombre}</span>
        <span className={`ic-estado ic-estado--${tono}`} data-testid={`estado-${equipo.deviceKeyId}`}>
          <span className="ic-punto" aria-hidden="true" />
          {estado}
        </span>
      </span>
      <span className="ic-fila ic-meta">
        <span title={equipo.ipPublica ? `IP pública: ${equipo.ipPublica}` : undefined}>{ip ? `IP ${ip}` : 'Sin IP'}</span>
        {equipo.version && <span>v{equipo.version}</span>}
        {equipo.hostname && <span className="ic-host">{equipo.hostname}</span>}
        {equipo.pendientes > 0 && <span className="ic-pend">{equipo.pendientes} en espera</span>}
      </span>
      <span className="ic-chips">
        {!cfg.configurado ? (
          <span className="ic-chip ic-chip--aviso">Nueva · falta configurar</span>
        ) : chips.length === 0 ? (
          <span className="ic-chip ic-chip--gris">No imprime nada</span>
        ) : (
          chips.map((c) => (
            <span key={c} className="ic-chip">
              {c}
            </span>
          ))
        )}
        {duplicadoDe && (
          <span className="ic-chip ic-chip--aviso" data-testid={`dup-${equipo.deviceKeyId}`}>
            Posible duplicado de {duplicadoDe.nombre}
          </span>
        )}
      </span>
      <span className="ic-ir" aria-hidden="true">Configurar ›</span>
    </button>
  );
}
