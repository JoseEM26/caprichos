import { useCallback, useEffect, useState } from 'react';
import { useTiempoReal } from '../../comun/socket';
import { repartosApi, ContadoresDelivery as Datos } from './repartosApi';

/** Respaldo ligero: recarga cada 45 s aunque el socket no avise (pantalla de despacho encendida todo el día). */
export const RESPALDO_CONTADORES_MS = 45_000;

/** Contadores del delivery; se recalculan solos con los eventos de cocina y de reparto, sin recargar la pantalla. */
export function useContadoresDelivery(): Datos | null {
  const [datos, setDatos] = useState<Datos | null>(null);
  const cargar = useCallback(() => {
    repartosApi.contadoresDelivery().then(setDatos).catch(() => undefined); // si falla se conserva lo último
  }, []);
  useEffect(() => {
    cargar();
    const cada = setInterval(cargar, RESPALDO_CONTADORES_MS);
    return () => clearInterval(cada);
  }, [cargar]);
  // cocina marca listo/despeja → pedido:estado; entra pedido → pedido:nuevo; toma/salida/entrega → pedido:estado y reparto:rutas
  useTiempoReal(['pedido:estado', 'pedido:nuevo', 'pedido:progreso', 'cocina:comanda', 'reparto:rutas', 'reparto:incidente'], cargar);
  return datos;
}

const chip = (destacado: boolean) => ({
  flex: '1 1 140px',
  minHeight: 56,
  boxSizing: 'border-box' as const,
  display: 'flex',
  flexDirection: 'column' as const,
  justifyContent: 'center',
  padding: '6px 12px',
  borderRadius: 12,
  border: `1.5px solid ${destacado ? 'var(--cp-navy, #0B2C3E)' : 'var(--cp-line, #E3D6C6)'}`,
  background: destacado ? 'var(--cp-navy, #0B2C3E)' : 'var(--cp-cream, #FBF4EC)',
  color: destacado ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
});

export function ContadoresDeliveryChips({ datos }: { datos: Datos | null }) {
  const d = datos ?? { enCocina: 0, listos: 0, enCamino: 0, pendientes: 0, entregadosHoy: 0 };
  const items: Array<[string, number, string, boolean]> = [
    ['Pendientes', d.pendientes, 'contador-pendientes', true],
    ['En cocina', d.enCocina, 'contador-en-cocina', false],
    ['Listos para repartir', d.listos, 'contador-listos', false],
    ['En camino', d.enCamino, 'contador-en-camino', false],
    ['Entregados hoy', d.entregadosHoy, 'contador-entregados', false],
  ];
  return (
    <div role="group" aria-label="Contadores del delivery" data-testid="contadores-delivery" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map(([texto, n, id, destacado]) => (
        <div key={id} data-testid={id} role="status" aria-live="polite" aria-label={`${texto}: ${n}`} style={chip(destacado)}>
          <span style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.1, color: destacado ? 'var(--cp-gold, #D99E39)' : id === 'contador-listos' && n > 0 ? 'var(--cp-orange, #E67929)' : undefined }}>{n}</span>
          <span style={{ fontSize: 12, fontWeight: 800 }}>{texto}</span>
        </div>
      ))}
    </div>
  );
}
