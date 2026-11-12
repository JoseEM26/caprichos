import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Insignia } from '../../comun/Insignia';
import { Boton } from '../../comun/Boton';
import { CampoConfig } from './CampoConfig';

const CLAVE = 'cumpleanos_banner_equipo';

/** Interruptor del aviso «Hoy cumple años …» para todo el equipo. Nace encendido; solo el administrador lo cambia. */
export function TarjetaCumpleanosBannerConfiguracion({ esAdmin: esAdminProp }: { esAdmin?: boolean } = {}) {
  let rol = '';
  try {
    rol = useSesion().usuario?.rol || '';
  } catch {
    rol = '';
  }
  const esAdmin = esAdminProp !== undefined ? esAdminProp : rol.toUpperCase() === 'ADMIN';
  const [activo, setActivo] = useState<boolean | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const lista = await api.get<Array<{ clave: string; valor: unknown }>>('/admin/configuracion');
      const fila = lista.find((p) => p.clave === CLAVE);
      const norm = typeof fila?.valor === 'string' ? fila.valor.trim().toLowerCase() : '';
      setActivo(!(fila?.valor === false || norm === 'no'));
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo leer el ajuste');
      setActivo(true);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const alternar = async () => {
    if (activo === null) return;
    setGuardando(true);
    setError(null);
    try {
      await api.put(`/admin/configuracion/${CLAVE}`, { valor: activo ? 'no' : 'si' });
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cambiar el aviso de cumpleaños');
    } finally {
      setGuardando(false);
    }
  };

  if (activo === null) return null;
  return (
    <div data-testid="tarjeta-cumpleanos-banner" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '18px 20px', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--cp-navy)' }}>Aviso de cumpleaños para todo el equipo</div>
          <div style={{ fontSize: 12.5, color: 'var(--cp-soft)', marginTop: 2, maxWidth: 560 }}>
            Encendido, quien entra al panel ve «Hoy cumple años María S.» (solo nombre e inicial, nunca la fecha ni la edad). Apagado, no sale
            para nadie; la persona que cumple años sigue viendo su saludo.
          </div>
        </div>
        <CampoConfig id="operacion-cumpleanos-banner" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Insignia variante={activo ? 'exito' : 'neutro'}>{activo ? 'Encendido' : 'Apagado'}</Insignia>
          {esAdmin ? (
            <Boton variante={activo ? 'secundario' : 'primario'} cargando={guardando} onClick={alternar} aria-label="Alternar aviso de cumpleaños del equipo">
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
    </div>
  );
}
