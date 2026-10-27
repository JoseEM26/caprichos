import { useState, useEffect } from 'react';
import { api } from '../../comun/api';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { PAL_DEFAULT } from './paletas-constantes';

const NOMBRES_TEMAS: Record<string, string> = {
  ninguno: 'Normal (sin decoración)',
  halloween: 'Halloween',
  navidad: 'Navidad',
  anonuevo: 'Año Nuevo',
  sanvalentin: 'San Valentín',
  madre: 'Día de la Madre',
  padre: 'Día del Padre',
  patrias: 'Fiestas Patrias',
  ninos: 'Día del Niño',
  aniversario: 'Aniversario',
};

const ROLES_COLOR = [
  { k: 'accent', n: 'Botones y detalles' },
  { k: 'on', n: 'Texto sobre los botones' },
  { k: 'ink', n: 'Texto y fondos oscuros' },
  { k: 'bg', n: 'Fondo de la carta' },
  { k: 'card', n: 'Tarjetas y cajas' },
  { k: 'price', n: 'Precios' },
  { k: 'sec', n: 'Detalle secundario' },
  { k: 'soft', n: 'Texto suave' },
  { k: 'line', n: 'Líneas y bordes' },
];

function hexL(h: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return NaN;
  const c = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function ratioOf(a: string, b: string): number {
  const l1 = hexL(a);
  const l2 = hexL(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function PaletaView() {
  const [paletas, setPaletas] = useState<Record<string, Record<string, string>>>(PAL_DEFAULT);
  const [decoracionActiva, setDecoracionActiva] = useState('ninguno');
  const [tieneBorrador, setTieneBorrador] = useState(false);
  const [productoEjemplo, setProductoEjemplo] = useState<{ categoria: string; nombre: string; sub: string; precio: string } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirmarPublicar, setConfirmarPublicar] = useState(false);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);
  const [temaPorRestablecer, setTemaPorRestablecer] = useState<string | null>(null);
  const [guardandoAccion, setGuardandoAccion] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await api.get<{
        paletas: Record<string, Record<string, string>>;
        decoracionActiva: string;
        tieneBorrador: boolean;
        productoEjemplo?: { categoria: string; nombre: string; sub: string; precio: string } | null;
      }>('/admin/contenido/paleta');
      setPaletas(data.paletas);
      setDecoracionActiva(data.decoracionActiva);
      setTieneBorrador(data.tieneBorrador);
      if (data.productoEjemplo) {
        setProductoEjemplo(data.productoEjemplo);
      } else {
        try {
          const dis = await api.get<any>('/admin/contenido/disenador');
          const cats = dis?.categorias || [];
          const prods = dis?.productos || [];
          const catFrappe = cats.find((c: any) => /frappe/i.test(c.nombre)) || cats[0];
          const prod = prods.find((p: any) => catFrappe && p.categoriaId === catFrappe.id) || prods[0];
          if (prod) {
            const catNombre = cats.find((c: any) => c.id === prod.categoriaId)?.nombre || '';
            setProductoEjemplo({
              categoria: catNombre,
              nombre: prod.nombre,
              sub: prod.descripcion || '',
              precio: `Desde s/ ${Number(prod.precio).toFixed(2)}`,
            });
          }
        } catch {
          // Si falla la consulta auxiliar, se muestra el estado sin producto
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar la paleta de colores');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const cambiarColor = (temaKey: string, rolKey: string, valor: string) => {
    const copia = {
      ...paletas,
      [temaKey]: {
        ...paletas[temaKey],
        [rolKey]: valor,
      },
    };
    setPaletas(copia);
    setTieneBorrador(true);
    // Guardar borrador en backend
    api.put('/admin/contenido/paleta/borrador', { paletas: copia }).catch(() => {});
  };

  const restablecerTema = (temaKey: string) => {
    const base = PAL_DEFAULT[temaKey] || PAL_DEFAULT.ninguno;
    const copia = {
      ...paletas,
      [temaKey]: { ...base },
    };
    setPaletas(copia);
    setTieneBorrador(true);
    api.put('/admin/contenido/paleta/borrador', { paletas: copia }).catch(() => {});
  };

  const ejecutarPublicar = async () => {
    setGuardandoAccion(true);
    try {
      await api.post('/admin/contenido/paleta/publicar', {});
      setTieneBorrador(false);
      setConfirmarPublicar(false);
      setMensaje('¡Colores publicados en la carta!');
      setTimeout(() => setMensaje(null), 4000);
    } catch (err: any) {
      setMensaje(err?.message || 'Error al publicar colores');
    } finally {
      setGuardandoAccion(false);
    }
  };

  const ejecutarDescartar = async () => {
    setGuardandoAccion(true);
    try {
      await api.post('/admin/contenido/paleta/descartar', {});
      await cargarDatos();
      setTieneBorrador(false);
      setConfirmarDescartar(false);
      setMensaje('Cambios descartados');
      setTimeout(() => setMensaje(null), 3000);
    } catch (err: any) {
      setMensaje(err?.message || 'Error al descartar cambios');
    } finally {
      setGuardandoAccion(false);
    }
  };

  if (cargando) return <Cargando mensaje="Cargando paleta de colores..." />;
  if (error) return <EstadoError mensaje={error} alReintentar={cargarDatos} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Texto literal del mockup */}
      <div
        style={{
          border: '1.5px dashed var(--cp-soft)',
          borderRadius: 12,
          padding: '12px 14px',
          fontSize: 13,
          lineHeight: '19px',
          color: 'var(--cp-soft)',
        }}
      >
        Cada decoración festiva tiene su propia paleta, solo para la carta virtual. Mientras una decoración está activa, la carta usa sus colores; cuando vuelves a &ldquo;Sin decoración&rdquo;, regresa la paleta normal. La decoración activa se elige en &ldquo;Diseño de la carta&rdquo;.
      </div>

      {/* Barra de estado y acciones */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        {tieneBorrador ? (
          <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 9999, padding: '4px 12px', background: 'var(--cp-gold)', color: 'var(--cp-navy)' }}>
            Colores sin publicar
          </span>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 9999, padding: '4px 12px', background: 'var(--cp-navy)', color: 'var(--cp-cream)' }}>
            Colores publicados
          </span>
        )}
        <button
          onClick={() => setConfirmarPublicar(true)}
          disabled={!tieneBorrador}
          style={{
            minHeight: 48,
            padding: '0 20px',
            border: 0,
            borderRadius: 12,
            background: tieneBorrador ? 'var(--cp-orange)' : 'var(--cp-line)',
            color: 'var(--cp-navy)',
            fontWeight: 800,
            opacity: tieneBorrador ? 1 : 0.6,
            cursor: tieneBorrador ? 'pointer' : 'not-allowed',
          }}
        >
          Publicar colores
        </button>
        <button
          onClick={() => setConfirmarDescartar(true)}
          disabled={!tieneBorrador}
          style={{
            minHeight: 48,
            padding: '0 20px',
            border: '1.5px solid var(--cp-navy)',
            borderRadius: 12,
            background: 'transparent',
            color: 'var(--cp-navy)',
            fontWeight: 700,
            opacity: tieneBorrador ? 1 : 0.6,
            cursor: tieneBorrador ? 'pointer' : 'not-allowed',
          }}
        >
          Descartar
        </button>
        {mensaje && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cp-soft)' }}>{mensaje}</span>}
      </div>

      {/* Cuadrícula de tarjetas de paletas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {Object.entries(paletas).map(([key, pal]) => {
          const esActiva = decoracionActiva.toLowerCase() === key.toLowerCase();
          const nombreTema = NOMBRES_TEMAS[key] || key;
          const r1 = ratioOf(pal.on || '#000000', pal.accent || '#FFFFFF');
          const r2 = ratioOf(pal.price || '#000000', pal.bg || '#FFFFFF');
          const r3 = ratioOf(pal.ink || '#000000', pal.bg || '#FFFFFF');
          const issues: string[] = [];
          if (r1 < 4.5) issues.push('el texto de los botones se lee con poco contraste');
          if (r2 < 4.5) issues.push('los precios se leen con poco contraste sobre el fondo');
          if (r3 < 4.5) issues.push('el texto se lee con poco contraste sobre el fondo');
          return (
            <div
              key={key}
              style={{
                background: 'var(--cp-white)',
                border: `2px solid ${esActiva ? 'var(--cp-orange)' : 'var(--cp-line)'}`,
                borderRadius: 16,
                boxShadow: '0 6px 18px rgba(11,44,62,0.10)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Encabezado */}
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--cp-line)' }}>
                <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 16 }}>
                  {nombreTema}
                </span>
                {esActiva && (
                  <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 9999, padding: '3px 10px', background: 'var(--cp-orange)', color: 'var(--cp-navy)' }}>
                    Elegida en la carta
                  </span>
                )}
              </div>

              {/* Vista previa en vivo con los colores */}
              <div style={{ background: pal.bg, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, height: 3, background: pal.accent, borderRadius: 2 }} />
                  <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 15, color: pal.ink }}>{productoEjemplo?.categoria || 'Frappes'}</span>
                  <span style={{ flex: 1, height: 3, background: pal.accent, borderRadius: 2 }} />
                </div>
                <div style={{ background: pal.card, border: `1px solid ${pal.line}`, borderRadius: 12, padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ width: 48, height: 48, borderRadius: 10, background: pal.sec, flex: 'none' }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: 'var(--fuente-titulos)', fontWeight: 700, fontSize: 13, color: pal.ink }}>{productoEjemplo?.nombre || 'Producto'}</span>
                    <span style={{ display: 'block', fontSize: 12, color: pal.soft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{productoEjemplo?.sub || 'Descripción del producto'}</span>
                    <span style={{ display: 'block', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 15, color: pal.price }}>{productoEjemplo?.precio || ''}</span>
                  </span>
                  <span style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, background: pal.accent, color: pal.on, fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center' }}>
                    Personalizar
                  </span>
                </div>
              </div>

              {/* Controles de selección de colores */}
              <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                {ROLES_COLOR.map((r) => {
                  const val = pal[r.k] || '#000000';
                  const esHex = val.startsWith('#');
                  return (
                    <label key={r.k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, lineHeight: '16px', fontWeight: 600 }}>
                      <input
                        type="color"
                        value={esHex ? val : '#000000'}
                        onChange={(e) => cambiarColor(key, r.k, e.target.value)}
                        style={{ width: 40, height: 36, padding: 0, border: '1.5px solid var(--cp-line)', borderRadius: 8, background: 'var(--cp-white)', flex: 'none', cursor: 'pointer' }}
                      />
                      <span>{r.n}</span>
                    </label>
                  );
                })}
              </div>

              {issues.length > 0 && (
                <div style={{ margin: '0 16px 12px', border: '1.5px solid var(--cp-rust)', borderRadius: 10, padding: '8px 10px', fontSize: 12, lineHeight: '17px', color: 'var(--cp-rust)', fontWeight: 600 }}>
                  Ojo: {issues.join('; ')}.
                </div>
              )}

              {/* Botón de restablecer */}
              <div style={{ padding: '0 16px 14px' }}>
                <button
                  onClick={() => setTemaPorRestablecer(key)}
                  style={{ minHeight: 44, padding: '0 14px', border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  Restablecer colores
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmar restablecer */}
      <Confirmar
        abierto={!!temaPorRestablecer}
        titulo={`¿Restablecer los colores de "${temaPorRestablecer === 'ninguno' ? 'Normal' : NOMBRES_TEMAS[temaPorRestablecer || ''] || ''}"?`}
        mensaje="Volverán los colores originales de esta paleta."
        textoConfirmar="Sí, restablecer"
        textoNo="No, cancelar"
        alConfirmar={() => {
          if (temaPorRestablecer) restablecerTema(temaPorRestablecer);
          setTemaPorRestablecer(null);
        }}
        alCancelar={() => setTemaPorRestablecer(null)}
      />

      {/* Confirmar publicar */}
      <Confirmar
        abierto={confirmarPublicar}
        titulo="¿Publicar los colores en la carta?"
        mensaje="La carta usará estas paletas cuando una decoración esté activa."
        textoConfirmar="Sí, publicar"
        textoNo="No, seguir editando"
        cargando={guardandoAccion}
        alConfirmar={ejecutarPublicar}
        alCancelar={() => setConfirmarPublicar(false)}
      />

      {/* Confirmar descartar */}
      <Confirmar
        abierto={confirmarDescartar}
        titulo="¿Descartar los cambios de color sin publicar?"
        mensaje="Volverán los últimos colores publicados."
        textoConfirmar="Sí, descartar"
        textoNo="No, mantener cambios"
        peligro
        cargando={guardandoAccion}
        alConfirmar={ejecutarDescartar}
        alCancelar={() => setConfirmarDescartar(false)}
      />
    </div>
  );
}
