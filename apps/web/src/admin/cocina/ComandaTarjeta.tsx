import { useEffect, useState } from 'react';
import type { ColorComanda, Comanda, LineaComanda } from './cocinaTipos';

export interface ComandaTarjetaProps {
  comanda: Comanda;
  onDespejar?: (comanda: Comanda) => void;
  despejando?: boolean;
  soloLectura?: boolean;
  mostrarArea?: boolean;
  /** Vista de un área: la boleta muestra solo las líneas de esa área y resalta su casilla. */
  soloArea?: boolean;
}

export function obtenerColorMinutos(minutos: number): ColorComanda {
  if (minutos >= 50) return 'ROJO';
  if (minutos >= 35) return 'NARANJA';
  return 'VERDE';
}

const normalizarOpcion = (o: any): string => {
  if (!o) return '';
  if (typeof o === 'string') return o;
  if (o.nombre) return o.nombre;
  if (o.texto) return o.texto;
  return '';
};

const VERDE_LISTO = '#2F7A45';

/** Nombres de las otras áreas del pedido que todavía no despejaron. */
export function areasQueFaltan(comanda: Comanda): string[] {
  return (comanda.areas || [])
    .filter((a) => !a.despejada && a.areaId !== comanda.areaId)
    .map((a) => a.areaNombre);
}

function descripcionLinea(it: LineaComanda): string {
  const opcionesArr = (it.opciones || []).map(normalizarOpcion).filter(Boolean);
  const partes: string[] = [];
  if (it.tamano) partes.push(it.tamano);
  if (it.sabor) partes.push(it.sabor);
  if (opcionesArr.length > 0) partes.push(opcionesArr.join(' · '));
  if (it.nota) partes.push(it.nota);
  return partes.join(' · ');
}

function IconoListo({ listo }: { listo: boolean }) {
  if (listo) {
    return (
      <span
        role="img"
        aria-label="listo"
        title="Listo en su área"
        style={{ display: 'inline-flex', color: VERDE_LISTO, flexShrink: 0, marginTop: 2 }}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
          <path
            d="M3 8.5l3 3 7-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label="pendiente"
      title="Pendiente en su área"
      style={{ display: 'inline-flex', color: 'var(--cp-soft)', flexShrink: 0, marginTop: 2 }}
    >
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </span>
  );
}

function LineaFila({
  it,
  etiquetaArea,
  listo,
}: {
  it: LineaComanda;
  etiquetaArea?: string;
  listo?: boolean;
}) {
  const desc = descripcionLinea(it);
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <span style={{ fontWeight: 800, color: 'var(--cp-navy)' }}>{it.cantidad}×</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, color: 'var(--cp-navy)' }}>{it.nombre}</span>
        {etiquetaArea && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              border: '1px solid var(--cp-soft)',
              borderRadius: '9999px',
              padding: '0 6px',
              color: 'var(--cp-soft)',
              marginLeft: '6px',
            }}
          >
            {etiquetaArea}
          </span>
        )}
        {desc && (
          <>
            <br />
            <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>{desc}</span>
          </>
        )}
      </span>
      {listo !== undefined && <IconoListo listo={listo} />}
    </div>
  );
}

/**
 * Casilla de estado de un área: marcada con check si ya despejó, en blanco si falta.
 */
function CasillaArea({ listo }: { listo: boolean }) {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      <rect
        x="1.5"
        y="1.5"
        width="13"
        height="13"
        rx="3"
        fill={listo ? VERDE_LISTO : 'none'}
        stroke={listo ? VERDE_LISTO : 'var(--cp-soft)'}
        strokeWidth="1.8"
      />
      {listo && (
        <path
          d="M4 8.5l2.6 2.6 5.4-5.4"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/**
 * Franja con una casilla por área del pedido. El área de la pantalla (vista de área) va resaltada.
 */
function EstadoAreas({ comanda, areaActual }: { comanda: Comanda; areaActual?: string }) {
  if (!comanda.areas || comanda.areas.length === 0) return null;
  return (
    <div
      aria-label="Estado por área"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
    >
      {comanda.areas.map((area) => {
        const esActual = area.areaId === areaActual;
        return (
          <span
            key={area.areaId}
            role="img"
            aria-label={`${area.areaNombre}: ${area.despejada ? 'lista' : 'falta'}`}
            data-testid={`estado-area-${area.areaId}`}
            data-despejada={area.despejada ? 'true' : 'false'}
            data-actual={esActual ? 'true' : 'false'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '12px',
              fontWeight: esActual ? 800 : 600,
              color: 'var(--cp-navy)',
              border: esActual ? '1.5px solid var(--cp-navy)' : '1px solid var(--cp-line)',
              borderRadius: '9999px',
              padding: '2px 8px',
              background: esActual ? 'var(--cp-cream)' : 'transparent',
            }}
          >
            <CasillaArea listo={area.despejada} />
            {area.areaNombre}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Líneas del pedido. En la vista de un área (soloArea) muestra solo sus líneas, con el check
 * de listo de esa área. Si el servidor trae las áreas del pedido, en la vista Todas se agrupan
 * por área (subtítulo pequeño) con un check por línea. Sin áreas (respuesta anterior), lista plana.
 */
export function LineasComanda({
  comanda,
  mostrarArea = true,
  soloArea = false,
}: {
  comanda: Comanda;
  mostrarArea?: boolean;
  soloArea?: boolean;
}) {
  const areas = comanda.areas || [];
  const conAreas = areas.length > 0;
  if (soloArea || !conAreas) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {(comanda.lineas || []).map((it, idx) => (
          <LineaFila
            key={it.id || idx}
            it={it}
            etiquetaArea={mostrarArea ? it.area || comanda.areaNombre || undefined : undefined}
            listo={soloArea && conAreas ? comanda.despejada === true : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {areas.map((area) => (
        <div
          key={area.areaId}
          data-testid={`area-pedido-${area.areaId}`}
          style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--cp-soft)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {area.areaNombre}
          </div>
          {area.lineas.map((it, idx) => (
            <LineaFila key={it.id || idx} it={it} listo={area.despejada} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ComandaTarjeta({
  comanda,
  onDespejar,
  despejando = false,
  soloLectura = false,
  mostrarArea = true,
  soloArea = false,
}: ComandaTarjetaProps) {
  const [minutosEnVivo, setMinutosEnVivo] = useState<number>(() => {
    if (comanda.creado_en) {
      const creadoMs = new Date(comanda.creado_en).getTime();
      if (!isNaN(creadoMs)) {
        return Math.max(0, Math.floor((Date.now() - creadoMs) / 60000));
      }
    }
    return comanda.minutos ?? 0;
  });

  useEffect(() => {
    const actualizar = () => {
      if (comanda.creado_en) {
        const creadoMs = new Date(comanda.creado_en).getTime();
        if (!isNaN(creadoMs)) {
          setMinutosEnVivo(Math.max(0, Math.floor((Date.now() - creadoMs) / 60000)));
          return;
        }
      }
      setMinutosEnVivo(comanda.minutos ?? 0);
    };

    actualizar();
    const interval = setInterval(actualizar, 15000);
    return () => clearInterval(interval);
  }, [comanda.creado_en, comanda.minutos]);

  const colorCalculado: ColorComanda = (() => {
    if (minutosEnVivo >= 50) return 'ROJO';
    if (minutosEnVivo >= 35) return 'NARANJA';
    const colorRaw = comanda.color || comanda.colorEspera;
    if (colorRaw) return colorRaw.toUpperCase() as ColorComanda;
    return obtenerColorMinutos(minutosEnVivo);
  })();

  const tBg =
    colorCalculado === 'ROJO'
      ? 'var(--cp-rust)'
      : colorCalculado === 'NARANJA'
      ? 'var(--cp-orange)'
      : 'var(--cp-line)';
  const tFg = colorCalculado === 'ROJO' ? 'var(--cp-white)' : 'var(--cp-navy)';

  const formatoModalidad = () => {
    const mod = (comanda.modalidad || '').toUpperCase();
    if (mod === 'MESA' || mod === 'LOCAL') {
      return comanda.mesa ? `En mesa · M${comanda.mesa}` : 'En mesa';
    }
    if (mod === 'DELIVERY') return 'Delivery';
    if (mod === 'RECOGER' || mod === 'LLEVAR') return 'Para llevar';
    return comanda.modalidad || 'Para llevar';
  };

  const modalName = formatoModalidad();
  const canalTxt = comanda.canal ? `${comanda.canal}` : 'Web';
  const whoTxt = comanda.mesa
    ? `M${comanda.mesa}`
    : comanda.mozo
    ? `mozo ${comanda.mozo}`
    : 'Cliente de mostrador';

  const despejada = comanda.despejada === true;
  const faltan = areasQueFaltan(comanda);

  return (
    <div
      data-testid={`comanda-${comanda.codigo || comanda.ticket}`}
      data-despejada={despejada ? 'true' : 'false'}
      style={{
        background: despejada ? '#F3F6F4' : 'var(--cp-white)',
        border: despejada ? `1.5px solid ${VERDE_LISTO}` : '1.5px solid var(--cp-line)',
        borderRadius: '14px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        fontFamily: 'Montserrat, system-ui, sans-serif',
        boxSizing: 'border-box',
        boxShadow: '0 2px 8px rgba(11, 44, 62, 0.05)',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '16px',
            color: 'var(--cp-navy)',
          }}
        >
          {comanda.ticket || comanda.codigo}
          {comanda.cliente && (
            <span
              data-testid="comanda-cliente"
              style={{ marginLeft: 8, fontSize: '11px', fontWeight: 600, color: 'var(--cp-soft)' }}
            >
              {comanda.cliente}
            </span>
          )}
        </span>
        <span
          data-testid="indicador-tiempo"
          data-color={colorCalculado}
          style={{
            fontSize: '12px',
            fontWeight: 800,
            borderRadius: '9999px',
            padding: '2px 10px',
            background: tBg,
            color: tFg,
          }}
        >
          {minutosEnVivo} min
        </span>
      </div>

      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
        {modalName} · {canalTxt} · {whoTxt}
      </div>

      {despejada && (
        <div
          role="status"
          data-testid="aviso-area-lista"
          style={{
            border: `1.5px solid ${VERDE_LISTO}`,
            borderRadius: '10px',
            padding: '6px 8px',
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--cp-navy)',
          }}
        >
          Tu área ya está lista
          {faltan.length > 0 ? `, falta: ${faltan.join(', ')}` : ''}
        </div>
      )}

      <EstadoAreas comanda={comanda} areaActual={soloArea ? comanda.areaId : undefined} />

      <LineasComanda comanda={comanda} mostrarArea={mostrarArea} soloArea={soloArea} />

      {comanda.nota && (
        <div
          style={{
            border: '1.5px dashed var(--cp-soft)',
            borderRadius: '10px',
            padding: '6px 8px',
            fontSize: '12px',
            color: 'var(--cp-navy)',
          }}
        >
          Nota: {comanda.nota}
        </div>
      )}

      {!soloLectura && onDespejar && !despejada && (
        <button
          type="button"
          disabled={despejando}
          onClick={() => onDespejar(comanda)}
          style={{
            minHeight: '48px',
            border: 0,
            borderRadius: '12px',
            background: 'var(--cp-orange)',
            color: 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            marginTop: 'auto',
          }}
        >
          Despejar
        </button>
      )}
    </div>
  );
}
