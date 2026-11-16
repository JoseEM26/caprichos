import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../comun/api';
import { Boton } from '../../comun/Boton';

const RUTA = '/admin/whatsapp/evolution/mensajes';
interface Estado { proveedor: string; vinculado: boolean | null; estado: string | null }

/**
 * Si el número de Evolution está desvinculado, tapa todo el chat y muestra solo el QR para volver a vincularlo.
 * Solo tapa cuando el servidor lo confirma; si la consulta falla, deja el chat y avisa en pequeño.
 */
export function BloqueoVinculacion({ children }: { children: React.ReactNode }) {
  const [est, setEst] = useState<Estado | null>(null);
  const [fallo, setFallo] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [errorQr, setErrorQr] = useState(false);
  const pidiendo = useRef(false);

  const consultar = useCallback(async () => {
    try {
      setEst(await api.get<Estado>(`${RUTA}/estado`));
      setFallo(false);
    } catch {
      setFallo(true);
    }
  }, []);

  const desvinculado = est?.vinculado === false;
  // Con Evolution en uso, sin vínculo no hay chat posible: se tapa todo. Con Meta en uso, el QR va arriba y el chat sigue.
  const bloqueado = desvinculado && est?.proveedor === 'EVOLUTION';

  useEffect(() => {
    void consultar();
    const t = setInterval(() => void consultar(), desvinculado ? 5000 : 30000);
    return () => clearInterval(t);
  }, [consultar, desvinculado]);

  const pedirQr = useCallback(async () => {
    if (pidiendo.current) return;
    pidiendo.current = true;
    try {
      const r = await api.post<{ disponible: boolean; base64: string | null }>(`${RUTA}/qr`, {});
      setQr(r.disponible ? r.base64 : null);
      setErrorQr(!r.disponible);
    } catch {
      setErrorQr(true);
    } finally {
      pidiendo.current = false;
    }
  }, []);

  // QR nuevo apenas se sabe que está desvinculado y cada ~40 s (vence en un minuto) hasta que se vincule
  useEffect(() => {
    if (!desvinculado) { setQr(null); setErrorQr(false); return; }
    void pedirQr();
    const t = setInterval(() => void pedirQr(), 40000);
    return () => clearInterval(t);
  }, [desvinculado, pedirQr]);

  const conectando = est?.estado === 'connecting';
  const imagenQr = qr ? (qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`) : null;

  if (!bloqueado) {
    return (
      <>
        {fallo && <div role="status" data-testid="aviso-vinculacion" style={{ fontSize: 11, color: 'var(--cp-soft)', padding: '2px 8px' }}>No se pudo comprobar la conexión de WhatsApp.</div>}
        {desvinculado && (
          <section data-testid="qr-vincular-meta" aria-label="Vincular el número de WhatsApp a Evolution" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, margin: '6px 8px', padding: 12, borderRadius: 14, border: '2px solid var(--cp-orange)', background: 'var(--cp-cream)' }}>
            {imagenQr ? (
              <img alt="QR para vincular el número de WhatsApp del local" src={imagenQr} style={{ width: 200, height: 200, background: '#fff', borderRadius: 8 }} />
            ) : (
              <div role="status" style={{ width: 200, textAlign: 'center' }}>{errorQr ? 'No se pudo generar el código.' : 'Generando código…'}</div>
            )}
            <div style={{ flex: '1 1 220px', display: 'grid', gap: 6, color: 'var(--cp-navy)' }}>
              <strong>Vincula el número del local a Evolution</strong>
              <span style={{ fontSize: 13 }}>En el celular del local: WhatsApp › Dispositivos vinculados › Vincular dispositivo, y escanea este código. Se renueva solo.</span>
              <span role="status" style={{ fontSize: 13, fontWeight: 700 }}>{conectando ? 'Conectando…' : 'Esperando que escanees…'} · Mientras tanto se sigue atendiendo por Meta.</span>
              <small style={{ color: 'var(--cp-soft)' }}>Escanéalo solo con el celular del local.</small>
            </div>
          </section>
        )}
        {children}
      </>
    );
  }
  return (
    <div data-testid="bloqueo-vinculacion" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', height: '100%' }}>
      <p style={{ margin: 0, maxWidth: 560, fontSize: 16, fontWeight: 700, color: 'var(--cp-navy)' }}>
        Vincula el número de WhatsApp del local: abre WhatsApp en el celular del local › Dispositivos vinculados › Vincular dispositivo y escanea este código
      </p>
      {imagenQr ? (
        <img alt="QR para vincular el número de WhatsApp del local" src={imagenQr} style={{ width: 'min(70vw, 360px)', height: 'min(70vw, 360px)' }} />
      ) : errorQr ? (
        <div role="alert" style={{ color: 'var(--cp-rust)', fontWeight: 700 }}>No se pudo generar el código.</div>
      ) : (
        <div role="status">Generando código…</div>
      )}
      <div role="status" style={{ fontWeight: 700 }}>{conectando ? 'Conectando…' : 'Esperando que escanees…'}</div>
      <Boton variante="secundario" onClick={() => void pedirQr()}>Generar otro código</Boton>
      <small style={{ color: 'var(--cp-soft)' }}>Escanéalo solo con el celular del local.</small>
    </div>
  );
}
