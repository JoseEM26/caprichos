import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EstadoAdminImpresion } from '@caprichos/compartido';
import { impresionApi } from '../impresion/impresionApi';
import { useEventos } from '../../comun/socket';

/**
 * Franja fija arriba de Pedidos y caja: aparece mientras haya etiquetas en cola y la
 * impresora de Caja no esté conectada o tenga un problema. Se oculta sola al reconectar.
 */
export function FranjaImpresion() {
  const [estado, setEstado] = useState<EstadoAdminImpresion | null>(null);

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

  if (!estado) return null;
  const conProblema = estado.agente === 'sin_conexion' || estado.impresora !== 'lista';
  if (!(estado.pendientes > 0 && conProblema)) return null;

  return (
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
      <Link
        to="/admin/configuracion"
        style={{
          minHeight: 40,
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0 14px',
          borderRadius: 10,
          background: 'var(--cp-navy, #0B2C3E)',
          color: 'var(--cp-cream, #FBF4EC)',
          fontWeight: 800,
          fontSize: 13,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Ir a Impresión
      </Link>
    </div>
  );
}
