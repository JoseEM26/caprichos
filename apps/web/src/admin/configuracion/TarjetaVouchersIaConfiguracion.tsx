import { useState, useEffect, useCallback } from 'react';
import { useSesion } from '../../comun/sesion';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { ErrorApi } from '../../comun/api';
import { vouchersApi, ResumenConsumoVoucherIa } from '../vouchers/vouchersApi';
import { ParametrosVoucherConfig } from '../vouchers/tipos';

export interface TarjetaVouchersIaConfiguracionProps {
  esAdmin?: boolean;
}

function useSesionSegura() {
  try {
    return useSesion();
  } catch {
    return null;
  }
}

export function TarjetaVouchersIaConfiguracion({
  esAdmin: esAdminProp,
}: TarjetaVouchersIaConfiguracionProps = {}) {
  const sesion = useSesionSegura();
  const esAdmin =
    esAdminProp !== undefined
      ? esAdminProp
      : (sesion?.usuario?.rol || '').toUpperCase() === 'ADMIN' ||
        Boolean(sesion?.tiene?.('ADMIN'));

  const [config, setConfig] = useState<ParametrosVoucherConfig>({
    voucher_ia_activo: false,
    voucher_titular_nombre: 'Kevin',
    voucher_yape_numero: '946388934',
    voucher_plin_numero: '946388934',
  });

  // Campos de formulario editables
  const [titularNombre, setTitularNombre] = useState<string>('Kevin');
  const [yapeNumero, setYapeNumero] = useState<string>('946388934');
  const [plinNumero, setPlinNumero] = useState<string>('946388934');

  const [consumoIa, setConsumoIa] = useState<ResumenConsumoVoucherIa | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);

  // Modales Confirmar Sí/No
  const [confirmarSwitchAbierto, setConfirmarSwitchAbierto] = useState<boolean>(false);
  const [confirmarGuardarCampos, setConfirmarGuardarCampos] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);

  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const cfg = await vouchersApi.obtenerConfiguracion();
      setConfig(cfg);
      setTitularNombre(cfg.voucher_titular_nombre);
      setYapeNumero(cfg.voucher_yape_numero);
      setPlinNumero(cfg.voucher_plin_numero);

      const consumo = await vouchersApi.obtenerConsumoIa();
      setConsumoIa(consumo);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'Error al cargar la configuración de lectura de vouchers';
      setError(msg);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleSolicitarSwitch = () => {
    if (!esAdmin) return;
    setError(null);
    setMensajeExito(null);
    setConfirmarSwitchAbierto(true);
  };

  const handleConfirmarSwitch = async () => {
    const nuevoValor = !config.voucher_ia_activo;
    setGuardando(true);
    setError(null);
    try {
      await vouchersApi.guardarParametro('voucher_ia_activo', nuevoValor);
      setConfig((prev) => ({ ...prev, voucher_ia_activo: nuevoValor }));
      setConfirmarSwitchAbierto(false);

      const ahora = new Date().toLocaleTimeString('es-PE', { hour12: false });
      setMensajeExito(
        nuevoValor
          ? `Lectura de vouchers con IA activada a las ${ahora}`
          : `Lectura de vouchers con IA desactivada a las ${ahora}`,
      );
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'No se pudo actualizar el estado de la lectura de vouchers con IA';
      setError(msg);
      setConfirmarSwitchAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  const handleSolicitarGuardarCampos = () => {
    if (!esAdmin) return;
    setError(null);
    setMensajeExito(null);
    setConfirmarGuardarCampos(true);
  };

  const handleConfirmarGuardarCampos = async () => {
    setGuardando(true);
    setError(null);
    try {
      await vouchersApi.guardarParametro(
        'voucher_titular_nombre',
        titularNombre.trim() || 'Kevin',
      );
      await vouchersApi.guardarParametro(
        'voucher_yape_numero',
        yapeNumero.trim() || '946388934',
      );
      await vouchersApi.guardarParametro(
        'voucher_plin_numero',
        plinNumero.trim() || '946388934',
      );
      setConfig((prev) => ({
        ...prev,
        voucher_titular_nombre: titularNombre.trim() || 'Kevin',
        voucher_yape_numero: yapeNumero.trim() || '946388934',
        voucher_plin_numero: plinNumero.trim() || '946388934',
      }));

      setConfirmarGuardarCampos(false);
      setMensajeExito('Parámetros de vouchers actualizados correctamente');
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'No se pudieron guardar los parámetros de vouchers';
      setError(msg);
      setConfirmarGuardarCampos(false);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div
        data-testid="tarjeta-vouchers-ia-cargando"
        style={{
          padding: '20px',
          background: 'var(--cp-white, #FFFFFF)',
          borderRadius: '14px',
          border: '1px solid var(--cp-line, #E3D6C6)',
        }}
      >
        <Cargando mensaje="Cargando configuración de vouchers..." />
      </div>
    );
  }

  const activo = config.voucher_ia_activo;

  return (
    <div
      data-testid="tarjeta-vouchers-ia"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        padding: '18px 20px',
        background: 'var(--cp-white, #FFFFFF)',
        border: '1px solid var(--cp-line, #E3D6C6)',
        borderRadius: '16px',
        boxShadow: '0 2px 8px rgba(11, 44, 62, 0.05)',
        fontFamily: 'Montserrat, sans-serif',
      }}
    >
      {/* Cabecera de la tarjeta */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'var(--cp-sand, #E3D6C6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '14px',
              color: 'var(--cp-navy, #0B2C3E)',
            }}
          >
            VCH
          </div>
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: '16px',
                color: 'var(--cp-navy, #0B2C3E)',
              }}
            >
              Lectura de vouchers con IA
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--cp-soft, #2C4C5D)', marginTop: '2px' }}>
              Extracción automática de montos y operaciones de Yape y Plin mediante visión.
            </div>
          </div>
        </div>

        {/* Interruptor para ADMIN */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Insignia variante={activo ? 'exito' : 'neutro'}>
            {activo ? 'Activado' : 'Desactivado'}
          </Insignia>

          {esAdmin ? (
            <Boton
              variante={activo ? 'secundario' : 'primario'}
              onClick={handleSolicitarSwitch}
              aria-label="Alternar Lectura de vouchers con IA"
              data-testid="btn-toggle-vouchers-ia"
            >
              {activo ? 'Desactivar' : 'Activar'}
            </Boton>
          ) : (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--cp-soft, #2C4C5D)',
                fontStyle: 'italic',
                padding: '4px 8px',
                background: 'var(--cp-sand, #E3D6C6)',
                borderRadius: '6px',
              }}
            >
              Solo ADMIN
            </span>
          )}
        </div>
      </div>

      {/* Alerta de solo lectura si no es ADMIN */}
      {!esAdmin && (
        <div
          role="status"
          style={{
            fontSize: '12px',
            color: 'var(--cp-soft, #2C4C5D)',
            background: 'var(--cp-cream, #FBF4EC)',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--cp-line, #E3D6C6)',
          }}
        >
          Solo el Administrador puede modificar la configuración de lectura de vouchers.
        </div>
      )}

      {/* Formulario de parámetros editables */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'var(--cp-cream, #FBF4EC)',
          border: '1px solid var(--cp-line, #E3D6C6)',
          borderRadius: '12px',
          padding: '14px',
        }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: '13.5px',
            color: 'var(--cp-navy, #0B2C3E)',
          }}
        >
          Datos de validación de cuentas Yape / Plin
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          {/* Titular */}
          <div>
            <label
              htmlFor="voucher-titular"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--cp-navy, #0B2C3E)',
                marginBottom: '4px',
              }}
            >
              Titular de la cuenta
            </label>
            <input
              id="voucher-titular"
              data-testid="input-voucher-titular"
              type="text"
              disabled={!esAdmin || guardando}
              value={titularNombre}
              onChange={(e) => setTitularNombre(e.target.value)}
              placeholder="Ejemplo: Kevin"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '40px',
                borderRadius: '8px',
                border: '1.5px solid var(--cp-line, #E3D6C6)',
                background: 'var(--cp-white, #FFFFFF)',
                padding: '0 10px',
                fontSize: '13px',
              }}
            />
          </div>

          {/* Número Yape */}
          <div>
            <label
              htmlFor="voucher-yape"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--cp-navy, #0B2C3E)',
                marginBottom: '4px',
              }}
            >
              Número Yape (destino)
            </label>
            <input
              id="voucher-yape"
              data-testid="input-voucher-yape"
              type="text"
              disabled={!esAdmin || guardando}
              value={yapeNumero}
              onChange={(e) => setYapeNumero(e.target.value)}
              placeholder="946388934"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '40px',
                borderRadius: '8px',
                border: '1.5px solid var(--cp-line, #E3D6C6)',
                background: 'var(--cp-white, #FFFFFF)',
                padding: '0 10px',
                fontSize: '13px',
              }}
            />
          </div>

          {/* Número Plin */}
          <div>
            <label
              htmlFor="voucher-plin"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--cp-navy, #0B2C3E)',
                marginBottom: '4px',
              }}
            >
              Número Plin (destino)
            </label>
            <input
              id="voucher-plin"
              data-testid="input-voucher-plin"
              type="text"
              disabled={!esAdmin || guardando}
              value={plinNumero}
              onChange={(e) => setPlinNumero(e.target.value)}
              placeholder="946388934"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '40px',
                borderRadius: '8px',
                border: '1.5px solid var(--cp-line, #E3D6C6)',
                background: 'var(--cp-white, #FFFFFF)',
                padding: '0 10px',
                fontSize: '13px',
              }}
            />
          </div>
        </div>

        {/* Botón Guardar cambios de campos */}
        {esAdmin && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <Boton
              variante="primario"
              cargando={guardando}
              onClick={handleSolicitarGuardarCampos}
              data-testid="btn-guardar-campos-vouchers"
            >
              Guardar datos de cuentas
            </Boton>
          </div>
        )}
      </div>

      {/* Métricas de consumo de IA del mes */}
      {consumoIa && (
        <div
          data-testid="consumo-ia-mes-vouchers"
          style={{
            background: 'var(--cp-cream, #FBF4EC)',
            border: '1px solid var(--cp-line, #E3D6C6)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--cp-navy, #0B2C3E)',
              }}
            >
              Consumo de IA este mes ({consumoIa.periodo})
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--cp-green, #2F7A45)',
                background: '#E8F5E9',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid var(--cp-green, #2F7A45)',
              }}
            >
              Sin tope mensual
            </span>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--cp-soft, #2C4C5D)', lineHeight: 1.45 }}>
            {consumoIa.llamadasTotal} lecturas · {consumoIa.tokensTotal.toLocaleString()} tokens · Costo estimado: ${consumoIa.costoUsdEstimado.toFixed(4)} USD. Decisión del dueño: este uso no se corta por tope mensual.
          </div>
        </div>
      )}

      {/* Regla de oro visual */}
      <div
        style={{
          fontSize: '12px',
          color: 'var(--cp-soft, #2C4C5D)',
          background: 'var(--cp-white, #FFFFFF)',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px dashed var(--cp-line, #E3D6C6)',
          lineHeight: 1.4,
        }}
      >
        <b>Regla de oro:</b> La IA solo lee la foto, extrae datos y calcula un semáforo informativo. La persona (Caja o Administrador) siempre decide Aprobar o Rechazar el pago.
      </div>

      {/* Mensaje de éxito */}
      {mensajeExito && (
        <div
          role="status"
          style={{
            color: 'var(--cp-green, #2F7A45)',
            fontSize: '12.5px',
            fontWeight: 700,
          }}
        >
          {mensajeExito}
        </div>
      )}

      {/* Mensaje de error */}
      {error && (
        <div
          role="alert"
          style={{
            color: 'var(--cp-rust, #B2500F)',
            fontSize: '12.5px',
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      {/* Modal Confirmar Sí/No: Alternar IA */}
      <Confirmar
        abierto={confirmarSwitchAbierto}
        titulo={
          activo
            ? '¿Desactivar lectura de vouchers con IA?'
            : '¿Activar lectura de vouchers con IA?'
        }
        mensaje={
          activo
            ? 'Al desactivarlo, las fotos de los vouchers se guardarán con estado Sin lectura y el personal revisará manualmente a ojo.'
            : 'Al activarlo, la IA analizará cada voucher de Yape y Plin extrayendo monto, titular y número destino.'
        }
        textoSi={activo ? 'Sí, desactivar' : 'Sí, activar'}
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={handleConfirmarSwitch}
        alCancelar={() => setConfirmarSwitchAbierto(false)}
      />

      {/* Modal Confirmar Sí/No: Guardar Campos */}
      <Confirmar
        abierto={confirmarGuardarCampos}
        titulo="¿Guardar cambios de configuración de vouchers?"
        mensaje={`Se actualizarán el titular (${titularNombre}), números Yape (${yapeNumero}) y Plin (${plinNumero}).`}
        textoSi="Sí, guardar cambios"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={handleConfirmarGuardarCampos}
        alCancelar={() => setConfirmarGuardarCampos(false)}
      />
    </div>
  );
}
