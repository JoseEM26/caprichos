import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { CampoCodigoSupervisor } from '../../comun/CampoCodigoSupervisor';
import { pedidosApi } from './pedidosApi';
import { ErrorApi } from '../../comun/api';

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
  cobroId?: string | number;
  alCerrar: () => void;
  alAnularExitoso: () => void;
}

export function ModalAnular({
  pedidoId,
  codigoPedido,
  esCobro = false,
  cobroId,
  alCerrar,
  alAnularExitoso,
}: ModalAnularProps) {
  const [motivo, setMotivo] = useState<string>('');
  const [codigo, setCodigo] = useState<string>('');
  const [errorMensaje, setErrorMensaje] = useState<string>('');
  const [enviando, setEnviando] = useState<boolean>(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState<boolean>(false);

  const validarCampos = (): boolean => {
    setErrorMensaje('');
    const motivoTrim = motivo.trim();
    if (motivoTrim.length < 5) {
      setErrorMensaje('El motivo es obligatorio y debe tener al menos 5 caracteres.');
      return false;
    }

    const codigoTrim = codigo.trim();
    if (!/^\d{6}$/.test(codigoTrim)) {
      setErrorMensaje('El código del supervisor debe ser de exactamente 6 dígitos numéricos.');
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
    const codigoParaEnviar = codigo.trim();
    const motivoParaEnviar = motivo.trim();

    // Regla de seguridad: el código no queda en el estado tras enviar
    setCodigo('');
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
        await pedidosApi.anularCobro(idCobro, motivoParaEnviar, codigoParaEnviar);
      } else {
        await pedidosApi.cambiarEstado(
          pedidoId,
          'ANULADO',
          motivoParaEnviar,
          codigoParaEnviar,
        );
      }
      alAnularExitoso();
    } catch (err: any) {
      if (err instanceof ErrorApi) {
        if (err.codigo === 'CODIGO_INVALIDO' || err.codigo === 'PIN_INVALIDO') {
          setErrorMensaje('Código del supervisor inválido. Pídelo nuevamente a la supervisora.');
        } else if (err.codigo === 'CODIGO_BLOQUEADO' || err.codigo === 'PIN_BLOQUEADO') {
          setErrorMensaje('Demasiados intentos fallidos. Bloqueado temporalmente por 5 minutos.');
        } else if (err.codigo === 'SUPERVISOR_SIN_CONFIGURAR') {
          setErrorMensaje('El local aún no tiene configurado el código de supervisor. El administrador debe generarlo desde su pantalla.');
        } else {
          setErrorMensaje(err.message || 'Error al anular');
        }
      } else {
        setErrorMensaje(err?.message || 'Error al procesar la anulación');
      }
    } finally {
      setEnviando(false);
    }
  };

  const manejarCerrar = () => {
    setCodigo('');
    alCerrar();
  };

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
      <div
        role="dialog"
        aria-modal="true"
        aria-label={esCobro ? 'Anular cobro' : 'Anular pedido'}
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(540px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream, #FBF4EC)',
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: 20,
              color: 'var(--cp-navy, #0B2C3E)',
            }}
          >
            {esCobro
              ? `Anular cobro del pedido ${codigoPedido}`
              : `Anular pedido ${codigoPedido}`}
          </div>
          <button
            onClick={manejarCerrar}
            aria-label="Cerrar"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              background: 'transparent',
              color: 'var(--cp-navy, #0B2C3E)',
              fontSize: 20,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            X
          </button>
        </div>

        <div style={{ fontSize: 13, lineHeight: '18px', color: 'var(--cp-soft, #2C4C5D)' }}>
          {esCobro
            ? 'La anulación del cobro revierte el estado de pago del pedido a PENDIENTE y queda registrada en auditoría con el PIN del supervisor.'
            : 'Un pedido anulado sale de cocina y reparto, y libera sus mesas. Requiere motivo de 5 o más caracteres y el PIN de 6 dígitos de la supervisora.'}
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
                  onClick={() => {
                    setMotivo(m);
                    setErrorMensaje('');
                  }}
                  style={{
                    minHeight: 38,
                    padding: '0 12px',
                    borderRadius: 9999,
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    background: seleccionado
                      ? 'var(--cp-navy, #0B2C3E)'
                      : 'transparent',
                    color: seleccionado
                      ? 'var(--cp-cream, #FBF4EC)'
                      : 'var(--cp-navy, #0B2C3E)',
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
            style={{
              fontWeight: 700,
              fontSize: 13,
              display: 'block',
              marginBottom: 4,
            }}
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

        {/* Código de supervisor (6 dígitos) */}
        <CampoCodigoSupervisor
          id="anular-pin"
          valor={codigo}
          onChange={(v) => {
            setCodigo(v);
            setErrorMensaje('');
          }}
          etiqueta="Código del supervisor (6 dígitos)"
          ayuda="Pídelo a la supervisora: lo ve en su pantalla y cambia cada 30 segundos"
        />

        {/* Mensaje de error */}
        {errorMensaje && (
          <div
            role="alert"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--cp-rust, #B2500F)',
              background: '#FFF0E6',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--cp-rust, #B2500F)',
            }}
          >
            {errorMensaje}
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Boton
            variante="peligro"
            cargando={enviando}
            disabled={enviando || motivo.trim().length < 5 || codigo.length !== 6}
            onClick={iniciarAnulacion}
            style={{
              flex: 1,
              minHeight: 52,
              borderRadius: 12,
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            Confirmar anulación
          </Boton>
          <Boton
            variante="secundario"
            disabled={enviando}
            onClick={manejarCerrar}
            style={{
              flex: 1,
              minHeight: 52,
              borderRadius: 12,
              fontWeight: 800,
            }}
          >
            Cancelar
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
          mensaje={`Motivo: ${motivo.trim()}. Esta acción requiere el PIN del supervisor ingresado.`}
          textoSi="Sí, anular"
          peligro
          alConfirmar={ejecutarAnulacion}
          alCancelar={() => setMostrarConfirmar(false)}
        />
      )}
    </>
  );
}
