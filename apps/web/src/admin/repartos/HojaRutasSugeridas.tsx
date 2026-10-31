import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { ErrorApi } from '../../comun/api';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { colorOpcion } from './OpcionesRutaSugerida';
import { OpcionRutaSugerida, RespuestaRutasSugeridas, repartosApi } from './repartosApi';

export type AlturaRutas = 'plegada' | 'media';

/** Alto de la tira plegada: asa y botones (44 px) más una fila de chips (44 px) y un respiro. */
export const ALTO_PLEGADA_PX = 96;
/** Fracción del alto de la pantalla que ocupa la hoja a media altura. */
export const FRACCION_MEDIA = 0.4;
/** Cuánto hay que arrastrar el asa para cambiar de altura. */
const UMBRAL_ALTURA_PX = 40;

const sinMovimiento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const botonChico: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 12,
  border: '1.5px solid var(--cp-line)',
  background: 'var(--cp-cream)',
  color: 'var(--cp-navy)',
  fontFamily: 'var(--fuente-titulos)',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
  flexShrink: 0,
};

interface Props {
  datos: RespuestaRutasSugeridas | null;
  cargando: boolean;
  error: string | null;
  alReintentar: () => void;
  seleccionadaId: string | null;
  alSeleccionar: (id: string | null) => void;
  altura: AlturaRutas;
  alCambiarAltura: (a: AlturaRutas) => void;
  alCerrar: () => void;
  alVerTodo: () => void;
  /** Se llama tras tomar la ruta o tras un 409 (para recargar). */
  alCambiar: () => void;
  /** Se llama solo cuando la ruta quedó tomada. */
  alTomada: () => void;
  /** Lo que ocupa la barra inferior fija, para que la hoja quede sobre ella. */
  desdeAbajo: string;
}

/**
 * Hoja de rutas sugeridas con tres alturas: cerrada, plegada (tira de chips) y media (paradas y Tomar).
 * Es una caja pegada abajo del tamaño de su contenido: no hay fondo ni capa que cubra el mapa, que sigue
 * recibiendo arrastre y zoom. Quien la usa la pliega al tocar el mapa.
 */
export function HojaRutasSugeridas({
  datos, cargando, error, alReintentar, seleccionadaId, alSeleccionar, altura, alCambiarAltura,
  alCerrar, alVerTodo, alCambiar, alTomada, desdeAbajo,
}: Props) {
  const [porTomar, setPorTomar] = useState<OpcionRutaSugerida | null>(null);
  const [tomando, setTomando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const inicioY = useRef<number | null>(null);
  const arrastrado = useRef(false);

  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    document.addEventListener('keydown', alTecla);
    return () => document.removeEventListener('keydown', alTecla);
  }, [alCerrar]);

  const opciones = datos?.opciones ?? [];
  const indice = opciones.findIndex((o) => o.id === seleccionadaId);
  const elegida = indice >= 0 ? opciones[indice] : null;

  const alternar = () => alCambiarAltura(altura === 'media' ? 'plegada' : 'media');

  const alBajar = (e: PointerEvent<HTMLButtonElement>) => {
    inicioY.current = e.clientY;
    arrastrado.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const alSoltar = (e: PointerEvent<HTMLButtonElement>) => {
    if (inicioY.current == null) return;
    const dy = e.clientY - inicioY.current;
    inicioY.current = null;
    if (Math.abs(dy) < UMBRAL_ALTURA_PX) return;
    // El click que sigue a un arrastre no debe alternar otra vez
    arrastrado.current = true;
    if (dy < 0) alCambiarAltura('media');
    else if (altura === 'media') alCambiarAltura('plegada');
    else alCerrar();
  };

  const tomar = async () => {
    if (!porTomar || tomando) return;
    setTomando(true);
    try {
      await repartosApi.tomarRutaSugerida(porTomar);
      alTomada();
      alSeleccionar(null);
    } catch (err: any) {
      if (err instanceof ErrorApi && err.codigo === 'RUTA_YA_TOMADA') {
        setAviso('Otro repartidor tomó parte de esta ruta; actualizamos las opciones');
        alSeleccionar(null);
      } else {
        setAviso(err instanceof ErrorApi && err.message ? err.message : 'No se pudo tomar la ruta');
      }
    } finally {
      setTomando(false);
      setPorTomar(null);
      alCambiar();
    }
  };

  let tira;
  if (cargando && !datos) tira = <Cargando mensaje="Calculando rutas sugeridas..." />;
  else if (error && !datos) tira = <EstadoError mensaje={error} alReintentar={alReintentar} />;
  else if (opciones.length === 0)
    tira = (
      <p data-testid="rutas-vacio" style={{ margin: 0, fontSize: 14, color: 'var(--cp-soft)' }}>
        {datos && datos.cupo <= 0 && datos.sinUbicacion.length === 0
          ? 'Ya llevas el máximo de pedidos: entrega alguno antes de tomar otra ruta'
          : 'No hay pedidos listos para repartir'}
      </p>
    );
  else
    tira = (
      <div
        data-testid="chips-rutas"
        style={{ display: 'flex', gap: 8, overflowX: 'auto', touchAction: 'pan-x', overscrollBehavior: 'contain', paddingBottom: 2 }}
      >
        {opciones.map((o, i) => {
          const color = colorOpcion(i);
          const activa = o.id === seleccionadaId;
          return (
            <button
              key={o.id}
              type="button"
              data-testid={`chip-ruta-${o.id}`}
              aria-pressed={activa}
              aria-label={`Ruta ${i + 1}, ${o.sector}, ${o.pedidos.length} pedidos, ${o.distanciaKm} kilómetros`}
              onClick={() => {
                alSeleccionar(o.id);
                alCambiarAltura('media');
              }}
              style={{
                ...botonChico,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
                background: activa ? 'var(--cp-white)' : 'var(--cp-cream)',
                border: activa ? `2.5px solid ${color}` : '1.5px solid var(--cp-line)',
              }}
            >
              <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
              Ruta {i + 1} · {o.sector} · {o.pedidos.length} {o.pedidos.length === 1 ? 'pedido' : 'pedidos'} · {o.distanciaKm} km
            </button>
          );
        })}
      </div>
    );

  const media = altura === 'media';

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label="Rutas sugeridas"
      data-testid="hoja-rutas"
      data-altura={altura}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: desdeAbajo,
        height: media ? `${FRACCION_MEDIA * 100}%` : ALTO_PLEGADA_PX,
        zIndex: 900,
        background: 'var(--cp-white)',
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -6px 24px rgba(11,44,62,.3)',
        display: 'flex',
        flexDirection: 'column',
        transition: sinMovimiento() ? 'none' : 'height .2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px 0 8px', flexShrink: 0 }}>
        <button
          type="button"
          data-testid="hoja-rutas-asa"
          aria-label={media ? 'Plegar rutas sugeridas' : 'Ampliar rutas sugeridas'}
          aria-expanded={media}
          onPointerDown={alBajar}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
          onClick={() => {
            if (arrastrado.current) arrastrado.current = false;
            else alternar();
          }}
          style={{
            flex: 1,
            minHeight: 44,
            border: 'none',
            background: 'transparent',
            touchAction: 'none',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span aria-hidden="true" style={{ width: 44, height: 5, borderRadius: 3, background: 'var(--cp-line2)' }} />
        </button>
        <button type="button" data-testid="btn-ver-todo" onClick={alVerTodo} aria-label="Ver todas las rutas en el mapa" style={botonChico}>
          Ver todo
        </button>
        <button type="button" onClick={alCerrar} aria-label="Cerrar rutas sugeridas" style={botonChico}>
          Cerrar
        </button>
      </div>
      <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>{tira}</div>

      {media && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 16px 16px', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {aviso && (
            <div role="status" data-testid="aviso-rutas" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-navy)' }}>
              {aviso}
            </div>
          )}
          {datos && datos.sinUbicacion.length > 0 && (
            <div data-testid="rutas-sin-ubicacion" style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
              Sin ubicación (Caja debe ubicarlos): {datos.sinUbicacion.map((s) => s.codigo).join(', ')}
            </div>
          )}
          {elegida ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--cp-navy)' }}>
                <strong>{elegida.tiempoMin} min</strong> · {elegida.razon}
                {elegida.urgente && <strong style={{ color: 'var(--cp-rust)' }}> · Urgente</strong>}
              </div>
              <ol data-testid="paradas-ruta" style={{ margin: 0, paddingLeft: 22, fontSize: 14 }}>
                {elegida.pedidos.map((p) => (
                  <li key={p.id}>
                    {p.codigo} · {p.cliente}
                    <span style={{ color: p.retrasoMin > 0 ? 'var(--cp-rust)' : 'var(--cp-soft)' }}>
                      {' '}· llega en {p.llegadaMin} min{p.retrasoMin > 0 ? ` (${p.retrasoMin} min tarde)` : ''}
                    </span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                disabled={tomando}
                onClick={() => setPorTomar(elegida)}
                style={{ minHeight: 44, borderRadius: 12, border: 'none', background: colorOpcion(indice), color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
              >
                Tomar esta ruta
              </button>
            </>
          ) : (
            opciones.length > 0 && <p style={{ margin: 0, fontSize: 14, color: 'var(--cp-soft)' }}>Toca una ruta (aquí o en el mapa) para ver sus paradas.</p>
          )}
        </div>
      )}

      <Confirmar
        abierto={!!porTomar}
        titulo="¿Tomar esta ruta?"
        mensaje={porTomar ? `Quedarán asignados ${porTomar.pedidos.length} pedidos y nadie más podrá tomarlos:` : ''}
        textoSi="Sí, tomar la ruta"
        textoNo="No"
        cargando={tomando}
        alConfirmar={tomar}
        alCancelar={() => setPorTomar(null)}
      >
        {porTomar && (
          <ul data-testid="confirmar-pedidos-ruta" style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
            {porTomar.pedidos.map((p) => (
              <li key={p.id}>{p.codigo} · {p.cliente}</li>
            ))}
          </ul>
        )}
      </Confirmar>
    </section>
  );
}
