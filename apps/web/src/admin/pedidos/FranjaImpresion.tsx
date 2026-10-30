import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EstadoAdminImpresion } from '@caprichos/compartido';
import { impresionApi } from '../impresion/impresionApi';
import { useEventos } from '../../comun/socket';
import { ColaImpresion } from '../impresion/ColaImpresion';
import { IndicadoresMaquinas } from '../impresion/IndicadoresMaquinas';
import { useEstadoMaquinas } from '../impresion/useEstadoMaquinas';

/**
 * Franja fija arriba de Pedidos y caja: aparece mientras haya etiquetas en cola y la
 * impresora de Caja no esté conectada o tenga un problema. Se oculta sola al reconectar.
 */
export function FranjaImpresion() {
  const [estado, setEstado] = useState<EstadoAdminImpresion | null>(null);
  const [verCola, setVerCola] = useState(false);
  const { maquinas } = useEstadoMaquinas();

  const cargar = useCallback(async () => {
    try {
      setEstado(await impresionApi.obtenerEstado());
    } catch {
      // sin permiso o sin conexión: no se muestra la franja
      setEstado(null);
    }
  }, []);

  useEffect(() => {
    void cargar();
    const cada = setInterval(() => void cargar(), 20000);
    return () => clearInterval(cada);
  }, [cargar]);

  useEventos('impresion:sin_conexion', cargar);
  useEventos('pedido:nuevo', cargar);
  useEventos('impresion:cola', cargar);

  const indicadores = <IndicadoresMaquinas maquinas={maquinas} alVerCola={() => setVerCola(true)} />;
  const conProblema = estado ? estado.agente === 'sin_conexion' || estado.impresora !== 'lista' : false;
  if (!estado || !(estado.pendientes > 0 && conProblema)) {
    return (
      <>
        {indicadores}
        {verCola && <ColaImpresion alCerrar={() => setVerCola(false)} />}
      </>
    );
  }

  const estiloBoton = {
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 14px',
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 13,
    whiteSpace: 'nowrap' as const,
  };

  return (
    <>
    {indicadores}
    <div
      role="alert"
      data-testid="franja-impresion"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        padding: '10px 14px',
        marginBottom: 10,
        borderRadius: 10,
        background: '#FBE9DF',
        borderLeft: '5px solid var(--cp-rust, #B2500F)',
        color: 'var(--cp-navy, #0B2C3E)',
      }}
    >
      <div style={{ fontSize: 13, lineHeight: '18px' }}>
        <strong>Impresora sin conexión: {estado.pendientes} etiqueta(s) en cola.</strong>{' '}
        Revisa que la PC de la etiquetera esté encendida con el programa de impresión abierto.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setVerCola(true)}
          style={{ ...estiloBoton, background: 'var(--cp-rust, #B2500F)', color: '#fff', border: 0, cursor: 'pointer' }}
        >
          Gestionar cola
        </button>
        <Link
          to="/admin/configuracion?tab=impresion"
          style={{ ...estiloBoton, background: 'var(--cp-navy, #0B2C3E)', color: 'var(--cp-cream, #FBF4EC)', textDecoration: 'none' }}
        >
          Ver impresión
        </Link>
      </div>
    </div>
    {verCola && <ColaImpresion alCerrar={() => { setVerCola(false); void cargar(); }} />}
    </>
  );
}
