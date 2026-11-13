import { useCallback, useEffect, useState } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { comprobantesApi } from '../comprobantes/comprobantesApi';
import { estadoDe } from '../comprobantes/ElectronicosTab';
import { EnvioWhatsappFactura } from '../comprobantes/EnvioWhatsappFactura';
import { formatearSoles } from '../comprobantes/utilidades';
import type { CambioComprobantePendiente, ComprobantePedido } from '../comprobantes/tipos';
import { CambioComprobanteCobrado } from './CambioComprobanteCobrado';
import './comprobantes-pedido.css';

export interface SeccionComprobantesPedidoProps {
  pedido: {
    id: string | number;
    codigo?: string;
    pago_estado?: string | null;
    comprobante_tipo?: string | null;
    comprobante_numero?: string | null;
  };
}

const TIPO_TEXTO: Record<string, string> = { NOTA_VENTA: 'Nota de venta', SIMPLE: 'Nota de venta', BOLETA: 'Boleta', FACTURA: 'Factura' };
const tipoTexto = (t?: string | null) => TIPO_TEXTO[String(t ?? '').toUpperCase()] ?? 'Nota de venta';
const esElectronico = (t: string) => t === 'BOLETA' || t === 'FACTURA';

/** Estado que ve la persona: lo de SUNAT para boletas y facturas; «Interna» para la nota de venta. */
export function estadoComprobante(c: ComprobantePedido): { texto: string; variante: VarianteInsignia } {
  if (!esElectronico(c.tipo)) return c.anulado_en ? { texto: 'Anulado', variante: 'neutro' } : { texto: 'Interna (no va a SUNAT)', variante: 'neutro' };
  if (c.anulado_en && !c.baja_estado && c.facturacion_estado === 'POR_EMITIR_NOCHE') return { texto: 'Anulado (no se emitió)', variante: 'neutro' };
  if (c.anulado_en && !c.baja_estado) return { texto: 'Anulado (no llegó a SUNAT)', variante: 'neutro' };
  return estadoDe(c);
}

/** Comprobantes del pedido y de sus extras: vigente primero. Descargas con los mismos permisos de Comprobantes. */
export function SeccionComprobantesPedido({ pedido }: SeccionComprobantesPedidoProps) {
  const { tiene } = useSesion();
  const puede = tiene('comprobantes/ver');
  const id = String(pedido.id);
  const [lista, setLista] = useState<ComprobantePedido[] | null>(null);
  const [cambio, setCambio] = useState<CambioComprobantePendiente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(puede);

  const cargar = useCallback(() => {
    if (!puede) return;
    setCargando(true);
    setError(null);
    comprobantesApi
      .listarPorPedido(id)
      .then((r) => { setLista(r.elementos ?? []); setCambio(r.cambio_pendiente ?? null); }, (e) => setError(e instanceof Error && e.message ? e.message : 'No se pudieron cargar los comprobantes'))
      .finally(() => setCargando(false));
  }, [id, puede]);
  useEffect(cargar, [cargar]);

  const abrirPdf = async (c: ComprobantePedido) => {
    setAviso(null);
    try {
      window.open(await comprobantesApi.urlPdfElectronico(c.id), '_blank', 'noopener,noreferrer');
    } catch (e) {
      setAviso(e instanceof Error && e.message ? e.message : 'No se pudo abrir el PDF');
    }
  };
  const bajar = async (c: ComprobantePedido, tipo: 'XML' | 'CDR') => {
    setAviso(null);
    try {
      const a = document.createElement('a');
      a.href = await comprobantesApi.urlArchivoElectronico(c.id, tipo);
      a.download = `${c.numero_texto}-${tipo}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setAviso(e instanceof Error && e.message ? e.message : `No se pudo descargar el ${tipo}`);
    }
  };

  const cobrado = String(pedido.pago_estado ?? '').toUpperCase() === 'PAGADO';
  // Cobrado: el cambio no emite, queda para el envío de la noche (Caja y ADMIN)
  const cambioCobrado = cobrado && (
    <CambioComprobanteCobrado pedidoId={id} total={lista?.[0]?.total} cambio={cambio} puede={tiene('comprobantes/anular')} alCambiar={(m) => { cargar(); if (m) setAviso(m); }} />
  );
  const enlaceNota = puede && cobrado && (
    <a className="cpd-enlace" href={`/admin/comprobantes?tab=nota&pedidoId=${encodeURIComponent(id)}`} target="_blank" rel="noopener noreferrer">
      Ver nota de venta térmica
    </a>
  );

  // Sin permiso de Comprobantes, o sin filas electrónicas: solo lo que ya trae el pedido
  const resumenPedido = (
    <div className="cpd-tarjeta" data-testid="comprobante-del-pedido">
      <div className="cpd-cab">
        <strong>{tipoTexto(pedido.comprobante_tipo)}{pedido.comprobante_numero ? ` ${pedido.comprobante_numero}` : ''}</strong>
        <Insignia variante="neutro">{cobrado ? 'Interna (no va a SUNAT)' : 'Aún sin cobrar'}</Insignia>
      </div>
      {enlaceNota && <div className="cpd-acciones">{enlaceNota}</div>}
      {cambioCobrado}
    </div>
  );

  if (!puede) return <div data-testid="comprobantes-pedido">{resumenPedido}</div>;
  if (cargando) return <Cargando />;
  if (error) return <EstadoError mensaje={error} alReintentar={cargar} />;
  const filas = lista ?? [];
  if (filas.length === 0) return <div data-testid="comprobantes-pedido">{resumenPedido}</div>;

  return (
    <div className="cpd-lista" data-testid="comprobantes-pedido">
      {aviso && <p role="alert" className="cpd-aviso">{aviso}</p>}
      {filas.map((c) => {
        const est = estadoComprobante(c);
        const otro = String(c.pedido_id) !== id;
        const tipo = String(c.tipo).toUpperCase();
        const electronico = esElectronico(tipo);
        const cdrPosible = c.tiene_cdr;
        return (
          <article key={c.id} className={`cpd-tarjeta${c.anulado_en ? ' cpd-anulado' : ''}`} data-testid={`comprobante-${c.numero_texto ?? `pedido-${c.pedido_id}`}`} aria-label={`${tipoTexto(tipo)} ${c.numero_texto ?? 'sin número'}`}>
            <div className="cpd-cab">
              <strong>{tipoTexto(tipo)} {c.numero_texto ?? '(el número sale en la noche)'}</strong>
              <Insignia variante={est.variante}>{est.texto}</Insignia>
            </div>
            <dl className="cpd-datos">
              <div><dt>Fecha</dt><dd>{c.fecha_lima}</dd></div>
              <div><dt>Total</dt><dd className="cpd-monto">{formatearSoles(c.total)}</dd></div>
              {c.documento && <div><dt>{tipo === 'FACTURA' ? 'RUC' : 'DNI'}</dt><dd>{c.documento}</dd></div>}
              {c.razon_social && <div><dt>Razón social</dt><dd>{c.razon_social}</dd></div>}
              {otro && c.codigo_pedido && <div><dt>Del pedido extra</dt><dd>{c.codigo_pedido}</dd></div>}
            </dl>
            {c.simulado && <p className="cpd-nota">Comprobante de prueba: no se envió a SUNAT de verdad.</p>}
            {c.revision_motivo && <p className="cpd-nota">Motivo de revisión: {c.revision_motivo}</p>}
            {c.respuesta_sunat && !c.anulado_en && est.variante === 'peligro' && <p className="cpd-nota">{c.respuesta_sunat}</p>}
            {(c.anulado_en || c.baja_estado) && (
              <p className="cpd-nota">
                {c.baja_estado ? `Baja: ${c.baja_estado.toLowerCase().replace('_', ' ')}. ` : ''}
                {c.baja_motivo || c.anulado_motivo ? `Motivo: ${c.baja_motivo || c.anulado_motivo}` : ''}
              </p>
            )}
            <EnvioWhatsappFactura comprobante={c} puedeReenviar={tiene('comprobantes/emitir') && !c.baja_estado} alCambiar={cargar} />
            <div className="cpd-acciones">
              {electronico && <button type="button" className="cpd-btn" onClick={() => abrirPdf(c)} aria-label={`Ver PDF ${c.numero_texto}`}>Ver PDF</button>}
              {electronico && c.tiene_xml && <button type="button" className="cpd-btn" onClick={() => bajar(c, 'XML')} aria-label={`Descargar XML firmado ${c.numero_texto}`}>XML firmado</button>}
              {electronico && cdrPosible && <button type="button" className="cpd-btn" onClick={() => bajar(c, 'CDR')} aria-label={`Descargar CDR de SUNAT ${c.numero_texto}`}>CDR SUNAT</button>}
              {!electronico && enlaceNota}
            </div>
          </article>
        );
      })}
      {cambioCobrado}
      {/* Con boleta o factura, la nota de venta térmica sigue disponible aparte */}
      {enlaceNota && filas.some((c) => esElectronico(String(c.tipo).toUpperCase())) && <div className="cpd-acciones">{enlaceNota}</div>}
    </div>
  );
}
