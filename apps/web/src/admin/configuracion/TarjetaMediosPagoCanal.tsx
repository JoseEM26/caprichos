import { useCallback, useEffect, useState } from 'react';
import {
  CANALES_MEDIO_PAGO,
  MEDIOS_PAGO_CANAL,
  NOMBRE_MEDIO_PAGO,
  mediosPagoPorDefecto,
  normalizarMediosPagoCanal,
  type CanalMedioPago,
  type MedioPagoCanal,
  type MediosPagoPorCanal,
} from '@caprichos/compartido';
import { api, ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Confirmar } from '../../comun/Confirmar';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';

export function useSesionSegura() {
  try {
    return useSesion();
  } catch {
    return null;
  }
}

/** Aviso entre las dos tarjetas de medios de pago (Pagos y esta tabla): tras guardar, la otra recarga. */
export const EVENTO_MEDIOS_PAGO_CANAL = 'caprichos:medios-pago-canal';

const NOMBRE_CANAL: Record<CanalMedioPago, string> = { CARTA: 'Carta web', CAJA: 'Caja', MOZO: 'Mozo', BOT: 'WhatsApp' };

/**
 * Medios de pago por canal (parámetro medios_pago_canal): tabla medio × canal con interruptores.
 * Apagado es apagado: no se muestra y el servidor lo rechaza. No cambia lo ya registrado. Solo ADMIN edita.
 */
export function TarjetaMediosPagoCanal({ esAdmin: esAdminProp }: { esAdmin?: boolean } = {}) {
  const sesion = useSesionSegura();
  const esAdmin = esAdminProp !== undefined ? esAdminProp : (sesion?.usuario?.rol || '').toUpperCase() === 'ADMIN';
  const [guardado, setGuardado] = useState<MediosPagoPorCanal>(mediosPagoPorDefecto());
  const [config, setConfig] = useState<MediosPagoPorCanal>(mediosPagoPorDefecto());
  const [cargando, setCargando] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.get<{ canales: unknown }>('/admin/medios-pago');
      const n = normalizarMediosPagoCanal(r?.canales);
      setGuardado(n);
      setConfig(n);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudieron leer los medios de pago');
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    void cargar();
    const alCambiar = () => void cargar();
    window.addEventListener(EVENTO_MEDIOS_PAGO_CANAL, alCambiar);
    return () => window.removeEventListener(EVENTO_MEDIOS_PAGO_CANAL, alCambiar);
  }, [cargar]);

  const hayCambios = JSON.stringify(config) !== JSON.stringify(guardado);
  const cajaSinMedios = !MEDIOS_PAGO_CANAL.some((m) => config.CAJA[m]);

  const alternar = (canal: CanalMedioPago, medio: MedioPagoCanal) => {
    setExito(null);
    setConfig({ ...config, [canal]: { ...config[canal], [medio]: !config[canal][medio] } });
  };

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await api.put('/admin/configuracion/medios_pago_canal', { valor: config });
      setConfirmar(false);
      setExito('Listo: los medios de pago quedaron guardados.');
      window.dispatchEvent(new Event(EVENTO_MEDIOS_PAGO_CANAL));
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar');
      setConfirmar(false);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <Cargando mensaje="Cargando medios de pago por canal..." />;

  return (
    <div
      data-testid="tarjeta-medios-canal"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '18px 16px', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 16 }}
    >
      <div>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--cp-navy)' }}>Medios de pago por canal</div>
        <div style={{ fontSize: 12.5, color: 'var(--cp-soft)', marginTop: 2, maxWidth: 560 }}>
          Enciende o apaga cada medio en cada lugar donde se cobra. Un medio apagado no se muestra ni se acepta ahí, para nadie. Los
          pedidos y cobros ya registrados no cambian. Caja siempre debe tener al menos un medio encendido.
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 300, fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 4px' }}>Medio</th>
              {CANALES_MEDIO_PAGO.map((c) => (
                <th key={c} style={{ padding: '6px 4px', textAlign: 'center' }}>
                  {NOMBRE_CANAL[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEDIOS_PAGO_CANAL.map((m) => (
              <tr key={m} style={{ borderTop: '1px solid var(--cp-line)' }}>
                <td style={{ padding: '6px 4px', color: 'var(--cp-navy)', fontWeight: 600 }}>
                  {NOMBRE_MEDIO_PAGO[m]}
                  {m === 'PAGO_EN_LINEA' && <div style={{ fontSize: 11, color: 'var(--cp-soft)', fontWeight: 400 }}>Tarjeta y Yape por Culqi (solo carta)</div>}
                </td>
                {CANALES_MEDIO_PAGO.map((c) =>
                  m === 'PAGO_EN_LINEA' && c !== 'CARTA' ? (
                    <td key={c} style={{ textAlign: 'center', padding: '4px', color: 'var(--cp-soft)', fontSize: 12 }}>
                      No aplica
                    </td>
                  ) : (
                    <td key={c} style={{ textAlign: 'center', padding: '4px' }}>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={config[c][m]}
                        disabled={!esAdmin || guardando}
                        onChange={() => alternar(c, m)}
                        aria-label={`${NOMBRE_MEDIO_PAGO[m]} en ${NOMBRE_CANAL[c]}`}
                        style={{ width: 24, height: 24 }}
                      />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cajaSinMedios && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--cp-red, #b3261e)' }}>
          Caja necesita al menos un medio de pago encendido.
        </div>
      )}
      {error && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--cp-red, #b3261e)' }}>
          {error}
        </div>
      )}
      {exito && (
        <div role="status" style={{ fontSize: 13, color: 'var(--cp-navy)' }}>
          {exito}
        </div>
      )}
      {esAdmin ? (
        <div>
          <Boton variante="primario" onClick={() => setConfirmar(true)} disabled={!hayCambios || cajaSinMedios || guardando}>
            Guardar medios por canal
          </Boton>
        </div>
      ) : (
        <span style={{ fontSize: 11, color: 'var(--cp-soft)', fontStyle: 'italic' }}>Solo ADMIN</span>
      )}

      <Confirmar
        abierto={confirmar}
        titulo="Guardar medios por canal"
        mensaje="Desde ahora los medios apagados no se mostrarán ni se aceptarán en ese canal. Lo ya cobrado no cambia. ¿Guardar?"
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        peligro={false}
        cargando={guardando}
        alConfirmar={guardar}
        alCancelar={() => setConfirmar(false)}
      />
    </div>
  );
}
