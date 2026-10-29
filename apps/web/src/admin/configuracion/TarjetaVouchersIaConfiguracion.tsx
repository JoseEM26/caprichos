import { useState, useEffect, useCallback } from 'react';
import { useSesion } from '../../comun/sesion';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { ErrorApi } from '../../comun/api';
import { vouchersApi, ResumenConsumoVoucherIa, EstadoIaVouchers } from '../vouchers/vouchersApi';
import { ParametrosVoucherConfig } from '../vouchers/tipos';
import { CampoAyuda } from './AyudaCampo';
import { CampoConfig } from './CampoConfig';

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
    voucher_titular_nombre: 'Maria Jose Morillo Ruiz',
    voucher_yape_numero: '977503006',
    voucher_plin_numero: '977503006',
  });
  const [topeTexto, setTopeTexto] = useState<string>('20');
  const [corteTexto, setCorteTexto] = useState<string>('10');
  const [estadoIa, setEstadoIa] = useState<EstadoIaVouchers | null>(null);
  const [confirmarLimites, setConfirmarLimites] = useState<boolean>(false);

  // Campos de formulario editables
  const [titularNombre, setTitularNombre] = useState<string>('Maria Jose Morillo Ruiz');
  const [yapeNumero, setYapeNumero] = useState<string>('977503006');
  const [plinNumero, setPlinNumero] = useState<string>('977503006');

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

      setTopeTexto(String(cfg.chatbot_ia_tope_mensual_usd ?? 20));
      setCorteTexto(String(cfg.voucher_ia_corte_min ?? 10));

      const consumo = await vouchersApi.obtenerConsumoIa();
      setConsumoIa(consumo);
      try {
        setEstadoIa(await vouchersApi.obtenerEstadoIa());
      } catch {
        setEstadoIa(null);
      }
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
        titularNombre.trim() || 'Maria Jose Morillo Ruiz',
      );
      await vouchersApi.guardarParametro(
        'voucher_yape_numero',
        yapeNumero.trim() || '977503006',
      );
      await vouchersApi.guardarParametro(
        'voucher_plin_numero',
        plinNumero.trim() || '977503006',
      );
      setConfig((prev) => ({
        ...prev,
        voucher_titular_nombre: titularNombre.trim() || 'Maria Jose Morillo Ruiz',
        voucher_yape_numero: yapeNumero.trim() || '977503006',
        voucher_plin_numero: plinNumero.trim() || '977503006',
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

  const topeNum = Number(topeTexto.trim().replace(',', '.'));
  const corteNum = Number(corteTexto.trim());
  const topeValido = topeTexto.trim() !== '' && Number.isFinite(topeNum) && topeNum >= 1 && topeNum <= 500;
  const corteValido = corteTexto.trim() !== '' && Number.isInteger(corteNum) && corteNum >= 1 && corteNum <= 120;

  const handleSolicitarGuardarLimites = () => {
    if (!esAdmin) return;
    setMensajeExito(null);
    if (!topeValido) {
      setError('El tope mensual debe estar entre 1 y 500 USD.');
      return;
    }
    if (!corteValido) {
      setError('La pausa del corte automático debe ser un número entero entre 1 y 120 minutos.');
      return;
    }
    setError(null);
    setConfirmarLimites(true);
  };

  const handleConfirmarGuardarLimites = async () => {
    setGuardando(true);
    setError(null);
    try {
      await vouchersApi.guardarParametro('chatbot_ia_tope_mensual_usd', topeNum);
      await vouchersApi.guardarParametro('voucher_ia_corte_min', corteNum);
      setConfig((prev) => ({ ...prev, chatbot_ia_tope_mensual_usd: topeNum, voucher_ia_corte_min: corteNum }));
      setEstadoIa((prev) =>
        prev ? { ...prev, topeMensual: { ...prev.topeMensual, topeUsd: topeNum, superado: prev.topeMensual.usadoUsd >= topeNum } } : prev,
      );
      setConfirmarLimites(false);
      setMensajeExito('Límites de la lectura con IA actualizados correctamente');
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudieron guardar los límites de la lectura con IA');
      setConfirmarLimites(false);
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
              La IA lee la foto del voucher de Yape o Plin y propone monto, titular y número destino con un semáforo. Apagada, Caja revisa todos los vouchers a mano. La persona siempre decide.
            </div>
          </div>
        </div>

        {/* Interruptor para ADMIN */}
        <CampoConfig id="vouchers-ia-interruptor" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
        </CampoConfig>
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
            <CampoAyuda
              id="voucher-titular"
              etiqueta="Titular de la cuenta"
              ayuda="Nombre de quien recibe los pagos. Se compara con el nombre que la IA lee en el voucher."
              efecto="Si no coincide con el voucher, este se marca como dudoso y Caja lo revisa con más cuidado. Cambia desde la siguiente lectura; los vouchers ya leídos no se recalculan."
              ejemplo="Maria Morillo"
              cfgId="vouchers-titular"
            >
              <input
                data-testid="input-voucher-titular"
                type="text"
                disabled={!esAdmin || guardando}
                value={titularNombre}
                onChange={(e) => setTitularNombre(e.target.value)}
                placeholder="Ejemplo: Maria Jose Morillo Ruiz"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--cp-line, #E3D6C6)',
                  background: 'var(--cp-white, #FFFFFF)',
                  padding: '0 10px',
                  fontSize: '13px',
                }}
              />
            </CampoAyuda>
          </div>

          {/* Número Yape */}
          <div>
            <CampoAyuda
              id="voucher-yape"
              etiqueta="Número Yape (destino)"
              ayuda="Celular al que los clientes deben yapear. Se compara con el número destino que la IA lee en el voucher."
              efecto="Un voucher hecho a otro número se marca como dudoso. Si lo cambias, los clientes deben yapear al número nuevo. Aplica desde la siguiente lectura."
              ejemplo="977503006"
              cfgId="vouchers-yape-numero"
            >
              <input
                data-testid="input-voucher-yape"
                type="text"
                disabled={!esAdmin || guardando}
                value={yapeNumero}
                onChange={(e) => setYapeNumero(e.target.value)}
                placeholder="977503006"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--cp-line, #E3D6C6)',
                  background: 'var(--cp-white, #FFFFFF)',
                  padding: '0 10px',
                  fontSize: '13px',
                }}
              />
            </CampoAyuda>
          </div>

          {/* Número Plin */}
          <div>
            <CampoAyuda
              id="voucher-plin"
              etiqueta="Número Plin (destino)"
              ayuda="Celular al que los clientes deben hacer plin. Se compara con el número destino que la IA lee en el voucher."
              efecto="Un voucher hecho a otro número se marca como dudoso. Si lo cambias, los clientes deben hacer plin al número nuevo. Aplica desde la siguiente lectura."
              ejemplo="977503006"
              cfgId="vouchers-plin-numero"
            >
              <input
                data-testid="input-voucher-plin"
                type="text"
                disabled={!esAdmin || guardando}
                value={plinNumero}
                onChange={(e) => setPlinNumero(e.target.value)}
                placeholder="977503006"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--cp-line, #E3D6C6)',
                  background: 'var(--cp-white, #FFFFFF)',
                  padding: '0 10px',
                  fontSize: '13px',
                }}
              />
            </CampoAyuda>
          </div>
        </div>

        {/* Botón Guardar cambios de campos */}
        {esAdmin && (
          <CampoConfig id="vouchers-guardar-datos" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <Boton
              variante="primario"
              cargando={guardando}
              onClick={handleSolicitarGuardarCampos}
              data-testid="btn-guardar-campos-vouchers"
            >
              Guardar datos de cuentas
            </Boton>
          </CampoConfig>
        )}
      </div>

      {/* Consumo del mes frente al tope, y límites editables */}
      <div
        data-testid="consumo-ia-mes-vouchers"
        data-cfg-id="vouchers-ia-consumo"
        tabIndex={-1}
        style={{
          background: 'var(--cp-cream, #FBF4EC)',
          border: '1px solid var(--cp-line, #E3D6C6)',
          borderRadius: '12px',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy, #0B2C3E)' }}>
            Consumo de IA este mes{consumoIa ? ` (${consumoIa.periodo})` : ''}
          </span>
          <span
            data-testid="etiqueta-tope-mensual"
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: estadoIa?.topeMensual.superado ? 'var(--cp-rust, #B2500F)' : 'var(--cp-green, #2F7A45)',
              background: estadoIa?.topeMensual.superado ? '#FDECEA' : '#E8F5E9',
              padding: '2px 8px',
              borderRadius: '6px',
              border: `1px solid ${estadoIa?.topeMensual.superado ? 'var(--cp-rust, #B2500F)' : 'var(--cp-green, #2F7A45)'}`,
            }}
          >
            Tope mensual: {(estadoIa?.topeMensual.topeUsd ?? config.chatbot_ia_tope_mensual_usd ?? 20).toLocaleString('es-PE')} USD
          </span>
        </div>

        {estadoIa && (
          <div>
            <div
              role="progressbar"
              aria-label="Consumo de IA de vouchers frente al tope mensual"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.round((estadoIa.topeMensual.usadoUsd / Math.max(estadoIa.topeMensual.topeUsd, 0.01)) * 100))}
              data-testid="barra-tope-vouchers"
              style={{ height: '10px', borderRadius: '9999px', background: 'var(--cp-sand, #E3D6C6)', overflow: 'hidden' }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (estadoIa.topeMensual.usadoUsd / Math.max(estadoIa.topeMensual.topeUsd, 0.01)) * 100)}%`,
                  background: estadoIa.topeMensual.superado ? 'var(--cp-rust, #B2500F)' : 'var(--cp-green, #2F7A45)',
                }}
              />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft, #2C4C5D)', marginTop: '4px' }}>
              Usado por vouchers: ${estadoIa.topeMensual.usadoUsd.toFixed(2)} de ${estadoIa.topeMensual.topeUsd.toFixed(2)} USD
              {estadoIa.topeMensual.superado ? '. Tope alcanzado: la lectura automática está detenida hasta el próximo mes.' : '.'}
            </div>
          </div>
        )}

        {consumoIa && (
          <div style={{ fontSize: '12px', color: 'var(--cp-soft, #2C4C5D)', lineHeight: 1.45 }}>
            {consumoIa.llamadasTotal} lecturas · {consumoIa.tokensTotal.toLocaleString()} tokens · Costo estimado: ${consumoIa.costoUsdEstimado.toFixed(4)} USD (todas las funciones con IA).
          </div>
        )}

        <div style={{ fontSize: '12px', color: 'var(--cp-soft, #2C4C5D)', lineHeight: 1.45 }}>
          Al llegar al tope, la lectura automática se detiene, los vouchers se guardan igual y Caja los revisa a ojo. Se avisa una sola vez a los administradores.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <CampoAyuda
            id="voucher-tope-mensual"
            etiqueta="Tope mensual de IA (USD)"
            ayuda="Gasto máximo del mes en la lectura de vouchers con IA. Al alcanzarlo, la lectura automática se detiene hasta el próximo mes."
            efecto="Los vouchers se guardan igual y Caja los revisa a ojo. Se avisa una sola vez a los administradores."
            ejemplo="20"
            porDefecto="20"
            unidad="USD"
            rango="1 a 500"
            cfgId="vouchers-ia-tope"
          >
            <input
              data-testid="input-voucher-tope"
              type="text"
              inputMode="decimal"
              disabled={!esAdmin || guardando}
              value={topeTexto}
              onChange={(e) => setTopeTexto(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '44px',
                borderRadius: '8px',
                border: '1.5px solid var(--cp-line, #E3D6C6)',
                background: 'var(--cp-white, #FFFFFF)',
                padding: '0 10px',
                fontSize: '13px',
              }}
            />
          </CampoAyuda>
          <CampoAyuda
            id="voucher-corte-min"
            etiqueta="Pausa del corte automático (minutos)"
            ayuda="Si la IA falla tres veces seguidas por saldo o clave (o cinco errores), se corta este tiempo y los vouchers se guardan sin lectura para que Caja los revise a mano."
            efecto="Pasado el tiempo, una lectura de prueba decide si se reanuda. Aplica desde el próximo corte."
            ejemplo="10"
            porDefecto="10"
            unidad="minutos"
            rango="1 a 120"
            cfgId="vouchers-ia-corte"
          >
            <input
              data-testid="input-voucher-corte"
              type="text"
              inputMode="numeric"
              disabled={!esAdmin || guardando}
              value={corteTexto}
              onChange={(e) => setCorteTexto(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '44px',
                borderRadius: '8px',
                border: '1.5px solid var(--cp-line, #E3D6C6)',
                background: 'var(--cp-white, #FFFFFF)',
                padding: '0 10px',
                fontSize: '13px',
              }}
            />
          </CampoAyuda>
        </div>

        {esAdmin && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Boton
              variante="primario"
              cargando={guardando}
              onClick={handleSolicitarGuardarLimites}
              data-testid="btn-guardar-limites-vouchers"
            >
              Guardar límites
            </Boton>
          </div>
        )}
      </div>

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

      {/* Modal Confirmar Sí/No: Guardar límites */}
      <Confirmar
        abierto={confirmarLimites}
        titulo="¿Guardar los límites de la lectura con IA?"
        mensaje={`Tope mensual: ${topeTexto} USD. Pausa del corte automático: ${corteTexto} minutos.`}
        textoSi="Sí, guardar límites"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={handleConfirmarGuardarLimites}
        alCancelar={() => setConfirmarLimites(false)}
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
