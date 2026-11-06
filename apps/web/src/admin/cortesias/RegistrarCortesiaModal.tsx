import { useEffect, useMemo, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { CampoCodigoSupervisor } from '../../comun/CampoCodigoSupervisor';
import { useSesion } from '../../comun/sesion';
import { catalogoApi, ProductoAdmin } from '../catalogo/catalogoApi';
import { pedidosApi, Pedido } from '../pedidos/pedidosApi';
import { MOTIVOS_CORTESIA, cortesiasApi, errorDatosCortesia } from './cortesiasApi';
import '../cierre/pendientes-cierre.css';

export interface RegistrarCortesiaModalProps {
  alCerrar: () => void;
  alRegistrar: (codigo: string) => void;
}

/**
 * Cortesía por separado: sin pedido propio. El pedido de referencia es obligatorio (puede ser de un día anterior).
 * Descuenta stock como una venta (lo hace el servidor). Lo ven Caja y ADMIN; el SUPERVISOR presenta su código.
 */
export function RegistrarCortesiaModal({ alCerrar, alRegistrar }: RegistrarCortesiaModalProps) {
  const { usuario } = useSesion();
  const pideCodigo = usuario?.rol === 'SUPERVISOR';

  const [productos, setProductos] = useState<ProductoAdmin[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [productoId, setProductoId] = useState('');
  const [tamanoId, setTamanoId] = useState('');
  const [saborId, setSaborId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [busquedaPedido, setBusquedaPedido] = useState('');
  const [resultadosPedido, setResultadosPedido] = useState<Pedido[]>([]);
  const [pedidoRef, setPedidoRef] = useState<Pedido | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let montado = true;
    catalogoApi
      .listarProductos({ incluyeOcultos: false })
      .then((lista) => {
        if (montado) setProductos(lista);
      })
      .catch(() => {
        if (montado) setError('No se pudo cargar la carta. Cierra y vuelve a intentar.');
      })
      .finally(() => {
        if (montado) setCargandoProductos(false);
      });
    return () => {
      montado = false;
    };
  }, []);

  const producto = useMemo(() => productos.find((p) => p.id === productoId) ?? null, [productos, productoId]);
  const porSabor = !!producto && producto.controlaStock && (producto.sabores ?? []).length > 0;

  const buscarPedido = async () => {
    const q = busquedaPedido.trim().toUpperCase();
    if (q.length < 3) {
      setError('Escribe al menos 3 caracteres del código del pedido (ej. CP-W012).');
      return;
    }
    setBuscando(true);
    setError(null);
    try {
      const r = await pedidosApi.listar({ buscar: q, limite: 5 });
      setResultadosPedido(r.items ?? []);
      if ((r.items ?? []).length === 0) setError('No encontramos ese pedido.');
    } catch (err: any) {
      setError(err?.mensaje || 'No se pudo buscar el pedido.');
    } finally {
      setBuscando(false);
    }
  };

  const confirmar = async () => {
    if (!producto) return setError('Elige el producto.');
    if (producto.tamanos.length > 0 && !tamanoId) return setError('Elige el tamaño del producto.');
    if (porSabor && !saborId) return setError('Elige el sabor que se regala.');
    const n = Math.floor(Number(cantidad));
    if (!Number.isFinite(n) || n < 1) return setError('La cantidad mínima es 1.');
    const eMotivo = errorDatosCortesia(motivo, nota);
    if (eMotivo) return setError(eMotivo);
    if (!pedidoRef) return setError('Busca y elige el pedido al que corresponde la cortesía.');
    if (pideCodigo && !/^\d{6}$/.test(codigo)) return setError('Escribe el código de 6 dígitos del supervisor.');

    setEnviando(true);
    setError(null);
    try {
      await cortesiasApi.registrarSeparada(
        {
          productoId: producto.id,
          ...(tamanoId ? { tamanoId } : {}),
          ...(porSabor ? { saborId } : {}),
          cantidad: n,
          motivo,
          ...(nota.trim() ? { nota: nota.trim() } : {}),
          pedidoReferenciaId: pedidoRef.id,
        },
        pideCodigo ? codigo : undefined,
      );
      alRegistrar(pedidoRef.codigo);
    } catch (err: any) {
      if (err?.codigo === 'CODIGO_INVALIDO') setCodigo('');
      setError(err?.mensaje || 'No se pudo registrar la cortesía.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div onClick={enviando ? undefined : alCerrar} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(11, 44, 62, 0.55)' }} />
      <div role="dialog" aria-modal="true" aria-label="Registrar cortesía" className="ad-dialogo">
        <div className="ad-cabecera">
          <div className="ad-titulo">Registrar cortesía</div>
          <button type="button" className="ad-cerrar" onClick={alCerrar} aria-label="Cerrar" disabled={enviando}>
            X
          </button>
        </div>
        <div className="ad-cuerpo">
          <p className="ad-aviso" role="note" style={{ margin: 0 }}>
            Para regalar algo que no va en un pedido nuevo. Indica el pedido al que corresponde.
          </p>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 800 }}>Producto</span>
            <select
              aria-label="Producto"
              value={productoId}
              disabled={cargandoProductos}
              onChange={(e) => {
                setProductoId(e.target.value);
                setTamanoId('');
                setSaborId('');
              }}
              style={{ minHeight: 44, borderRadius: 10, padding: '0 10px', fontSize: 15 }}
            >
              <option value="">{cargandoProductos ? 'Cargando carta…' : 'Elige un producto'}</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          {producto && producto.tamanos.length > 0 && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Tamaño</span>
              <select aria-label="Tamaño" value={tamanoId} onChange={(e) => setTamanoId(e.target.value)} style={{ minHeight: 44, borderRadius: 10, padding: '0 10px' }}>
                <option value="">Elige el tamaño</option>
                {producto.tamanos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}

          {porSabor && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 800 }}>Sabor</span>
              <select aria-label="Sabor" value={saborId} onChange={(e) => setSaborId(e.target.value)} style={{ minHeight: 44, borderRadius: 10, padding: '0 10px' }}>
                <option value="">Elige el sabor</option>
                {(producto?.sabores ?? []).filter((s) => s.id && s.activo !== false).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 800 }}>Cantidad</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              style={{ minHeight: 44, borderRadius: 10, padding: '0 10px', fontSize: 15, width: 120 }}
            />
          </label>

          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <legend style={{ fontWeight: 800, marginBottom: 6 }}>Motivo (obligatorio)</legend>
            {MOTIVOS_CORTESIA.map((m) => (
              <label key={m.codigo} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 40 }}>
                <input type="radio" name="motivo-separada" checked={motivo === m.codigo} onChange={() => setMotivo(m.codigo)} />
                {m.etiqueta}
              </label>
            ))}
          </fieldset>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 800 }}>{motivo === 'OTRO' ? 'Nota (obligatoria)' : 'Nota (opcional)'}</span>
            <textarea aria-label="Nota" value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={300} style={{ borderRadius: 10, padding: 8 }} />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 800 }}>Pedido de referencia (obligatorio)</span>
            {pedidoRef ? (
              <div style={{ fontWeight: 700 }}>
                Corresponde al pedido {pedidoRef.codigo}{' '}
                <button type="button" onClick={() => setPedidoRef(null)} style={{ marginLeft: 8, fontWeight: 700, background: 'none', border: 0, textDecoration: 'underline', cursor: 'pointer' }}>
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    aria-label="Código del pedido"
                    placeholder="Ej. CP-W012"
                    value={busquedaPedido}
                    onChange={(e) => setBusquedaPedido(e.target.value)}
                    style={{ flex: 1, minHeight: 44, borderRadius: 10, padding: '0 10px', fontSize: 15, textTransform: 'uppercase' }}
                  />
                  <Boton variante="secundario" cargando={buscando} onClick={buscarPedido}>
                    Buscar
                  </Boton>
                </div>
                {resultadosPedido.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPedidoRef(p)}
                    style={{ textAlign: 'left', minHeight: 44, borderRadius: 10, padding: '6px 10px', border: '1.5px solid var(--cp-navy, #0B2C3E)', background: '#fff', cursor: 'pointer' }}
                  >
                    {p.codigo} · {p.cliente_nombre ?? 'Sin nombre'} · {new Date(p.creado_en).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}
                  </button>
                ))}
              </>
            )}
          </div>

          {pideCodigo && (
            <CampoCodigoSupervisor id="cortesia-separada-codigo" valor={codigo} onChange={(v) => setCodigo(v)} etiqueta="Código del supervisor (6 dígitos)" ayuda="Lo ve el supervisor en su pantalla y cambia cada 30 segundos" />
          )}

          {error && (
            <div role="alert" style={{ color: 'var(--cp-rust, #B2500F)', fontWeight: 700 }}>
              {error}
            </div>
          )}
        </div>
        <div className="ad-pie" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Boton variante="secundario" disabled={enviando} onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" cargando={enviando} disabled={enviando} onClick={confirmar}>
            Registrar cortesía
          </Boton>
        </div>
      </div>
    </>
  );
}
