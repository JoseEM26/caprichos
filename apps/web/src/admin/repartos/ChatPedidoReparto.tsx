import { useCallback, useEffect, useRef, useState } from 'react';
import { repartosApi, ChatRepartidor } from './repartosApi';

/** Horas que sigue abierto el chat de un pedido después de entregarlo (igual que el servidor). */
const HORAS_CHAT_TRAS_ENTREGA = 2;
const CADA_MS = 5000;

const FUENTE_TITULOS = 'var(--fuente-titulos), Montserrat, sans-serif';
const FUENTE_TEXTO = 'Montserrat, sans-serif';

/** Se puede abrir el chat si el pedido sigue en curso o se entregó hace menos de 2 h. */
export function chatVigente(estado: string, entregadoEn: string | null | undefined, ahora = Date.now()): boolean {
  if (estado === 'LISTO' || estado === 'EN_CAMINO') return true;
  if (estado !== 'ENTREGADO' || !entregadoEn) return false;
  return ahora - new Date(entregadoEn).getTime() <= HORAS_CHAT_TRAS_ENTREGA * 60 * 60 * 1000;
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' });

interface Props {
  pedidoId: string;
  codigo: string;
  alCerrar: () => void;
}

/** Hoja a pantalla completa con el chat de WhatsApp de UN pedido: sin lista ni otros clientes. */
export function ChatPedidoReparto({ pedidoId, codigo, alCerrar }: Props) {
  const [datos, setDatos] = useState<ChatRepartidor | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await repartosApi.obtenerChat(pedidoId));
      setErrorCarga(null);
    } catch (err: any) {
      setErrorCarga(err?.message || 'No se pudo cargar el chat');
    }
  }, [pedidoId]);

  useEffect(() => {
    cargar();
    const reloj = setInterval(cargar, CADA_MS);
    return () => clearInterval(reloj);
  }, [cargar]);

  const cantidad = datos?.mensajes?.length ?? 0;
  useEffect(() => {
    finRef.current?.scrollIntoView?.({ block: 'end' });
  }, [cantidad]);

  const puedeEscribir = !!datos?.disponible && !!datos.ventanaAbierta && !datos.atendidoPorLocal && !enviando;

  async function enviar() {
    const limpio = texto.trim();
    if (!limpio || !puedeEscribir) return;
    setEnviando(true);
    setErrorEnvio(null);
    try {
      await repartosApi.enviarChat(pedidoId, limpio);
      setTexto('');
      await cargar();
    } catch (err: any) {
      setErrorEnvio(err?.message || 'No se pudo enviar el mensaje');
      await cargar();
    } finally {
      setEnviando(false);
    }
  }

  const aviso = (mensaje: string, tipo: 'info' | 'error' = 'info') => (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 700,
        background: tipo === 'error' ? '#FDE8E8' : '#FFF4E5',
        color: tipo === 'error' ? 'var(--cp-rust)' : 'var(--cp-navy)',
      }}
    >
      {mensaje}
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chat de WhatsApp del pedido ${codigo}`}
      data-testid="chat-pedido-reparto"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--cp-cream)',
        color: 'var(--cp-navy)',
        fontFamily: FUENTE_TEXTO,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
          background: 'var(--cp-white)',
          borderBottom: '1.5px solid var(--cp-line)',
        }}
      >
        <button
          type="button"
          onClick={alCerrar}
          aria-label="Cerrar chat"
          style={{ minHeight: 48, minWidth: 48, borderRadius: 12, border: '1.5px solid var(--cp-navy)', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}
        >
          ←
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: FUENTE_TITULOS, fontWeight: 800, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {datos?.cliente?.nombre ?? 'Chat del cliente'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--cp-soft)', fontWeight: 700 }}>
            Pedido {codigo}
            {datos?.cliente?.telefono ? ` · ${datos.cliente.telefono}` : ''}
          </div>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!datos && !errorCarga && (
          <div role="status" style={{ color: 'var(--cp-soft)', fontWeight: 700 }}>
            Cargando chat...
          </div>
        )}
        {errorCarga && aviso(errorCarga, 'error')}
        {datos && !datos.disponible && aviso(datos.motivo || 'Este cliente no tiene chat')}
        {datos?.disponible && datos.atendidoPorLocal && aviso('El local está atendiendo este chat ahora. Podrás escribir cuando lo suelte.')}
        {datos?.disponible && !datos.ventanaAbierta && aviso('Pasaron 24 h sin respuesta del cliente; el local debe escribirle.')}

        {datos?.disponible && (datos.mensajes?.length ?? 0) === 0 && (
          <div style={{ color: 'var(--cp-soft)', fontWeight: 700, textAlign: 'center', marginTop: 24 }}>
            Aún no hay mensajes desde que se creó el pedido.
          </div>
        )}

        {datos?.disponible &&
          datos.mensajes?.map((m) => {
            const delLocal = m.de === 'local';
            return (
              <div key={m.id} style={{ alignSelf: delLocal ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 14,
                    borderBottomRightRadius: delLocal ? 4 : 14,
                    borderBottomLeftRadius: delLocal ? 14 : 4,
                    background: delLocal ? '#DCF8C6' : 'var(--cp-white)',
                    border: '1px solid var(--cp-line)',
                    fontSize: 14,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.texto}
                </div>
                <div style={{ fontSize: 11, color: 'var(--cp-soft)', textAlign: delLocal ? 'right' : 'left', marginTop: 2 }}>
                  {delLocal ? 'Local' : 'Cliente'} · {hora(m.en)}
                </div>
              </div>
            );
          })}
        <div ref={finRef} />
      </div>

      {datos?.disponible && (
        <div style={{ borderTop: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {errorEnvio && aviso(errorEnvio, 'error')}
          <form
            style={{ display: 'flex', gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
          >
            <input
              type="text"
              aria-label="Escribe un mensaje al cliente"
              placeholder={puedeEscribir ? 'Escribe un mensaje' : 'No puedes escribir ahora'}
              value={texto}
              maxLength={1000}
              disabled={!puedeEscribir}
              onChange={(e) => setTexto(e.target.value)}
              style={{ flex: 1, minWidth: 0, minHeight: 48, borderRadius: 12, border: '1.5px solid var(--cp-line)', padding: '0 12px', fontSize: 15, fontFamily: FUENTE_TEXTO }}
            />
            <button
              type="submit"
              aria-label="Enviar mensaje"
              disabled={!puedeEscribir || !texto.trim()}
              style={{
                minHeight: 48,
                minWidth: 88,
                padding: '0 14px',
                borderRadius: 12,
                border: 'none',
                background: 'var(--cp-green)',
                color: 'var(--cp-white)',
                fontWeight: 800,
                cursor: 'pointer',
                opacity: !puedeEscribir || !texto.trim() ? 0.5 : 1,
              }}
            >
              {enviando ? 'Enviando...' : 'Enviar'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
