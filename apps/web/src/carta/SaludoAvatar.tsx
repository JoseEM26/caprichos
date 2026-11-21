import { useEffect, useState } from 'react';
import { AvatarEditorPerezoso } from '../avatar/AvatarEditorPerezoso';
import { AvatarVivoPerezoso } from '../avatar/AvatarVivoPerezoso';
import { apodoDe, marcarSaludoHoy, useAvatarConfig, yaSaludoHoy } from '../avatar/useAvatarConfig';
import { useCuentaOpcional } from './cuenta/CuentaContext';
import './avatar-carta.css';

const MS_VISIBLE = 3500;

/**
 * «Avatar de bolsillo»: al abrir la carta, una vez por día, el avatar del cliente asoma en la esquina inferior izquierda
 * (el carrito vive en la cabecera, arriba), saluda y se esconde solo. Tocarlo abre «Mi avatar».
 */
export function SaludoAvatar() {
  const ctx = useCuentaOpcional();
  const avatarUrl = ctx?.cliente?.avatarUrl ?? null;
  const [elegible] = useState(() => !yaSaludoHoy());
  const config = useAvatarConfig(elegible && Boolean(avatarUrl));
  const [fase, setFase] = useState<'oculto' | 'visible' | 'editor' | 'hecho'>('oculto');

  // Con la config a mano se decide: interruptor apagado = no sale y no gasta el saludo del día
  useEffect(() => {
    if (fase !== 'oculto' || !config || !avatarUrl || config.mostrarAlEntrar === false) return;
    marcarSaludoHoy();
    setFase('visible');
  }, [config, avatarUrl, fase]);

  useEffect(() => {
    if (fase !== 'visible') return;
    const t = setTimeout(() => setFase('hecho'), MS_VISIBLE);
    return () => clearTimeout(t);
  }, [fase]);

  if (!ctx?.cliente || !avatarUrl || !config) return null;
  if (fase === 'editor') {
    return <AvatarEditorPerezoso inicial={config} nombreCuenta={ctx.cliente.nombre} guardar={ctx.guardarAvatar!} cerrar={() => setFase('hecho')} />;
  }
  if (fase !== 'visible') return null;
  const apodo = apodoDe(config, ctx.cliente.nombre);
  return (
    <button type="button" className="avc-bolsillo" onClick={() => ctx.guardarAvatar && setFase('editor')} aria-label="Abrir Mi avatar" data-testid="saludo-avatar">
      <AvatarVivoPerezoso config={config} retratoUrl={avatarUrl} accion="saludando" ancho={120} alto={156} tamanoRetrato={88} />
      <span className="avc-globo" role="status" aria-live="polite">{apodo ? `¡Hola, ${apodo}! 👋` : '¡Hola! 👋'}</span>
    </button>
  );
}
