import React, { useEffect, useRef, useState } from 'react';
import { ElementoPlano, MesaSalon } from '../tipos';
import { useMantenerPresionado } from '../useMantenerPresionado';
import '../salon.css';

export interface CuadriculaPlanoProps {
  columnas: number;
  filas: number;
  elementos: ElementoPlano[];
  elementoSeleccionadoId?: string | null;
  onSeleccionarElemento?: (elemento: ElementoPlano | null) => void;
  herramientaActiva?: string | null;
  onColocarElemento?: (x: number, y: number) => void;
  onMoverElemento?: (id: string, nuevoX: number, nuevoY: number) => void;
  // Modo mozo / mesas
  mesasSalon?: MesaSalon[];
  mesasSeleccionadasIds?: string[];
  onSeleccionarMesaSalon?: (mesa: MesaSalon) => void;
  modoSalon?: boolean;
  // Mantener presionada una mesa ocupada (3 s) abre Forzar liberación; solo con permiso mesas/liberar
  alMantenerMesaSalon?: (mesa: MesaSalon) => void;
  puedeForzarLiberacion?: boolean;
}

export const ESTILOS_ELEMENTOS: Record<
  string,
  { nombre: string; bg: string; bd: string; fg: string; dw: number; dh: number }
> = {
  MESA: {
    nombre: 'Mesa',
    bg: 'var(--cp-white)',
    bd: 'var(--cp-navy)',
    fg: 'var(--cp-navy)',
    dw: 2,
    dh: 2,
  },
  PARED: {
    nombre: 'Pared',
    bg: 'var(--cp-navy)',
    bd: 'var(--cp-navy)',
    fg: 'var(--cp-cream)',
    dw: 4,
    dh: 1,
  },
  COCINA: {
    nombre: 'Cocina',
    bg: '#8FA9B8',
    bd: 'var(--cp-soft)',
    fg: 'var(--cp-navy)',
    dw: 5,
    dh: 3,
  },
  BARRA: {
    nombre: 'Barra',
    bg: 'var(--cp-gold)',
    bd: 'var(--cp-rust)',
    fg: 'var(--cp-navy)',
    dw: 6,
    dh: 2,
  },
  BANO: {
    nombre: 'Baños',
    bg: 'var(--cp-line2)',
    bd: 'var(--cp-soft)',
    fg: 'var(--cp-navy)',
    dw: 3,
    dh: 3,
  },
  ENTRADA: {
    nombre: 'Entrada',
    bg: '#5DD38A',
    bd: 'var(--cp-ok)',
    fg: 'var(--cp-navy)',
    dw: 4,
    dh: 1,
  },
  ESCALERA: {
    nombre: 'Escalera',
    bg: '#F6E3C3',
    bd: 'var(--cp-rust)',
    fg: 'var(--cp-navy)',
    dw: 2,
    dh: 3,
  },
  CAJA: {
    nombre: 'Caja',
    bg: 'var(--cp-line)',
    bd: 'var(--cp-soft)',
    fg: 'var(--cp-navy)',
    dw: 3,
    dh: 2,
  },
  OTRO: {
    nombre: 'Otro',
    bg: 'var(--cp-sand)',
    bd: 'var(--cp-line)',
    fg: 'var(--cp-navy)',
    dw: 2,
    dh: 2,
  },
};

export function CuadriculaPlano({
  columnas,
  filas,
  elementos,
  elementoSeleccionadoId,
  onSeleccionarElemento,
  herramientaActiva,
  onColocarElemento,
  onMoverElemento,
  mesasSalon,
  mesasSeleccionadasIds = [],
  onSeleccionarMesaSalon,
  modoSalon = false,
  alMantenerMesaSalon,
  puedeForzarLiberacion = false,
}: CuadriculaPlanoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mantener = useMantenerPresionado<MesaSalon>((mesa) => alMantenerMesaSalon?.(mesa));

  // Estado para arrastre suave con puntero táctil o ratón
  const [arrastre, setArrastre] = useState<{
    id: string;
    inicioX: number;
    inicioY: number;
    elemX: number;
    elemY: number;
    ancho: number;
    alto: number;
    previewX: number;
    previewY: number;
    activo: boolean;
  } | null>(null);

  // Zoom: por defecto la cuadrícula cabe en el ancho disponible (celular);
  // con los botones - y + se acerca o aleja, y el lienzo se desplaza con el dedo.
  const [escalaManual, setEscalaManual] = useState<number | null>(null);
  const [anchoDisponible, setAnchoDisponible] = useState(0);
  const envolturaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = envolturaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(([entrada]) =>
      setAnchoDisponible(entrada.contentRect.width),
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const escalaAjustada =
    anchoDisponible > 0
      ? Math.min(1, Math.max(0.4, (anchoDisponible - 28) / (columnas * 38)))
      : 1;
  const escala = escalaManual ?? escalaAjustada;

  // Tamaño de celda en píxeles (base para renderizar cuadrícula)
  const celdaTamanoPx = Math.round(38 * escala);

  const anchoTotal = columnas * celdaTamanoPx;
  const altoTotal = filas * celdaTamanoPx;

  // Mapa de mesas de salón si aplica
  const mapaMesasSalon = React.useMemo(() => {
    const map = new Map<string, MesaSalon>();
    if (mesasSalon) {
      for (const m of mesasSalon) {
        map.set(m.id, m);
      }
    }
    return map;
  }, [mesasSalon]);

  const handlePointerDown = (
    e: React.PointerEvent,
    elem: ElementoPlano,
  ) => {
    if (modoSalon || herramientaActiva) return;
    e.stopPropagation();

    // Capturar puntero para no perder el seguimiento aunque el dedo salga del elemento
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setArrastre({
      id: elem.id,
      inicioX: e.clientX,
      inicioY: e.clientY,
      elemX: elem.x,
      elemY: elem.y,
      ancho: elem.ancho,
      alto: elem.alto,
      previewX: elem.x,
      previewY: elem.y,
      activo: false,
    });

    onSeleccionarElemento?.(elem);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!arrastre) return;
    const deltaPxX = e.clientX - arrastre.inicioX;
    const deltaPxY = e.clientY - arrastre.inicioY;

    // Solo activar si se movió al menos 4 píxeles (distingue click de arrastre)
    const distancia = Math.hypot(deltaPxX, deltaPxY);
    const yaActivo = arrastre.activo || distancia > 4;

    const deltaCeldasX = Math.round(deltaPxX / celdaTamanoPx);
    const deltaCeldasY = Math.round(deltaPxY / celdaTamanoPx);

    let nuevoX = arrastre.elemX + deltaCeldasX;
    let nuevoY = arrastre.elemY + deltaCeldasY;

    // Respetar estrictamente los límites del plano
    nuevoX = Math.max(0, Math.min(columnas - arrastre.ancho, nuevoX));
    nuevoY = Math.max(0, Math.min(filas - arrastre.alto, nuevoY));

    setArrastre((prev) =>
      prev
        ? {
            ...prev,
            previewX: nuevoX,
            previewY: nuevoY,
            activo: yaActivo,
          }
        : null,
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!arrastre) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignorar si ya fue liberado
    }

    if (
      arrastre.activo &&
      (arrastre.previewX !== arrastre.elemX || arrastre.previewY !== arrastre.elemY)
    ) {
      onMoverElemento?.(arrastre.id, arrastre.previewX, arrastre.previewY);
    }

    setArrastre(null);
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (herramientaActiva && onColocarElemento && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const col = Math.floor(clickX / celdaTamanoPx);
      const fil = Math.floor(clickY / celdaTamanoPx);

      if (col >= 0 && col < columnas && fil >= 0 && fil < filas) {
        onColocarElemento(col, fil);
      }
      return;
    }

    // Deseleccionar elemento si se hace clic en fondo vacío
    if (!herramientaActiva && !modoSalon) {
      onSeleccionarElemento?.(null);
    }
  };

  return (
    <div ref={envolturaRef} style={{ width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div className="salon-zoom" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <button
          type="button"
          aria-label="Alejar plano"
          disabled={escala <= 0.5}
          onClick={() => setEscalaManual(Math.max(0.5, Math.round((escala - 0.25) * 100) / 100))}
          style={{
            minHeight: '34px',
            minWidth: '34px',
            borderRadius: '9999px',
            border: '1.5px solid var(--cp-navy)',
            background: 'transparent',
            color: 'var(--cp-navy)',
            fontWeight: 800,
            cursor: escala <= 0.5 ? 'default' : 'pointer',
          }}
        >
          −
        </button>
        <span style={{ minWidth: '44px', textAlign: 'center', fontWeight: 800, fontSize: '12px', color: 'var(--cp-navy)' }}>
          {Math.round(escala * 100)}%
        </span>
        <button
          type="button"
          aria-label="Acercar plano"
          disabled={escala >= 2}
          onClick={() => setEscalaManual(Math.min(2, Math.round((escala + 0.25) * 100) / 100))}
          style={{
            minHeight: '34px',
            minWidth: '34px',
            borderRadius: '9999px',
            border: '1.5px solid var(--cp-navy)',
            background: 'transparent',
            color: 'var(--cp-navy)',
            fontWeight: 800,
            cursor: escala >= 2 ? 'default' : 'pointer',
          }}
        >
          +
        </button>
        {escalaManual !== null && (
          <button
            type="button"
            onClick={() => setEscalaManual(null)}
            style={{
              minHeight: '34px',
              padding: '0 12px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Ajustar al ancho
          </button>
        )}
      </div>
    <div
      className="salon-lienzo"
      style={{
        width: '100%',
        overflow: 'auto',
        display: 'flex',
        justifyContent: 'center',
        padding: '12px',
        background: 'var(--cp-cream)',
        borderRadius: '16px',
        border: '1px solid var(--cp-line)',
        // Tocar el fondo desplaza el lienzo; cada elemento mantiene el arrastre (ver abajo)
        touchAction: 'pan-x pan-y',
        userSelect: 'none',
      }}
    >
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        data-testid="cuadricula-plano"
        style={{
          position: 'relative',
          width: `${anchoTotal}px`,
          height: `${altoTotal}px`,
          backgroundColor: '#FFFFFF',
          backgroundImage:
            'linear-gradient(to right, var(--cp-line) 1px, transparent 1px), linear-gradient(to bottom, var(--cp-line) 1px, transparent 1px)',
          backgroundSize: `${celdaTamanoPx}px ${celdaTamanoPx}px`,
          border: '1.5px solid var(--cp-line)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(11, 44, 62, 0.05)',
          // margen automático: si la cuadrícula es más ancha, se puede desplazar hasta el borde izquierdo
          margin: 'auto',
          flex: '0 0 auto',
          cursor: herramientaActiva ? 'crosshair' : 'default',
        }}
      >
        {elementos.map((elem) => {
          const config = ESTILOS_ELEMENTOS[elem.tipo] || ESTILOS_ELEMENTOS.OTRO;
          const estaSeleccionado = elementoSeleccionadoId === elem.id;
          const estaArrastrando = arrastre?.id === elem.id;

          const posX = estaArrastrando && arrastre.activo ? arrastre.previewX : elem.x;
          const posY = estaArrastrando && arrastre.activo ? arrastre.previewY : elem.y;

          // Datos de salón si está en modo mozo
          const mesaSalon = mapaMesasSalon.get(elem.id);
          const esMesa = elem.tipo === 'MESA';
          const estaElegidaEnSalon = mesasSeleccionadasIds.includes(elem.id);

          let bg = config.bg;
          let bd = config.bd;
          let fg = config.fg;

          if (modoSalon && esMesa && mesaSalon) {
            if (estaElegidaEnSalon) {
              bg = 'var(--cp-navy)';
              fg = 'var(--cp-cream)';
              bd = 'var(--cp-navy)';
            } else if (mesaSalon.estado === 'OCUPADA') {
              bg = '#F6C9A5';
              bd = 'var(--cp-orange)';
              fg = 'var(--cp-navy)';
            } else {
              // Libre
              bg = 'var(--cp-greenbg)';
              bd = 'var(--cp-ok)';
              fg = 'var(--cp-navy)';
            }
          }

          if (estaSeleccionado && !modoSalon) {
            bd = 'var(--cp-orange)';
          }

          const tieneReserva = esMesa && mesaSalon?.reserva;
          const forzable =
            puedeForzarLiberacion && modoSalon && esMesa && mesaSalon?.estado === 'OCUPADA' && !!alMantenerMesaSalon;
          const pulsa = forzable && mesaSalon ? mantener.manejadores(mesaSalon) : null;

          return (
            <div
              key={elem.id}
              data-testid={`elemento-plano-${elem.id}`}
              className="salon-celda"
              onPointerDown={(e) => {
                handlePointerDown(e, elem);
                pulsa?.onPointerDown(e);
              }}
              onPointerUp={pulsa?.onPointerUp}
              onPointerLeave={pulsa?.onPointerLeave}
              onPointerCancel={pulsa?.onPointerCancel}
              onPointerMove={pulsa?.onPointerMove}
              onClickCapture={pulsa?.onClickCapture}
              onContextMenu={pulsa?.onContextMenu}
              onClick={(e) => {
                e.stopPropagation();
                if (modoSalon && esMesa && mesaSalon && onSeleccionarMesaSalon) {
                  onSeleccionarMesaSalon(mesaSalon);
                } else if (!herramientaActiva) {
                  onSeleccionarElemento?.(elem);
                }
              }}
              style={{
                position: 'absolute',
                left: `${posX * celdaTamanoPx}px`,
                top: `${posY * celdaTamanoPx}px`,
                width: `${elem.ancho * celdaTamanoPx}px`,
                height: `${elem.alto * celdaTamanoPx}px`,
                boxSizing: 'border-box',
                backgroundColor: bg,
                border: `${estaSeleccionado ? 2.5 : 1.5}px solid ${bd}`,
                color: fg,
                borderRadius: esMesa ? '10px' : '4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px 4px',
                fontSize: '11px',
                fontWeight: 700,
                textAlign: 'center',
                // En modo edición el elemento se arrastra con el dedo (no desplaza el lienzo)
                touchAction: modoSalon ? (forzable ? 'manipulation' : undefined) : 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
                cursor: modoSalon
                  ? esMesa
                    ? 'pointer'
                    : 'default'
                  : herramientaActiva
                  ? 'crosshair'
                  : 'grab',
                opacity: !elem.activo ? 0.45 : estaArrastrando ? 0.8 : 1,
                boxShadow: estaSeleccionado
                  ? '0 0 0 2px var(--cp-orange)'
                  : estaArrastrando
                  ? '0 8px 16px rgba(11, 44, 62, 0.2)'
                  : 'none',
                zIndex: estaArrastrando ? 20 : estaSeleccionado ? 10 : 1,
                transition: estaArrastrando
                  ? 'none'
                  : 'left 0.1s ease, top 0.1s ease, box-shadow 0.15s ease',
              }}
            >
              {/* Progreso de la pulsación prolongada */}
              {pulsa && mantener.objetivo?.id === elem.id && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: 0,
                    height: '4px',
                    width: `${Math.round(mantener.progreso * 100)}%`,
                    background: 'var(--cp-orange)',
                    borderRadius: '0 0 10px 10px',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* Marca de reserva visual "R" */}
              {tieneReserva && (
                <div
                  title={`Reservada para ${mesaSalon?.reserva?.nombre || ''} (${mesaSalon?.reserva?.personas || ''} p.)`}
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--cp-gold)',
                    color: 'var(--cp-navy)',
                    border: '1.5px solid var(--cp-white)',
                    fontSize: '10px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                  }}
                >
                  R
                </div>
              )}

              {/* Texto principal del elemento */}
              <span
                style={{
                  lineHeight: '13px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
              >
                {modoSalon && esMesa && elem.numero
                  ? elem.numero
                  : modoSalon && elem.tipo === 'PARED'
                    ? ''
                    : elem.nombre || (elem.numero ? `Mesa ${elem.numero}` : config.nombre)}
              </span>

              {/* Subtítulo: asientos o estado */}
              {esMesa && elem.asientos !== null && (
                <span
                  style={{
                    fontSize: '9px',
                    opacity: 0.85,
                    fontWeight: 600,
                    lineHeight: '11px',
                  }}
                >
                  {modoSalon && mesaSalon?.estado === 'OCUPADA' ? 'ocupada' : `${elem.asientos} pers.`}
                </span>
              )}

              {/* Mozo si está ocupada en salón */}
              {false && modoSalon && mesaSalon?.estado === 'OCUPADA' && mesaSalon?.mozo && (
                <span
                  style={{
                    fontSize: '8px',
                    opacity: 0.75,
                    lineHeight: '9px',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {mesaSalon?.mozo?.split(' ')[0]}
                </span>
              )}

              {/* Indicador de desactivado */}
              {!elem.activo && (
                <span
                  style={{
                    fontSize: '8px',
                    opacity: 0.9,
                    color: 'var(--cp-rust)',
                    fontWeight: 800,
                  }}
                >
                  Inactivo
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
}
