import { Link } from 'react-router-dom';
import { useSesion } from '../../comun/sesion';
import { ReimprimirPedido } from '../pedidos/ReimprimirPedido';
import type { FilaHistorialImpresion, OrigenImpresion } from './historialImpresionApi';
import '../pedidos/detalle-pedido.css';

export const TEXTO_ORIGEN: Record<OrigenImpresion, string> = {
  AUTOMATICA: 'Automática',
  REIMPRESION: 'Reimpresión',
  PRUEBA: 'Prueba',
  REINTENTO: 'Reintento',
};
export const AYUDA_ORIGEN: Record<OrigenImpresion, string> = {
  AUTOMATICA: 'Salió sola al aceptar, cobrar o cerrar',
  REIMPRESION: 'Copia pedida por una persona con el botón Reimprimir',
  PRUEBA: 'Hoja de prueba o simulación; no es de un pedido real',
  REINTENTO: 'El mismo trabajo que volvió a la cola',
};
const COLOR_ORIGEN: Record<OrigenImpresion, { fondo: string; texto: string }> = {
  AUTOMATICA: { fondo: 'var(--cp-greenbg)', texto: 'var(--cp-green)' },
  REIMPRESION: { fondo: 'var(--cp-sand)', texto: 'var(--cp-navy)' },
  PRUEBA: { fondo: '#FFF4D6', texto: '#7A5400' },
  REINTENTO: { fondo: '#FBEDE9', texto: 'var(--cp-rust)' },
};
export const TEXTO_ESTADO: Record<string, string> = {
  IMPRESO: 'Impreso',
  FALLIDO: 'Falló',
  PENDIENTE: 'En cola',
  IMPRIMIENDO: 'Imprimiendo',
  VENCIDO: 'Venció',
  DESCARTADO: 'Descartado',
};

/** Texto + color (nunca solo color). Con `alClic` es un interruptor para filtrar. */
export function ChipOrigen({ origen, activo, alClic, cantidad }: { origen: OrigenImpresion; activo?: boolean; alClic?: () => void; cantidad?: number }) {
  const c = COLOR_ORIGEN[origen];
  const estilo = {
    background: c.fondo,
    color: c.texto,
    border: `1.5px solid ${activo ? c.texto : 'transparent'}`,
    borderRadius: 9999,
    padding: '2px 10px',
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap' as const,
    minHeight: alClic ? 36 : undefined,
  };
  const texto = `${TEXTO_ORIGEN[origen]}${cantidad !== undefined ? ` · ${cantidad}` : ''}`;
  return alClic ? (
    <button type="button" title={AYUDA_ORIGEN[origen]} aria-pressed={!!activo} onClick={alClic} style={{ ...estilo, cursor: 'pointer' }}>
      {texto}
    </button>
  ) : (
    <span title={AYUDA_ORIGEN[origen]} style={estilo}>
      {texto}
    </span>
  );
}

export function ChipEstado({ estado }: { estado: string }) {
  const mal = estado === 'FALLIDO' || estado === 'VENCIDO';
  const ok = estado === 'IMPRESO';
  return (
    <span
      style={{
        borderRadius: 9999,
        padding: '2px 10px',
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        background: ok ? 'var(--cp-greenbg)' : mal ? '#FBEDE9' : 'var(--cp-sand)',
        color: ok ? 'var(--cp-green)' : mal ? 'var(--cp-rust)' : 'var(--cp-navy)',
        border: `1px solid ${ok ? 'var(--cp-green)' : mal ? 'var(--cp-rust)' : 'var(--cp-line)'}`,
      }}
    >
      {ok ? '✓ ' : mal ? '✕ ' : ''}
      {TEXTO_ESTADO[estado] ?? estado}
    </span>
  );
}

const hora = (iso: string) => new Date(iso).toLocaleString('es-PE', { hour12: true, dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima' });

function quien(f: FilaHistorialImpresion): string {
  if (f.solicitadoPor) return `${f.solicitadoPor.nombre}${f.solicitadoPor.rol ? ` · ${f.solicitadoPor.rol}` : ''}`;
  return f.origen === 'AUTOMATICA' ? 'Sistema (automático)' : 'No registrado';
}

/** Una impresión: origen, estado, qué, quién, cuándo, dónde y error; con «Reimprimir» si tiene pedido. Sirve a Historial y al detalle del pedido. */
export function FilaImpresion({ fila, mostrarPedido = true, alTerminar }: { fila: FilaHistorialImpresion; mostrarPedido?: boolean; alTerminar?: () => void }) {
  const { tiene } = useSesion();
  const puedeReimprimir = !!fila.pedidoId && tiene('pedidos/cambiar_estado');
  return (
    <li
      data-testid="fila-impresion"
      style={{
        listStyle: 'none',
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: 12,
        padding: '10px 12px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <ChipOrigen origen={fila.origen} />
          <ChipEstado estado={fila.estado} />
          <b style={{ fontSize: 14 }}>{fila.etiqueta}</b>
          {mostrarPedido &&
            (fila.pedidoId ? (
              <Link to={`/admin/caja?pedido=${fila.pedidoId}`} style={{ fontSize: 13, fontWeight: 800, color: 'var(--cp-navy)' }}>
                {fila.pedidoCodigo ?? `Pedido ${fila.pedidoId}`}
              </Link>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Sin pedido</span>
            ))}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--cp-soft)', display: 'flex', gap: '2px 12px', flexWrap: 'wrap' }}>
          <span>
            <b>Pidió:</b> {quien(fila)}
          </span>
          <span>
            <b>Cuándo:</b> {hora(fila.creadoEn)}
          </span>
          {fila.impresoEn && (
            <span>
              <b>Salió:</b> {hora(fila.impresoEn)}
            </span>
          )}
          <span>
            <b>Dónde:</b> {fila.equipo ? `${fila.equipo.nombre}${fila.impresora ? ` / ${fila.impresora}` : ''}` : 'Sin computadora asignada'}
          </span>
          {fila.intentos > 1 && <span>{fila.intentos} intentos</span>}
          {fila.motivo && <span>({fila.motivo.replace(/^era (\w+)$/, (_m, o: string) => `antes: ${TEXTO_ORIGEN[o as OrigenImpresion]?.toLowerCase() ?? o}`)})</span>}
        </div>
        {fila.error && (
          <div role="note" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cp-rust)' }}>
            {fila.error}
          </div>
        )}
      </div>
      {puedeReimprimir && (
        <ReimprimirPedido pedido={{ id: fila.pedidoId!, codigo: fila.pedidoCodigo ?? fila.pedidoId! }} variante="detalle" alTerminar={alTerminar} />
      )}
    </li>
  );
}
