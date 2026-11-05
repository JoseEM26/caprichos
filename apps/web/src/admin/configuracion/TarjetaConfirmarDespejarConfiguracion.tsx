import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { CampoConfig } from './CampoConfig';

const CLAVE = 'cocina_confirmar_despejar';

function useSesionSegura() {
  try {
    return useSesion();
  } catch {
    return null;
  }
}

/** Interruptor «Confirmar al despejar» (cocina): encendido, despejar pide Sí/No; apagado, un toque despeja. Solo el administrador. */
export function TarjetaConfirmarDespejarConfiguracion({ esAdmin: esAdminProp }: { esAdmin?: boolean } = {}) {
  const sesion = useSesionSegura();
  const esAdmin = esAdminProp !== undefined ? esAdminProp : (sesion?.usuario?.rol || '').toUpperCase() === 'ADMIN';

  // Sin fila en parámetro, o cualquier valor distinto de «no», queda encendido (como antes).
  const [activo, setActivo] = useState<boolean | null>(null);
  const [cargando, setCargando] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const lista = await api.get<Array<{ clave: string; valor: unknown }>>('/admin/configuracion');
      const fila = lista.find((p) => p.clave === CLAVE);
      const norm = typeof fila?.valor === 'string' ? fila.valor.trim().toLowerCase() : '';
      setActivo(!(fila?.valor === false || norm === 'no'));
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo leer el ajuste de cocina');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const alternar = async () => {
    if (activo === null) return;
    const nuevo = !activo;
    setGuardando(true);
    setError(null);
    try {
      await api.put(`/admin/configuracion/${CLAVE}`, { valor: nuevo ? 'si' : 'no' });
      setConfirmar(false);
      setExito(nuevo ? 'Confirmación al despejar encendida.' : 'Confirmación al despejar apagada.');
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cambiar la confirmación al despejar');
      setConfirmar(false);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando && activo === null) {
    return (
      <div data-testid="tarjeta-confirmar-despejar-cargando" style={{ padding: 20 }}>
        <Cargando mensaje="Cargando ajuste de cocina..." />
      </div>
    );
  }

  return (
    <div
      data-testid="tarjeta-confirmar-despejar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '18px 20px',
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: 16,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--cp-navy)' }}>
            Confirmar al despejar
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--cp-soft)', marginTop: 2, maxWidth: 560 }}>
            Es el valor general del local: encendido, despejar un pedido pide confirmar con Sí o No; apagado, un toque lo
            despeja directo («Deshacer» sigue disponible). Aplica a quien no lo haya personalizado: cada cocinero puede
            cambiarlo para sí mismo desde Cocina («Preguntar antes de despejar»).
          </div>
        </div>
        <CampoConfig id="cocina-confirmar-despejar" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Insignia variante={activo ? 'exito' : 'neutro'}>{activo ? 'Encendido' : 'Apagado'}</Insignia>
          {esAdmin ? (
            <Boton
              variante={activo ? 'secundario' : 'primario'}
              onClick={() => {
                setExito(null);
                setConfirmar(true);
              }}
              aria-label="Alternar confirmar al despejar"
            >
              {activo ? 'Apagar' : 'Encender'}
            </Boton>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--cp-soft)', fontStyle: 'italic' }}>Solo ADMIN</span>
          )}
        </CampoConfig>
      </div>

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

      <Confirmar
        abierto={confirmar}
        titulo={activo ? 'Apagar la confirmación al despejar' : 'Encender la confirmación al despejar'}
        mensaje={
          activo
            ? 'Desde ahora un toque en Despejar saca la comanda de cocina sin preguntar.'
            : 'Desde ahora Despejar pedirá confirmar con Sí o No antes de sacar la comanda.'
        }
        textoSi="Sí, confirmar"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={alternar}
        alCancelar={() => setConfirmar(false)}
      />
    </div>
  );
}
