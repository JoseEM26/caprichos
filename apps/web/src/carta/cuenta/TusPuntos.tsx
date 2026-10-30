import { useEffect, useState } from 'react';
import { api } from '../../comun/api';

interface Movimiento {
  id: string;
  tipo: 'SUMA' | 'CANJE' | 'REVERSA' | 'DEVOLUCION_CANJE';
  puntos: number;
  motivo: string | null;
  fecha: string;
  pedido: { codigo: string } | null;
}
interface Pagina {
  porcentaje: number;
  movimientos: Movimiento[];
  pagina: number;
  hayMas: boolean;
}

const ENTRA = ['SUMA', 'DEVOLUCION_CANJE'];

function fechaCorta(iso: string): string {
  const f = new Date(iso);
  return Number.isNaN(f.getTime()) ? '' : f.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

/** «TUS PUNTOS»: saldo, cómo funcionan y el historial de movimientos de la cuenta. */
export function TusPuntos({ puntos }: { puntos: number }) {
  const [porcentaje, setPorcentaje] = useState(5);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);
  const [verComoFunciona, setVerComoFunciona] = useState(false);

  const cargar = async (n: number) => {
    setCargando(true);
    setError(false);
    try {
      const r = await api.get<Pagina>(`/carta/cuenta/puntos/movimientos?pagina=${n}`);
      setPorcentaje(r.porcentaje);
      setMovs((prev) => [...prev, ...r.movimientos.filter((m) => !prev.some((p) => p.id === m.id))]);
      setPagina(r.pagina);
      setHayMas(r.hayMas);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if ((verHistorial || verComoFunciona) && pagina === 0) void cargar(1);
    // solo la primera vez que se abre una de las dos secciones
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verHistorial, verComoFunciona]);

  const enlace = { minHeight: 44, background: 'transparent', border: 0, color: 'var(--cp-cream)', textDecoration: 'underline', fontWeight: 700, fontSize: 13, textAlign: 'left' as const, padding: 0, cursor: 'pointer' };

  return (
    <div style={{ background: 'var(--cp-navy)', color: 'var(--cp-cream)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--cp-orange)' }}>TUS PUNTOS</span>
      <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 34 }}>{puntos}</span>
      <span style={{ fontSize: 12, opacity: 0.85 }}>Los acumulas con cada pedido que haces con tu cuenta y los usas en tus siguientes pedidos.</span>

      <button type="button" style={enlace} aria-expanded={verComoFunciona} onClick={() => setVerComoFunciona((v) => !v)}>
        Cómo funcionan
      </button>
      {verComoFunciona && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: '18px' }}>
          <li>Ganas {porcentaje} % de lo que pagas en productos sin promoción ni cupón.</li>
          <li>Se suman cuando Caja cobra tu pedido; los combos y promociones no suman.</li>
        </ul>
      )}

      <button type="button" style={enlace} aria-expanded={verHistorial} onClick={() => setVerHistorial((v) => !v)}>
        {verHistorial ? 'Ocultar movimientos' : 'Ver mis movimientos'}
      </button>
      {verHistorial && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          {movs.length === 0 && !cargando && !error && <span>Aún no tienes movimientos.</span>}
          {movs.map((m) => {
            const suma = ENTRA.includes(m.tipo);
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 6 }}>
                <span style={{ minWidth: 0 }}>
                  {fechaCorta(m.fecha)}
                  {m.pedido ? ` · ${m.pedido.codigo}` : ''}
                  <br />
                  <span style={{ opacity: 0.8 }}>{m.motivo ?? ''}</span>
                </span>
                <b style={{ flex: 'none', color: suma ? '#8EE6A5' : '#FFB4A8' }}>
                  {suma ? '+' : '−'}
                  {m.puntos.toFixed(2)}
                </b>
              </div>
            );
          })}
          {error && <span role="alert">No pudimos cargar tus movimientos.</span>}
          {(hayMas || error) && (
            <button type="button" style={enlace} disabled={cargando} onClick={() => void cargar(error ? Math.max(1, pagina + 1) : pagina + 1)}>
              {error ? 'Reintentar' : 'Ver más'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
