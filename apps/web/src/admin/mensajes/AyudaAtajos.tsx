import { useEffect } from 'react';

const ATAJOS: Array<[string, string]> = [
  ['Alt + ↑ / Alt + ↓', 'Chat anterior / siguiente'],
  ['Enter', 'Enviar el mensaje'],
  ['Shift + Enter', 'Salto de línea'],
  ['/', 'Respuestas rápidas (Enter pega, Esc cierra)'],
  ['Esc', 'Cerrar el menú, el panel o el chat'],
  ['? o Alt + /', 'Mostrar esta ayuda'],
];

/** Ayuda breve de atajos de teclado del módulo Mensajes. */
export function AyudaAtajos({ alCerrar }: { alCerrar: () => void }) {
  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [alCerrar]);
  return (
    <div className="msg-ayuda" role="dialog" aria-label="Atajos de teclado">
      <div className="msg-ayuda-cab">
        <b>Atajos de teclado</b>
        <button type="button" className="msg-btn" aria-label="Cerrar la ayuda" onClick={alCerrar}>
          ✕
        </button>
      </div>
      <dl className="msg-ayuda-lista">
        {ATAJOS.map(([tecla, texto]) => (
          <div key={tecla}>
            <dt>
              <kbd>{tecla}</kbd>
            </dt>
            <dd>{texto}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
