import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { CampoConfig } from './CampoConfig';
import { stockApi, EstadoControlAlmacen } from '../stock/stockApi';

const AJUSTES_COCINA = [
  { clave: 'almacen_consumir_al_preparar', defecto: false, texto: 'Descontar los insumos de Cocina cuando Cocina marca lista la comanda (en vez de al cobrar)' },
  { clave: 'almacen_permitir_cocina_negativa', defecto: true, texto: 'Dejar que Cocina siga aunque le falte insumo (queda en negativo y se crea un pendiente de almacén)' },
] as const;

const esSi = (v: unknown, defecto: boolean) => (v === undefined || v === null || v === '' ? defecto : v === true || /^(si|sí|true)$/i.test(String(v)));

/** Parámetros de Cocina y almacén: solo con el control encendido y solo el administrador los cambia. */
function AjustesCocinaAlmacen() {
  const [valores, setValores] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .get<Array<{ clave: string; valor: unknown }>>('/admin/configuracion')
      .then((lista) => setValores(Object.fromEntries(AJUSTES_COCINA.map((a) => [a.clave, esSi((Array.isArray(lista) ? lista : []).find((p) => p.clave === a.clave)?.valor, a.defecto)]))))
      .catch(() => setError('No se pudieron leer los ajustes'));
  }, []);
  const cambiar = async (clave: string, nuevo: boolean) => {
    setError(null);
    try {
      await api.put(`/admin/configuracion/${clave}`, { valor: nuevo });
      setValores((v) => ({ ...v, [clave]: nuevo }));
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar el ajuste');
    }
  };
  return (
    <div data-testid="ajustes-cocina-almacen" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {AJUSTES_COCINA.map((a) => (
        <label key={a.clave} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, fontSize: 13 }}>
          <input type="checkbox" checked={valores[a.clave] ?? a.defecto} onChange={(e) => void cambiar(a.clave, e.target.checked)} />
          {a.texto}
        </label>
      ))}
      {error && <div role="alert" style={{ fontSize: 13, color: 'var(--cp-red, #b3261e)' }}>{error}</div>}
    </div>
  );
}

function useSesionSegura() {
  try {
    return useSesion();
  } catch {
    return null;
  }
}

/**
 * Interruptor «Control de almacén»: gobierna SOLO insumos y recetas. El stock de productos terminados
 * (casilla «Controlar stock de este producto» en Catálogo) funciona aparte. Solo el administrador.
 */
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
            Este interruptor gobierna solo los insumos y las recetas. Encendido, cada cobro descuenta insumos por receta,
            agota solos los productos que dependen de insumos sin stock y avisa de lo que falta. Apagado, vender no toca
            el stock de insumos: puedes cargar insumos, compras y proveedores con calma.
          </div>
          <div
            data-testid="control-almacen-productos"
            style={{ fontSize: 12.5, color: 'var(--cp-navy)', marginTop: 6, maxWidth: 560 }}
          >
            {(estado?.productosControlados ?? 0) > 0 ? (
              <>
                El stock de productos terminados (donas, galletas) funciona aparte: <b>{estado?.productosControlados}</b>{' '}
                {estado?.productosControlados === 1 ? 'producto controla' : 'productos controlan'} su stock con la casilla
                «Controlar stock de este producto» del Catálogo, con o sin este interruptor.
              </>
            ) : (
              <>
                El stock de productos terminados (donas, galletas) funciona aparte, con la casilla «Controlar stock de
                este producto» del Catálogo. Ningún producto la tiene marcada todavía.
              </>
            )}
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

      {activo && esAdmin && <AjustesCocinaAlmacen />}

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
            ? 'Desde ahora vender no descontará insumos ni agotará productos por falta de insumos. El stock de los productos con casilla (donas, galletas) sigue igual. Los registros manuales siguen guardándose.'
            : riesgo
              ? `${estado?.insumosSinStock} insumos de recetas no tienen stock cargado. Si lo enciendes, ${estado?.productosEnRiesgo} productos se agotarán al primer cobro. ¿Encender igual?`
              : 'Desde ahora cada cobro descontará insumos por receta y agotará los productos que se queden sin insumos. El stock de los productos con casilla (donas, galletas) no cambia.'
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
