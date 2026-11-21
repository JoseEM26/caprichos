import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AvatarVivoPerezoso } from '../avatar/AvatarVivoPerezoso';
import { apodoDe, useAvatarConfig } from '../avatar/useAvatarConfig';
import { useCarrito } from './CarritoContext';
import { useCuentaOpcional } from './cuenta/CuentaContext';
import './avatar-carta.css';

const MS_FIESTA = 5000;
const COLORES = ['#E67929', '#F2C14E', '#E84A7F', '#3BB4E7', '#2DBE60', '#6B4E9B'];
// Confeti fijo (sin azar en el render): posición, duración y retraso repartidos
const CONFETI = Array.from({ length: 22 }, (_, i) => ({ izq: (i * 37) % 100, dur: 3 + (i % 5) * 0.6, ret: (i % 7) * 0.35, color: COLORES[i % COLORES.length] }));

/**
 * Al crear un pedido, a pantalla completa unos segundos: el avatar del cliente celebra con confeti y el código del pedido.
 * Sin avatar no sale (decisión: sin Capri, para no inventar un segundo personaje). Se cierra con Saltar, Esc o tocando.
 */
export function CelebracionPedido() {
  const { pedidoConfirmado } = useCarrito();
  const ctx = useCuentaOpcional();
  const avatarUrl = ctx?.cliente?.avatarUrl ?? null;
  const [codigo, setCodigo] = useState<string | null>(null);
  const ya = useRef<string | null>(null);

  useEffect(() => {
    if (!pedidoConfirmado || !avatarUrl || ya.current === pedidoConfirmado.codigo) return;
    ya.current = pedidoConfirmado.codigo;
    setCodigo(pedidoConfirmado.codigo);
  }, [pedidoConfirmado, avatarUrl]);

  if (!codigo || !avatarUrl || !ctx?.cliente) return null;
  return createPortal(<Fiesta codigo={codigo} avatarUrl={avatarUrl} nombreCuenta={ctx.cliente.nombre} cerrar={() => setCodigo(null)} />, document.body);
}

function Fiesta({ codigo, avatarUrl, nombreCuenta, cerrar }: { codigo: string; avatarUrl: string; nombreCuenta: string; cerrar: () => void }) {
  const config = useAvatarConfig(true);
  const saltar = useRef<HTMLButtonElement>(null);
  const apodo = apodoDe(config, nombreCuenta);
  const cierre = useRef(cerrar);
  cierre.current = cerrar;

  useEffect(() => {
    saltar.current?.focus();
    const t = setTimeout(() => cierre.current(), MS_FIESTA);
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cierre.current(); };
    window.addEventListener('keydown', tecla);
    return () => { clearTimeout(t); window.removeEventListener('keydown', tecla); };
  }, []);

  return (
    <div className="avc-fiesta" role="dialog" aria-modal="true" aria-label="Gracias por tu compra" onClick={cerrar} data-testid="celebracion-pedido">
      {CONFETI.map((c, i) => (
        <i key={i} className="avc-confeti" aria-hidden="true" style={{ left: `${c.izq}%`, background: c.color, animationDuration: `${c.dur}s`, animationDelay: `${c.ret}s` }} />
      ))}
      <AvatarVivoPerezoso config={config} retratoUrl={avatarUrl} accion="baile" ancho={240} alto={300} tamanoRetrato={180} />
      <div aria-live="polite">
        <h2>{apodo ? `¡Gracias por tu compra, ${apodo}! 🎉` : '¡Gracias por tu compra! 🎉'}</h2>
        <p>Pedido #{codigo}</p>
      </div>
      <button ref={saltar} type="button" className="avc-saltar" onClick={(e) => { e.stopPropagation(); cerrar(); }}>Saltar</button>
    </div>
  );
}
