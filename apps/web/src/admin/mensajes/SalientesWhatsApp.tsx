import { useCallback, useEffect, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import {
  ETIQUETA_CLASIFICACION,
  EstadoSaliente,
  ResumenSalientes,
  SalienteAdmin,
  formatearLag,
  salientesApi,
} from './salientesApi';

const FILTROS: Array<{ id: EstadoSaliente; label: string }> = [
  { id: 'FALLIDO', label: 'Fallidos' },
  { id: 'PENDIENTE', label: 'En cola' },
  { id: 'ENVIADO', label: 'Enviados' },
  { id: 'DESCARTADO', label: 'Descartados' },
];

type Accion = { tipo: 'reenviar' | 'descartar'; fila: SalienteAdmin } | null;

/**
 * Pestaña Salientes de Mensajes: cola de WhatsApp que sale sola, con los fallidos (cola de muertos)
 * para reenviar o descartar con confirmación. Sin emojis; nada se borra desde aquí.
 */
export function SalientesWhatsApp() {
  const [resumen, setResumen] = useState<ResumenSalientes | null>(null);
  const [estado, setEstado] = useState<EstadoSaliente>('FALLIDO');
  const [filas, setFilas] = useState<SalienteAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [accion, setAccion] = useState<Accion>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [r, l] = await Promise.all([salientesApi.resumen(), salientesApi.listar(estado)]);
      setResumen(r);
      setFilas(l.filas);
    } catch {
      setError('No se pudo cargar la cola de WhatsApp.');
    } finally {
      setCargando(false);
    }
  }, [estado]);

  useEffect(() => {
    void cargar();
    const cada = setInterval(() => void cargar(), 20000);
    return () => clearInterval(cada);
  }, [cargar]);

  const ejecutar = async () => {
    if (!accion) return;
    if (accion.tipo === 'descartar' && motivo.trim().length < 3) return;
    setEnviando(true);
    try {
      if (accion.tipo === 'reenviar') await salientesApi.reenviar(accion.fila.id);
      else await salientesApi.descartar(accion.fila.id, motivo.trim());
      setAccion(null);
      setMotivo('');
      setError(null);
      await cargar();
    } catch (err: any) {
      setError(err?.message || 'No se pudo completar la acción.');
    } finally {
      setEnviando(false);
    }
  };

  const cerrarAccion = () => {
    setAccion(null);
    setMotivo('');
  };

  return (
    <section aria-label="Mensajes salientes de WhatsApp" style={{ padding: 12, overflow: 'auto' }}>
      {resumen?.lagAlerta && (
        <div
          role="alert"
          data-testid="franja-lag-salientes"
          style={{
            padding: '10px 14px',
            marginBottom: 10,
            borderRadius: 10,
            background: '#FBE9DF',
            borderLeft: '5px solid var(--cp-rust, #B2500F)',
            color: 'var(--cp-navy, #0B2C3E)',
            fontSize: 13,
          }}
        >
          <strong>Los mensajes salen con retraso: el más viejo lleva {formatearLag(resumen.lagSegundos)} en cola.</strong>{' '}
          Revisa que la API y la conexión con WhatsApp estén bien.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }} aria-label="Indicadores">
        {[
          { k: 'Pendientes', v: resumen?.pendientes ?? '-' },
          { k: 'Enviando', v: resumen?.enviando ?? '-' },
          { k: 'Fallidos', v: resumen?.fallidos ?? '-' },
          { k: 'Retraso', v: resumen ? formatearLag(resumen.lagSegundos) : '-' },
        ].map((t) => (
          <div
            key={t.k}
            style={{ flex: '1 1 120px', padding: '8px 12px', borderRadius: 10, background: '#F0F2F5', fontSize: 12 }}
          >
            <div style={{ color: '#54656F' }}>{t.k}</div>
            <b data-testid={`indicador-${t.k.toLowerCase()}`} style={{ fontSize: 18 }}>{t.v}</b>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setEstado(f.id)}
            aria-pressed={estado === f.id}
            style={{
              minHeight: 36,
              padding: '0 12px',
              borderRadius: 10,
              border: 'none',
              background: estado === f.id ? '#D9FDD3' : '#F0F2F5',
              color: estado === f.id ? '#005C4B' : '#54656F',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div role="alert" style={{ color: 'var(--cp-rust, #B2500F)', marginBottom: 8 }}>{error}</div>}

      {cargando ? (
        <div>Cargando...</div>
      ) : filas.length === 0 ? (
        <div>No hay mensajes en esta lista.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filas.map((f) => (
            <article
              key={f.id}
              data-testid="saliente-tarjeta"
              style={{ padding: 12, borderRadius: 12, background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <b>{f.telefono}</b>
                <span style={{ fontSize: 12, color: '#54656F' }}>
                  {new Date(f.actualizadoEn).toLocaleString('es-PE')}
                </span>
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Origen: {f.origen}
                {f.pedidoCodigo ? ` · Pedido ${f.pedidoCodigo}` : ''} · Intentos {f.intentos}/{f.maxIntentos}
              </div>
              {f.texto && <div style={{ fontSize: 13, marginTop: 4, color: '#54656F' }}>{f.texto.slice(0, 160)}</div>}
              {f.estado === 'FALLIDO' && (
                <div style={{ fontSize: 13, marginTop: 6, color: 'var(--cp-rust, #B2500F)' }}>
                  {f.clasificacion ? `${ETIQUETA_CLASIFICACION[f.clasificacion]}. ` : ''}
                  {f.ultimoError ?? 'Sin detalle'}
                </div>
              )}
              {f.estado === 'DESCARTADO' && (
                <div style={{ fontSize: 13, marginTop: 6 }}>Descartado: {f.motivoDescarte}</div>
              )}
              {f.estado === 'FALLIDO' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setAccion({ tipo: 'reenviar', fila: f })}
                    style={{ minHeight: 40, padding: '0 14px', borderRadius: 10, border: 'none', background: 'var(--cp-navy, #0B2C3E)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Reenviar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccion({ tipo: 'descartar', fila: f })}
                    style={{ minHeight: 40, padding: '0 14px', borderRadius: 10, border: '1px solid #B2500F', background: '#fff', color: '#B2500F', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Descartar
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Confirmar
        abierto={accion?.tipo === 'reenviar'}
        titulo="¿Reenviar este mensaje?"
        mensaje="Vuelve a la cola con los intentos en cero y se envía en el próximo lote."
        textoSi="Sí, reenviar"
        cargando={enviando}
        alConfirmar={ejecutar}
        alCancelar={cerrarAccion}
      />
      <Confirmar
        abierto={accion?.tipo === 'descartar'}
        titulo="¿Descartar este mensaje?"
        mensaje="No se enviará y queda registrado quién lo descartó. No se borra."
        textoSi="Sí, descartar"
        peligro
        cargando={enviando}
        alConfirmar={ejecutar}
        alCancelar={cerrarAccion}
      >
        <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
          Motivo (obligatorio)
          <textarea
            aria-label="Motivo del descarte"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #D1D5DB' }}
          />
        </label>
      </Confirmar>
    </section>
  );
}
