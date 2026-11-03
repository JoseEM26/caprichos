import { useEffect, useState } from 'react';
import { DetalleConversacion } from './mensajesTipos';
import { esUsuarioWhatsApp } from './utilidadesChat';

export interface MenuChatProps {
  detalle: DetalleConversacion;
  onEditarNombre: () => void;
  onTogglePausaBot: () => void;
  onTomarChat: () => void;
  onSoltarChat: () => void;
  onMarcarAtendido: () => void;
  onCopiarProductos: () => void;
  onCopiarCelular: () => void;
}

/** Botón «⋯» con las acciones secundarias del chat. Se cierra al elegir una, con Esc o al tocar fuera. */
export function MenuChat({
  detalle,
  onEditarNombre,
  onTogglePausaBot,
  onTomarChat,
  onSoltarChat,
  onMarcarAtendido,
  onCopiarProductos,
  onCopiarCelular,
}: MenuChatProps) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const alTecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [abierto]);

  const elegir = (accion: () => void) => () => {
    setAbierto(false);
    accion();
  };
  const esWa = esUsuarioWhatsApp(detalle);

  return (
    <div style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        className="msg-btn msg-btn-icono"
        aria-label="Más opciones del chat"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        ⋯
      </button>
      {abierto && (
        <>
          <button type="button" className="msg-menu-fondo" aria-label="Cerrar el menú" onClick={() => setAbierto(false)} />
          <div className="msg-menu" role="menu" aria-label="Acciones del chat">
            <button type="button" role="menuitem" className="msg-menu-item" onClick={elegir(onEditarNombre)}>
              Editar nombre
            </button>
            <button type="button" role="menuitem" className="msg-menu-item" onClick={elegir(onTogglePausaBot)}>
              {detalle.estado === 'pausado' ? 'Reanudar el bot' : 'Pausar el bot'}
            </button>
            <button
              type="button"
              role="menuitem"
              className="msg-menu-item"
              onClick={elegir(detalle.esMio ? onSoltarChat : onTomarChat)}
            >
              {detalle.esMio ? 'Soltar el chat' : 'Tomar el chat'}
            </button>
            {detalle.estado !== 'atendido' && (
              <button type="button" role="menuitem" className="msg-menu-item" onClick={elegir(onMarcarAtendido)}>
                Marcar atendido
              </button>
            )}
            <button type="button" role="menuitem" className="msg-menu-item" onClick={elegir(onCopiarProductos)}>
              Copiar solo productos
            </button>
            {!esWa && (
              <>
                <button type="button" role="menuitem" className="msg-menu-item" onClick={elegir(onCopiarCelular)}>
                  Copiar celular
                </button>
                <a
                  role="menuitem"
                  className="msg-menu-item"
                  style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
                  href={`https://wa.me/51${detalle.telefono.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setAbierto(false)}
                >
                  Abrir en WhatsApp
                </a>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
