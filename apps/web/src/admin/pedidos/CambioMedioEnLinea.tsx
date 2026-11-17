import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { pedidosApi, type Pedido } from './pedidosApi';

const MEDIOS = [
  { medio: 'EFECTIVO', nombre: 'Efectivo' },
  { medio: 'YAPE', nombre: 'Yape' },
  { medio: 'PLIN', nombre: 'Plin' },
  { medio: 'TRANSFERENCIA', nombre: 'Transferencia' },
];

/** Caja (E2): cambia el medio de un pedido que espera el pago en línea de Culqi. El pedido pasa a cocina según el medio elegido. */
export function CambioMedioEnLinea({ pedido, alExito }: { pedido: Pedido; alExito: (mensaje: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [medio, setMedio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const confirmar = async () => {
    if (!medio) return;
    setEnviando(true);
    setError('');
    try {
      const r = await pedidosApi.cambiarMedioEnLinea(String(pedido.id), medio);
      setAbierto(false);
      setMedio(null);
      alExito(r.mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cambiar el medio. Reintenta.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div data-testid="cambio-medio-en-linea" style={{ display: 'grid', gap: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
        El cliente todavía no pagó en línea. Si prefiere otro medio, cámbialo aquí.
      </span>
      {!abierto ? (
        <Boton variante="secundario" onClick={() => setAbierto(true)}>Cambiar medio de pago</Boton>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {MEDIOS.map((m) => (
              <Boton key={m.medio} variante={medio === m.medio ? 'primario' : 'secundario'} onClick={() => setMedio(m.medio)}>
                {m.nombre}
              </Boton>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Boton disabled={!medio || enviando} cargando={enviando} onClick={() => void confirmar()}>Confirmar el cambio</Boton>
            <Boton variante="secundario" onClick={() => { setAbierto(false); setMedio(null); }}>No cambiar</Boton>
          </div>
        </>
      )}
      {error && <p role="alert" style={{ color: 'var(--cp-rust, #B2500F)', margin: 0 }}>{error}</p>}
    </div>
  );
}
