import type { CSSProperties, ReactNode } from 'react';
import { DatosLocalCarta, EstadoLocalCarta } from './tipos';
import { useEsMovil } from './useEsMovil';
import { MosaicoMomentos } from './MosaicoMomentos';
import { normalizarConocenos } from './conocenosContenido';
import type { ContenidoConocenos } from './conocenosContenido';

interface PaginaConocenosProps {
  datosLocal: DatosLocalCarta | null;
  estadoLocal: EstadoLocalCarta | null;
  /** Fotos reales del Diseñador (Momentos). Si no hay, el mosaico usa las de marca. */
  fotos?: string[];
  /** Textos editables; si faltan se usan los de siempre. */
  contenido?: Partial<ContenidoConocenos> | null;
}

const titulo: CSSProperties = { fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18 };
const botonBorde: CSSProperties = {
  minHeight: 48,
  boxSizing: 'border-box',
  borderRadius: 12,
  border: '1.5px solid var(--cp-navy)',
  color: 'var(--cp-navy)',
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
};

function Bloque({ children, gap = 10 }: { children: ReactNode; gap?: number }) {
  return (
    <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap }}>
      {children}
    </div>
  );
}

/** Página «Conócenos» (mockup Main ▸ CONÓCENOS): quiénes somos, dónde estamos, horario y contacto. */
export function PaginaConocenos({ datosLocal, estadoLocal, fotos = [], contenido }: PaginaConocenosProps) {
  const movil = useEsMovil();
  const c = normalizarConocenos(contenido);
  const tituloDe = (id: string) => c.bloques.find((b) => b.id === id)?.titulo ?? '';
  const direccion = datosLocal?.direccion || 'Campoy, San Juan de Lurigancho, Lima';
  const telefono = datosLocal?.telefono || '';
  const whatsapp = (datosLocal?.whatsapp || '').replace(/\D/g, '');
  const hoy = ((new Date().getDay() + 6) % 7) + 1; // 1 = lunes … 7 = domingo
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${datosLocal?.nombre || 'Caprichos'} ${direccion}`)}`;
  const redes = Object.entries(datosLocal?.redes ?? {}).filter(([, v]) => v);
  const urlRed = (red: string, valor: string) =>
    /^https?:/.test(valor) ? valor : `https://${red}.com/${red === 'tiktok' ? '@' : ''}${valor.replace(/^@/, '')}`;

  const tarjetas: Record<string, ReactNode> = {
    donde: (
      <Bloque>
        <div style={titulo}>{tituloDe('donde')}</div>
        <div style={{ lineHeight: '22px' }}>{direccion}</div>
        <a href={mapa} target="_blank" rel="noopener noreferrer" style={botonBorde}>Cómo llegar en Google Maps</a>
        <a href={mapa} target="_blank" rel="noopener noreferrer" style={{ ...botonBorde, borderStyle: 'dashed', fontWeight: 700 }}>Ver nuestras reseñas en Google</a>
      </Bloque>
    ),
    horario: (
      <Bloque gap={6}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={titulo}>{tituloDe('horario')}</div>
          {estadoLocal && (
            <span style={{ fontSize: 12, fontWeight: 800, borderRadius: 9999, padding: '3px 12px', background: estadoLocal.abierta ? '#2F9E57' : 'var(--cp-rust)', color: '#fff' }}>
              {estadoLocal.abierta ? `Abierto · cierra ${estadoLocal.cierra ?? ''}` : estadoLocal.texto}
            </span>
          )}
        </div>
        {(datosLocal?.horario ?? []).map((d) => (
          <div key={d.dia_semana} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: d.dia_semana === hoy ? 800 : 400 }}>
            <span>{d.dia}</span>
            <span>{d.cerrado || !d.abre ? 'Cerrado' : `${d.abre} a ${d.cierra}`}</span>
          </div>
        ))}
      </Bloque>
    ),
    contacto: whatsapp ? (
      <Bloque>
        <div style={titulo}>{tituloDe('contacto')}</div>
        {telefono && <div>Teléfono y WhatsApp: {telefono}</div>}
        <a href={`https://wa.me/51${whatsapp.slice(-9)}`} target="_blank" rel="noopener noreferrer" style={{ ...botonBorde, border: 0, background: 'var(--cp-orange)', color: '#fff' }}>
          Escríbenos por WhatsApp
        </a>
      </Bloque>
    ) : null,
    redes: redes.length > 0 ? (
      <Bloque>
        <div style={titulo}>{tituloDe('redes')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {redes.map(([red, valor]) => (
            <a key={red} href={urlRed(red, valor)} target="_blank" rel="noopener noreferrer" style={{ ...botonBorde, padding: '0 16px', textTransform: 'capitalize' }}>
              {red}
            </a>
          ))}
        </div>
      </Bloque>
    ) : null,
  };

  // Orden y visibilidad del editor. Las tarjetas van en dos columnas: la primera a la izquierda y el resto a la derecha.
  const visibles = c.bloques.filter((b) => b.visible);
  const ids = visibles.map((b) => b.id).filter((id) => id !== 'momentos');
  const primeraTarjeta = visibles.findIndex((b) => b.id !== 'momentos');
  const hueco = movil ? 12 : 20;

  return (
    <div style={{ width: '100%', boxSizing: 'border-box', maxWidth: 1200, margin: '0 auto', padding: movil ? '12px 16px 40px' : '24px 24px 64px', display: 'flex', flexDirection: 'column', gap: movil ? 12 : 20 }}>
      <div style={{ background: 'var(--cp-navy)', color: 'var(--cp-cream)', borderRadius: movil ? 14 : 20, padding: movil ? 18 : 32, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 12, letterSpacing: '0.12em', color: 'var(--cp-orange)' }}>{c.etiqueta}</span>
        <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: movil ? 22 : 34, lineHeight: movil ? '28px' : '42px' }}>{c.titulo}</span>
        {c.parrafos.map((p, i) => (
          <span key={i} style={{ fontSize: movil ? 14 : 16, lineHeight: movil ? '21px' : '24px', maxWidth: 720 }}>{p}</span>
        ))}
        <div style={{ marginTop: 10 }}>
          <MosaicoMomentos fotos={fotos} cantidad={3} columnas={3} prioritaria />
        </div>
      </div>

      {visibles.map((b, i) => {
        if (b.id === 'momentos') {
          return <MosaicoMomentos key="momentos" titulo={b.titulo} fotos={fotos} cantidad={c.momentosCantidad} />;
        }
        if (i !== primeraTarjeta) return null;
        return (
          <div key="tarjetas" style={{ display: 'flex', flexWrap: 'wrap', gap: hueco, alignItems: 'stretch' }}>
            <div style={{ flex: '1 1 340px', minWidth: 0 }}>{tarjetas[ids[0]]}</div>
            {ids.length > 1 && (
              <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: hueco }}>
                {ids.slice(1).map((id) => <div key={id} style={{ display: 'contents' }}>{tarjetas[id]}</div>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
