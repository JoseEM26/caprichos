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

  const bloqueado = est?.proveedor === 'EVOLUTION' && est.vinculado === false;

  useEffect(() => {
    void consultar();
    const t = setInterval(() => void consultar(), bloqueado ? 5000 : 30000);
    return () => clearInterval(t);
  }, [consultar, bloqueado]);

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

  // QR nuevo al bloquear y cada ~50 s (vence en un minuto) mientras siga desvinculado
  useEffect(() => {
    if (!bloqueado) { setQr(null); setErrorQr(false); return; }
    void pedirQr();
    const t = setInterval(() => void pedirQr(), 50000);
    return () => clearInterval(t);
  }, [bloqueado, pedirQr]);

  if (!bloqueado) {
    return (
      <>
        {fallo && <div role="status" data-testid="aviso-vinculacion" style={{ fontSize: 11, color: 'var(--cp-soft)', padding: '2px 8px' }}>No se pudo comprobar la conexión de WhatsApp.</div>}
        {children}
      </>
    );
  }
  const conectando = est?.estado === 'connecting';
  return (
    <div data-testid="bloqueo-vinculacion" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', height: '100%' }}>
      <p style={{ margin: 0, maxWidth: 560, fontSize: 16, fontWeight: 700, color: 'var(--cp-navy)' }}>
        Vincula el número de WhatsApp del local: abre WhatsApp en el celular del local › Dispositivos vinculados › Vincular dispositivo y escanea este código
      </p>
      {qr ? (
        <img alt="QR para vincular el número de WhatsApp del local" src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`} style={{ width: 'min(70vw, 360px)', height: 'min(70vw, 360px)' }} />
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
