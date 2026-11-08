import { useEffect, useState } from 'react';
import { useEventos } from '../../comun/socket';
import { HistorialVoucher } from '../salon/HistorialVoucher';
import { SubirVoucherMozo } from '../vouchers/SubirVoucherMozo';
import { ReasignarVoucherBoton } from '../vouchers/ReasignarVoucherBoton';
import { vouchersApi } from '../vouchers/vouchersApi';
import { TarjetaLecturaVoucher } from '../vouchers/TarjetaLecturaVoucher';
import { FotoAmpliable } from '../vouchers/FotoAmpliable';
import { VisorCaptura } from '../vouchers/VisorCaptura';
import { obtenerBlobAutenticado } from '../../comun/api';
import { BannerVouchersIaPausa } from '../vouchers/BannerVouchersIaPausa';
import { Boton } from '../../comun/Boton';
import type { VoucherPagoItem } from '../vouchers/tipos';

export interface SeccionVouchersPedidoProps {
  pedidoId: string | number;
  /** Cambia cuando el pedido cambia (p. ej. tras cobrar) para volver a leer las fotos. */
  recargarClave?: string | number | null;
  total?: number | string | null;
  medio?: string | null;
  /** Avisa a quien la usa (p. ej. ModalConfirmarPago) con los vouchers leídos del pedido. */
  alCargar?: (vouchers: VoucherPagoItem[]) => void;
  /** Detalle del pedido: cada captura es una fila corta (miniatura, medio · monto, semáforo, Ver captura, Reemplazar). */
  compacto?: boolean;
  /** Solo con `compacto`: sin capturas, muestra la caja «Sin captura (opcional)» con «Subir captura». */
  ofrecerSubida?: boolean;
}

/**
 * Fotos de comprobante enlazadas a un pedido (cualquier origen: mozo, caja, WhatsApp, carta).
 * El servidor exige vouchers/ver (CAJERO, ADMIN): sin permiso responde 403 y la sección no se muestra.
 */
export function SeccionVouchersPedido({ pedidoId, recargarClave, total, medio, alCargar, compacto = false, ofrecerSubida = false }: SeccionVouchersPedidoProps) {
  const [vouchers, setVouchers] = useState<VoucherPagoItem[]>([]);
  // Sin permiso (403) o con error no se ofrece subir nada
  const [cargado, setCargado] = useState(false);
  // Sube cada vez que un voucher se mueve (aquí o desde Mensajes): vuelve a leer las fotos del pedido
  const [recarga, setRecarga] = useState(0);
  const [aviso, setAviso] = useState('');
  useEventos('vouchers:actualizado', (d?: { pedidoIds?: Array<string | number>; motivo?: string; origen?: string }) => {
    setRecarga((n) => n + 1);
    const esMio = !!d?.pedidoIds?.some((i) => String(i) === String(pedidoId));
    if (esMio && (d?.motivo === 'subido' || d?.motivo === 'reemplazado')) {
      setAviso(d.origen === 'WHATSAPP' ? 'Llegó el voucher por WhatsApp' : 'Se actualizó el voucher de este pedido');
    }
  });
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 6000);
    return () => clearTimeout(t);
  }, [aviso]);
  // Reemplazo tardío (Caja/Admin): se elige el medio y la foto; el motivo se pregunta UNA vez, junto al «Antes/Nuevo»
  // (SubirVoucherMozo). El anterior queda en el historial como reemplazado.
  const [reemplazando, setReemplazando] = useState(false);
  const [medioCambio, setMedioCambio] = useState<'YAPE' | 'PLIN' | 'TRANSFERENCIA' | null>(null);

  useEffect(() => {
    let activo = true;
    vouchersApi
      .listarVouchers({ pedidoId, estado: 'todos' })
      .then((items) => {
        if (!activo) return;
        const lista = Array.isArray(items) ? items : [];
        setVouchers(lista);
        setCargado(true);
        alCargar?.(lista);
      })
      .catch(() => {
        if (!activo) return;
        setCargado(false);
        setVouchers([]);
        alCargar?.([]);
      });
    return () => {
      activo = false;
    };
    // alCargar no entra en las dependencias: cambia en cada render del padre y no debe re-leer.
  }, [pedidoId, recargarClave, recarga]);

  const vacio = vouchers.length === 0;
  if (vacio && !(compacto && ofrecerSubida && cargado)) return null;

  // «Actual»: el más reciente que se pueda leer (si todos son ilegibles, el más reciente); el resto va plegado
  const ordenados = [...vouchers].sort((x, y) => String(y.creadoEn).localeCompare(String(x.creadoEn)));
  const actual = ordenados.find((v) => v.semaforo !== 'ILEGIBLE') ?? ordenados[0];
  const anteriores = ordenados.filter((v) => v !== actual);
  const iniciarCambio = () => {
    const m = String(vouchers[0]?.medio ?? medio ?? 'YAPE').toUpperCase();
    setMedioCambio(m.includes('PLIN') ? 'PLIN' : m.includes('TRANSF') ? 'TRANSFERENCIA' : 'YAPE');
    setReemplazando(true);
  };
  const recargar = () => setRecarga((n) => n + 1);
  const comprobante = (v: VoucherPagoItem) =>
    compacto ? (
      <FilaVoucher key={String(v.id)} v={v} medio={medio} total={total} onReemplazar={iniciarCambio} onReasignado={recargar} />
    ) : (
      <TarjetaComprobante key={String(v.id)} v={v} medio={medio} total={total} onReasignado={recargar} />
    );

  return (
    <div
      data-testid="seccion-vouchers-pedido"
      style={{
        border: '1.5px solid var(--cp-line, #E3D6C6)',
        borderRadius: 12,
        padding: 12,
        background: 'var(--cp-white, #FFFFFF)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <BannerVouchersIaPausa />
      {aviso && (
        <div role="status" data-testid="aviso-voucher" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-navy, #0B2C3E)', background: '#E6F5EA', border: '1px solid #9BD3AB', borderRadius: 8, padding: '4px 10px' }}>
          {aviso}
        </div>
      )}
      {!vacio && (
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy, #0B2C3E)' }}>
          Comprobantes del pedido ({vouchers.length})
        </div>
      )}
      {!vacio && <HistorialVoucher pedidoId={pedidoId} />}
      {!vacio && comprobante(actual)}
      {vacio && (
        <div data-testid="sin-captura" style={{ border: '2px dashed var(--cp-line, #E3D6C6)', borderRadius: 14, padding: '14px 12px', textAlign: 'center', color: 'var(--cp-soft, #2C4C5D)', fontSize: 14 }}>
          <strong style={{ color: 'var(--cp-navy, #0B2C3E)' }}>Sin captura (opcional).</strong> Se puede subir ahora o después.
          {!reemplazando && (
            <div style={{ marginTop: 8 }}>
              <Boton variante="secundario" onClick={iniciarCambio}>Subir captura</Boton>
            </div>
          )}
        </div>
      )}
      {anteriores.length > 0 && (
        <details data-testid="capturas-anteriores" style={{ border: '1px dashed var(--cp-line, #E3D6C6)', borderRadius: 10, padding: '6px 10px', background: 'var(--cp-cream, #FBF4EC)' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13, minHeight: 32, display: 'flex', alignItems: 'center', color: 'var(--cp-navy, #0B2C3E)' }}>
            Capturas anteriores ({anteriores.length})
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {anteriores.map((v) => comprobante(v))}
          </div>
        </details>
      )}
      {!reemplazando ? (
        // En el detalle (compacto) cada fila ya trae su «Reemplazar»
        !vacio && !compacto && (
          <Boton variante="secundario" onClick={iniciarCambio} style={{ alignSelf: 'flex-start' }}>
            Reemplazar voucher
          </Boton>
        )
      ) : (
        <div
          data-testid="reemplazo-voucher"
          style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1.5px solid var(--cp-orange, #E67929)', background: 'var(--cp-cream, #FFF4E6)', borderRadius: 14, padding: 12 }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy, #0B2C3E)' }}>{vacio ? 'Subir la captura' : 'Cambiar el voucher'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--cp-soft, #2C4C5D)' }}>
            {vacio
              ? 'Elige el medio y la foto del pago.'
              : 'Elige el medio y la foto correcta. Antes de guardar verás el voucher anterior junto al nuevo y escribirás el motivo una sola vez.'}
          </div>
          <div role="group" aria-label="Medio del voucher" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(['YAPE', 'PLIN', 'TRANSFERENCIA'] as const).map((m) => {
              const activo = medioCambio === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setMedioCambio(m)}
                  style={{
                    minHeight: 44,
                    padding: '6px 16px',
                    borderRadius: 999,
                    border: `1.5px solid ${activo ? 'var(--cp-navy, #0B2C3E)' : 'var(--cp-line, #E3D6C6)'}`,
                    background: activo ? 'var(--cp-navy, #0B2C3E)' : 'var(--cp-white, #FFFFFF)',
                    color: activo ? 'var(--cp-white, #FFFFFF)' : 'var(--cp-navy, #0B2C3E)',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {m === 'YAPE' ? 'Yape' : m === 'PLIN' ? 'Plin' : 'Transferencia'}
                </button>
              );
            })}
          </div>
          {medioCambio && (
            <SubirVoucherMozo
              key={medioCambio}
              cambioDirecto={!vacio}
              pedidoId={pedidoId}
              medio={medioCambio}
              alVoucherValido={() => undefined}
              alRespuesta={() => {
                setReemplazando(false);
                setRecarga((n) => n + 1);
              }}
            />
          )}
          <Boton variante="secundario" onClick={() => setReemplazando(false)} style={{ alignSelf: 'flex-start' }}>
            Cancelar
          </Boton>
        </div>
      )}
    </div>
  );
}

/** Un comprobante: la foto a un lado y su lectura al otro (en pantalla ancha); apilado en celular. */
function TarjetaComprobante({
  v,
  medio,
  total,
  onReasignado,
}: {
  v: VoucherPagoItem;
  medio?: string | null;
  total?: number | string | null;
  onReasignado: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ flex: '0 0 190px', maxWidth: '100%' }}>
        <FotoAmpliable archivoId={v.archivoId} />
      </div>
      <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <TarjetaLecturaVoucher
          voucher={{ id: v.id, semaforo: v.semaforo, motivos: v.motivos, extraido: v.extraido, medio: v.medio ?? medio ?? null }}
          pedido={{ total: total ?? null, medio: medio ?? null }}
          puedeVer
        />
        <ReasignarVoucherBoton voucherId={v.id} onReasignado={onReasignado} />
      </div>
    </div>
  );
}

const SEMAFORO_FILA: Record<string, { texto: string; bg: string; fg: string }> = {
  CONFIABLE: { texto: 'Legible', bg: '#DFF3E3', fg: '#1F5C33' },
  OBSERVADO: { texto: 'Revisar', bg: '#FFF3C4', fg: '#8A5A00' },
  RARO: { texto: 'Revisar', bg: '#FFF3C4', fg: '#8A5A00' },
  SIN_LECTURA: { texto: 'Revisar', bg: '#FFF3C4', fg: '#8A5A00' },
  ILEGIBLE: { texto: 'Ilegible', bg: '#F9DEDE', fg: '#9B1C1C' },
};

/** Miniatura 54×72 de la captura; tocarla abre el visor. */
function Miniatura({ archivoId, alAbrir }: { archivoId: string | number; alAbrir: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let vigente = true;
    obtenerBlobAutenticado(`/admin/archivos/${archivoId}`)
      .then((u) => vigente && setUrl(u))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [archivoId]);
  return (
    <button type="button" onClick={alAbrir} aria-label="Ver captura en grande" style={{ flex: 'none', width: 54, height: 72, borderRadius: 10, border: '1.5px solid var(--cp-line, #E3D6C6)', background: 'var(--cp-white, #FFFFFF)', padding: 0, overflow: 'hidden', cursor: 'zoom-in' }}>
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
    </button>
  );
}

/** Una captura en una fila corta: miniatura, medio · monto, operación y hora, semáforo y los botones Ver captura y Reemplazar. */
function FilaVoucher({
  v,
  medio,
  total,
  onReemplazar,
  onReasignado,
}: {
  v: VoucherPagoItem;
  medio?: string | null;
  total?: number | string | null;
  onReemplazar: () => void;
  onReasignado: () => void;
}) {
  const [visor, setVisor] = useState(false);
  const sem = SEMAFORO_FILA[v.semaforo] ?? SEMAFORO_FILA.SIN_LECTURA;
  const medioTxt = String(v.medio ?? medio ?? 'Captura');
  const monto = v.extraido?.monto;
  const operacion = v.operacion ?? v.extraido?.operacion;
  const hora = v.extraido?.hora;
  return (
    <div data-testid="fila-voucher" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="dp-voucher-fila">
        <Miniatura archivoId={v.archivoId} alAbrir={() => setVisor(true)} />
        <div style={{ flex: '1 1 140px', minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>
            {medioTxt}
            {monto != null ? ` · S/ ${Number(monto).toFixed(2)}` : ''}
          </div>
          {(operacion || hora) && (
            <div style={{ fontSize: 13.5, color: 'var(--cp-soft, #2C4C5D)', fontWeight: 600 }}>
              {operacion ? `Operación ${operacion}` : ''}
              {operacion && hora ? ' · ' : ''}
              {hora ?? ''}
            </div>
          )}
          <span data-testid="voucher-semaforo" style={{ display: 'inline-block', marginTop: 4, fontSize: 12, fontWeight: 800, borderRadius: 9999, padding: '2px 10px', background: sem.bg, color: sem.fg }}>
            {sem.texto}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Boton variante="secundario" onClick={() => setVisor(true)}>Ver captura</Boton>
          <Boton variante="secundario" onClick={onReemplazar} aria-label="Reemplazar voucher">Reemplazar</Boton>
        </div>
      </div>
      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13, minHeight: 32, display: 'flex', alignItems: 'center', color: 'var(--cp-navy, #0B2C3E)' }}>Lectura y detalle de la captura</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          <TarjetaLecturaVoucher
            voucher={{ id: v.id, semaforo: v.semaforo, motivos: v.motivos, extraido: v.extraido, medio: v.medio ?? medio ?? null }}
            pedido={{ total: total ?? null, medio: medio ?? null }}
            puedeVer
          />
          <ReasignarVoucherBoton voucherId={v.id} onReasignado={onReasignado} />
        </div>
      </details>
      {visor && <VisorCaptura archivoId={v.archivoId} alCerrar={() => setVisor(false)} />}
    </div>
  );
}
