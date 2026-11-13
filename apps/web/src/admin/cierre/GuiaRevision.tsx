import { useEffect, useState } from 'react';
import { cierreApi, type GuiaRevision as Guia } from './cierreApi';

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/**
 * «Antes de cerrar, revisa esto» (y «Algo no cuadra: revisa estos puntos» tras un arqueo que no cuadró).
 * Solo muestra operaciones propias del día y una lista fija: nunca lo que debería haber, ni qué medio falla, ni cuánto (DT-61).
 */
export function GuiaRevision({ modo }: { modo: 'antes' | 'no-cuadra' }) {
  const [g, setG] = useState<Guia | null>(null);

  useEffect(() => {
    let vivo = true;
    // Si la guía no carga, la lista fija igual sirve: no se muestra error
    try {
      cierreApi.obtenerGuiaRevision().then((d) => vivo && setG(d)).catch(() => undefined);
    } catch {
      // sin guía, no pasa nada
    }
    return () => {
      vivo = false;
    };
  }, []);

  const bloques: Array<{ clave: string; titulo: string; lineas: string[] }> = g
    ? [
        { clave: 'anulados', titulo: 'Pedidos anulados que ya habían pagado: ¿se devolvió el dinero?', lineas: g.anuladosConPago.map((p) => `${p.codigo} · ${p.medio ?? 'sin medio'} · ${soles(p.monto)}`) },
        { clave: 'cobros', titulo: 'Cobros anulados hoy', lineas: g.cobrosAnulados.map((c) => `${c.codigo} · ${c.medio ?? 'sin medio'} · ${soles(c.monto)} · ${c.hora}`) },
        { clave: 'mov', titulo: 'Ingresos y egresos que registraste', lineas: g.movimientos.map((m) => `${m.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'} ${soles(m.monto)} · ${m.motivo}${m.anulado ? ' (anulado)' : ''}`) },
        { clave: 'pend', titulo: 'Pedidos sin cobrar', lineas: g.pendientesDeCobro.map((p) => `${p.codigo} · ${p.estado} · ${soles(p.total)}`) },
        { clave: 'prop', titulo: 'Hubo propinas en estos medios (las apps y el POS las incluyen en su total)', lineas: g.propinasPorMedio.map((p) => `${p.medio}: ${p.cantidad} ${p.cantidad === 1 ? 'cobro con propina' : 'cobros con propina'}`) },
        { clave: 'rep', titulo: 'Repartidores por liquidar', lineas: g.repartidoresPorLiquidar.map((r) => `${r.nombre} · ${r.pedidos} ${r.pedidos === 1 ? 'pedido' : 'pedidos'}`) },
      ].filter((b) => b.lineas.length > 0)
    : [];

  const titulo = modo === 'antes' ? 'Antes de cerrar, revisa esto' : 'Algo no cuadra: revisa estos puntos';

  return (
    <details open={modo === 'no-cuadra'} className="dc-intento" data-testid={`guia-${modo}`} style={{ padding: '0 12px 10px' }}>
      <summary>{titulo}</summary>
      {bloques.map((b) => (
        <section key={b.clave} data-testid={`guia-${b.clave}`}>
          <h4 style={{ margin: '8px 0 4px', fontSize: 14 }}>{b.titulo}</h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {b.lineas.slice(0, 20).map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </section>
      ))}
      {g && (
        <>
          <h4 style={{ margin: '10px 0 4px', fontSize: 14 }}>Pregúntate</h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }} data-testid="guia-lista">
            {g.lista.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </>
      )}
    </details>
  );
}
