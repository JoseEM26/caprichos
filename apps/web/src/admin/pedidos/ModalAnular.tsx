import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { pedidosApi, Pedido } from './pedidosApi';
import { ErrorApi } from '../../comun/api';
import '../cierre/pendientes-cierre.css';

const MOTIVOS_COMUNES = [
  'Cliente no recibió',
  'Pedido duplicado',
  'El cliente desistió',
  'Error al digitar',
  'Falta un insumo',
  'No contesta',
] as const;

export interface ModalAnularProps {
  pedidoId: string | number;
  codigoPedido: string;
  esCobro?: boolean;
  /** Ya no cambia nada: todo pedido se anula completo (se deja para no romper a quien lo pasa). */
  completo?: boolean;
  cobroId?: string | number;
  /** Solo el administrador puede anular el cobro de una caja ya cerrada. */
  esAdmin?: boolean;
  /** Detalle del pedido para el encabezado (cliente, modalidad, estado, total, líneas). Opcional. */
  pedido?: Pedido | null;
  alCerrar: () => void;
  alAnularExitoso: () => void;
}

const ETIQUETA_ESTADO: Record<string, string> = {
  COLA: 'En cola',
  PREPARANDO: 'Preparando',
  LISTO: 'Listo',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  ANULADO: 'Anulado',
};

const soles = (v: string | number | null | undefined) => `S/ ${Number(v || 0).toFixed(2)}`;

export function ModalAnular({
  pedidoId,
  codigoPedido,
  esCobro = false,
  cobroId,
  esAdmin = false,
  pedido,
  alCerrar,
  alAnularExitoso,
}: ModalAnularProps) {
  const [motivo, setMotivo] = useState<string>('');
  const [errorMensaje, setErrorMensaje] = useState<string>('');
  const [enviando, setEnviando] = useState<boolean>(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState<boolean>(false);
  // El servidor dijo CAJA_CERRADA: el administrador puede seguir con el ajuste en la caja de hoy
  const [cajaCerrada, setCajaCerrada] = useState<boolean>(false);
  const minimoMotivo = cajaCerrada ? 10 : 5;
  // Solo con el Control de almacén encendido y consumo registrado (el API avisa con tieneConsumoAlmacen)
  const [consumoAlmacen, setConsumoAlmacen] = useState<'MERMA' | 'DEVOLVER'>('MERMA');
  const preguntaAlmacen = !esCobro && pedido?.tieneConsumoAlmacen === true;
  // Todos los roles anulan el pedido completo con la misma advertencia; anular un cobro es aparte
  const pedidoCompleto = !esCobro;

  const validarCampos = (): boolean => {
    setErrorMensaje('');
    const motivoTrim = motivo.trim();
    if (motivoTrim.length < minimoMotivo) {
      setErrorMensaje(`El motivo es obligatorio y debe tener al menos ${minimoMotivo} caracteres.`);
      return false;
    }

    return true;
  };

  const iniciarAnulacion = () => {
    if (validarCampos()) {
      setMostrarConfirmar(true);
    }
  };

  const ejecutarAnulacion = async () => {
    const motivoParaEnviar = motivo.trim();

    setMostrarConfirmar(false);
    setEnviando(true);
    setErrorMensaje('');

    try {
      let idCobro = cobroId;
      if (esCobro && !idCobro) {
        try {
          const pedDet = await pedidosApi.obtenerPorId(pedidoId);
          if (pedDet.cobro_vigente_id) {
            idCobro = pedDet.cobro_vigente_id;
          }
        } catch {
          // Continuar
        }
      }

      if (esCobro && idCobro) {
        if (cajaCerrada) await pedidosApi.anularCobroCajaCerrada(idCobro, motivoParaEnviar);
        else await pedidosApi.anularCobro(idCobro, motivoParaEnviar);
      } else {
        if (preguntaAlmacen) await pedidosApi.cambiarEstado(pedidoId, 'ANULADO', motivoParaEnviar, undefined, consumoAlmacen);
        else await pedidosApi.cambiarEstado(pedidoId, 'ANULADO', motivoParaEnviar);
      }
      alAnularExitoso();
    } catch (err: any) {
      if (err instanceof ErrorApi && err.codigo === 'CAJA_CERRADA' && esCobro) {
        setCajaCerrada(true);
        setErrorMensaje(
          esAdmin
            ? 'La caja de este cobro ya está cerrada. Como administrador puedes anularlo de todos modos.'
            : 'La caja de este cobro ya está cerrada. Pide al administrador que lo anule.',
        );
      } else if (err instanceof ErrorApi) {
        setErrorMensaje(err.message || 'Error al anular');
      } else {
        setErrorMensaje(err?.message || 'Error al procesar la anulación');
      }
    } finally {
      setEnviando(false);
    }
  };

  const manejarCerrar = () => {
    alCerrar();
  };

  // Pedido con cobro: el servidor reversa puntos y stock al anularlo; si está entregado con cobro vigente lo rechaza
  const tieneCobro = !!pedido && (!!pedido.cobro_vigente_id || pedido.pago_estado === 'PAGADO');
  const lineas = pedido?.lineas ?? [];
  const nombreCliente = pedido?.cliente_nombre?.trim() || (pedido?.modalidad === 'MESA' && pedido?.mesa_nombre) || 'Sin nombre';

  return (
    <>
      <div
        onClick={manejarCerrar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'rgba(11, 44, 62, 0.55)',
        }}
      />
      <div role="dialog" aria-modal="true" aria-label={esCobro ? 'Anular cobro' : 'Anular pedido'} className="ad-dialogo">
        <div className="ad-cabecera">
          <div className="ad-titulo">
            {esCobro
              ? `Anular cobro del pedido ${codigoPedido}`
              : `Anular pedido ${codigoPedido}`}
          </div>
          <button type="button" className="ad-cerrar" onClick={manejarCerrar} aria-label="Cerrar">
            X
          </button>
        </div>

        <div className="ad-cuerpo">
          {pedido && (
            <dl className="ad-resumen" aria-label="Resumen del pedido">
              <div>
                <dt>Cliente</dt>
                <dd>{nombreCliente}</dd>
              </div>
              <div>
                <dt>Modalidad</dt>
                <dd>{pedido.modalidad}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{ETIQUETA_ESTADO[pedido.estado] ?? pedido.estado}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{soles(pedido.total)}</dd>
              </div>
            </dl>
          )}

          {pedido && (
            <details className="ad-lineas">
              <summary>
                Líneas del pedido ({lineas.length})
              </summary>
              <ul>
                {lineas.map((l) => (
                  <li key={l.id}>
                    <span>
                      {l.cantidad} × {l.nombre}
                    </span>
                    <span>{soles(l.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="ad-aviso" role="note">
            {esCobro
              ? `La anulación del cobro revierte el estado de pago del pedido a PENDIENTE y queda registrada en auditoría a nombre de quien la anula.`
              : `Un pedido anulado sale de cocina y reparto, y libera sus mesas. Requiere motivo de 5 o más caracteres.`}
            {pedidoCompleto && (
              <div style={{ marginTop: 6, fontWeight: 700 }}>
                Se anula el pedido COMPLETO, con todas sus áreas (no solo la que ves en esta pantalla). Se devuelve el stock; si ya estaba cobrado, su cobro también se anula y sale de la caja, y se reversan sus puntos y cupones. Queda registrado a tu nombre.
              </div>
            )}
            {tieneCobro && !esCobro && (
              <div style={{ marginTop: 6 }}>
                Este pedido tiene un cobro registrado: al anularlo se devuelve su stock y se reversan sus puntos. Si ya está entregado con cobro vigente, el sistema no lo anula: primero hay que anular el cobro.
              </div>
            )}
          </div>

          {/* Motivos comunes */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
              Elige o escribe el motivo
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {MOTIVOS_COMUNES.map((m) => {
                const seleccionado = motivo === m;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={seleccionado}
                    onClick={() => {
                      setMotivo(m);
                      setErrorMensaje('');
                    }}
                    style={{
                      minHeight: 44,
                      padding: '0 12px',
                      borderRadius: 9999,
                      border: '1.5px solid var(--cp-navy, #0B2C3E)',
                      background: seleccionado ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                      color: seleccionado ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            <label
              htmlFor="anular-motivo"
              style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}
            >
              Motivo detallado (al menos 5 caracteres)
            </label>
            <input
              id="anular-motivo"
              type="text"
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setErrorMensaje('');
              }}
              placeholder="Escribe el motivo de anulación..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 44,
                borderRadius: 10,
                border: '1.5px solid var(--cp-line, #E3D6C6)',
                background: 'var(--cp-white, #FFFFFF)',
                padding: '0 12px',
                fontSize: 14,
              }}
            />
          </div>

          {preguntaAlmacen && (
            <fieldset style={{ border: '1.5px solid var(--cp-line, #E3D6C6)', borderRadius: 10, padding: 10, margin: 0 }}>
              <legend style={{ fontWeight: 700, fontSize: 13 }}>¿Se llegó a preparar?</legend>
              <label style={{ display: 'flex', gap: 8, minHeight: 44, alignItems: 'center', fontSize: 13 }}>
                <input type="radio" name="consumo-almacen" checked={consumoAlmacen === 'MERMA'} onChange={() => setConsumoAlmacen('MERMA')} />
                Sí, se llegó a preparar: los ingredientes quedan como merma
              </label>
              <label style={{ display: 'flex', gap: 8, minHeight: 44, alignItems: 'center', fontSize: 13 }}>
                <input type="radio" name="consumo-almacen" checked={consumoAlmacen === 'DEVOLVER'} onChange={() => setConsumoAlmacen('DEVOLVER')} />
                No, nunca se preparó: devolver los ingredientes a Cocina
              </label>
            </fieldset>
          )}

          {errorMensaje && (
            <div role="alert" className="ad-error">
              {errorMensaje}
            </div>
          )}

          {cajaCerrada && esAdmin && (
            <div className="ad-aviso" role="note" data-testid="aviso-caja-cerrada">
              Si sigues, el pedido vuelve a «por cobrar» y se registra un egreso de ajuste por el efectivo de este cobro en la caja de hoy.
              La caja cerrada no cambia. Necesitas tener la caja de hoy abierta y escribir un motivo de al menos 10 caracteres.
            </div>
          )}
        </div>

        <div className="ad-pie">
          <Boton
            variante="secundario"
            disabled={enviando}
            onClick={manejarCerrar}
            style={{ minHeight: 44, borderRadius: 12, fontWeight: 800 }}
          >
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            cargando={enviando}
            disabled={enviando || motivo.trim().length < minimoMotivo || (cajaCerrada && !esAdmin)}
            onClick={iniciarAnulacion}
            style={{ minHeight: 44, borderRadius: 12, fontWeight: 800 }}
          >
            {cajaCerrada ? 'Anular de todos modos (caja cerrada)' : 'Confirmar anulación'}
          </Boton>
        </div>
      </div>

      {mostrarConfirmar && (
        <Confirmar
          abierto={mostrarConfirmar}
          titulo={
            esCobro
              ? `¿Anular el cobro de ${codigoPedido}?`
              : `¿Anular el pedido ${codigoPedido}?`
          }
          mensaje={`${cajaCerrada ? 'La caja ya está cerrada: el pedido vuelve a por cobrar y se registra un egreso de ajuste en la caja de hoy. ' : ''}${pedidoCompleto ? 'Se anula el pedido COMPLETO, todas las áreas. ' : ''}Motivo: ${motivo.trim()}.`}
          textoSi="Sí, anular"
          peligro
          alConfirmar={ejecutarAnulacion}
          alCancelar={() => setMostrarConfirmar(false)}
        />
      )}
    </>
  );
}
