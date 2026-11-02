import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { CampoConfig } from './CampoConfig';

const CLAVE = 'cocina_minutos_preparacion_defecto';
const DEFECTO = 10;

/** Minutos de preparación por defecto (entero 1–120) para productos sin datos de los últimos 30 días. */
export function TarjetaMinutosPreparacionConfiguracion() {
  const [valor, setValor] = useState<string>(String(DEFECTO));
  const [guardado, setGuardado] = useState<string>(String(DEFECTO));
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api
      .get<Array<{ clave: string; valor: unknown }>>('/admin/configuracion')
      .then((lista) => {
        const n = Number(lista.find((p) => p.clave === CLAVE)?.valor);
        const v = Number.isInteger(n) && n >= 1 && n <= 120 ? String(n) : String(DEFECTO);
        setValor(v);
        setGuardado(v);
      })
      .catch(() => {
        // sin lectura, queda el defecto de fábrica
      });
  }, []);

  const guardar = async () => {
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 1 || n > 120) {
      setError('Escribe un número entero entre 1 y 120.');
      return;
    }
    setGuardando(true);
    setError(null);
    setExito(null);
    try {
      await api.put(`/admin/configuracion/${CLAVE}`, { valor: n });
      setGuardado(String(n));
      setExito(`Minutos por defecto guardados: ${n} min.`);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar el tiempo por defecto.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <CampoConfig id="cocina-minutos-preparacion-defecto">
      <div
        data-testid="tarjeta-minutos-preparacion"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '18px 20px',
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: 16,
          marginBottom: 8,
        }}
      >
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--cp-navy)' }}>
            Minutos de preparación por defecto
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--cp-soft)', marginTop: 2, maxWidth: 560 }}>
            Sirve para «Listo en ~N min» cuando un producto no tiene datos de los últimos 30 días. Con datos, cada producto usa su promedio real.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label htmlFor="cocina-minutos-defecto" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-navy)' }}>
            Minutos (1 a 120)
          </label>
          <input
            id="cocina-minutos-defecto"
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            step={1}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            style={{ minHeight: 44, width: 96, padding: '0 10px', borderRadius: 10, border: '1px solid var(--cp-line)', fontSize: 15 }}
          />
          <Boton variante="primario" onClick={guardar} disabled={guardando || valor === guardado}>
            Guardar
          </Boton>
        </div>
        {error && (
          <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
            {error}
          </div>
        )}
        {exito && (
          <div role="status" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-navy)' }}>
            {exito}
          </div>
        )}
      </div>
    </CampoConfig>
  );
}
