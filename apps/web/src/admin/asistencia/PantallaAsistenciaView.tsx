import { useEffect, useState } from 'react';
import { pantallaQr, QrPantalla } from './asistenciaApi';

/**
 * Pantalla fija del local: muestra el QR de asistencia y lo renueva cada ranura de 30 s.
 * La hora de referencia es la del servidor (offset al cargar), así la cuenta regresiva no depende del reloj del equipo.
 */
export function PantallaAsistenciaView() {
  const [qr, setQr] = useState<QrPantalla | null>(null);
  const [offset, setOffset] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cargar = async () => {
      try {
        const nuevo = await pantallaQr();
        if (cancelado) return;
        setQr(nuevo);
        setOffset(nuevo.ahora - Date.now());
        setError(null);
        // Renueva justo al cambiar la ranura (con un margen de 50 ms)
        timer = setTimeout(cargar, Math.max(200, nuevo.cambiaEn - nuevo.ahora + 50));
      } catch {
        if (cancelado) return;
        setError('Sin conexión con el servidor. Reintentando…');
        timer = setTimeout(cargar, 5000);
      }
    };

    void cargar();
    const reloj = setInterval(() => setAhora(Date.now()), 250);
    return () => {
      cancelado = true;
      if (timer) clearTimeout(timer);
      clearInterval(reloj);
    };
  }, []);

  const restan = qr ? Math.max(0, Math.ceil((qr.cambiaEn - (ahora + offset)) / 1000)) : null;

  return (
    <section aria-label="Pantalla de asistencia" style={{ display: 'grid', justifyItems: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
      <h2 style={{ margin: 0 }}>Marca tu asistencia</h2>
      <p style={{ margin: 0 }}>Abre «Mi asistencia» en tu celular y escanea este código.</p>
      {qr ? (
        <img
          src={qr.qr}
          alt="Código QR de asistencia"
          data-testid="qr-asistencia"
          style={{ width: 'min(70vmin, 480px)', height: 'auto', background: '#fff', padding: 12, borderRadius: 12 }}
        />
      ) : (
        <div role="status">Cargando código…</div>
      )}
      {qr && (
        <>
          <div aria-live="polite" data-testid="cuenta-regresiva" style={{ fontSize: 18 }}>
            El código cambia en {restan} s
          </div>
          <div style={{ fontSize: 14 }}>
            Si la cámara no funciona, escribe este código: <strong data-testid="codigo-corto" style={{ fontSize: 28, letterSpacing: 4 }}>{qr.codigo}</strong>
          </div>
        </>
      )}
      {error && <div role="alert">{error}</div>}
    </section>
  );
}
