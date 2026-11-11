import { useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { ModalConPestanas } from '../../comun/ModalConPestanas';
import { useSesion } from '../../comun/sesion';
import { almacenApi, FilaRecuentoInsumo, PendienteGrupo, ResultadoEmision } from './almacenApi';

const num = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');

/** Texto rojo «Debe a almacén: 10 kg» para un stock de Cocina en negativo; vacío si no es negativo. */
export const textoDeuda = (stock: number, unidad: string) => (stock < 0 ? `Debe a almacén: ${num(-stock)} ${unidad}` : '');

type Pedido = { titulo: string; mensaje: string; ids?: string[]; insumoId?: string };

/**
 * «Pendientes de almacén»: lo que Cocina gastó sin tener en su stock (le debe a Almacén). Se emite como traslado real
 * Almacén → Cocina. Solo aparece con el Control de almacén encendido; Cocina no ve los botones de emitir ni de contar.
 */
export function PendientesAlmacen() {
  const { tiene, usuario } = useSesion();
  const puedeEmitir = usuario?.rol === 'ADMIN' || tiene('ADMIN') || tiene('almacen/emitir');
  const puedeContar = usuario?.rol === 'ADMIN' || tiene('ADMIN') || tiene('almacen/ajustar');
  const [activo, setActivo] = useState(false);
  const [grupos, setGrupos] = useState<PendienteGrupo[]>([]);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<ResultadoEmision | null>(null);
  const [recuentoAbierto, setRecuentoAbierto] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await almacenApi.listarPendientes();
      setActivo(r.activo);
      setGrupos(r.grupos);
    } catch {
      setActivo(false);
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!activo) return null; // Control de almacén apagado: no se ve nada nuevo

  const emitir = async () => {
    if (!pedido) return;
    setEnviando(true);
    setError('');
    try {
      const r = await almacenApi.emitirPendientes({ ids: pedido.ids, insumoId: pedido.insumoId });
      setResultado(r);
      setPedido(null);
      await cargar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo emitir. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section
      aria-label="Pendientes de almacén"
      style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Pendientes de almacén{grupos.length ? ` (${grupos.length})` : ''}</h3>
        {puedeContar && (
          <Boton variante="secundario" onClick={() => setRecuentoAbierto(true)} style={{ minHeight: 44 }}>
            Recuento de insumos
          </Boton>
        )}
      </div>
      <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
        Lo que Cocina usó y todavía no sacó de Almacén. Al emitir se hace el traslado y Cocina queda al día.
      </div>

      {resultado && (
        <div role="status" style={{ fontSize: 13, color: 'var(--cp-navy)', background: 'var(--cp-cream)', borderRadius: 10, padding: 10 }}>
          {resultado.resultados.map((r) => (
            <div key={r.insumoId}>
              {r.nombre}: se emitió {num(r.emitido)} {r.unidad}.
              {r.parcial ? ` Almacén no alcanzó: faltan ${num(r.faltaAlmacen)} ${r.unidad} por emitir.` : ''}
            </div>
          ))}
        </div>
      )}

      {grupos.length === 0 && <div style={{ fontSize: 14 }}>No hay pendientes. Cocina está al día.</div>}

      {grupos.map((g) => (
        <div key={g.insumoId} style={{ border: '1px solid var(--cp-line)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <strong>{g.nombre}</strong>
              <div style={{ color: '#B42318', fontWeight: 700, fontSize: 13 }}>
                {textoDeuda(g.stockCocina, g.unidad) || `Pendiente: ${num(g.saldoPendiente)} ${g.unidad}`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
                Cocina {num(g.stockCocina)} {g.unidad} · Almacén {num(g.stockAlmacen)} {g.unidad}
              </div>
            </div>
            {puedeEmitir && (
              <Boton
                onClick={() =>
                  setPedido({
                    titulo: `¿Emitir todo lo pendiente de ${g.nombre}?`,
                    mensaje: `Se pasan ${num(g.saldoPendiente)} ${g.unidad} de Almacén a Cocina.${g.stockAlmacen < g.saldoPendiente ? ' Almacén no alcanza: se emite lo que haya.' : ''}`,
                    insumoId: g.insumoId,
                  })
                }
                style={{ minHeight: 44 }}
              >
                Emitir todo
              </Boton>
            )}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {g.pendientes.map((p) => (
              <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>
                  {p.origen} · {num(p.saldo)} {g.unidad} · {new Date(p.creadoEn).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                {puedeEmitir && p.estado === 'PENDIENTE' && (
                  <Boton
                    variante="secundario"
                    onClick={() => setPedido({ titulo: '¿Emitir este pendiente?', mensaje: `${g.nombre}: ${num(p.saldo)} ${g.unidad} (${p.origen}).`, ids: [p.id] })}
                    style={{ minHeight: 44 }}
                  >
                    Emitir
                  </Boton>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <Confirmar
        abierto={!!pedido}
        titulo={pedido?.titulo}
        mensaje={pedido?.mensaje}
        textoSi="Sí, emitir"
        textoNo="No"
        cargando={enviando}
        error={error || null}
        alConfirmar={emitir}
        alCancelar={() => {
          setPedido(null);
          setError('');
        }}
      />

      {recuentoAbierto && (
        <ModalRecuentoInsumos
          alCerrar={() => setRecuentoAbierto(false)}
          alGuardar={async () => {
            setRecuentoAbierto(false);
            await cargar();
          }}
        />
      )}
    </section>
  );
}

function TablaRecuento({ lugar, valores, alCambiar }: { lugar: 'COCINA' | 'ALMACEN'; valores: Record<string, string>; alCambiar: (clave: string, v: string) => void }) {
  const [filas, setFilas] = useState<FilaRecuentoInsumo[] | null>(null);
  const [falla, setFalla] = useState(false);
  useEffect(() => {
    almacenApi.listarInsumosRecuento(lugar).then(setFilas).catch(() => setFalla(true));
  }, [lugar]);
  if (falla) return <div role="alert">No se pudo cargar la lista. Cierra e intenta de nuevo.</div>;
  if (!filas) return <div>Cargando…</div>;
  return (
    <div style={{ maxHeight: '50dvh', overflow: 'auto' }}>
      {filas.map((f) => {
        const v = valores[`${lugar}:${f.insumoId}`] ?? '';
        const contado = v === '' ? null : Number(v.replace(',', '.'));
        const dif = contado === null || Number.isNaN(contado) ? null : Math.round((contado - f.sistema) * 1000) / 1000;
        return (
          <div key={f.insumoId} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, padding: '8px 0', borderBottom: '1px solid var(--cp-line)' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{f.nombre}</div>
              <div style={{ fontSize: 12, color: f.sistema < 0 ? '#B42318' : 'var(--cp-soft)' }}>
                {f.sistema < 0 ? textoDeuda(f.sistema, f.unidad) : `Sistema: ${num(f.sistema)} ${f.unidad}`}
                {f.pendiente > 0 ? ` · Pendiente de emitir: ${num(f.pendiente)}` : ''}
              </div>
              {dif !== null && dif !== 0 && (
                <div style={{ fontSize: 12, fontWeight: 700, color: dif < 0 ? '#B42318' : '#1A7F37' }}>
                  Diferencia: {dif > 0 ? '+' : ''}
                  {num(dif)} {f.unidad}
                </div>
              )}
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
              Contado
              <input
                inputMode="decimal"
                value={v}
                onChange={(e) => alCambiar(`${lugar}:${f.insumoId}`, e.target.value)}
                aria-label={`Contado de ${f.nombre}`}
                style={{ minHeight: 44, width: 96, borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
              />
            </label>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Recuento nocturno de insumos: pestañas Cocina y Almacén; solo se ajusta lo que se escribió. La confirmación Sí/No va
 * en el pie del MISMO modal (un modal nunca encima de otro).
 */
function ModalRecuentoInsumos({ alCerrar, alGuardar }: { alCerrar: () => void; alGuardar: () => void | Promise<void> }) {
  const [pestana, setPestana] = useState<'COCINA' | 'ALMACEN'>('COCINA');
  const [valores, setValores] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const cambiar = (k: string, v: string) => setValores((x) => ({ ...x, [k]: v }));
  const cuantas = (l: string) => Object.entries(valores).filter(([k, v]) => k.startsWith(`${l}:`) && v !== '').length;

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      for (const lugar of ['COCINA', 'ALMACEN'] as const) {
        const filas = Object.entries(valores)
          .filter(([k, v]) => k.startsWith(`${lugar}:`) && v !== '' && !Number.isNaN(Number(v.replace(',', '.'))))
          .map(([k, v]) => ({ insumoId: k.split(':')[1], contado: Number(v.replace(',', '.')) }));
        if (filas.length) await almacenApi.aplicarRecuentoInsumos({ lugar, filas, motivo: motivo.trim() || undefined });
      }
      await alGuardar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el recuento.');
      setConfirmando(false);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalConPestanas
      titulo="Recuento de insumos"
      subtitulo="Cuenta lo que hay y escribe la cantidad. Solo se ajusta lo que escribas."
      pestanas={[
        { id: 'COCINA', etiqueta: 'Cocina', insignia: cuantas('COCINA') || null, contenido: <TablaRecuento lugar="COCINA" valores={valores} alCambiar={cambiar} /> },
        { id: 'ALMACEN', etiqueta: 'Almacén', insignia: cuantas('ALMACEN') || null, contenido: <TablaRecuento lugar="ALMACEN" valores={valores} alCambiar={cambiar} /> },
      ]}
      pestanaActiva={pestana}
      alCambiarPestana={(id) => setPestana(id as 'COCINA' | 'ALMACEN')}
      alCerrar={alCerrar}
      bloquearCierre={guardando}
      bajoPestanas={
        <div style={{ padding: '6px 16px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
            Motivo (opcional)
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: '0 8px' }} />
          </label>
          {error && <div role="alert" style={{ color: '#B42318', fontSize: 13 }}>{error}</div>}
        </div>
      }
      pie={
        confirmando ? (
          <>
            <span style={{ flex: 1, fontSize: 13 }}>¿Ajustar el stock a lo contado? Los pendientes que esto resuelva pasan a Ajustado.</span>
            <Boton variante="secundario" onClick={() => setConfirmando(false)} disabled={guardando}>No</Boton>
            <Boton cargando={guardando} onClick={guardar}>Sí, ajustar</Boton>
          </>
        ) : (
          <>
            <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
            <Boton onClick={() => setConfirmando(true)} disabled={cuantas('COCINA') + cuantas('ALMACEN') === 0}>
              Guardar recuento
            </Boton>
          </>
        )
      }
    />
  );
}
