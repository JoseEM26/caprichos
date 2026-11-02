import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { ColorComanda, Comanda, LineaComanda } from './cocinaTipos';
import { duracionLegible } from '../../comun/tiempoLegible';

/** Tiempo para deshacer un «completa» (la línea vuelve a 0) antes de que el botón desaparezca. */
export const SEGUNDOS_DESHACER = 5;

export interface ComandaTarjetaProps {
  comanda: Comanda;
  onDespejar?: (comanda: Comanda) => void;
  despejando?: boolean;
  soloLectura?: boolean;
  mostrarArea?: boolean;
  /** Vista de un área: la boleta muestra solo las líneas de esa área y resalta su casilla. */
  soloArea?: boolean;
  /** Vista de un área: cada toque en la casilla de una línea suma una unidad lista. */
  alMarcarUnidades?: (linea: LineaComanda, listas: number) => void;
  /** Vista Todas, con permiso cocina/despachar: botones de despachar por línea y de despachar todo. */
  puedeDespachar?: boolean;
  alDespacharLinea?: (linea: LineaComanda, unidades: number) => void;
  alDespacharTodo?: (comanda: Comanda) => void;
  /** La última unidad acaba de despejar el área: la tarjeta queda en verde con «Deshacer» un rato. */
  alDeshacerSalida?: () => void;
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

/** Texto oculto a la vista y leído por lectores de pantalla: la opción es la menos pedida de su grupo. */
const sinVista: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

/**
 * Tamaño, sabor, opciones y nota de la línea. Una opción «menos pedida» va más oscura, en negrita y con
 * fondo y borde de acento; las demás van normales.
 */
function DescripcionLinea({ it }: { it: LineaComanda }) {
  const opciones = (it.opciones || []).filter((o) => normalizarOpcion(o));
  const partes: ReactNode[] = [];
  if (it.tamano) partes.push(<span key="tamano">{it.tamano}</span>);
  if (it.sabor) partes.push(<span key="sabor">{it.sabor}</span>);
  opciones.forEach((o, i) => {
    const texto = normalizarOpcion(o);
    const destacada = typeof o === 'object' && o !== null && o.pocoPedida === true;
    partes.push(
      destacada ? (
        <span
          key={`op-${i}`}
          data-testid="opcion-poco-pedida"
          title="Poco pedida: la opción que menos se eligió en su grupo (últimos 30 días)"
          style={{
            fontWeight: 800,
            color: 'var(--cp-navy)',
            background: 'var(--cp-cream)',
            border: '1.5px solid var(--cp-rust, #B2500F)',
            borderRadius: '6px',
            padding: '0 5px',
          }}
        >
          {texto}
          <span style={sinVista}> (poco pedida)</span>
        </span>
      ) : (
        <span key={`op-${i}`}>{texto}</span>
      ),
    );
  });
  if (it.nota)
    partes.push(
      <span
        key="nota"
        data-testid="linea-nota"
        style={{
          fontWeight: 700,
          color: 'var(--cp-navy)',
          background: '#FFF3C4',
          padding: '0 4px',
          borderRadius: '4px',
        }}
      >
        {it.nota}
      </span>,
    );

  if (partes.length === 0) return null;
  return (
    <>
      <br />
      <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
        {partes.map((p, i) => (
          <span key={i}>
            {i > 0 && ' · '}
            {p}
          </span>
        ))}
      </span>
    </>
  );
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

/** Casilla de 44 px por unidad: vacía, con el avance o con check verde cuando está completa. */
function CasillaUnidad({ listas, cantidad }: { listas: number; cantidad: number }) {
  const completa = listas >= cantidad;
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        border: `2px solid ${completa ? VERDE_LISTO : 'var(--cp-soft)'}`,
        background: completa ? VERDE_LISTO : 'var(--cp-white)',
        color: completa ? '#FFFFFF' : 'var(--cp-navy)',
        fontWeight: 800,
        fontSize: '12px',
      }}
    >
      {completa ? (
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M3.5 8.5l3 3 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        listas
      )}
    </span>
  );
}

interface MarcarLinea {
  onTocar: () => void;
}

interface DespachoLinea {
  onDespachar: (unidades: number) => void;
}

function LineaFila({
  it,
  etiquetaArea,
  listo,
  marcar,
  despacho,
}: {
  it: LineaComanda;
  etiquetaArea?: string;
  listo?: boolean;
  marcar?: MarcarLinea;
  despacho?: DespachoLinea;
}) {
  const listas = it.listas ?? (listo ? it.cantidad : 0);
  const despachadas = it.despachadas ?? 0;
  const completa = listas >= it.cantidad;
  const todoDespachado = it.cantidad > 0 && despachadas >= it.cantidad;
  const pendientesDespacho = Math.max(0, listas - despachadas);
  const atenuada = completa;

  return (
    <div
      data-testid={`linea-${it.id}`}
      data-completa={completa ? 'true' : 'false'}
      style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', opacity: atenuada || todoDespachado ? 0.6 : 1 }}
    >
      {marcar && (
        <button
          type="button"
          onClick={marcar.onTocar}
          aria-label={
            completa
              ? `${it.nombre}: ${listas} de ${it.cantidad} listas. Tocar para volver a pendiente`
              : `${it.nombre}: ${listas} de ${it.cantidad} listas. Tocar para sumar una lista`
          }
          style={{
            minWidth: '44px',
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 0,
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <CasillaUnidad listas={listas} cantidad={it.cantidad} />
        </button>
      )}
      <span style={{ fontWeight: 800, color: 'var(--cp-navy)' }}>{it.cantidad}×</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontWeight: 700,
            color: todoDespachado ? 'var(--cp-soft)' : 'var(--cp-navy)',
            textDecoration: todoDespachado ? 'line-through' : undefined,
          }}
        >
          {it.nombre}
        </span>
        {it.cantidad > 1 && !todoDespachado && (
          <span
            data-testid="unidades-linea"
            style={{
              fontSize: '12px',
              fontWeight: 700,
              border: '1px solid var(--cp-soft)',
              borderRadius: '9999px',
              padding: '0 6px',
              color: 'var(--cp-navy)',
              marginLeft: '6px',
            }}
          >
            {`${listas} de ${it.cantidad}`}
          </span>
        )}
        {despachadas > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 700,
              color: todoDespachado ? VERDE_LISTO : 'var(--cp-soft)',
              marginLeft: '6px',
            }}
          >
            {todoDespachado && (
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16">
                <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {todoDespachado ? 'Despachado' : `${despachadas} de ${it.cantidad} despachados`}
          </span>
        )}
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
        <DescripcionLinea it={it} />
      </span>
      {despacho && pendientesDespacho > 0 && (
        <button
          type="button"
          onClick={() => despacho.onDespachar(pendientesDespacho)}
          aria-label={`Despachar ${pendientesDespacho} de ${it.nombre}`}
          style={{
            minHeight: '44px',
            minWidth: '44px',
            padding: '0 12px',
            border: 0,
            borderRadius: '10px',
            background: 'var(--cp-navy)',
            color: 'var(--cp-white)',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Despachar
        </button>
      )}
      {!marcar && listo !== undefined && <IconoListo listo={listo} />}
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
 * Un toque en la casilla: suma una unidad. Si la línea ya está completa, vuelve a lo que ya salió
 * (0 si nada salió; si ya despachó algo, eso queda). Quien la llama muestra «Deshacer».
 */
function tocarLinea(it: LineaComanda, alMarcar: (linea: LineaComanda, listas: number) => void) {
  const listas = it.listas ?? 0;
  if (listas >= it.cantidad) alMarcar(it, it.despachadas ?? 0);
  else alMarcar(it, listas + 1);
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
  alMarcarUnidades,
  alDespacharLinea,
}: {
  comanda: Comanda;
  mostrarArea?: boolean;
  soloArea?: boolean;
  alMarcarUnidades?: (linea: LineaComanda, listas: number) => void;
  alDespacharLinea?: (linea: LineaComanda, unidades: number) => void;
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
            marcar={
              alMarcarUnidades && !comanda.despejada
                ? { onTocar: () => tocarLinea(it, alMarcarUnidades) }
                : undefined
            }
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
            <LineaFila
              key={it.id || idx}
              it={it}
              listo={area.despejada}
              despacho={
                alDespacharLinea ? { onDespachar: (unidades) => alDespacharLinea(it, unidades) } : undefined
              }
            />
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
  alMarcarUnidades,
  puedeDespachar = false,
  alDespacharLinea,
  alDespacharTodo,
  alDeshacerSalida,
}: ComandaTarjetaProps) {
  // Última línea que se completó: se puede deshacer unos segundos (vuelve a su cantidad anterior)
  const [deshacer, setDeshacer] = useState<{ linea: LineaComanda; previas: number } | null>(null);
  useEffect(() => {
    if (!deshacer) return;
    const t = setTimeout(() => setDeshacer(null), SEGUNDOS_DESHACER * 1000);
    return () => clearTimeout(t);
  }, [deshacer]);

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
          gap: '8px',
        }}
      >
        {comanda.cliente ? (
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span
              data-testid="comanda-cliente"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '20px',
                lineHeight: '24px',
                color: 'var(--cp-navy)',
                overflowWrap: 'anywhere',
              }}
            >
              {comanda.cliente}
            </span>
            <span
              data-testid="comanda-codigo"
              style={{ fontSize: '11px', fontWeight: 600, color: 'var(--cp-soft)' }}
            >
              {comanda.ticket || comanda.codigo}
            </span>
          </span>
        ) : (
          <span
            data-testid="comanda-codigo"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '16px',
              color: 'var(--cp-navy)',
            }}
          >
            {comanda.ticket || comanda.codigo}
          </span>
        )}
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
            flexShrink: 0,
          }}
        >
          {duracionLegible(minutosEnVivo)}
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

      {despejada && alDeshacerSalida && (
        <div
          role="status"
          data-testid="deshacer-salida"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            border: '1.5px solid var(--cp-soft)',
            borderRadius: '10px',
            padding: '4px 8px',
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--cp-navy)',
          }}
        >
          <span>Sale de la pantalla en unos segundos</span>
          <button
            type="button"
            onClick={alDeshacerSalida}
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: '0 12px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '10px',
              background: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Deshacer
          </button>
        </div>
      )}

      <EstadoAreas comanda={comanda} areaActual={soloArea ? comanda.areaId : undefined} />

      {deshacer && alMarcarUnidades && (
        <div
          role="status"
          data-testid="deshacer-unidades"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            border: '1.5px solid var(--cp-soft)',
            borderRadius: '10px',
            padding: '4px 8px',
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--cp-navy)',
          }}
        >
          <span>{`${deshacer.linea.nombre}: vuelve a pendiente`}</span>
          <button
            type="button"
            onClick={() => {
              alMarcarUnidades(deshacer.linea, deshacer.previas);
              setDeshacer(null);
            }}
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: '0 12px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '10px',
              background: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Deshacer
          </button>
        </div>
      )}

      {comanda.nota && (
        <div
          data-testid="comanda-nota"
          style={{
            background: '#FFF3C4',
            border: '2px solid #D99E39',
            borderRadius: '10px',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cp-navy)' }}>NOTA DEL CLIENTE</span>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--cp-navy)', overflowWrap: 'anywhere' }}>
            {comanda.nota}
          </span>
        </div>
      )}

      <LineasComanda
        comanda={comanda}
        mostrarArea={mostrarArea}
        soloArea={soloArea}
        alMarcarUnidades={
          alMarcarUnidades
            ? (linea, listas) => {
                const previas = linea.listas ?? 0;
                // Una línea completa que vuelve a pendiente se puede deshacer unos segundos
                if (previas >= linea.cantidad && listas < previas) setDeshacer({ linea, previas });
                alMarcarUnidades(linea, listas);
              }
            : undefined
        }
        alDespacharLinea={puedeDespachar && comanda.modalidad?.toUpperCase() !== 'DELIVERY' ? alDespacharLinea : undefined}
      />

      {puedeDespachar &&
        alDespacharTodo &&
        comanda.modalidad?.toUpperCase() !== 'DELIVERY' &&
        (comanda.areas ?? []).some((a) => a.lineas.some((l) => (l.listas ?? 0) > (l.despachadas ?? 0))) && (
          <button
            type="button"
            onClick={() => alDespacharTodo(comanda)}
            style={{
              minHeight: '44px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '12px',
              background: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Despachar todo lo listo
          </button>
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
          Listo
        </button>
      )}
    </div>
  );
}
