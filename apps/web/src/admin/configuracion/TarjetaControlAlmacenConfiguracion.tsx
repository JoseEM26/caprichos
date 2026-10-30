import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { CampoConfig } from './CampoConfig';
import { stockApi, EstadoControlAlmacen } from '../stock/stockApi';

function useSesionSegura() {
  try {
    return useSesion();
  } catch {
    return null;
  }
}

/** Interruptor «Control de almacén»: apagado, vender no descuenta stock ni agota productos solos. Solo el administrador. */
export function TarjetaControlAlmacenConfiguracion({ esAdmin: esAdminProp }: { esAdmin?: boolean } = {}) {
  const sesion = useSesionSegura();
  const esAdmin = esAdminProp !== undefined ? esAdminProp : (sesion?.usuario?.rol || '').toUpperCase() === 'ADMIN';

  const [estado, setEstado] = useState<EstadoControlAlmacen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setEstado(await stockApi.estadoControl());
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo leer el estado del control de almacén');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const alternar = async () => {
    if (!estado) return;
    const nuevo = !estado.activo;
    setGuardando(true);
    setError(null);
    try {
      await api.put('/admin/configuracion/stock_control_activo', { valor: nuevo });
      setConfirmar(false);
      setExito(nuevo ? 'Control de almacén encendido.' : 'Control de almacén apagado.');
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cambiar el control de almacén');
      setConfirmar(false);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando && !estado) {
    return (
      <div data-testid="tarjeta-control-almacen-cargando" style={{ padding: 20 }}>
        <Cargando mensaje="Cargando control de almacén..." />
      </div>
    );
  }

  const activo = estado?.activo ?? false;
  const riesgo = !activo && (estado?.productosEnRiesgo ?? 0) > 0;

  return (
    <div
      data-testid="tarjeta-control-almacen"
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
            Control de almacén
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--cp-soft)', marginTop: 2, maxWidth: 560 }}>
            Encendido, cada cobro descuenta insumos por receta, agota solos los productos sin insumos y avisa de lo que
            falta. Apagado, vender no toca el stock: puedes cargar insumos, compras y proveedores con calma y encenderlo
            cuando el almacén esté listo.
          </div>
        </div>
        <CampoConfig id="operacion-control-almacen" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Insignia variante={activo ? 'exito' : 'neutro'}>{activo ? 'Encendido' : 'Apagado'}</Insignia>
          {esAdmin ? (
            <Boton
              variante={activo ? 'secundario' : 'primario'}
              onClick={() => {
                setExito(null);
                setConfirmar(true);
              }}
              aria-label="Alternar control de almacén"
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
        titulo={activo ? 'Apagar el control de almacén' : 'Encender el control de almacén'}
        mensaje={
          activo
            ? 'Desde ahora vender no descontará stock ni agotará productos solos. Los registros manuales siguen guardándose.'
            : riesgo
              ? `${estado?.insumosSinStock} insumos de recetas no tienen stock cargado. Si lo enciendes, ${estado?.productosEnRiesgo} productos se agotarán al primer cobro. ¿Encender igual?`
              : 'Desde ahora cada cobro descontará stock por receta y agotará los productos que se queden sin insumos.'
        }
        textoSi="Sí, confirmar"
        textoNo="No, cancelar"
        peligro={!activo}
        cargando={guardando}
        alConfirmar={alternar}
        alCancelar={() => setConfirmar(false)}
      />
    </div>
  );
}
