import { useCallback, useEffect, useState } from 'react';
import { normalizarMediosPagoCanal, type MediosPagoPorCanal } from '@caprichos/compartido';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { EVENTO_MEDIOS_PAGO_CANAL, useSesionSegura } from './TarjetaMediosPagoCanal';

interface ConfigCulqi {
  modo?: 'REAL' | 'SIMULADO';
  publicKey?: string;
}

/** Estado informativo del proveedor (GET público de la carta). Sin dato, no se muestra nada. */
export function textoProveedorCulqi(c: ConfigCulqi | null | undefined): string | null {
  if (!c || (c.modo !== 'REAL' && c.modo !== 'SIMULADO')) return null;
  if (!c.publicKey) return 'Sin llaves configuradas';
  return c.modo === 'REAL' ? 'Cobrando en modo REAL' : 'Modo de prueba (simulado)';
}

/**
 * Check «Tarjeta / Yape en línea (Culqi)». Es el mismo dato que la tabla medio × canal:
 * medios_pago_canal › CARTA › PAGO_EN_LINEA. Solo ADMIN guarda, con el diálogo Confirmar.
 */
export function PagoEnLineaCheck({ esAdmin: esAdminProp }: { esAdmin?: boolean } = {}) {
  const sesion = useSesionSegura();
  const esAdmin = esAdminProp !== undefined ? esAdminProp : (sesion?.usuario?.rol || '').toUpperCase() === 'ADMIN';
  const [tabla, setTabla] = useState<MediosPagoPorCanal | null>(null);
  const [guardadoActivo, setGuardadoActivo] = useState(false);
  const [activo, setActivo] = useState(false);
  const [proveedor, setProveedor] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<{ canales: unknown }>('/admin/medios-pago');
      const t = normalizarMediosPagoCanal(r?.canales);
      setTabla(t);
      setGuardadoActivo(t.CARTA.PAGO_EN_LINEA);
      setActivo(t.CARTA.PAGO_EN_LINEA);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo leer el pago en línea');
    }
  }, []);

  useEffect(() => {
    void cargar();
    api
      .get<ConfigCulqi>('/carta/pagos/culqi/config')
      .then((c) => setProveedor(textoProveedorCulqi(c)))
      .catch(() => setProveedor(null));
    const alCambiar = () => void cargar();
    window.addEventListener(EVENTO_MEDIOS_PAGO_CANAL, alCambiar);
    return () => window.removeEventListener(EVENTO_MEDIOS_PAGO_CANAL, alCambiar);
  }, [cargar]);

  const hayCambios = activo !== guardadoActivo;

  const aplicar = async () => {
    if (!tabla) return;
    setGuardando(true);
    setError(null);
    try {
      // Valor completo: se cambia solo CARTA.PAGO_EN_LINEA y el resto de medios viaja tal cual
      const valor = { ...tabla, CARTA: { ...tabla.CARTA, PAGO_EN_LINEA: activo } };
      await api.put('/admin/configuracion/medios_pago_canal', { valor });
      setConfirmar(false);
      setExito(activo ? 'Pago en línea encendido en la carta web.' : 'Pago en línea apagado en la carta web.');
      window.dispatchEvent(new Event(EVENTO_MEDIOS_PAGO_CANAL));
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar el pago en línea');
      setConfirmar(false);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      data-testid="pago-en-linea-check"
      style={{
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: '14px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '15px' }}>Tarjeta / Yape en línea (Culqi)</div>
          <div style={{ fontSize: '12.5px', color: 'var(--cp-soft)', marginTop: 2, maxWidth: 560 }}>
            Solo en la carta web. El cliente paga antes de que el pedido llegue a Caja o cocina.
          </div>
          {proveedor && <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cp-navy)', marginTop: 4 }}>{proveedor}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            role="switch"
            aria-checked={activo}
            aria-label="Tarjeta / Yape en línea (Culqi)"
            disabled={!esAdmin || guardando || tabla === null}
            onClick={() => {
              setActivo(!activo);
              setExito(null);
            }}
            style={{
              minHeight: '44px',
              padding: '0 20px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-navy)',
              background: activo ? 'var(--cp-navy)' : 'transparent',
              color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '13px',
            }}
          >
            {activo ? 'Activo' : 'Desactivado'}
          </button>
          {esAdmin ? (
            <Boton variante="secundario" disabled={!hayCambios || guardando} onClick={() => setConfirmar(true)}>
              Aplicar pago en línea
            </Boton>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--cp-soft)', fontStyle: 'italic' }}>Solo ADMIN</span>
          )}
        </div>
      </div>
      {error && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--cp-rust)' }}>
          {error}
        </div>
      )}
      {exito && !error && (
        <div role="status" style={{ fontSize: 13, color: 'var(--cp-navy)' }}>
          {exito}
        </div>
      )}
      <Confirmar
        abierto={confirmar}
        titulo="¿Cambiar el pago en línea?"
        mensaje="Solo afecta a la carta web: con el pago en línea encendido, el cliente paga antes de que el pedido llegue a Caja o cocina. Lo ya cobrado no cambia. ¿Guardar?"
        textoSi="Sí, guardar"
        textoNo="No, revisar"
        peligro={false}
        cargando={guardando}
        alConfirmar={aplicar}
        alCancelar={() => setConfirmar(false)}
      />
    </div>
  );
}
