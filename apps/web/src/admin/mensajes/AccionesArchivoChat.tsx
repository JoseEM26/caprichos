import { useState } from 'react';
import { obtenerBlobAutenticado } from '../../comun/api';
import { asignarFotoComoVoucher, listarPedidosParaVoucher, PedidoParaVoucher, recuperarArchivoMensaje } from './mensajesApi';
import { MensajeItem } from './mensajesTipos';

/**
 * Acciones sobre el archivo de un mensaje del cliente: «Descargar» la foto, «Asignar como voucher del pedido…»
 * (elige entre los pedidos de los últimos días) y «Recuperar archivo» cuando no se guardó. Todo con sesión y permiso.
 */
export function AccionesArchivoChat({ mensaje: m }: { mensaje: MensajeItem }) {
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoParaVoucher[] | null>(null);

  const conFoto = m.imagen && !!m.imagenId;
  if (!conFoto && !m.recuperable) return null;

  const ejecutar = async (accion: () => Promise<void>, fallo: string) => {
    setOcupado(true);
    setAviso('');
    try {
      await accion();
    } catch (e: any) {
      setAviso(e?.message || fallo);
    } finally {
      setOcupado(false);
    }
  };

  const descargar = () =>
    ejecutar(async () => {
      const url = await obtenerBlobAutenticado(`/admin/archivos/${m.imagenId}`);
      const a = document.createElement('a');
      a.href = url;
      a.download = `foto-${m.id}.jpg`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }, 'No se pudo descargar la foto');

  const abrirPedidos = () =>
    ejecutar(async () => {
      const lista = await listarPedidosParaVoucher(m.id);
      setPedidos(lista);
      if (!lista.length) setAviso('Este cliente no tiene pedidos de los últimos días');
    }, 'No se pudieron cargar los pedidos');

  const asignar = (p: PedidoParaVoucher) =>
    ejecutar(async () => {
      const r = await asignarFotoComoVoucher(m.id, p.id);
      setPedidos(null);
      setAviso(`Listo: la foto quedó como voucher del pedido ${r.codigo}`);
    }, 'No se pudo asignar la foto');

  const recuperar = () =>
    ejecutar(async () => {
      await recuperarArchivoMensaje(m.id);
      setAviso('Archivo recuperado');
    }, 'No se pudo recuperar el archivo');

  return (
    <div className="msg-acciones-archivo" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '4px 0' }}>
      {conFoto && (
        <>
          <button type="button" className="msg-btn" disabled={ocupado} onClick={descargar}>Descargar</button>
          <button type="button" className="msg-btn" disabled={ocupado} onClick={abrirPedidos}>Asignar como voucher del pedido…</button>
        </>
      )}
      {m.recuperable && (
        <button type="button" className="msg-btn" disabled={ocupado} onClick={recuperar}>Recuperar archivo</button>
      )}
      {pedidos && pedidos.length > 0 && (
        <ul aria-label="Pedidos del cliente" style={{ flexBasis: '100%', margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
          {pedidos.map((p) => (
            <li key={p.id}>
              <button type="button" className="msg-btn" disabled={ocupado} onClick={() => asignar(p)}>
                {p.codigo} · S/ {p.total.toFixed(2)} · {p.pagoEstado === 'PENDIENTE' ? 'pago pendiente' : p.pagoEstado.toLowerCase()}
              </button>
            </li>
          ))}
        </ul>
      )}
      {aviso && <div role="status" style={{ flexBasis: '100%', fontSize: 12 }}>{aviso}</div>}
    </div>
  );
}
