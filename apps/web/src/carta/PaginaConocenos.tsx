import type { CSSProperties, ReactNode } from 'react';
import { DatosLocalCarta, EstadoLocalCarta } from './tipos';
import { useEsMovil } from './useEsMovil';
import { MosaicoMomentos } from './MosaicoMomentos';
import { normalizarConocenos } from './conocenosContenido';
import type { ContenidoConocenos } from './conocenosContenido';
import { TextoEd, useEdicion } from './edicion';

interface PaginaConocenosProps {
  datosLocal: DatosLocalCarta | null;
  estadoLocal: EstadoLocalCarta | null;
  /** Textos, bloques y galería propia de Conócenos; si faltan se usan los de siempre. */
  contenido?: Partial<ContenidoConocenos> | null;
}

/** Datos del local: no se editan aquí; en edición, al tocarlos avisa dónde se cambian. */
function Local({ children }: { children: ReactNode }) {
  const ed = useEdicion();
  if (!ed) return <>{children}</>;
  return (
    <span role="button" tabIndex={0} data-edicion="accion" title="Se edita en Configuración del local" style={{ display: 'block', cursor: 'help' }} onClick={() => ed.accion('local')}>
      {children}
    </span>
  );
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
export function PaginaConocenos({ datosLocal, estadoLocal, contenido }: PaginaConocenosProps) {
  const movil = useEsMovil();
  const ed = useEdicion();
  const c = normalizarConocenos(contenido);
  // Galería propia: las 3 primeras son «Nuestro lugar» y el resto, Momentos. En edición se ven también las ocultas.
  const galeria = ed ? c.galeria : c.galeria.filter((f) => f.activo);
  const lugar = galeria.slice(0, 3);
  const momentos = galeria.slice(3);
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
        <div style={titulo}><TextoEd clave="bloque.donde.titulo" valor={tituloDe('donde')} ayuda="Título del bloque" /></div>
        <Local><div style={{ lineHeight: '22px' }}>{direccion}</div></Local>
        <a href={mapa} target="_blank" rel="noopener noreferrer" style={botonBorde}>Cómo llegar en Google Maps</a>
        <a href={mapa} target="_blank" rel="noopener noreferrer" style={{ ...botonBorde, borderStyle: 'dashed', fontWeight: 700 }}>Ver nuestras reseñas en Google</a>
      </Bloque>
    ),
    horario: (
      <Bloque gap={6}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={titulo}><TextoEd clave="bloque.horario.titulo" valor={tituloDe('horario')} ayuda="Título del bloque" /></div>
          {estadoLocal && (
            <span style={{ fontSize: 12, fontWeight: 800, borderRadius: 9999, padding: '3px 12px', background: estadoLocal.abierta ? '#2F9E57' : 'var(--cp-rust)', color: '#fff' }}>
              {estadoLocal.abierta ? `Abierto · cierra ${estadoLocal.cierra ?? ''}` : estadoLocal.texto}
            </span>
          )}
        </div>
        <Local>
          {(datosLocal?.horario ?? []).map((d) => (
            <div key={d.dia_semana} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: d.dia_semana === hoy ? 800 : 400 }}>
              <span>{d.dia}</span>
              <span>{d.cerrado || !d.abre ? 'Cerrado' : `${d.abre} a ${d.cierra}`}</span>
            </div>
          ))}
          {ed && !(datosLocal?.horario ?? []).length && <div style={{ color: 'var(--cp-soft)' }}>Horario del local</div>}
        </Local>
      </Bloque>
    ),
    contacto: whatsapp || ed ? (
      <Bloque>
        <div style={titulo}><TextoEd clave="bloque.contacto.titulo" valor={tituloDe('contacto')} ayuda="Título del bloque" /></div>
        <Local>{telefono ? <div>Teléfono y WhatsApp: {telefono}</div> : <div style={{ color: 'var(--cp-soft)' }}>Teléfono y WhatsApp del local</div>}</Local>
        <a href={`https://wa.me/51${whatsapp.slice(-9)}`} target="_blank" rel="noopener noreferrer" style={{ ...botonBorde, border: 0, background: 'var(--cp-orange)', color: '#fff' }}>
          Escríbenos por WhatsApp
        </a>
      </Bloque>
    ) : null,
    redes: redes.length > 0 || ed ? (
      <Bloque>
        <div style={titulo}><TextoEd clave="bloque.redes.titulo" valor={tituloDe('redes')} ayuda="Título del bloque" /></div>
        <Local><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {redes.map(([red, valor]) => (
            <a key={red} href={urlRed(red, valor)} target="_blank" rel="noopener noreferrer" style={{ ...botonBorde, padding: '0 16px', textTransform: 'capitalize' }}>
              {red}
            </a>
          ))}
          {ed && redes.length === 0 && <span style={{ color: 'var(--cp-soft)' }}>Redes sociales del local</span>}
        </div></Local>
      </Bloque>
    ) : null,
  };

  // Orden y visibilidad del editor. Las tarjetas van en dos columnas: la primera a la izquierda y el resto a la derecha.
  const visibles = ed ? c.bloques : c.bloques.filter((b) => b.visible);
  const ids = visibles.map((b) => b.id).filter((id) => id !== 'momentos');
  const primeraTarjeta = visibles.findIndex((b) => b.id !== 'momentos');
  const hueco = movil ? 12 : 20;
  const conBarra = (id: string) => (ed ? ed.bloque(`bloque:${id}`, tarjetas[id]) : tarjetas[id]);

  return (
    <div style={{ width: '100%', boxSizing: 'border-box', maxWidth: 1200, margin: '0 auto', padding: movil ? '12px 16px 40px' : '24px 24px 64px', display: 'flex', flexDirection: 'column', gap: movil ? 12 : 20 }}>
      <div style={{ background: 'var(--cp-navy)', color: 'var(--cp-cream)', borderRadius: movil ? 14 : 20, padding: movil ? 18 : 32, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 12, letterSpacing: '0.12em', color: 'var(--cp-orange)' }}><TextoEd clave="etiqueta" valor={c.etiqueta} ayuda="Etiqueta" /></span>
        <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: movil ? 22 : 34, lineHeight: movil ? '28px' : '42px' }}><TextoEd clave="titulo" valor={c.titulo} ayuda="Título" /></span>
        {c.parrafos.map((p, i) => (
          <span key={i} style={{ fontSize: movil ? 14 : 16, lineHeight: movil ? '21px' : '24px', maxWidth: 720 }}><TextoEd clave={`parrafo.${i}`} valor={p} ayuda="Párrafo" /></span>
        ))}
        {ed && c.parrafos.length < 6 && ed.agregar('parrafo', 'Agregar párrafo', { alignSelf: 'flex-start', minHeight: 44 })}
        {(ed || lugar.length > 0) && (
          <div style={{ marginTop: 10 }}>
            <MosaicoMomentos fotos={lugar} columnas={3} claveFotos="galeria" prioritaria />
          </div>
        )}
      </div>

      {visibles.map((b, i) => {
        if (b.id === 'momentos') {
          const mosaico = (
            <MosaicoMomentos key="momentos" titulo={b.titulo} claveTitulo="bloque.momentos.titulo" fotos={momentos} claveFotos="galeria" conAgregar />
          );
          return ed ? ed.bloque('bloque:momentos', mosaico) : mosaico;
        }
        if (i !== primeraTarjeta) return null;
        return (
          <div key="tarjetas" style={{ display: 'flex', flexWrap: 'wrap', gap: hueco, alignItems: 'stretch' }}>
            <div style={{ flex: '1 1 340px', minWidth: 0 }}>{conBarra(ids[0])}</div>
            {ids.length > 1 && (
              <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: hueco }}>
                {ids.slice(1).map((id) => <div key={id} style={{ display: 'contents' }}>{conBarra(id)}</div>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
