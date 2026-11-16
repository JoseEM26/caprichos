import { useEffect, useState } from 'react';
import { api } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { DatosTransferencia, FilaCopiable, type InfoTransferencia } from '../../comun/DatosTransferencia';
import { urlMensajesConTexto } from './utilidadesChat';

interface DatosPagoPedido {
  telefono: string | null;
  texto: string;
  medio: string;
}

/**
 * Datos para pagar de un pedido con Yape, Plin o transferencia (con «Copiar») y el botón «Enviar datos de pago por WhatsApp»:
 * abre el chat del cliente en Mensajes con el mensaje ya escrito (la persona solo toca Enviar; el sistema no envía solo).
 * El botón pide el permiso mensajes/enviar; sin celular en el pedido explica qué falta.
 */
export function PanelDatosPago({ pedidoId, medio }: { pedidoId: string | number | bigint; medio: 'YAPE' | 'PLIN' | 'TRANSFERENCIA' }) {
  const [info, setInfo] = useState<(InfoTransferencia & { numero?: string }) | null>(null);
  const [envio, setEnvio] = useState<DatosPagoPedido | null>(null);
  let puede = false;
  try {
    const sesion = useSesion();
    puede = Boolean(sesion?.tiene?.('mensajes/enviar')) || sesion?.usuario?.rol === 'ADMIN';
  } catch {
    puede = false;
  }
  useEffect(() => {
    let vivo = true;
    Promise.resolve(api.get<any>('/carta/local'))
      .then((l) => vivo && setInfo(l?.mediosPago?.[medio.toLowerCase()] ?? null))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [medio]);
  useEffect(() => {
    if (!puede) return;
    let vivo = true;
    Promise.resolve(api.get<DatosPagoPedido | null>(`/admin/whatsapp/datos-pago-pedido/${pedidoId}?medio=${medio}`))
      .then((d) => vivo && setEnvio(d))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [pedidoId, medio, puede]);

  const hayDatos = medio === 'TRANSFERENCIA' ? Boolean(info?.cuenta || info?.cci) : Boolean(info?.numero);
  if (!hayDatos && !envio) return null;
  return (
    <div data-testid="panel-datos-pago" style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--cp-sand, #F3E6D6)', borderRadius: 10, padding: 10 }}>
      {hayDatos && (
        <>
          <div style={{ fontWeight: 800, fontSize: 13 }}>Datos para pagar con {medio === 'TRANSFERENCIA' ? 'transferencia' : medio === 'YAPE' ? 'Yape' : 'Plin'}</div>
          {medio === 'TRANSFERENCIA' ? (
            <DatosTransferencia info={info} />
          ) : (
            <>
              <FilaCopiable etiqueta="Número" valor={info!.numero!} />
              {info?.titular && <div style={{ fontSize: 12 }}>A nombre de <strong>{info.titular}</strong></div>}
            </>
          )}
        </>
      )}
      {puede && envio &&
        (envio.telefono ? (
          <a
            href={urlMensajesConTexto(envio.telefono, envio.texto)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ minHeight: 44, boxSizing: 'border-box', padding: '0 14px', borderRadius: 12, background: 'var(--cp-green, #2F7A45)', color: 'var(--cp-white, #FFFFFF)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', textAlign: 'center' }}
          >
            Enviar datos de pago por WhatsApp
          </a>
        ) : (
          <div role="status" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
            Falta el celular del cliente: agrégalo en «Corregir cliente» para enviarle los datos de pago por WhatsApp.
          </div>
        ))}
    </div>
  );
}
