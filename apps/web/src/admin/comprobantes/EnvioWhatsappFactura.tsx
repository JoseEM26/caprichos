import { useState } from 'react';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { comprobantesApi } from './comprobantesApi';
import { textoWhatsappManual, urlWhatsappManual } from './utilidades';
import { urlMensajesConTexto } from '../mensajes/utilidadesChat';
import type { ComprobanteElectronico, EnvioWhatsappFactura, EstadoEnvioWhatsapp } from './tipos';

/** Hora de Lima corta: «11/11 14:05». */
const horaCorta = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
};

const TEXTO: Record<EstadoEnvioWhatsapp, { texto: string; variante: VarianteInsignia }> = {
  PENDIENTE: { texto: 'Enviando por WhatsApp…', variante: 'aviso' },
  ENVIADO: { texto: 'Enviada por WhatsApp', variante: 'exito' },
  SIN_CELULAR: { texto: 'Sin celular', variante: 'neutro' },
  SIN_VENTANA: { texto: 'Sin ventana de WhatsApp', variante: 'aviso' },
  ERROR: { texto: 'Error al enviar', variante: 'peligro' },
  APAGADO: { texto: 'Apagado', variante: 'neutro' },
  OMITIDO: { texto: 'No enviada', variante: 'neutro' },
};

/** Etiqueta del envío por WhatsApp de una factura (con la hora si ya salió). Sin envío registrado: null. */
export function etiquetaEnvio(e: EnvioWhatsappFactura | null | undefined): { texto: string; variante: VarianteInsignia } | null {
  if (!e) return null;
  const base = TEXTO[e.estado] ?? { texto: 'No enviada', variante: 'neutro' as VarianteInsignia };
  if (e.detalle === 'ENVIADO_A_MANO') return { texto: 'Enviado a mano', variante: 'exito' };
  return e.estado === 'ENVIADO' && e.enviado_en ? { ...base, texto: `${base.texto} · ${horaCorta(e.enviado_en)}` } : base;
}

/** ¿Es una boleta o factura real, ya firmada y vigente? Solo esas se mandan por WhatsApp (misma regla que el servidor). */
export const esFacturaEnviable = (c: Pick<ComprobanteElectronico, 'tipo' | 'facturacion_estado' | 'simulado'> & { anulado_en?: string | null }) => {
  const tipo = String(c.tipo).toUpperCase();
  const firmado = c.facturacion_estado === 'EMITIDO_SUNAT' || (tipo === 'BOLETA' && c.facturacion_estado === 'PENDIENTE_RESUMEN');
  return (tipo === 'FACTURA' || tipo === 'BOLETA') && firmado && !c.simulado && !c.anulado_en;
};

/** Etiqueta pequeña + botón «Reenviar por WhatsApp» (Sí/No) de una factura. Se muestra solo para facturas reales aceptadas. */
export function EnvioWhatsappFactura({
  comprobante,
  puedeReenviar,
  alCambiar,
}: {
  comprobante: ComprobanteElectronico & { anulado_en?: string | null };
  puedeReenviar: boolean;
  alCambiar?: () => void;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!esFacturaEnviable(comprobante)) return null;
  const etiqueta = etiquetaEnvio(comprobante.envio_whatsapp);
  // Envío a mano: solo en la lista de electrónicos (trae celular_wa); el botón se destaca cuando no hay ventana de 24 h
  const enLista = 'celular_wa' in comprobante;
  const urlManual = urlWhatsappManual(comprobante.celular_wa, comprobante, comprobante.enlace_pdf_publico);
  const sinVentana = comprobante.envio_whatsapp?.estado === 'SIN_VENTANA' && comprobante.envio_whatsapp.detalle !== 'ENVIADO_A_MANO';
  // El enlace se abre sin esperar; la marca «Enviado a mano» va aparte y, si falla, no estorba
  const alAbrirManual = () => {
    void comprobantesApi.marcarEnviadoWhatsappManual(comprobante.id).then(() => alCambiar?.(), () => undefined);
  };

  const reenviar = async () => {
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      const r = await comprobantesApi.reenviarFacturaWhatsapp(comprobante.id);
      setMensaje(TEXTO[r.estado]?.texto ?? 'Hecho');
      alCambiar?.();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo reenviar por WhatsApp');
    } finally {
      setOcupado(false);
      setConfirmar(false);
    }
  };

  return (
    <div data-testid={`envio-whatsapp-${comprobante.id}`} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
      {etiqueta && <Insignia variante={etiqueta.variante}>{etiqueta.texto}</Insignia>}
      {enLista && !urlManual && !etiqueta && <Insignia variante="neutro">Sin celular</Insignia>}
      {enLista && urlManual && (
        <a
          href={urlManual}
          target="_blank"
          rel="noopener noreferrer"
          onClick={alAbrirManual}
          aria-label={`Enviar por WhatsApp ${comprobante.numero_texto}`}
          style={{
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 14px',
            borderRadius: 10,
            fontWeight: 700,
            textDecoration: 'none',
            border: '1.5px solid #25D366',
            background: sinVentana ? '#25D366' : 'var(--cp-white)',
            color: sinVentana ? '#fff' : '#128C7E',
          }}
        >
          Enviar por WhatsApp
        </a>
      )}
      {enLista && sinVentana && urlManual && (
        <a
          href={urlMensajesConTexto(String(comprobante.celular_wa), textoWhatsappManual(comprobante, comprobante.enlace_pdf_publico))}
          target="_blank"
          rel="noopener noreferrer"
          onClick={alAbrirManual}
          aria-label={`Enviar ${comprobante.numero_texto} desde Mensajes`}
          style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: 10, fontWeight: 700, textDecoration: 'none', background: 'var(--cp-green, #2F7A45)', color: '#fff' }}
        >
          Enviar desde Mensajes (fuera de las 24 h)
        </a>
      )}
      {puedeReenviar && (
        <Boton variante="secundario" onClick={() => setConfirmar(true)} style={{ minHeight: 44 }} aria-label={`Reenviar por WhatsApp ${comprobante.numero_texto}`}>
          Reenviar por WhatsApp
        </Boton>
      )}
      {mensaje && <span role="status" style={{ fontSize: 13 }}>{mensaje}</span>}
      {error && <span role="alert" style={{ fontSize: 13, color: 'var(--cp-red, #b00020)' }}>{error}</span>}
      <Confirmar
        abierto={confirmar}
        titulo="Reenviar por WhatsApp"
        mensaje={`¿Mandar de nuevo la factura ${comprobante.numero_texto} al WhatsApp del cliente? Cuenta como un mensaje más en Meta y respeta la ventana de 24 horas.`}
        textoSi="Sí, reenviar"
        textoNo="No"
        cargando={ocupado}
        alConfirmar={reenviar}
        alCancelar={() => setConfirmar(false)}
      />
    </div>
  );
}
