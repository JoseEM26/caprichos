import { useEffect, useMemo, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { catalogoApi, ProductoAdmin } from '../catalogo/catalogoApi';
import type { Pedido } from '../pedidos/pedidosApi';
import { SelectorProductoCortesia, productoAgotado } from './SelectorProductoCortesia';
import { SelectorPedidoCortesia } from './SelectorPedidoCortesia';
import { MOTIVOS_CORTESIA, cortesiasApi, errorDatosCortesia } from './cortesiasApi';
import '../cierre/pendientes-cierre.css';
import './cortesia-pasos.css';

export interface RegistrarCortesiaModalProps {
  alCerrar: () => void;
  alRegistrar: (codigo: string) => void;
}

const PASOS = ['¿Qué regalas?', '¿Por qué?', '¿A qué pedido corresponde?'];

/** Paso del formulario al que pertenece un error del servidor. */
export function pasoDeError(codigo?: string): number | null {
  if (!codigo) return null;
  if (/NOTA|MOTIVO/.test(codigo)) return 1;
  if (/PEDIDO/.test(codigo)) return 2;
  if (/PRODUCTO|TAMANO|SABOR|STOCK|AGOTADO|CANTIDAD/.test(codigo)) return 0;
  return null;
}

/**
 * Cortesía por separado, en pasos: qué regalas, por qué y a qué pedido corresponde (puede ser de un día anterior).
 * Descuenta stock como una venta (lo hace el servidor). Lo ven quienes tienen el permiso de cortesías (queda auditada).
 */
export function RegistrarCortesiaModal({ alCerrar, alRegistrar }: RegistrarCortesiaModalProps) {

  const [paso, setPaso] = useState(0);
  const [productos, setProductos] = useState<ProductoAdmin[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [productoId, setProductoId] = useState('');
  const [tamanoId, setTamanoId] = useState('');
  const [saborId, setSaborId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [pedidoRef, setPedidoRef] = useState<Pedido | null>(null);
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
  const tamano = producto?.tamanos.find((t) => t.id === tamanoId);
  const sabor = (producto?.sabores ?? []).find((s) => s.id === saborId);
  const motivoEtiqueta = MOTIVOS_CORTESIA.find((m) => m.codigo === motivo)?.etiqueta ?? '';

  /** Mensaje de lo que falta en un paso, o null si está completo. */
  const faltaEnPaso = (n: number): string | null => {
    if (n === 0) {
      if (!producto) return 'Elige el producto.';
      if (producto.tamanos.length > 0 && !tamanoId) return 'Elige el tamaño del producto.';
      if (porSabor && !saborId) return 'Elige el sabor que se regala.';
      const c = Math.floor(Number(cantidad));
      if (!Number.isFinite(c) || c < 1) return 'La cantidad mínima es 1.';
    }
    if (n === 1) return errorDatosCortesia(motivo, nota);
    if (n === 2 && !pedidoRef) return 'Busca y elige el pedido al que corresponde la cortesía.';
    return null;
  };

  const siguiente = () => {
    const e = faltaEnPaso(paso);
    setError(e);
    if (!e) setPaso(paso + 1);
  };

  const confirmar = async () => {
    for (let n = 0; n < 3; n++) {
      const e = faltaEnPaso(n);
      if (e) {
        setPaso(n);
        return setError(e);
      }
    }
    if (!producto || !pedidoRef) return;

    setEnviando(true);
    setError(null);
    try {
      await cortesiasApi.registrarSeparada({
        productoId: producto.id,
        ...(tamanoId ? { tamanoId } : {}),
        ...(porSabor ? { saborId } : {}),
        cantidad: Math.floor(Number(cantidad)),
        motivo,
        ...(nota.trim() ? { nota: nota.trim() } : {}),
        pedidoReferenciaId: pedidoRef.id,
      });
      alRegistrar(pedidoRef.codigo);
    } catch (err: any) {
      const p = pasoDeError(err?.codigo);
      if (p !== null) setPaso(p);
      setError(err?.mensaje || 'No se pudo registrar la cortesía.');
    } finally {
      setEnviando(false);
    }
  };

  const ultimo = paso === 2;
  return (
    <>
      <div onClick={enviando ? undefined : alCerrar} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(11, 44, 62, 0.55)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registrar cortesía"
        className="ad-dialogo"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !enviando) alCerrar();
        }}
      >
        <div className="ad-cabecera">
          <div className="ad-titulo">Registrar cortesía</div>
          <button type="button" className="ad-cerrar" onClick={alCerrar} aria-label="Cerrar" disabled={enviando}>
            X
          </button>
        </div>
        <ol className="cpx-pasos" aria-label="Progreso">
          {PASOS.map((t, i) => (
            <li key={t} className={i === paso ? 'cpx-paso cpx-paso-actual' : i < paso ? 'cpx-paso cpx-paso-hecho' : 'cpx-paso'} aria-current={i === paso ? 'step' : undefined}>
              <span>{i + 1}</span>
              {i === paso ? t : ''}
            </li>
          ))}
        </ol>
        <div className="ad-cuerpo cpx-cuerpo">
          {paso === 0 && (
            <>
              <h3 className="cpx-h">{PASOS[0]}</h3>
              {!producto ? (
                <SelectorProductoCortesia
                  productos={productos}
                  cargando={cargandoProductos}
                  alElegir={(p) => {
                    if (productoAgotado(p)) return;
                    setProductoId(p.id);
                    setTamanoId('');
                    setSaborId('');
                    setError(null);
                  }}
                />
              ) : (
                <div className="cpx-elegido">
                  <span>
                    <b>{producto.nombre}</b> · {producto.categoria?.nombre}
                  </span>
                  <button type="button" className="cpx-link" onClick={() => setProductoId('')}>
                    Cambiar
                  </button>
                </div>
              )}
              {producto && producto.tamanos.length > 0 && (
                <label className="cpx-campo">
                  <span>Tamaño</span>
                  <select aria-label="Tamaño" value={tamanoId} onChange={(e) => setTamanoId(e.target.value)} className="cpx-input">
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
                <div className="cpx-campo" role="group" aria-label="Sabor">
                  <span>Sabor</span>
                  <div className="cpx-chips">
                    {(producto?.sabores ?? [])
                      .filter((s) => s.id && s.activo !== false)
                      .map((s) => {
                        const agotado = s.disponible === false || s.quedan === 0;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className="cpx-chip"
                            aria-pressed={saborId === s.id}
                            disabled={agotado}
                            onClick={() => setSaborId(s.id as string)}
                          >
                            {s.nombre}
                            {agotado ? ' · Agotado' : typeof s.quedan === 'number' ? ` · Quedan ${s.quedan}` : ''}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
              {producto && (
                <label className="cpx-campo">
                  <span>Cantidad</span>
                  <input aria-label="Cantidad" type="number" inputMode="numeric" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="cpx-input" style={{ width: 110 }} />
                </label>
              )}
            </>
          )}

          {paso === 1 && (
            <>
              <h3 className="cpx-h">{PASOS[1]}</h3>
              <fieldset className="cpx-motivos">
                <legend>Motivo (obligatorio)</legend>
                {MOTIVOS_CORTESIA.map((m) => (
                  <label key={m.codigo}>
                    <input type="radio" name="motivo-separada" checked={motivo === m.codigo} onChange={() => setMotivo(m.codigo)} />
                    {m.etiqueta}
                  </label>
                ))}
              </fieldset>
              <label className="cpx-campo">
                <span>{motivo === 'OTRO' ? 'Nota (obligatoria)' : 'Nota (opcional)'}</span>
                <textarea aria-label="Nota" value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={300} className="cpx-input" style={{ padding: 8 }} />
              </label>
            </>
          )}

          {paso === 2 && (
            <>
              <h3 className="cpx-h">{PASOS[2]}</h3>
              <SelectorPedidoCortesia seleccionado={pedidoRef} alElegir={setPedidoRef} alError={setError} />
            </>
          )}

          {ultimo && pedidoRef && (
            <>
              <h4 className="cpx-h" style={{ fontSize: 14 }}>Resumen</h4>
              <dl className="cpx-resumen" aria-label="Resumen de la cortesía">
                <dt>Regalas</dt>
                <dd>
                  {Math.floor(Number(cantidad))} × {producto?.nombre}
                  {tamano ? ` (${tamano.nombre})` : ''}
                  {sabor ? ` · ${sabor.nombre}` : ''}
                </dd>
                <dt>Motivo</dt>
                <dd>
                  {motivoEtiqueta}
                  {nota.trim() ? ` — ${nota.trim()}` : ''}
                </dd>
                <dt>Pedido</dt>
                <dd>{pedidoRef.codigo}</dd>
              </dl>
            </>
          )}

          {error && (
            <div role="alert" className="cpx-error">
              {error}
            </div>
          )}
        </div>
        <div className="ad-pie" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {paso === 0 ? (
            <Boton variante="secundario" disabled={enviando} onClick={alCerrar}>
              Cancelar
            </Boton>
          ) : (
            <Boton
              variante="secundario"
              disabled={enviando}
              onClick={() => {
                setError(null);
                setPaso(paso - 1);
              }}
            >
              Atrás
            </Boton>
          )}
          {ultimo ? (
            <Boton variante="primario" cargando={enviando} disabled={enviando} onClick={confirmar}>
              Registrar cortesía
            </Boton>
          ) : (
            <Boton variante="primario" onClick={siguiente}>
              Siguiente
            </Boton>
          )}
        </div>
      </div>
    </>
  );
}
