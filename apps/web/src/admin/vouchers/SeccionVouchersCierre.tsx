import { useState, useEffect, useCallback } from 'react';
import { vouchersApi } from './vouchersApi';
import { BannerVouchersIaPausa } from './BannerVouchersIaPausa';
import { VoucherPagoItem, SemaforoVoucher } from './tipos';
import { obtenerBlobAutenticado, ErrorApi } from '../../comun/api';
import { Confirmar } from '../../comun/Confirmar';
import { Cargando } from '../../comun/Cargando';

export interface SeccionVouchersCierreProps {
  fecha?: string;
  puedeVer?: boolean;
}

const CONFIG_SEMAFORO: Record<
  SemaforoVoucher,
  { label: string; color: string; bg: string; border: string }
> = {
  CONFIABLE: {
    label: 'Confiable',
    color: '#2F7A45',
    bg: '#E8F5E9',
    border: '#2F7A45',
  },
  OBSERVADO: {
    label: 'Observado',
    color: '#D99E39',
    bg: '#FFF9E6',
    border: '#D99E39',
  },
  RARO: {
    label: 'Raro',
    color: '#B2500F',
    bg: '#FFF0E6',
    border: '#B2500F',
  },
  ILEGIBLE: {
    label: 'Ilegible',
    color: '#607D8B',
    bg: '#ECEFF1',
    border: '#607D8B',
  },
  SIN_LECTURA: {
    label: 'Sin lectura',
    color: '#78909C',
    bg: '#ECEFF1',
    border: '#78909C',
  },
};

function MiniaturaVoucher({ archivoId }: { archivoId: string | number }) {
  const [url, setUrl] = useState<string>('');
  const [fallo, setFallo] = useState<boolean>(false);

  useEffect(() => {
    let activo = true;
    obtenerBlobAutenticado(`/admin/archivos/${archivoId}`)
      .then((blobUrl) => {
        if (activo) {
          if (blobUrl) setUrl(blobUrl);
          else setFallo(true);
        }
      })
      .catch(() => {
        if (activo) setFallo(true);
      });

    return () => {
      activo = false;
    };
  }, [archivoId]);

  if (fallo || !url) {
    return (
      <div
        data-testid={`miniatura-fallback-${archivoId}`}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '8px',
          background: 'var(--cp-line, #E3D6C6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          color: 'var(--cp-soft, #2C4C5D)',
          fontWeight: 700,
        }}
      >
        {fallo ? 'Error' : '...'}
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Ver foto completa del voucher"
      style={{ display: 'block', textDecoration: 'none' }}
    >
      <img
        src={url}
        alt={`Voucher ${archivoId}`}
        data-testid={`miniatura-img-${archivoId}`}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '8px',
          objectFit: 'cover',
          border: '1.5px solid var(--cp-line, #E3D6C6)',
          display: 'block',
        }}
      />
    </a>
  );
}

export function SeccionVouchersCierre({
  fecha,
  puedeVer = true,
}: SeccionVouchersCierreProps) {
  const [vouchers, setVouchers] = useState<VoucherPagoItem[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Confirmar Sí/No
  const [voucherAMarcar, setVoucherAMarcar] = useState<VoucherPagoItem | null>(null);
  const [marcando, setMarcando] = useState<boolean>(false);

  const fechaConsulta =
    fecha || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

  const cargarVouchers = useCallback(async () => {
    if (!puedeVer) {
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);
    try {
      const items = await vouchersApi.listarVouchers({
        fecha: fechaConsulta,
        estado: 'todos',
      });
      setVouchers(Array.isArray(items) ? items : []);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'No se pudieron cargar los vouchers digitales del día';
      setError(msg);
      setVouchers([]);
    } finally {
      setCargando(false);
    }
  }, [fechaConsulta, puedeVer]);

  useEffect(() => {
    cargarVouchers();
  }, [cargarVouchers]);

  if (!puedeVer) {
    return null;
  }

  const pendientesCount = vouchers.filter((v) => !v.revisadoEn).length;

  const handleConfirmarRevisado = async () => {
    if (!voucherAMarcar) return;
    setMarcando(true);
    try {
      const res = await vouchersApi.marcarRevisado(voucherAMarcar.id);
      setVouchers((prev) =>
        prev.map((v) =>
          v.id === voucherAMarcar.id
            ? {
                ...v,
                revisadoEn: res.revisadoEn || new Date().toISOString(),
              }
            : v,
        ),
      );
      setVoucherAMarcar(null);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'Error al marcar el voucher como revisado';
      setError(msg);
    } finally {
      setMarcando(false);
    }
  };

  return (
    <div
      data-testid="seccion-vouchers-cierre"
      style={{
        background: 'var(--cp-white, #FFFFFF)',
        border: '1px solid var(--cp-line, #E3D6C6)',
        borderRadius: '14px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        fontFamily: 'Montserrat, sans-serif',
      }}
    >
      <BannerVouchersIaPausa />
      {/* Cabecera de la sección */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div>
          <div
            style={{
              fontWeight: 800,
              fontSize: '16px',
              color: 'var(--cp-navy, #0B2C3E)',
            }}
          >
            Vouchers digitales del día
          </div>
          <div style={{ fontSize: '12px', color: 'var(--cp-soft, #2C4C5D)', marginTop: '2px' }}>
            Yape y Plin analizados con IA. No bloquea el cierre de caja.
          </div>
        </div>

        {/* Contador de pendientes */}
        <div
          data-testid="contador-pendientes-vouchers"
          style={{
            padding: '4px 12px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 800,
            background:
              pendientesCount > 0 ? '#FFF9E6' : '#E8F5E9',
            color:
              pendientesCount > 0 ? 'var(--cp-gold, #D99E39)' : 'var(--cp-green, #2F7A45)',
            border: `1.5px solid ${
              pendientesCount > 0 ? 'var(--cp-gold, #D99E39)' : 'var(--cp-green, #2F7A45)'
            }`,
          }}
        >
          {pendientesCount > 0
            ? `Faltan revisar: ${pendientesCount} voucher${pendientesCount > 1 ? 's' : ''}`
            : `Todos los vouchers revisados (${vouchers.length})`}
        </div>
      </div>

      {/* Estado cargando */}
      {cargando && (
        <div style={{ padding: '12px 0' }}>
          <Cargando mensaje="Cargando vouchers digitales..." />
        </div>
      )}

      {/* Error de carga */}
      {error && !cargando && (
        <div
          role="alert"
          style={{
            background: '#FFF0E6',
            border: '1px solid var(--cp-rust, #B2500F)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--cp-rust, #B2500F)',
            fontSize: '12.5px',
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      {/* Lista vacía */}
      {!cargando && vouchers.length === 0 && (
        <div
          style={{
            padding: '16px',
            textAlign: 'center',
            fontSize: '13px',
            color: 'var(--cp-soft, #2C4C5D)',
            background: 'var(--cp-cream, #FBF4EC)',
            borderRadius: '10px',
          }}
        >
          No hay vouchers digitales registrados en este turno.
        </div>
      )}

      {/* Lista de vouchers del día */}
      {!cargando && vouchers.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {vouchers.map((v) => {
            const sem = v.semaforo in CONFIG_SEMAFORO ? v.semaforo : 'SIN_LECTURA';
            const cfg = CONFIG_SEMAFORO[sem];
            const extraido = v.extraido;
            const estaRevisado = Boolean(v.revisadoEn);

            return (
              <div
                key={v.id}
                data-testid={`voucher-item-${v.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'var(--cp-cream, #FBF4EC)',
                  border: '1px solid var(--cp-line, #E3D6C6)',
                  flexWrap: 'wrap',
                }}
              >
                {/* Miniatura y datos principales */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', flex: 1 }}>
                  <MiniaturaVoucher archivoId={v.archivoId} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '14px',
                          color: 'var(--cp-navy, #0B2C3E)',
                        }}
                      >
                        {extraido?.monto != null
                          ? `S/ ${Number(extraido.monto).toFixed(2)}`
                          : 'Monto no visible'}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--cp-soft, #2C4C5D)',
                          background: 'var(--cp-white, #FFFFFF)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid var(--cp-line, #E3D6C6)',
                        }}
                      >
                        {v.medio || extraido?.medioDetectado || 'Digital'} · {v.origen}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--cp-soft, #2C4C5D)' }}>
                      {extraido?.titular ? `Titular: ${extraido.titular}` : ''}
                      {extraido?.titular && extraido?.operacion ? ' · ' : ''}
                      {extraido?.operacion ? `Op: ${extraido.operacion}` : ''}
                      {!extraido?.titular && !extraido?.operacion && 'Sin datos extraídos'}
                    </div>

                    {v.motivos && v.motivos.length > 0 && (
                      <div style={{ fontSize: '11px', color: cfg.color, fontWeight: 600 }}>
                        {v.motivos.join(' · ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Semáforo y acción de Marcar Revisado */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 800,
                      background: cfg.bg,
                      color: cfg.color,
                      border: `1px solid ${cfg.border}`,
                    }}
                  >
                    {cfg.label}
                  </span>

                  {estaRevisado ? (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--cp-green, #2F7A45)',
                        background: '#E8F5E9',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--cp-green, #2F7A45)',
                      }}
                    >
                      Revisado
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setVoucherAMarcar(v)}
                      data-testid={`btn-marcar-revisado-${v.id}`}
                      style={{
                        minHeight: '36px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1.5px solid var(--cp-navy, #0B2C3E)',
                        background: 'var(--cp-white, #FFFFFF)',
                        color: 'var(--cp-navy, #0B2C3E)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Marcar revisado
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Confirmar Sí/No obligatorio por contrato:
          "boton 'Marcar revisado' (Si/No Confirmar)" */}
      {voucherAMarcar && (
        <Confirmar
          abierto={Boolean(voucherAMarcar)}
          titulo="¿Marcar voucher como revisado?"
          mensaje={`¿Confirmas que revisaste el voucher de ${
            voucherAMarcar.extraido?.monto != null
              ? `S/ ${Number(voucherAMarcar.extraido.monto).toFixed(2)}`
              : 'monto digital'
          } (${voucherAMarcar.medio || 'Yape/Plin'})?`}
          textoConfirmar="Sí, marcar revisado"
          textoNo="No, cancelar"
          cargando={marcando}
          alConfirmar={handleConfirmarRevisado}
          alCancelar={() => setVoucherAMarcar(null)}
        />
      )}
    </div>
  );
}
