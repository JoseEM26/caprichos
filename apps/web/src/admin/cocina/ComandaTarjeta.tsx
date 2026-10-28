import { useEffect, useState } from 'react';
import type { ColorComanda, Comanda } from './cocinaTipos';

export interface ComandaTarjetaProps {
  comanda: Comanda;
  onDespejar?: (comanda: Comanda) => void;
  despejando?: boolean;
  soloLectura?: boolean;
  mostrarArea?: boolean;
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

export function ComandaTarjeta({
  comanda,
  onDespejar,
  despejando = false,
  soloLectura = false,
  mostrarArea = true,
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

  return (
    <div
      data-testid={`comanda-${comanda.codigo || comanda.ticket}`}
      style={{
        background: 'var(--cp-white)',
        border: '1.5px solid var(--cp-line)',
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {(comanda.lineas || []).map((it, idx) => {
          const opcionesArr = (it.opciones || []).map(normalizarOpcion).filter(Boolean);
          const descPartes: string[] = [];
          if (it.tamano) descPartes.push(it.tamano);
          if (it.sabor) descPartes.push(it.sabor);
          if (opcionesArr.length > 0) descPartes.push(opcionesArr.join(' · '));
          if (it.nota) descPartes.push(it.nota);

          const desc = descPartes.join(' · ');
          const areaNombre = it.area || comanda.areaNombre || '';

          return (
            <div key={it.id || idx} style={{ display: 'flex', gap: '8px' }}>
              <span style={{ fontWeight: 800, color: 'var(--cp-navy)' }}>
                {it.cantidad}×
              </span>
              <span>
                <span style={{ fontWeight: 700, color: 'var(--cp-navy)' }}>
                  {it.nombre}
                </span>
                {mostrarArea && areaNombre && (
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
                    {areaNombre}
                  </span>
                )}
                {desc && (
                  <>
                    <br />
                    <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                      {desc}
                    </span>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>

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

      {!soloLectura && onDespejar && (
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
