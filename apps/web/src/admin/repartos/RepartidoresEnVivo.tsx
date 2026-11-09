import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../comun/api';
import { useEventos, useSocketConectado } from '../../comun/socket';
import { MapaRepartidoresVivo } from './MapaRepartidoresVivo';
import { frescuraDe, UbicacionVivo } from './frescuraUbicacion';

const REFRESCO_MS = 30_000;
const hora = (t: number) => new Date(t).toLocaleTimeString('es-PE', { hour12: false });

interface EventoUbicacion {
  repartidorId: string;
  nombre: string;
  lat: number;
  lng: number;
  precision?: number;
  en: string;
  pedidos: string[];
}

/** Capa «🛵 Repartidores en vivo»: solo para quien tiene repartos/ver_ubicacion (nunca clientes ni otros roles). */
/** `esperados`: repartidores con pedidos en camino (del panel); los que no tienen posición vigente salen como «Sin ubicación». */
export function RepartidoresEnVivo({ esperados = [] }: { esperados?: Array<{ id: string; nombre: string }> }) {
  const [lista, setLista] = useState<UbicacionVivo[]>([]);
  const [ahora, setAhora] = useState(() => Date.now());
  const [actualizado, setActualizado] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [elegido, setElegido] = useState<string | null>(null);
  const [seguir, setSeguir] = useState<string | null>(null);
  const [centrar, setCentrar] = useState(0);
  const conectado = useSocketConectado();
  const listaRef = useRef(lista);
  listaRef.current = lista;

  const cargar = useCallback(() => {
    api
      .get<UbicacionVivo[]>('/admin/repartos/ubicaciones')
      .then((r) => {
        setLista(r);
        setActualizado(Date.now());
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(t);
  }, [cargar]);

  // Reloj para «hace N s» y colores de frescura
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const alLlegar = useCallback((e: EventoUbicacion) => {
    setLista((prev) => {
      const previo = prev.find((x) => x.repartidorId === e.repartidorId);
      const nuevo: UbicacionVivo = {
        telefono: previo?.telefono ?? null,
        ...previo,
        repartidorId: e.repartidorId,
        nombre: e.nombre,
        lat: e.lat,
        lng: e.lng,
        precision: e.precision,
        en: e.en,
        pedidos: e.pedidos.map((codigo) => previo?.pedidos.find((p) => p.codigo === codigo) ?? { codigo, etapa: 'EN_CAMINO' }),
      };
      return previo ? prev.map((x) => (x.repartidorId === e.repartidorId ? nuevo : x)) : [...prev, nuevo];
    });
    setActualizado(Date.now());
    // Repartidor nuevo en el mapa: trae su teléfono y destinos
    if (!listaRef.current.some((x) => x.repartidorId === e.repartidorId)) cargar();
  }, [cargar]);
  useEventos<EventoUbicacion>('reparto:ubicacion', alLlegar);

  const visibles = lista.filter((r) => frescuraDe(r.en, ahora).clave !== 'SIN_SENAL');
  const sinUbicacion = esperados.filter((e) => !visibles.some((v) => v.repartidorId === e.id));
  const sel = visibles.find((r) => r.repartidorId === elegido) ?? null;

  return (
    <section aria-label="Repartidores en vivo" data-testid="repartidores-en-vivo" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div role="status" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: conectado && !error ? 'var(--cp-green, #2F7A45)' : 'var(--cp-rust, #B2500F)' }}>
        <span>🛵 {conectado && !error ? 'En vivo' : 'Reconectando…'} · actualizado {actualizado ? hora(actualizado) : '--:--:--'}</span>
        <button type="button" onClick={() => setCentrar((c) => c + 1)} style={botonSec}>Centrar en todos</button>
        {seguir && <button type="button" onClick={() => setSeguir(null)} style={botonSec}>Dejar de seguir</button>}
      </div>

      <div style={{ position: 'relative', height: 'min(60vh, 560px)', border: '1.5px solid var(--cp-line, #E3D6C6)', borderRadius: 12, overflow: 'hidden' }}>
        <MapaRepartidoresVivo repartidores={visibles} ahora={ahora} seleccionadoId={elegido} seguirId={seguir} centrarClave={centrar} onSeleccionar={(id) => setElegido((p) => (p === id ? null : id))} />
        {visibles.length === 0 && (
          <p style={{ position: 'absolute', left: 8, right: 8, top: 8, margin: 0, padding: '6px 10px', background: 'var(--cp-cream, #FBF4EC)', borderRadius: 8, fontSize: 13, color: 'var(--cp-navy, #0B2C3E)', zIndex: 500 }}>
            Ningún repartidor comparte su ubicación ahora.
          </p>
        )}
      </div>

      {sel && (
        <div data-testid="tarjeta-repartidor-vivo" style={{ background: '#fff', border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: 12, padding: 12, color: 'var(--cp-navy, #0B2C3E)' }}>
          <strong style={{ fontSize: 16 }}>{sel.nombre}</strong>
          <div style={{ fontSize: 13, color: frescuraDe(sel.en, ahora).color, fontWeight: 800 }}>{frescuraDe(sel.en, ahora).texto}</div>
          <ul style={{ margin: '6px 0', paddingLeft: 18, fontSize: 13 }}>
            {sel.pedidos.map((p) => (
              <li key={p.codigo}>{p.codigo} · {p.etapa === 'LLEGADO' ? 'llegó' : 'en camino'}{p.direccion ? ` · ${p.direccion}` : ''}</li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {sel.telefono && <a href={`tel:${sel.telefono}`} style={{ ...botonSec, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>📞 Llamar</a>}
            <button type="button" onClick={() => setSeguir((s) => (s === sel.repartidorId ? null : sel.repartidorId))} style={botonSec}>
              {seguir === sel.repartidorId ? 'Dejar de seguir' : `Seguir a ${sel.nombre.split(' ')[0]}`}
            </button>
          </div>
        </div>
      )}

      <ul aria-label="Estado de los repartidores" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visibles.map((r) => {
          const f = frescuraDe(r.en, ahora);
          return (
            <li key={r.repartidorId}>
              <button type="button" onClick={() => setElegido(r.repartidorId)} style={{ ...botonSec, width: '100%', justifyContent: 'space-between', textAlign: 'left' }}>
                <span>{r.nombre} · {r.pedidos.length} {r.pedidos.length === 1 ? 'pedido' : 'pedidos'}</span>
                <span style={{ color: f.color }}>{f.clave === 'EN_VIVO' ? 'En vivo' : f.texto}</span>
              </button>
            </li>
          );
        })}
         {sinUbicacion.map((e) => (
          <li key={`s-${e.id}`} style={{ ...botonSec, display: 'flex', justifyContent: 'space-between', border: '1.5px dashed var(--cp-line, #E3D6C6)', color: 'var(--cp-soft, #2C4C5D)' }}>
            <span>{e.nombre}</span>
            <span>Sin ubicación</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const botonSec: React.CSSProperties = {
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 10,
  border: '1.5px solid var(--cp-navy, #0B2C3E)',
  background: 'var(--cp-cream, #FBF4EC)',
  color: 'var(--cp-navy, #0B2C3E)',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};
