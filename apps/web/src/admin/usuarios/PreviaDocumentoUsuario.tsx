import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';

export interface ClientePrevia {
  nombre: string;
  puntos: number;
  pedidos: number;
  ultimoPedido: string | null;
  tieneCuenta: boolean;
  cuentaActiva?: boolean;
  yaVinculadoA?: null | 'ESTE_USUARIO' | 'OTRO_USUARIO';
  registradoEn?: string;
  celularEnmascarado?: string;
  mismoNombre?: boolean;
}
export type PreviaDocumento = { pareceCelular: boolean } & (
  | { estado: 'LIBRE' | 'ES_EL_MISMO' }
  | { estado: 'OTRO_USUARIO'; usuario: { nombre: string; rol: string } }
  | { estado: 'CLIENTE' | 'PERSONA_SIN_CUENTA'; cliente: ClientePrevia; puedeVincular: boolean; motivo?: string }
);

const fecha = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' }) : null);
const caja = (color: string) => ({ border: `1px solid ${color}`, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column' as const, gap: 8, fontSize: 13, lineHeight: '18px', color: 'var(--cp-navy)', maxWidth: '100%' });

interface Props {
  usuarioId: string | number;
  tipo: string;
  /** Número ya válido (7-12 / 8 dígitos) o null mientras no lo es. */
  numero: string | null;
  /** «No, es otra persona»: el padre vacía el número. */
  alRechazar: () => void;
  /** Avisa al padre si el documento queda bloqueado (mensaje) o libre (null). Debe ser estable (setState). */
  alCambiarBloqueo: (mensaje: string | null) => void;
}

/** Bajo el campo de documento: quién lo tiene (solo lectura, con espera de 500 ms) y, si es un cliente, vincular su cuenta. */
export function PreviaDocumentoUsuario({ usuarioId, tipo, numero, alRechazar, alCambiarBloqueo }: Props) {
  const [previa, setPrevia] = useState<PreviaDocumento | null>(null);
  const [cargando, setCargando] = useState(false);
  const [paso, setPaso] = useState<0 | 1 | 2>(0);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [vinculada, setVinculada] = useState<{ nombre: string; celular: string } | null>(null);

  useEffect(() => {
    setPrevia(null);
    setVinculada(null);
    setError('');
    if (!numero) {
      setCargando(false);
      return;
    }
    let vivo = true;
    setCargando(true);
    const t = setTimeout(() => {
      Promise.resolve(api.post<PreviaDocumento>(`/admin/usuarios/${usuarioId}/previa-documento`, { tipoDocumento: tipo, documento: numero }))
        .then((r) => vivo && setPrevia(r ?? null))
        .catch(() => vivo && setPrevia(null)) // sin vista previa, el servidor igual valida al guardar
        .finally(() => vivo && setCargando(false));
    }, 500);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [usuarioId, tipo, numero]);

  useEffect(() => {
    let m: string | null = null;
    if (previa?.estado === 'OTRO_USUARIO') m = `Ese documento ya es de ${previa.usuario.nombre} (${previa.usuario.rol}) del equipo. No se puede usar`;
    else if (previa?.estado === 'CLIENTE' || previa?.estado === 'PERSONA_SIN_CUENTA') m = 'Ese documento ya es de un cliente: el documento del usuario no puede cambiar a ese número';
    alCambiarBloqueo(m);
  }, [previa, alCambiarBloqueo]);

  async function vincular(confirmaMismaPersona: boolean) {
    setOcupado(true);
    setError('');
    try {
      const r = await api.post<{ vinculada: { nombre: string; celular: string } }>(`/admin/usuarios/${usuarioId}/cuenta-cliente/vincular-por-documento`, {
        tipoDocumento: tipo, documento: numero, ...(confirmaMismaPersona ? { confirmaMismaPersona: true } : {}),
      });
      setVinculada(r.vinculada);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo vincular la cuenta.');
    } finally {
      setPaso(0);
      setOcupado(false);
    }
  }

  if (!numero) return null;
  const c = previa && 'cliente' in previa ? previa.cliente : null;
  const puede = previa && 'puedeVincular' in previa ? previa.puedeVincular : false;
  const motivo = previa && 'motivo' in previa ? previa.motivo : undefined;
  return (
    <div role="status" aria-live="polite" data-testid="previa-documento" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {cargando && <span style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Revisando el documento…</span>}
      {previa?.pareceCelular && (
        <div style={{ ...caja('var(--cp-rust)'), fontWeight: 700, color: 'var(--cp-rust)' }}>
          Ese número parece un celular, no un documento. ¿Es el documento correcto?
        </div>
      )}
      {previa?.estado === 'LIBRE' && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green)' }}>Documento libre: se puede usar</span>}
      {previa?.estado === 'ES_EL_MISMO' && <span style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Ese ya es el documento de este usuario.</span>}
      {previa?.estado === 'OTRO_USUARIO' && (
        <div style={{ ...caja('var(--cp-rust)'), fontWeight: 700, color: 'var(--cp-rust)' }}>
          Ya es de {previa.usuario.nombre} ({previa.usuario.rol}) del equipo. No se puede usar.
        </div>
      )}
      {c && (
        <div style={caja('var(--cp-navy)')} data-testid="ficha-cliente">
          <strong style={{ fontSize: 15 }}>{c.nombre}</strong>
          {c.registradoEn && <span>Cliente desde {fecha(c.registradoEn)}</span>}
          <span style={{ fontSize: 22, fontWeight: 800 }}>{c.puntos.toLocaleString('en-US')} puntos</span>
          <span>
            {c.pedidos} {c.pedidos === 1 ? 'pedido pagado' : 'pedidos pagados'}
            {c.ultimoPedido ? ` · último ${fecha(c.ultimoPedido)}` : ''}
          </span>
          {c.celularEnmascarado && <span>Celular {c.celularEnmascarado}</span>}
          <span>{!c.tieneCuenta ? 'Sin cuenta de cliente' : c.cuentaActiva ? 'Cuenta activa' : 'Cuenta desactivada'}</span>
          {vinculada ? (
            <span style={{ fontWeight: 700, color: 'var(--cp-green)' }}>
              Vinculada a {vinculada.nombre} ({vinculada.celular}) — recibe el descuento de personal. El documento del usuario no cambia.
            </span>
          ) : (
            <>
              <span style={{ fontWeight: 700 }}>Ese documento ya es de este cliente. El documento del usuario no cambia. ¿Es la misma persona?</span>
              {!puede && motivo && <span>{motivo}</span>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {puede && (
                  <Boton type="button" onClick={() => setPaso(1)} deshabilitado={ocupado}>
                    Sí, vincular su cuenta de cliente
                  </Boton>
                )}
                <Boton type="button" variante="secundario" onClick={alRechazar} deshabilitado={ocupado}>
                  No, es otra persona
                </Boton>
              </div>
            </>
          )}
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: 13, color: 'var(--cp-rust)', fontWeight: 600 }}>{error}</div>}
      <Confirmar
        abierto={paso === 1}
        titulo="Vincular cuenta de cliente"
        mensaje={`¿Vincular la cuenta de cliente de ${c?.nombre ?? ''} a este usuario? Recibirá el descuento de personal. No se fusionan personas ni se mueven puntos.`}
        textoSi="Sí, vincular"
        textoNo="No"
        cargando={ocupado}
        alConfirmar={() => (c && c.mismoNombre === false ? setPaso(2) : vincular(false))}
        alCancelar={() => setPaso(0)}
      />
      <Confirmar
        abierto={paso === 2}
        titulo="¿Es la misma persona?"
        mensaje="El nombre de la cuenta de cliente no coincide con el de este usuario. ¿Confirmas que es la misma persona?"
        textoSi="Sí, es la misma persona"
        textoNo="No"
        cargando={ocupado}
        alConfirmar={() => vincular(true)}
        alCancelar={() => setPaso(0)}
      />
    </div>
  );
}
