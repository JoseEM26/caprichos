import { useEffect } from 'react';

const FX_TEMAS: Record<string, { glyphs: string[]; msg: string; bg: string; fg: string; lights?: boolean }> = {
  ninguno: { glyphs: [], msg: '', bg: 'var(--cp-line)', fg: 'var(--cp-navy)' },
  halloween: { glyphs: ['🎃', '🦇', '👻', '✨'], msg: '¡Feliz Halloween! Dulces y travesuras en Caprichos', bg: '#2B1B3F', fg: '#F6A04D' },
  navidad: { glyphs: ['❄️', '🎄', '🎁', '⭐'], msg: '¡Feliz Navidad! Endulza la Nochebuena con Caprichos', bg: '#1F6B3A', fg: '#FFFFFF', lights: true },
  anonuevo: { glyphs: ['🎉', '✨', '🎈', '🥂'], msg: '¡Feliz Año Nuevo! Brindemos con algo dulce', bg: '#1A1A2E', fg: '#F5C84B' },
  sanvalentin: { glyphs: ['❤️', '💕', '🌹', '✨'], msg: 'Feliz Día de San Valentín. Comparte un capricho', bg: '#B83A5B', fg: '#FFFFFF' },
  madre: { glyphs: ['🌸', '💐', '🌷', '✨'], msg: 'Feliz Día de la Madre. Un capricho para mamá', bg: '#D77FA1', fg: '#FFFFFF' },
  padre: { glyphs: ['⭐', '🏆', '☕', '✨'], msg: 'Feliz Día del Padre. Un capricho para papá', bg: 'var(--cp-soft)', fg: 'var(--cp-cream)' },
  patrias: { glyphs: ['🎉', '🎈', '✨', '🇵🇪'], msg: '¡Felices Fiestas Patrias! Celebra con sabor peruano', bg: '#C8102E', fg: '#FFFFFF' },
  ninos: { glyphs: ['🎈', '⭐', '🍭', '🎉'], msg: 'Feliz Día del Niño. Donas y frappes para los más chiquitos', bg: 'var(--cp-gold)', fg: 'var(--cp-navy)' },
  aniversario: { glyphs: ['🎈', '🎉', '🎂', '✨'], msg: '¡Caprichos está de aniversario! Celebra con nosotros', bg: 'var(--cp-orange)', fg: 'var(--cp-navy)' },
};

export function DecoracionAnimada({ tema }: { tema: string }) {
  const tKey = (tema || 'ninguno').toLowerCase();
  const info = FX_TEMAS[tKey];

  useEffect(() => {
    // Inyectar animaciones de caída y subida si no existen
    const id = 'cp-fx-keyframes';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        @keyframes fx-fall {
          0% { transform: translateY(-30px) rotate(0deg); opacity: 0; }
          10% { opacity: 0.85; }
          90% { opacity: 0.85; }
          100% { transform: translateY(105vh) rotate(360deg); opacity: 0; }
        }
        @keyframes fx-rise {
          0% { transform: translateY(105vh) rotate(0deg); opacity: 0; }
          10% { opacity: 0.85; }
          90% { opacity: 0.85; }
          100% { transform: translateY(-30px) rotate(-180deg); opacity: 0; }
        }
        @keyframes bulb-glow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (!info || !info.glyphs.length) return null;

  const count = 16;
  const particles = [];
  for (let i = 0; i < count; i++) {
    const g = info.glyphs[i % info.glyphs.length];
    const rise = g === '🎈';
    const left = `${((i * 53) % 94) + 2}%`;
    const size = `${16 + ((i * 7) % 14)}px`;
    const duration = 9 + ((i * 3) % 8);
    const delay = -((i * 17) % 10);
    const anim = `${rise ? 'fx-rise' : 'fx-fall'} ${duration}s linear ${delay}s infinite`;
    particles.push({ g, left, size, anim });
  }

  const bulbs = [];
  if (info.lights) {
    const cols = ['#E63946', '#F5C84B', '#2FA84F', '#4DA3FF'];
    for (let i = 0; i < 24; i++) {
      bulbs.push({
        left: `${(i / 23) * 100}%`,
        color: cols[i % cols.length],
        anim: `bulb-glow ${1 + ((i * 3) % 4) * 0.4}s ease-in-out infinite alternate`,
      });
    }
  }

  return (
    <>
      {/* Guirnalda de luces si es Navidad */}
      {info.lights && (
        <div style={{ position: 'fixed', left: 0, right: 0, top: 0, height: 14, zIndex: 35, pointerEvents: 'none' }}>
          {bulbs.map((bb, idx) => (
            <span
              key={idx}
              style={{
                position: 'absolute',
                top: 2,
                left: bb.left,
                width: 10,
                height: 10,
                marginLeft: -5,
                borderRadius: '50%',
                background: bb.color,
                boxShadow: `0 0 8px ${bb.color}`,
                animation: bb.anim,
              }}
            />
          ))}
        </div>
      )}

      {/* Partículas cayendo */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 30,
        }}
      >
        {particles.map((f, idx) => (
          <span
            key={idx}
            style={{
              position: 'absolute',
              left: f.left,
              top: 0,
              fontSize: f.size,
              lineHeight: 1,
              animation: f.anim,
            }}
          >
            {f.g}
          </span>
        ))}
      </div>
    </>
  );
}
