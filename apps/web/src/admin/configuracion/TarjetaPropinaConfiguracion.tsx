import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { CampoConfig } from './CampoConfig';
import { CampoAyuda } from './AyudaCampo';

function useSesionSegura() {
  try {
    return useSesion();
  } catch {
    return null;
  }
}

type Canal = 'carta' | 'bot';

interface ConfigPropina {
  activa: { carta: boolean; bot: boolean };
  tope: number;
}

const ETIQUETA_CANAL: Record<Canal, string> = {
  carta: 'la carta virtual',
  bot: 'WhatsApp',
};

/**
 * Propina opcional (parámetros propina_activa y propina_tope). El interruptor es por canal: carta virtual
 * y WhatsApp. Apagada por defecto. Va aparte de la venta: no entra a comprobantes ni puntos. Solo ADMIN.
 */
export function TarjetaPropinaConfiguracion({ esAdmin: esAdminProp }: { esAdmin?: boolean } = {}) {
  const sesion = useSesionSegura();
  const esAdmin = esAdminProp !== undefined ? esAdminProp : (sesion?.usuario?.rol || '').toUpperCase() === 'ADMIN';

  const [config, setConfig] = useState<ConfigPropina>({ activa: { carta: false, bot: false }, tope: 200 });
  const [topeTexto, setTopeTexto] = useState<string>('200');
  const [cargando, setCargando] = useState<boolean>(true);
  const [pendiente, setPendiente] = useState<Canal | null>(null);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const lista = await api.get<Array<{ clave: string; valor: unknown }>>('/admin/configuracion');
      const activa = lista.find((x) => x.clave === 'propina_activa')?.valor as Partial<ConfigPropina['activa']> | undefined;
      const tope = Number(lista.find((x) => x.clave === 'propina_tope')?.valor);
      const topeFinal = Number.isFinite(tope) && tope > 0 ? tope : 200;
      setConfig({ activa: { carta: activa?.carta === true, bot: activa?.bot === true }, tope: topeFinal });
      setTopeTexto(String(topeFinal));
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo leer el ajuste de propina');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const alternar = async () => {
    if (!pendiente) return;
    const nuevo = { ...config.activa, [pendiente]: !config.activa[pendiente] };
    setGuardando(true);
    setError(null);
    try {
      await api.put('/admin/configuracion/propina_activa', { valor: nuevo });
      setPendiente(null);
      setExito(`Propina en ${ETIQUETA_CANAL[pendiente]} ${nuevo[pendiente] ? 'encendida' : 'apagada'}.`);
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cambiar la propina');
      setPendiente(null);
    } finally {
      setGuardando(false);
    }
  };

  const guardarTope = async () => {
    const n = Number(topeTexto.replace(',', '.'));
    setError(null);
    setExito(null);
    if (!Number.isFinite(n) || n < 1 || n > 1000) {
      setError('El tope de propina debe estar entre S/ 1 y S/ 1000');
      return;
    }
    setGuardando(true);
    try {
      await api.put('/admin/configuracion/propina_tope', { valor: n });
      setExito(`Tope de propina: S/ ${n.toFixed(2)}.`);
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar el tope de propina');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div data-testid="tarjeta-propina-cargando" style={{ padding: 20 }}>
        <Cargando mensaje="Cargando ajuste de propina..." />
      </div>
    );
  }

  const filaCanal = (canal: Canal, cfgId: string) => {
    const activo = config.activa[canal];
    return (
      <CampoConfig id={cfgId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13.5, color: 'var(--cp-navy)' }}>Propina en {ETIQUETA_CANAL[canal]}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Insignia variante={activo ? 'exito' : 'neutro'}>{activo ? 'Encendida' : 'Apagada'}</Insignia>
          {esAdmin ? (
            <Boton
              variante={activo ? 'secundario' : 'primario'}
              onClick={() => {
                setExito(null);
                setPendiente(canal);
              }}
              aria-label={`Alternar propina en ${ETIQUETA_CANAL[canal]}`}
            >
              {activo ? 'Apagar' : 'Encender'}
            </Boton>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--cp-soft)', fontStyle: 'italic' }}>Solo ADMIN</span>
          )}
        </div>
      </CampoConfig>
    );
  };

  return (
    <div
      data-testid="tarjeta-propina"
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
      <div>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--cp-navy)' }}>
          Propina opcional
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--cp-soft)', marginTop: 2, maxWidth: 560 }}>
          El cliente puede dejar una propina para el equipo. Va aparte del pedido: no es venta, no sale en el comprobante y
          no suma puntos. Se enciende por canal: la carta virtual y WhatsApp son independientes.
        </div>
      </div>

      {filaCanal('carta', 'operacion-propina-carta')}
      {filaCanal('bot', 'operacion-propina-bot')}

      <CampoConfig id="operacion-propina-tope" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <CampoAyuda
          id="propina-tope"
          etiqueta="Tope de propina por pedido (S/)"
          ayuda="La propina más alta que el cliente puede dejar en un pedido. Pasa de ese monto y la carta o el bot no lo aceptan."
          ejemplo="Con 50, nadie puede dejar más de S/ 50 en un pedido."
          unidad="S/"
          rango="1 a 1000"
          porDefecto="200"
        >
          <input
            type="text"
            inputMode="decimal"
            value={topeTexto}
            onChange={(e) => setTopeTexto(e.target.value)}
            disabled={!esAdmin || guardando}
            style={{ maxWidth: 160, minHeight: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--cp-line)' }}
          />
        </CampoAyuda>
        {esAdmin && (
          <div>
            <Boton variante="secundario" onClick={guardarTope} disabled={guardando || Number(topeTexto) === config.tope}>
              Guardar tope
            </Boton>
          </div>
        )}
      </CampoConfig>

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
        abierto={pendiente !== null}
        titulo={pendiente && config.activa[pendiente] ? `Apagar propina en ${ETIQUETA_CANAL[pendiente]}` : `Encender propina en ${pendiente ? ETIQUETA_CANAL[pendiente] : ''}`}
        mensaje={
          pendiente && config.activa[pendiente]
            ? `Desde ahora el cliente no verá la opción de dejar propina en ${ETIQUETA_CANAL[pendiente]}. Las propinas ya cobradas no cambian.`
            : `Desde ahora el cliente verá la opción de dejar propina en ${pendiente ? ETIQUETA_CANAL[pendiente] : ''}. Es opcional y va aparte del pedido.`
        }
        textoSi="Sí, confirmar"
        textoNo="No, cancelar"
        peligro={false}
        cargando={guardando}
        alConfirmar={alternar}
        alCancelar={() => setPendiente(null)}
      />
    </div>
  );
}
