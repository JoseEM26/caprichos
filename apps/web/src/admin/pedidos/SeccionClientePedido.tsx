import { useEffect, useState } from 'react';
import { useSesion } from '../../comun/sesion';
import { enmascararDocumento } from '../comprobantes/utilidades';
import { buscarCuentaPorTelefono, type CuentaCliente } from '../salon/componentes/clienteCuenta';
import { BotonAbrirChatCliente } from '../mensajes/BotonAbrirChatCliente';
import type { Pedido } from './pedidosApi';

/**
 * Datos del cliente del pedido. La cuenta (puntos) y el RUC guardado se piden solo con el permiso de ver clientes,
 * igual que la ficha del cliente; el RUC sale enmascarado salvo para el ADMIN.
 */
export function SeccionClientePedido({ pedido }: { pedido: Pedido }) {
  const { tiene, usuario } = useSesion();
  const tel = String(pedido.cliente_telefono ?? '').replace(/\D/g, '');
  const consulta = tiene('clientes/ver') && /^9\d{8}$/.test(tel);
  const [cuenta, setCuenta] = useState<CuentaCliente | null>(null);
  const [listo, setListo] = useState(!consulta);

  useEffect(() => {
    if (!consulta) return;
    let vivo = true;
    buscarCuentaPorTelefono(tel).then(
      (c) => { if (vivo) { setCuenta(c); setListo(true); } },
      () => { if (vivo) setListo(true); },
    );
    return () => { vivo = false; };
  }, [consulta, tel]);

  const esAdmin = usuario?.rol === 'ADMIN';
  const f = cuenta?.facturacion;
  return (
    <>
    <dl className="dv-grid" data-testid="seccion-cliente">
      <div><dt>Nombre</dt><dd>{pedido.cliente_nombre?.trim() || 'Sin nombre'}</dd></div>
      <div><dt>Celular</dt><dd>{pedido.cliente_telefono || 'Sin celular'}</dd></div>
      {consulta && listo && <div><dt>Cuenta</dt><dd>{cuenta ? `Con cuenta · ${cuenta.puntos} puntos` : 'Sin cuenta'}</dd></div>}
      {pedido.puntos?.texto && <div><dt>Puntos de este pedido</dt><dd>{pedido.puntos.texto}</dd></div>}
      {f && <div><dt>RUC guardado</dt><dd>{enmascararDocumento(f.ruc, esAdmin)}{f.razonSocial ? ` · ${f.razonSocial}` : ''}</dd></div>}
      {f?.direccion && <div><dt>Dirección fiscal</dt><dd>{f.direccion}</dd></div>}
    </dl>
    <BotonAbrirChatCliente telefono={pedido.cliente_telefono} nombre={pedido.cliente_nombre} respaldoWa estilo={{ alignSelf: 'flex-start' }} />
    </>
  );
}
