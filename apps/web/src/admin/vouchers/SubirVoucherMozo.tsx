import { useState, useRef, useEffect } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { vouchersApi, type ItemHistorialVoucher } from './vouchersApi';
import { FotoAmpliable } from './FotoAmpliable';
import { HistorialVoucher } from '../salon/HistorialVoucher';
import { reducirImagenVoucher } from './reducirImagenVoucher';
import { ErrorApi } from '../../comun/api';
import { MotivoCambioVoucher, MOTIVO_MINIMO } from './MotivoCambioVoucher';
import type { RespuestaSubirVoucher, RespuestaSubirVoucherMozo } from './tipos';

export interface SubirVoucherMozoProps {
  pedidoId: string | number;
  medio: 'YAPE' | 'PLIN' | 'TRANSFERENCIA' | 'TARJETA';
  alVoucherValido: (info: { id: string | number; legible: boolean }) => void;
  /** Respuesta completa de la API (semáforo y datos). Lo usa Caja; el mozo nunca la ve. */
  alRespuesta?: (respuesta: RespuestaSubirVoucher) => void;
  alCambiarEstado?: (estado: {
    subiendo: boolean;
    esValido: boolean;
    voucherId?: string | number;
  }) => void;
  bloqueado?: boolean;
  /** Ofrece la salida sin foto (código del supervisor): Caja/Admin y el mozo en su cobro de mesa. */
  ofrecerExcepcion?: boolean;
  /** Pedido nuevo del mozo: el voucher se puede subir después (texto «Opcional ahora»). */
  opcional?: boolean;
  /** Se ejecuta antes de subir la foto (p. ej. guardar el plan de pago para comparar el monto del medio). */
  antesDeSubir?: () => Promise<void>;
  /** Motivo del cambio al reemplazar un voucher vigente (Caja y Admin). */
  motivoCambio?: string;
  /** Muestra «Quitar voucher» tras subir la foto (la regla del servidor decide si se permite). */
  quitable?: boolean;
  /** Se llama tras quitar el voucher: la ventana vuelve a estar sin foto. */
  alQuitado?: () => void;
  /** Arranca directo en «elegir la foto nueva» (sin el paso «Voucher actual › Cambiar voucher»): Caja ya pulsó «Reemplazar voucher». */
  cambioDirecto?: boolean;
}

export function SubirVoucherMozo({
  pedidoId,
  medio,
  alVoucherValido,
  alRespuesta,
  alCambiarEstado,
  bloqueado = false,
  ofrecerExcepcion = false,
  opcional = false,
  antesDeSubir,
  motivoCambio,
  quitable = false,
  alQuitado,
  cambioDirecto = false,
}: SubirVoucherMozoProps) {
  // Id del voucher que acaba de subir: «Quitar voucher» lo retira (queda en el historial)
  const [ultimoVoucherId, setUltimoVoucherId] = useState<string | number | null>(null);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaPreviaUrl, setVistaPreviaUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<boolean>(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const [esIlegible, setEsIlegible] = useState<boolean>(false);
  const [voucherValidoId, setVoucherValidoId] = useState<string | number | null>(null);
  // Lectura automática no disponible: el voucher queda guardado y Caja lo revisa a mano
  const [revisionManual, setRevisionManual] = useState<boolean>(false);
  // Avisos de lo que no cuadra (texto): el voucher cuenta como subido igual; Caja decide
  const [avisos, setAvisos] = useState<string[]>([]);
  // Reemplazo de un voucher vigente: el servidor pide motivo (Caja y Admin); se escribe aquí y se reintenta
  const [pideMotivo, setPideMotivo] = useState(false);
  const [motivoLocal, setMotivoLocal] = useState('');

  // Voucher vigente del pedido para este medio (se muestra antes de cambiarlo) y cuántos anteriores hay
  const [actual, setActual] = useState<ItemHistorialVoucher | null>(null);
  const [anteriores, setAnteriores] = useState(0);
  const [cambiando, setCambiando] = useState(cambioDirecto);
  const [confirmandoCambio, setConfirmandoCambio] = useState(false);

  const cargarActual = () => {
    Promise.resolve()
      .then(() => vouchersApi.historialPedido(pedidoId))
      .then((r) => {
        const items = r?.items ?? [];
        setActual(items.find((i) => i.estado === 'VIGENTE' && (!i.medio || i.medio === medio)) ?? null);
        setAnteriores(items.filter((i) => i.estado === 'REEMPLAZADO').length);
      })
      .catch(() => undefined); // sin historial se sube como siempre; el servidor igual pide el motivo
  };
  useEffect(cargarActual, [pedidoId, medio]);

  const fechaHora = (iso: string) =>
    new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' });

  const textoGuardadoManual = 'Voucher guardado. La lectura automática no está disponible; Caja lo revisará.';

  const inputRef = useRef<HTMLInputElement>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);

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
      // 0. Plan de pago guardado antes de la foto (el monto que compara el servidor es el de este medio)
      await antesDeSubir?.();

      // 1. Reducción en cliente a max 1600px JPEG 0.85
      const blobReducido = await reducirImagenVoucher(file, 1600, 0.85);

      // 2. Subida a la API
      // El mozo recibe la forma reducida (legible, revisionManual, avisos): nunca semáforo
      const motivo = motivoLocal.trim() || motivoCambio;
      const respuesta = (await vouchersApi.subirVoucher(
        blobReducido,
        pedidoId,
        medio,
        ...(motivo ? [motivo] : []),
      )) as RespuestaSubirVoucherMozo;

      setPideMotivo(false);
      alRespuesta?.(respuesta);
      cargarActual();
      setUltimoVoucherId(respuesta.id);

      // Regla de oro del mozo: SOLO ve legible / no legible. NUNCA semáforo ni datos extraídos.
      if (respuesta.legible) {
        setVoucherValidoId(respuesta.id);
        setRevisionManual(respuesta.revisionManual === true);
        setAvisos(respuesta.avisos ?? []);
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
      if (err instanceof ErrorApi && err.codigo === 'MOTIVO_CAMBIO_REQUERIDO') {
        setPideMotivo(true);
        setErrorSubida(null);
        setVoucherValidoId(null);
        alCambiarEstado?.({ subiendo: false, esValido: false });
        return;
      }
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
    // Ya había un voucher: primero se compara «Antes» y «Nuevo» y se pide el motivo
    if (actual && !ultimoVoucherId) {
      setConfirmandoCambio(true);
      return;
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
        {medio === 'TARJETA' ? 'Foto de la copia del POS' : `Foto del voucher (${medio})`}
      </div>

      <div style={{ fontSize: '12px', color: 'var(--cp-soft, #2C4C5D)', lineHeight: 1.4 }}>
        {opcional
          ? 'Opcional ahora: puedes subirlo después. La foto se analiza al instante.'
          : 'La foto es opcional; pídesela al cliente con amabilidad. Se analiza al instante.'}
      </div>

      {/* Inputs ocultos: cámara (capture) y galería/archivo (sin capture) */}
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
      <input
        ref={inputGaleriaRef}
        type="file"
        accept="image/*"
        disabled={bloqueado || subiendo}
        onChange={handleSeleccionarArchivo}
        data-testid="input-voucher-galeria"
        style={{ display: 'none' }}
      />

      {/* Dos caminos: foto con la cámara o captura desde la galería/archivo */}
      {actual && !archivo && (
        <div data-testid="voucher-actual" style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--cp-white, #FFFFFF)', border: '1px solid var(--cp-line, #E3D6C6)', borderRadius: '10px', padding: '8px' }}>
          <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--cp-navy, #0B2C3E)' }}>Voucher actual</div>
          {actual.archivoId && <FotoAmpliable archivoId={actual.archivoId} alt="Voucher actual" alturaMaxima={140} />}
          <div style={{ fontSize: '12px', color: 'var(--cp-soft, #2C4C5D)', lineHeight: 1.4 }}>
            Subido el {fechaHora(actual.subidoEn)}
            {actual.subidoPor ? ` por ${actual.subidoPor}` : ''} · {actual.legible ? 'Se lee bien' : 'No se lee'}
            {actual.semaforo ? ` · Semáforo: ${actual.semaforo}` : ''}
          </div>
          {!cambiando && (
            <button
              type="button"
              disabled={bloqueado || subiendo}
              onClick={() => setCambiando(true)}
              data-testid="btn-cambiar-voucher"
              style={{ alignSelf: 'flex-start', minHeight: '44px', minWidth: '44px', border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: '10px', background: 'var(--cp-white, #FFFFFF)', color: 'var(--cp-navy, #0B2C3E)', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '13px', padding: '8px 14px' }}
            >
              Cambiar voucher
            </button>
          )}
        </div>
      )}

      {!archivo && (!actual || cambiando) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
            Tomar foto
          </button>
          <button
            type="button"
            disabled={bloqueado || subiendo}
            onClick={() => inputGaleriaRef.current?.click()}
            data-testid="btn-subir-captura"
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
            Subir captura
          </button>
        </div>
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
                ? 'Subiendo imagen…'
                : voucherValidoId
                ? avisos.length > 0
                  ? 'Voucher recibido'
                  : revisionManual
                    ? 'Voucher guardado'
                    : 'Voucher legible'
                : esIlegible
                ? 'No legible'
                : 'Pendiente'}
            </div>
          </div>
        </div>
      )}

      {/* Tras subir: cambiar la foto o quitar el voucher (44 px). La regla del servidor decide si se permite */}
      {archivo && !subiendo && ultimoVoucherId != null && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            type="button"
            disabled={bloqueado || quitando}
            onClick={handleTomarOtraFoto}
            data-testid="btn-cambiar-foto"
            style={{
              minHeight: '44px',
              minWidth: '44px',
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              borderRadius: '10px',
              background: 'var(--cp-white, #FFFFFF)',
              color: 'var(--cp-navy, #0B2C3E)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '13px',
              padding: '8px 14px',
            }}
          >
            Cambiar foto
          </button>
          {quitable && (
            <button
              type="button"
              disabled={bloqueado || quitando}
              onClick={() => setConfirmandoQuitar(true)}
              data-testid="btn-quitar-voucher"
              style={{
                minHeight: '44px',
                minWidth: '44px',
                border: '1.5px solid var(--cp-rust, #B2500F)',
                borderRadius: '10px',
                background: 'var(--cp-white, #FFFFFF)',
                color: 'var(--cp-rust, #B2500F)',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '13px',
                padding: '8px 14px',
              }}
            >
              Quitar voucher
            </button>
          )}
        </div>
      )}
      <Confirmar
        abierto={confirmandoCambio}
        titulo="Cambiar el voucher"
        mensaje="El voucher actual queda en el historial como reemplazado; no se borra."
        textoSi="Sí, cambiar"
        textoNo="No"
        alConfirmar={() => {
          if (motivoLocal.trim().length < MOTIVO_MINIMO || !archivo) return;
          setConfirmandoCambio(false);
          void procesarYSubir(archivo);
        }}
        alCancelar={() => {
          setConfirmandoCambio(false);
          setArchivo(null);
          setVistaPreviaUrl(null);
        }}
      >
        <div data-testid="comparar-voucher" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '10px 0 6px' }}>
          {[
            { rotulo: 'Antes', nota: actual ? fechaHora(actual.subidoEn) : '', contenido: actual?.archivoId ? <FotoAmpliable archivoId={actual.archivoId} alt="Voucher anterior" alturaMaxima={150} /> : null },
            { rotulo: 'Nuevo', nota: 'Foto elegida ahora', contenido: vistaPreviaUrl ? <img src={vistaPreviaUrl} alt="Voucher nuevo" style={{ display: 'block', maxWidth: '100%', maxHeight: 150, borderRadius: 8, objectFit: 'contain', margin: '0 auto' }} /> : null },
          ].map((c) => (
            <div
              key={c.rotulo}
              style={{ minWidth: 0, border: `1.5px solid ${c.rotulo === 'Nuevo' ? 'var(--cp-green, #2F7A45)' : 'var(--cp-line, #E3D6C6)'}`, borderRadius: 12, padding: 8, background: 'var(--cp-white, #FFFFFF)', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: c.rotulo === 'Nuevo' ? 'var(--cp-green, #2F7A45)' : 'var(--cp-soft, #2C4C5D)' }}>{c.rotulo}</div>
              {c.contenido}
              {c.nota && <div style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--cp-soft, #2C4C5D)' }}>{c.nota}</div>}
            </div>
          ))}
        </div>
        <MotivoCambioVoucher id={`motivo-nuevo-${pedidoId}-${medio}`} valor={motivoLocal} alCambiar={setMotivoLocal} />
      </Confirmar>
      {anteriores > 0 && (
        <HistorialVoucher key={anteriores} pedidoId={pedidoId} total={anteriores} rotulo="Ver vouchers anteriores" soloAnteriores />
      )}
      <Confirmar
        abierto={confirmandoQuitar}
        titulo="Quitar el voucher"
        mensaje="El voucher se retira del pedido. Queda en el historial como retirado; no se borra."
        textoSi="Sí, quitar"
        textoNo="No"
        cargando={quitando}
        alConfirmar={async () => {
          if (ultimoVoucherId == null) return;
          setQuitando(true);
          try {
            await vouchersApi.quitarVoucher(ultimoVoucherId);
            setConfirmandoQuitar(false);
            setArchivo(null);
            setVistaPreviaUrl(null);
            setVoucherValidoId(null);
            setUltimoVoucherId(null);
            setEsIlegible(false);
            setAvisos([]);
            alCambiarEstado?.({ subiendo: false, esValido: false });
            cargarActual();
            alQuitado?.();
          } catch (err) {
            setConfirmandoQuitar(false);
            setErrorSubida(err instanceof ErrorApi ? err.message : 'No se pudo quitar el voucher. Intenta de nuevo.');
          } finally {
            setQuitando(false);
          }
        }}
        alCancelar={() => setConfirmandoQuitar(false)}
      />

      {/* Estado: subiendo / analizando */}
      {subiendo && (
        <div
          data-testid="voucher-mozo-analizando"
          style={{ padding: '8px 0' }}
        >
          <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 13, fontWeight: 700, color: 'var(--cp-navy, #0B2C3E)' }}>
            <span aria-hidden="true" style={{ width: 18, height: 18, border: '3px solid var(--cp-line, #E3D6C6)', borderTopColor: 'var(--cp-orange, #F28C28)', borderRadius: '50%', display: 'inline-block', animation: 'cp-spin 0.8s linear infinite' }} />
            Subiendo imagen…
          </div>
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
            {ofrecerExcepcion
              ? 'No se lee: puedes subir otra foto o seguir sin captura (es opcional).'
              : 'Este voucher no se lee bien. Vuelve a tomar la foto, por favor.'}
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
      {/* Avisos: color de advertencia (no de error). Cuenta como subido; Caja decide. */}
      {voucherValidoId && !subiendo && avisos.length > 0 && (
        <div
          data-testid="voucher-mozo-avisos"
          role="status"
          style={{
            background: '#FFF7E0',
            border: '1.5px solid #B7791F',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ color: '#7A4E0B', fontWeight: 800, fontSize: '12.5px' }}>
            Voucher recibido, pero revisa esto:
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', color: '#7A4E0B', fontSize: '12.5px', lineHeight: 1.4 }}>
            {avisos.map((aviso, i) => (
              <li key={i}>{aviso}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleTomarOtraFoto}
            data-testid="btn-subir-otra-foto"
            style={{
              alignSelf: 'flex-start',
              minHeight: '44px',
              padding: '0 14px',
              background: 'transparent',
              color: '#7A4E0B',
              border: '1.5px solid #B7791F',
              borderRadius: '8px',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '12.5px',
              cursor: 'pointer',
            }}
          >
            Subir otra foto
          </button>
        </div>
      )}

      {/* Éxito: voucher legible (sin avisos) */}
      {voucherValidoId && !subiendo && avisos.length === 0 && (
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
            {revisionManual ? textoGuardadoManual : 'Foto del voucher lista para confirmar'}
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

      {/* Cambio de un voucher que ya estaba: motivo obligatorio (queda en el historial) */}
      {pideMotivo && archivo && !subiendo && (
        <div
          data-testid="motivo-cambio-voucher"
          style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--cp-white, #FFFFFF)', border: '1.5px solid var(--cp-orange, #E67929)', borderRadius: '10px', padding: '10px 12px' }}
        >
          <MotivoCambioVoucher id={`motivo-cambio-${pedidoId}-${medio}`} valor={motivoLocal} alCambiar={setMotivoLocal} pregunta="Este pedido ya tenía un voucher. ¿Por qué lo cambias?" />
          <button
            type="button"
            disabled={motivoLocal.trim().length < 5}
            onClick={() => archivo && procesarYSubir(archivo)}
            style={{ minHeight: '44px', border: 'none', borderRadius: '10px', background: 'var(--cp-orange, #E67929)', color: 'var(--cp-navy, #0B2C3E)', fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '13px', cursor: motivoLocal.trim().length < 5 ? 'not-allowed' : 'pointer', opacity: motivoLocal.trim().length < 5 ? 0.6 : 1 }}
          >
            Guardar cambio de voucher
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
