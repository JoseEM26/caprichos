import { useState, useRef, useEffect } from 'react';
import { vouchersApi } from './vouchersApi';
import { reducirImagenVoucher } from './reducirImagenVoucher';
import { Cargando } from '../../comun/Cargando';
import { ErrorApi } from '../../comun/api';

export interface SubirVoucherMozoProps {
  pedidoId: string | number;
  medio: 'YAPE' | 'PLIN';
  alVoucherValido: (info: { id: string | number; legible: boolean }) => void;
  alCambiarEstado?: (estado: {
    subiendo: boolean;
    esValido: boolean;
    voucherId?: string | number;
  }) => void;
  bloqueado?: boolean;
}

export function SubirVoucherMozo({
  pedidoId,
  medio,
  alVoucherValido,
  alCambiarEstado,
  bloqueado = false,
}: SubirVoucherMozoProps) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaPreviaUrl, setVistaPreviaUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<boolean>(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const [esIlegible, setEsIlegible] = useState<boolean>(false);
  const [voucherValidoId, setVoucherValidoId] = useState<string | number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Limpiar vista previa previa al desmontar
  useEffect(() => {
    return () => {
      if (vistaPreviaUrl && vistaPreviaUrl.startsWith('blob:')) {
        URL.revokeObjectURL(vistaPreviaUrl);
      }
    };
  }, [vistaPreviaUrl]);

  const procesarYSubir = async (file: File) => {
    setErrorSubida(null);
    setEsIlegible(false);
    setVoucherValidoId(null);
    setSubiendo(true);
    alCambiarEstado?.({ subiendo: true, esValido: false });

    try {
      // 1. Reducción en cliente a max 1600px JPEG 0.85
      const blobReducido = await reducirImagenVoucher(file, 1600, 0.85);

      // 2. Subida a la API
      const respuesta = await vouchersApi.subirVoucher(
        blobReducido,
        pedidoId,
        medio,
      );

      // Regla de oro del mozo: SOLO ve legible / no legible. NUNCA semáforo ni datos extraídos.
      if (respuesta.legible) {
        setVoucherValidoId(respuesta.id);
        setEsIlegible(false);
        alVoucherValido({ id: respuesta.id, legible: true });
        alCambiarEstado?.({
          subiendo: false,
          esValido: true,
          voucherId: respuesta.id,
        });
      } else {
        setVoucherValidoId(null);
        setEsIlegible(true);
        alVoucherValido({ id: respuesta.id, legible: false });
        alCambiarEstado?.({ subiendo: false, esValido: false });
      }
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'No se pudo subir o analizar la foto del voucher';
      setErrorSubida(msg);
      setVoucherValidoId(null);
      setEsIlegible(false);
      alCambiarEstado?.({ subiendo: false, esValido: false });
    } finally {
      setSubiendo(false);
    }
  };

  const handleSeleccionarArchivo = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (vistaPreviaUrl && vistaPreviaUrl.startsWith('blob:')) {
      URL.revokeObjectURL(vistaPreviaUrl);
    }

    setArchivo(file);
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      setVistaPreviaUrl(URL.createObjectURL(file));
    }
    await procesarYSubir(file);
  };

  const handleTomarOtraFoto = () => {
    if (vistaPreviaUrl && vistaPreviaUrl.startsWith('blob:')) {
      URL.revokeObjectURL(vistaPreviaUrl);
    }
    setArchivo(null);
    setVistaPreviaUrl(null);
    setEsIlegible(false);
    setErrorSubida(null);
    setVoucherValidoId(null);
    alCambiarEstado?.({ subiendo: false, esValido: false });

    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  };

  return (
    <div
      data-testid="seccion-subir-voucher-mozo"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        background: 'var(--cp-cream, #FBF4EC)',
        border: '1.5px solid var(--cp-line, #E3D6C6)',
        borderRadius: '12px',
        padding: '12px',
        marginTop: '8px',
      }}
    >
      <div
        style={{
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 800,
          fontSize: '13px',
          color: 'var(--cp-navy, #0B2C3E)',
        }}
      >
        Foto del voucher ({medio})
      </div>

      <div style={{ fontSize: '12px', color: 'var(--cp-soft, #2C4C5D)', lineHeight: 1.4 }}>
        Obligatorio para pagos digitales en mesa. La foto se analiza al instante.
      </div>

      {/* Input de archivo oculto */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={bloqueado || subiendo}
        onChange={handleSeleccionarArchivo}
        data-testid="input-voucher-archivo"
        style={{ display: 'none' }}
      />

      {/* Botón para tomar/subir foto si no hay archivo aún */}
      {!archivo && (
        <button
          type="button"
          disabled={bloqueado || subiendo}
          onClick={() => inputRef.current?.click()}
          data-testid="btn-tomar-voucher"
          style={{
            minHeight: '44px',
            border: '1.5px solid var(--cp-navy, #0B2C3E)',
            borderRadius: '10px',
            background: 'var(--cp-white, #FFFFFF)',
            color: 'var(--cp-navy, #0B2C3E)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 700,
            fontSize: '13px',
            cursor: bloqueado || subiendo ? 'not-allowed' : 'pointer',
            padding: '8px 14px',
          }}
        >
          Tomar foto o subir voucher
        </button>
      )}

      {/* Vista previa y estado */}
      {vistaPreviaUrl && (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            background: 'var(--cp-white, #FFFFFF)',
            border: '1px solid var(--cp-line, #E3D6C6)',
            borderRadius: '10px',
            padding: '8px',
          }}
        >
          <img
            src={vistaPreviaUrl}
            alt="Vista previa del voucher"
            data-testid="img-vista-previa-voucher"
            style={{
              width: '64px',
              height: '64px',
              objectFit: 'cover',
              borderRadius: '6px',
              border: '1px solid var(--cp-line, #E3D6C6)',
            }}
          />
          <div style={{ flex: 1, minWidth: 0, fontSize: '12px' }}>
            <div
              style={{
                fontWeight: 700,
                color: 'var(--cp-navy, #0B2C3E)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {archivo?.name || 'Voucher seleccionado'}
            </div>
            <div style={{ color: 'var(--cp-soft, #2C4C5D)', marginTop: '2px' }}>
              {subiendo
                ? 'Analizando voucher...'
                : voucherValidoId
                ? 'Voucher legible'
                : esIlegible
                ? 'No legible'
                : 'Pendiente'}
            </div>
          </div>
        </div>
      )}

      {/* Estado: subiendo / analizando */}
      {subiendo && (
        <div
          data-testid="voucher-mozo-analizando"
          style={{ padding: '8px 0' }}
        >
          <Cargando mensaje="Analizando voucher en el momento..." />
        </div>
      )}

      {/* Error de ilegible según contrato:
          "si la foto no se lee, el mozo ve 'Este voucher no se lee bien. Vuelve a tomar la foto, por favor.' y debe repetirla.
          con boton 'Tomar otra foto'. El mozo NO ve semaforo ni datos." */}
      {esIlegible && !subiendo && (
        <div
          data-testid="voucher-mozo-ilegible"
          style={{
            background: '#FFF0E6',
            border: '1.5px solid var(--cp-rust, #B2500F)',
            borderRadius: '10px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              color: 'var(--cp-rust, #B2500F)',
              fontWeight: 700,
              fontSize: '13px',
              lineHeight: 1.4,
            }}
          >
            Este voucher no se lee bien. Vuelve a tomar la foto, por favor.
          </div>
          <button
            type="button"
            onClick={handleTomarOtraFoto}
            data-testid="btn-tomar-otra-foto"
            style={{
              alignSelf: 'flex-start',
              minHeight: '40px',
              padding: '0 14px',
              background: 'var(--cp-rust, #B2500F)',
              color: '#FFFFFF',
              border: 0,
              borderRadius: '8px',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '12.5px',
              cursor: 'pointer',
            }}
          >
            Tomar otra foto
          </button>
        </div>
      )}

      {/* Éxito: voucher legible */}
      {voucherValidoId && !subiendo && (
        <div
          data-testid="voucher-mozo-valido"
          style={{
            background: '#E8F5E9',
            border: '1px solid var(--cp-green, #2F7A45)',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              color: 'var(--cp-green, #2F7A45)',
              fontWeight: 700,
              fontSize: '12.5px',
            }}
          >
            Foto del voucher lista para confirmar
          </div>
          <button
            type="button"
            onClick={handleTomarOtraFoto}
            style={{
              border: '1px solid var(--cp-green, #2F7A45)',
              background: 'transparent',
              color: 'var(--cp-green, #2F7A45)',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            Cambiar
          </button>
        </div>
      )}

      {/* Error de red / API */}
      {errorSubida && !subiendo && (
        <div
          role="alert"
          style={{
            background: '#FFF0E6',
            border: '1px solid var(--cp-rust, #B2500F)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--cp-rust, #B2500F)',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          {errorSubida}
          <div style={{ marginTop: '6px' }}>
            <button
              type="button"
              onClick={handleTomarOtraFoto}
              style={{
                border: '1px solid var(--cp-rust, #B2500F)',
                background: 'transparent',
                color: 'var(--cp-rust, #B2500F)',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
