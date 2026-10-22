import { useEffect, useState } from 'react';
import type { ColorComanda, Comanda } from './cocinaTipos';
import { Boton } from '../../comun/Boton';

export interface ComandaTarjetaProps {
  comanda: Comanda;
  onDespejar?: (comanda: Comanda) => void;
  despejando?: boolean;
  soloLectura?: boolean;
}

export function obtenerColorMinutos(minutos: number): ColorComanda {
  if (minutos >= 50) return 'ROJO';
  if (minutos >= 35) return 'NARANJA';
  return 'VERDE';
}

export function ComandaTarjeta({
  comanda,
  onDespejar,
  despejando = false,
  soloLectura = false,
}: ComandaTarjetaProps) {
  // Cronómetro reactivo en vivo: recalcula cada 15 segundos
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

  // Si la comanda trae color del servidor o lo calculamos según DT-69 (35 retraso, 50 crítico)
  const colorRaw = comanda.color || comanda.colorEspera;
  const colorCalculado: ColorComanda = colorRaw
    ? (colorRaw.toUpperCase() as ColorComanda)
    : obtenerColorMinutos(minutosEnVivo);

  const estiloColor = (() => {
    switch (colorCalculado) {
      case 'ROJO':
        return {
          bg: '#FDE8E8',
          fg: '#C93B2B',
          borde: '#F8B4B4',
          label: 'crítico',
        };
      case 'NARANJA':
        return {
          bg: '#FFF0E6',
          fg: '#B2500F',
          borde: '#FBD38D',
          label: 'retraso',
        };
      case 'VERDE':
      default:
        return {
          bg: '#E6F4EA',
          fg: '#2F7A45',
          borde: '#A3D9A5',
          label: 'ideal',
        };
    }
  })();

  const formatoModalidad = () => {
    const mod = (comanda.modalidad || '').toUpperCase();
    if (mod === 'MESA') {
      return comanda.mesa ? `Mesa ${comanda.mesa}` : 'En mesa';
    }
    if (mod === 'DELIVERY') return 'Delivery';
    if (mod === 'RECOGER') return 'Para recoger';
    return mod;
  };

  return (
    <article
      data-testid={`comanda-${comanda.codigo}`}
      style={{
        background: soloLectura ? 'var(--cp-cream)' : 'var(--cp-white)',
        color: 'var(--cp-navy)',
        border: soloLectura ? '2px solid var(--cp-gold)' : '1px solid var(--cp-line)',
        borderRadius: '14px',
        padding: soloLectura ? '16px' : '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: soloLectura
          ? '0 6px 20px rgba(0,0,0,0.25)'
          : '0 2px 8px rgba(11, 44, 62, 0.05)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Cabecera de la comanda: Código + Cronómetro */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: soloLectura ? '22px' : '18px',
            letterSpacing: '0.02em',
            color: 'var(--cp-navy)',
          }}
        >
          {comanda.ticket || comanda.codigo}
        </span>

        <span
          data-testid="indicador-tiempo"
          data-color={colorCalculado}
          style={{
            fontSize: soloLectura ? '15px' : '13px',
            fontWeight: 800,
            borderRadius: '9999px',
            padding: soloLectura ? '4px 12px' : '2px 10px',
            background: estiloColor.bg,
            color: estiloColor.fg,
            border: `1.5px solid ${estiloColor.borde}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {minutosEnVivo} min
        </span>
      </div>

      {/* Metadatos operativos: Canal, Modalidad, Mesa (NUNCA teléfono ni dirección DT-81) */}
      <div
        style={{
          fontSize: soloLectura ? '14px' : '12px',
          color: 'var(--cp-soft)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          alignItems: 'center',
          fontWeight: 600,
        }}
      >
        <span style={{ fontWeight: 800, color: 'var(--cp-rust)' }}>
          {formatoModalidad()}
        </span>
        {comanda.canal && <span>· Canal {comanda.canal}</span>}
        {comanda.areaNombre && <span>· {comanda.areaNombre}</span>}
      </div>

      {/* Lista de productos / líneas */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginTop: '2px',
          borderTop: '1px solid var(--cp-line)',
          paddingTop: '8px',
        }}
      >
        {comanda.lineas.map((linea, idx) => (
          <div
            key={linea.id || idx}
            style={{
              display: 'flex',
              gap: '8px',
              fontSize: soloLectura ? '16px' : '13px',
              lineHeight: soloLectura ? '22px' : '18px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: soloLectura ? '17px' : '14px',
                color: 'var(--cp-navy)',
                flexShrink: 0,
              }}
            >
              {linea.cantidad}×
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
              <div>
                <span style={{ fontWeight: 700 }}>{linea.nombre}</span>
                {linea.tamano && (
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--cp-soft)',
                      marginLeft: '6px',
                    }}
                  >
                    ({linea.tamano})
                  </span>
                )}
                {linea.sabor && (
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--cp-soft)',
                      marginLeft: '6px',
                    }}
                  >
                    - {linea.sabor}
                  </span>
                )}
              </div>

              {(linea.combo || linea.combo_nombre) && (
                <div style={{ fontSize: '12px', color: 'var(--cp-rust)', fontWeight: 700 }}>
                  Parte de: {linea.combo || linea.combo_nombre}
                </div>
              )}

              {linea.opciones && linea.opciones.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                  {linea.opciones
                    .map((op: any) =>
                      typeof op === 'string'
                        ? op
                        : op?.nombre || op?.opcion_nombre || '',
                    )
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}

              {linea.personas && linea.personas.length > 0 && (
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--cp-navy)',
                    fontWeight: 600,
                  }}
                >
                  Para: {linea.personas.join(', ')}
                </div>
              )}

              {linea.nota && (
                <div
                  style={{
                    marginTop: '2px',
                    border: '1.5px dashed var(--cp-rust)',
                    borderRadius: '8px',
                    padding: '3px 6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: '#FFF8F4',
                    color: 'var(--cp-rust)',
                  }}
                >
                  Nota: {linea.nota}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Nota general del pedido si existe */}
      {comanda.nota && (
        <div
          style={{
            border: '1.5px dashed var(--cp-soft)',
            borderRadius: '8px',
            padding: '6px 8px',
            fontSize: soloLectura ? '14px' : '12px',
            fontWeight: 700,
            background: 'var(--cp-sand)',
            color: 'var(--cp-navy)',
          }}
        >
          Nota del pedido: {comanda.nota}
        </div>
      )}

      {/* Botón único de acción: Despejar (solo en modo interactivo, nunca en solo lectura) */}
      {!soloLectura && onDespejar && (
        <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
          <Boton
            variante="primario"
            cargando={despejando}
            onClick={() => onDespejar(comanda)}
            style={{
              width: '100%',
              minHeight: '44px',
              borderRadius: '12px',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '14px',
              border: 'none',
            }}
          >
            Despejar
          </Boton>
        </div>
      )}
    </article>
  );
}
