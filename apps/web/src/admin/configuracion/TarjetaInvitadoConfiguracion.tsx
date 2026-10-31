import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { CampoConfig } from './CampoConfig';

function useSesionSegura() {
  try {
    return useSesion();
  } catch {
    return null;
  }
}

/** Interruptor «Pedir como invitado» (parámetro carta_invitado_activo). Apagado por defecto. Solo el administrador. */
export function TarjetaInvitadoConfiguracion({ esAdmin: esAdminProp }: { esAdmin?: boolean } = {}) {
  const sesion = useSesionSegura();
  const esAdmin = esAdminProp !== undefined ? esAdminProp : (sesion?.usuario?.rol || '').toUpperCase() === 'ADMIN';

  const [activo, setActivo] = useState<boolean>(false);
  const [cargando, setCargando] = useState<boolean>(true);
  const [confirmar, setConfirmar] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const lista = await api.get<Array<{ clave: string; valor: unknown }>>('/admin/configuracion');
      const p = lista.find((x) => x.clave === 'carta_invitado_activo');
      setActivo(String(p?.valor ?? '').toLowerCase().trim() === 'si');
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo leer el ajuste de pedir como invitado');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const alternar = async () => {
    const nuevo = !activo;
    setGuardando(true);
    setError(null);
    try {
      await api.put('/admin/configuracion/carta_invitado_activo', { valor: nuevo ? 'si' : 'no' });
      setConfirmar(false);
      setExito(nuevo ? 'Pedir como invitado encendido.' : 'Pedir como invitado apagado.');
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cambiar pedir como invitado');
      setConfirmar(false);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div data-testid="tarjeta-invitado-cargando" style={{ padding: 20 }}>
        <Cargando mensaje="Cargando ajuste de invitado..." />
      </div>
    );
  }

  return (
    <div
      data-testid="tarjeta-invitado"
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
            Pedir como invitado
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--cp-soft)', marginTop: 2, maxWidth: 560 }}>
            Encendido, quien pide desde la carta puede hacerlo sin dar su celular (no suma puntos). Apagado, debe poner al
            menos su celular para pedir y sumar puntos.
          </div>
        </div>
        <CampoConfig id="operacion-carta-invitado" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Insignia variante={activo ? 'exito' : 'neutro'}>{activo ? 'Encendido' : 'Apagado'}</Insignia>
          {esAdmin ? (
            <Boton
              variante={activo ? 'secundario' : 'primario'}
              onClick={() => {
                setExito(null);
                setConfirmar(true);
              }}
              aria-label="Alternar pedir como invitado"
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
        titulo={activo ? 'Apagar pedir como invitado' : 'Encender pedir como invitado'}
        mensaje={
          activo
            ? 'Desde ahora quien pida desde la carta debe escribir su celular para hacer su pedido y sumar puntos.'
            : 'Desde ahora quien pida desde la carta puede hacerlo sin dar su celular. Esos pedidos no suman puntos.'
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
