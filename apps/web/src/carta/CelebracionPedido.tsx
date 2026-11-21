import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AvatarVivoPerezoso } from '../avatar/AvatarVivoPerezoso';
import { apodoDe, useAvatarConfig } from '../avatar/useAvatarConfig';
import { prefiereMovimientoReducido, tieneSoporteWebGL } from '../mascota/soporteWebGL';
import { useCarrito } from './CarritoContext';
import { useCuentaOpcional } from './cuenta/CuentaContext';
import { FondoCelebracion } from './celebracion/FondoCelebracion';
import { temaDeDecoracion } from './celebracion/temas';
import type { TemaCelebracion } from './celebracion/temas';
import './avatar-carta.css';

const MS_FIESTA = 5800;

/** Carga la letra de la temática solo ahora (no estaba en la carta); si falla, queda la pila de respaldo. */
function cargarFuente(t: TemaCelebracion) {
  if (!t.fuente.google) return;
  const id = `avc-font-${t.id}`;
  if (document.getElementById(id)) return;
  const l = document.createElement('link');
  l.id = id; l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?family=${t.fuente.google}&display=swap`;
  document.head.appendChild(l);
}

/**
 * Al crear un pedido, a pantalla completa unos segundos: el avatar del cliente, grande, sostiene un cartel «¡Gracias!»
 * con el código del pedido sobre un fondo de la temática de la carta (`decoracion` del diseñador; sin ella, el clásico).
 * Sin avatar no sale. Se cierra con Saltar, Esc o tocando.
 */
export function CelebracionPedido({ decoracion }: { decoracion?: string }) {
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
  return createPortal(<Fiesta codigo={codigo} avatarUrl={avatarUrl} nombreCuenta={ctx.cliente.nombre} tema={temaDeDecoracion(decoracion)} cerrar={() => setCodigo(null)} />, document.body);
}

/** Tamaños pensados para el alto de la pantalla (~66 % en celular, ~72 % en laptop); se recalculan al girar o redimensionar. */
function useMedidas() {
  const medir = () => {
    const h = (typeof window !== 'undefined' && window.innerHeight) || 800;
    const w = (typeof window !== 'undefined' && window.innerWidth) || 400;
    const alto = Math.round(h * (w >= 900 ? 0.72 : 0.66));
    return { alto, ancho: Math.min(w, Math.round(alto * 0.95)), retrato: Math.round(Math.min(w * 0.8, h * 0.4, 360)) };
  };
  const [m, setM] = useState(medir);
  useEffect(() => {
    const f = () => setM(medir());
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return m;
}

function Fiesta({ codigo, avatarUrl, nombreCuenta, tema, cerrar }: { codigo: string; avatarUrl: string; nombreCuenta: string; tema: TemaCelebracion; cerrar: () => void }) {
  const config = useAvatarConfig(true);
  const saltar = useRef<HTMLButtonElement>(null);
  const apodo = apodoDe(config, nombreCuenta);
  const cierre = useRef(cerrar);
  cierre.current = cerrar;
  const [fallo, setFallo] = useState(false);
  const hay3d = useMemo(() => tieneSoporteWebGL() && !prefiereMovimientoReducido(), []);
  const sin3d = !hay3d || fallo || !config;
  const medidas = useMedidas();
  const titulo = apodo ? `¡Gracias, ${apodo}!` : '¡Gracias!';
  const cartel = useMemo(() => ({ titulo, subtitulo: `Pedido #${codigo}`, ...tema.cartel, fuente: tema.fuente.pila }), [titulo, codigo, tema]);
  const estilo = { '--avc-fuente': tema.fuente.pila, '--avc-cartel-fondo': tema.cartel.fondo, '--avc-cartel-tinta': tema.cartel.tinta, '--avc-cartel-borde': tema.cartel.borde, '--avc-cartel-acento': tema.cartel.acento, '--avc-btn-fondo': tema.boton.fondo, '--avc-btn-tinta': tema.boton.tinta, '--avc-btn-borde': tema.boton.borde } as React.CSSProperties;

  useEffect(() => {
    cargarFuente(tema);
    saltar.current?.focus();
    const t = setTimeout(() => cierre.current(), MS_FIESTA);
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cierre.current(); };
    window.addEventListener('keydown', tecla);
    return () => { clearTimeout(t); window.removeEventListener('keydown', tecla); };
  }, [tema]);

  return (
    <div className="avc-fiesta" style={estilo} role="dialog" aria-modal="true" aria-label="Gracias por tu compra" onClick={cerrar} data-testid="celebracion-pedido" data-tema={tema.id}>
      <FondoCelebracion tema={tema} />
      <div className="avc-escena" style={sin3d ? undefined : { width: medidas.ancho, height: medidas.alto }}>
        <AvatarVivoPerezoso
          config={config}
          retratoUrl={avatarUrl}
          accion="cartel"
          ancho={sin3d ? medidas.retrato : medidas.ancho}
          alto={sin3d ? medidas.retrato : medidas.alto}
          tamanoRetrato={medidas.retrato}
          cartel={cartel}
          alFallar={() => setFallo(true)}
        />
        {sin3d && (
          <div className="avc-cartel" data-testid="cartel-html" aria-hidden="true">
            <h2>{titulo}</h2>
            <p>Pedido #{codigo}</p>
          </div>
        )}
      </div>
      <div className="avc-solo-lectores" aria-live="polite">¡Gracias por tu compra{apodo ? `, ${apodo}` : ''}! Pedido {codigo}</div>
      <button ref={saltar} type="button" className="avc-saltar" onClick={(e) => { e.stopPropagation(); cerrar(); }}>Saltar</button>
    </div>
  );
}
