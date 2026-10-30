import { useState } from 'react';
import { Confirmar } from '../../../comun/Confirmar';
import { ConmutadorDispositivo } from '../../../comun/MarcoDispositivo';
import type { EstadoGuardado } from './useBorrador';

const TEXTO_ESTADO: Record<EstadoGuardado, string> = {
  guardado: 'Guardado',
  pendiente: 'Guardando...',
  guardando: 'Guardando...',
  error: 'No se pudo guardar',
};

interface Props {
  titulo: string;
  celular: boolean;
  onCelular: (celular: boolean) => void;
  cambios: number;
  /** Hay un borrador guardado en el servidor aunque esta sesión aún no haya cambiado nada. */
  hayBorrador: boolean;
  estado: EstadoGuardado;
  puedeDeshacer: boolean;
  onDeshacer: () => void;
  onPublicar: () => Promise<void>;
  onDescartar: () => Promise<void>;
  mensajePublicar: string;
  mensaje?: string | null;
  /** Controles propios de la pantalla (p. ej. decoración). */
  extra?: React.ReactNode;
}

/** Barra superior fija y delgada: dispositivo, cambios sin publicar, Descartar, Publicar y Deshacer. */
export function BarraSuperior(p: Props) {
  const [pedido, setPedido] = useState<null | 'publicar' | 'descartar'>(null);
  const [trabajando, setTrabajando] = useState(false);
  const hay = p.cambios > 0 || p.hayBorrador;

  const ejecutar = async () => {
    if (!pedido) return;
    setTrabajando(true);
    try {
      await (pedido === 'publicar' ? p.onPublicar() : p.onDescartar());
    } finally {
      setTrabajando(false);
      setPedido(null);
    }
  };

  const boton = { minHeight: 44, padding: '0 14px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' } as const;

  return (
    <>
      <div
        role="toolbar"
        aria-label="Barra del editor"
        style={{ position: 'sticky', top: 0, zIndex: 60, background: 'var(--cp-navy)', color: 'var(--cp-cream)', padding: '6px 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px', borderRadius: 12 }}
      >
        <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em' }}>{p.titulo}</span>
        <ConmutadorDispositivo celular={p.celular} onCambiar={p.onCelular} />
        {p.extra}
        <span style={{ flex: 1 }} />
        <span role="status" style={{ fontSize: 12, fontWeight: 700, opacity: 0.9 }}>{p.mensaje || TEXTO_ESTADO[p.estado]}</span>
        <span style={{ fontSize: 12, fontWeight: 800, borderRadius: 9999, padding: '4px 12px', background: hay ? 'var(--cp-gold)' : 'transparent', color: hay ? 'var(--cp-navy)' : 'var(--cp-cream)', border: hay ? 0 : '1.5px solid var(--cp-cream)' }}>
          Cambios sin publicar: {p.cambios > 0 ? p.cambios : p.hayBorrador ? 'borrador guardado' : 0}
        </span>
        <button type="button" style={{ ...boton, border: '1.5px solid var(--cp-cream)', background: 'transparent', color: 'var(--cp-cream)', opacity: p.puedeDeshacer ? 1 : 0.45 }} disabled={!p.puedeDeshacer} onClick={p.onDeshacer}>
          Deshacer
        </button>
        <button type="button" style={{ ...boton, border: '1.5px solid var(--cp-cream)', background: 'transparent', color: 'var(--cp-cream)', opacity: hay ? 1 : 0.45 }} disabled={!hay} onClick={() => setPedido('descartar')}>
          Descartar
        </button>
        <button type="button" style={{ ...boton, border: 0, background: hay ? 'var(--cp-orange)' : 'var(--cp-line)', color: 'var(--cp-navy)', opacity: hay ? 1 : 0.6 }} disabled={!hay} onClick={() => setPedido('publicar')}>
          Publicar
        </button>
      </div>
      <Confirmar
        abierto={pedido === 'publicar'}
        titulo="¿Publicar los cambios en la carta?"
        mensaje={p.mensajePublicar}
        textoConfirmar="Sí, publicar"
        textoNo="No, seguir editando"
        cargando={trabajando}
        alConfirmar={ejecutar}
        alCancelar={() => setPedido(null)}
      />
      <Confirmar
        abierto={pedido === 'descartar'}
        titulo="¿Descartar los cambios sin publicar?"
        mensaje="Volverás a lo último que se publicó y se perderán estas modificaciones."
        textoConfirmar="Sí, descartar"
        textoNo="No, mantener cambios"
        peligro
        cargando={trabajando}
        alConfirmar={ejecutar}
        alCancelar={() => setPedido(null)}
      />
    </>
  );
}
