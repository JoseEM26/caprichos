import { useState, useEffect } from 'react';
import { OfertaItem, ComboPrecioItem, ComboParteItem } from './ofertasApi';

const DIAS = [
  ['lun', 'Lunes', 'Lun'],
  ['mar', 'Martes', 'Mar'],
  ['mie', 'Miércoles', 'Mié'],
  ['jue', 'Jueves', 'Jue'],
  ['vie', 'Viernes', 'Vie'],
  ['sab', 'Sábado', 'Sáb'],
  ['dom', 'Domingo', 'Dom'],
];

const CANALES = [
  { clave: 'todos', nombre: 'Todos los canales' },
  { clave: 'carta', nombre: 'Solo carta web' },
  { clave: 'local', nombre: 'Solo en el local' },
  { clave: 'whatsapp', nombre: 'Solo WhatsApp' },
];

const CATEGORIAS_DEF = [
  'Combos',
  'Frappes',
  'Iced',
  'Frozen',
  'Calientes',
  'Waffles',
  'Salados',
  'Croissants',
  'Postres',
];

interface ModalComboProps {
  abierto: boolean;
  comboAEditar?: OfertaItem | null;
  onCerrar: () => void;
  onGuardar: (datos: any) => Promise<void>;
  productosDisponibles?: Array<{ id: string; nombre: string; categoria?: string }>;
  categoriasDisponibles?: string[];
}

export function ModalCombo({
  abierto,
  comboAEditar,
  onCerrar,
  onGuardar,
  productosDisponibles = [],
  categoriasDisponibles = CATEGORIAS_DEF,
}: ModalComboProps) {
  const [nombre, setNombre] = useState('');
  const [tamanos, setTamanos] = useState<ComboPrecioItem[]>([{ tamanoNombre: 'Regular', precio: 0 }]);
  const [partes, setPartes] = useState<ComboParteItem[]>([]);
  const [parteAbiertaIndex, setParteAbiertaIndex] = useState<number | null>(0);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [dias, setDias] = useState<string[]>([]);
  const [horaDesde, setHoraDesde] = useState('');
  const [horaHasta, setHoraHasta] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [canal, setCanal] = useState('todos');
  const [descripcion, setDescripcion] = useState('');
  const [mensajeError, setMensajeError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (comboAEditar) {
      setNombre(comboAEditar.nombre || '');
      const preciosLista = comboAEditar.combosPrecio || comboAEditar.combosPrecios;
      setTamanos(
        preciosLista && preciosLista.length > 0
          ? preciosLista.map((t) => ({ ...t }))
          : [{ tamanoNombre: 'Único', precio: comboAEditar.descuentoValor || 0 }],
      );
      const partesLista = comboAEditar.combosParte || comboAEditar.combosPartes;
      setPartes(
        partesLista && partesLista.length > 0
          ? partesLista.map((p) => ({
              ...p,
              nombre: p.nombre || (p.tipo === 'A_ELECCION' ? 'Bebida a elección' : 'Parte'),
              tipoParte: p.tipoParte || (p.tipo === 'FIJO' ? 'FIJO' : 'A_ELECCION'),
              cantidad: p.cantidad || 1,
            }))
          : [],
      );
      const diasArr = comboAEditar.dias || comboAEditar.diasSemana;
      setDias(
        (diasArr || []).map((d) => DIAS[d % 7]?.[0] || 'lun'),
      );
      setHoraDesde(comboAEditar.horaDesde || comboAEditar.horaInicio || '');
      setHoraHasta(comboAEditar.horaHasta || comboAEditar.horaFin || '');
      const fDesde = comboAEditar.fechaDesde || comboAEditar.fechaInicio;
      const fHasta = comboAEditar.fechaHasta || comboAEditar.fechaFin;
      setFechaDesde(fDesde ? fDesde.slice(0, 10) : '');
      setFechaHasta(fHasta ? fHasta.slice(0, 10) : '');
      setCanal(comboAEditar.canales && comboAEditar.canales[0] ? comboAEditar.canales[0].toLowerCase() : 'todos');
      setDescripcion(comboAEditar.descripcion || '');
      setMensajeError('');
      setParteAbiertaIndex(0);
    } else {
      setNombre('');
      setTamanos([{ tamanoNombre: 'Regular', precio: 0 }]);
      setPartes([]);
      setDias([]);
      setHoraDesde('');
      setHoraHasta('');
      setFechaDesde('');
      setFechaHasta('');
      setCanal('todos');
      setDescripcion('');
      setMensajeError('');
      setParteAbiertaIndex(0);
    }
  }, [comboAEditar, abierto]);

  if (!abierto) return null;

  const agregarTamano = () => {
    setTamanos((prev) => [...prev, { tamanoNombre: '', precio: 0 }]);
  };

  const quitarTamano = (index: number) => {
    setTamanos((prev) => prev.filter((_, i) => i !== index));
  };

  const agregarParte = (tipo: 'A_ELECCION' | 'FIJO' | 'OPCIONES') => {
    const nuevaParte: ComboParteItem = {
      nombre: tipo === 'A_ELECCION' ? 'Bebida' : tipo === 'FIJO' ? 'Producto fijo' : 'Complemento',
      tipoParte: tipo,
      cantidad: 1,
      categorias: tipo === 'A_ELECCION' ? ['Frappes'] : [],
      productos: [],
      opciones: tipo === 'OPCIONES' ? [{ nombre: 'Opción 1', items: [] }] : undefined,
    };
    setPartes((prev) => [...prev, nuevaParte]);
    setParteAbiertaIndex(partes.length);
  };

  const quitarParte = (index: number) => {
    setPartes((prev) => prev.filter((_, i) => i !== index));
    if (parteAbiertaIndex === index) setParteAbiertaIndex(null);
  };

  const moverParte = (index: number, dir: -1 | 1) => {
    const nuevo = [...partes];
    const target = index + dir;
    if (target < 0 || target >= nuevo.length) return;
    const temp = nuevo[index];
    nuevo[index] = nuevo[target];
    nuevo[target] = temp;
    setPartes(nuevo);
    setParteAbiertaIndex(target);
  };

  const toggleCategoriaEnParte = (parteIdx: number, cat: string) => {
    setPartes((prev) =>
      prev.map((p, i) => {
        if (i !== parteIdx) return p;
        const currentCats = p.categorias || [];
        const nextCats = currentCats.includes(cat)
          ? currentCats.filter((x) => x !== cat)
          : [...currentCats, cat];
        return { ...p, categorias: nextCats };
      }),
    );
  };

  const toggleDia = (d: string) => {
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const validarYGuardar = async () => {
    if (!nombre.trim()) {
      setMensajeError('Escribe el nombre del combo.');
      return;
    }
    if (tamanos.length === 0 || tamanos.some((t) => !t.tamanoNombre.trim() || !(t.precio > 0))) {
      setMensajeError('Cada tamaño debe tener un nombre y un precio mayor a 0.');
      return;
    }
    if (partes.length === 0) {
      setMensajeError('Agrega al menos una parte al combo.');
      return;
    }

    setGuardando(true);
    setMensajeError('');
    try {
      const diasNum = dias.map((code) => {
        const idx = DIAS.findIndex((x) => x[0] === code);
        return idx + 1;
      });

      const payload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        tipo: 'COMBO',
        aplicaA: 'TODA_LA_CARTA',
        dias: diasNum,
        diasSemana: diasNum,
        horaDesde: horaDesde || undefined,
        horaInicio: horaDesde || undefined,
        horaHasta: horaHasta || undefined,
        horaFin: horaHasta || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaInicio: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        fechaFin: fechaHasta || undefined,
        canales: canal === 'todos' ? ['CARTA', 'ADMIN', 'BOT'] : [canal.toUpperCase()],
        tamanos: tamanos.map((t) => ({
          tamanoNombre: t.tamanoNombre.trim(),
          precio: Number(t.precio),
        })),
        combosPrecios: tamanos.map((t) => ({
          tamanoNombre: t.tamanoNombre.trim(),
          precio: Number(t.precio),
        })),
        partes: partes.map((p, idx) => ({
          nombre: (p.nombre ?? "").trim(),
          tipo: (p.tipoParte === 'OPCIONES' || p.tipoParte === 'UNA_DE' ? 'A_ELECCION' : p.tipoParte || p.tipo || 'A_ELECCION') as any,
          tipoParte: p.tipoParte,
          cantidad: p.cantidad || 1,
          categorias: (p.categorias || []).map((c: any) => String(c)),
          productos: (p.productos || []).map((pr: any) => String(typeof pr === 'object' ? pr.productoId || pr.id : pr)),
          orden: idx + 1,
        })),
        combosPartes: partes.map((p, idx) => ({
          nombre: (p.nombre ?? "").trim(),
          tipo: (p.tipoParte === 'OPCIONES' || p.tipoParte === 'UNA_DE' ? 'A_ELECCION' : p.tipoParte || p.tipo || 'A_ELECCION') as any,
          tipoParte: p.tipoParte,
          cantidad: p.cantidad || 1,
          categorias: (p.categorias || []).map((c: any) => String(c)),
          productos: (p.productos || []).map((pr: any) => String(typeof pr === 'object' ? pr.productoId || pr.id : pr)),
          orden: idx + 1,
        })),
      };

      await onGuardar(payload);
      onCerrar();
    } catch (err: any) {
      setMensajeError(err.response?.data?.mensaje || err.message || 'Error al guardar el combo.');
    } finally {
      setGuardando(false);
    }
  };

  // Preview text generator
  const precioPrincipal = tamanos[0] ? `s/ ${tamanos[0].precio}` : 's/ 0';
  const resumenPartes = partes.map((sl) => {
    if (sl.tipoParte === 'FIJO') {
      const prodName = sl.productos && sl.productos[0] ? sl.productos[0].nombre : 'Producto fijo';
      return `${sl.cantidad} × ${prodName}`;
    }
    if (sl.tipoParte === 'A_ELECCION') {
      const cats = (sl.categorias || []).join(', ');
      return `${sl.cantidad} × ${(sl.nombre ?? "").toLowerCase()} a elección (${cats || 'opciones'})`;
    }
    return `1 × ${(sl.nombre ?? "").toLowerCase()} a elegir entre ${(sl.opciones || []).length || 2} opciones`;
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      {/* Fondo clickeable */}
      <div
        onClick={onCerrar}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(11, 44, 62, 0.55)',
          zIndex: 60,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Constructor de combos"
        style={{
          position: 'absolute',
          zIndex: 65,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(1110px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          backgroundColor: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '22px',
              color: 'var(--cp-navy)',
            }}
          >
            {comboAEditar ? 'Editar combo' : 'Constructor de combos'}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: '1.5px solid var(--cp-navy)',
              backgroundColor: 'transparent',
              color: 'var(--cp-navy)',
              fontSize: '20px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* 1. Nombre y precios */}
        <div
          style={{
            backgroundColor: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontWeight: 800, color: 'var(--cp-navy)' }}>1. ¿Cómo se llama y cuánto cuesta?</div>
          <div>
            <label htmlFor="cm-n" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
              Nombre del combo
            </label>
            <input
              id="cm-n"
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setMensajeError('');
              }}
              placeholder="Ej.: Dúo para compartir"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '44px',
                borderRadius: '10px',
                border: '1.5px solid var(--cp-line)',
                backgroundColor: 'var(--cp-white)',
                padding: '0 12px',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ fontWeight: 700, fontSize: '13px' }}>
            Precio por tamaño{' '}
            <span style={{ fontWeight: 600, color: 'var(--cp-soft)' }}>
              (si solo tiene un precio, deja una fila)
            </span>
          </div>

          {tamanos.map((t, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={t.tamanoNombre}
                onChange={(e) => {
                  const val = e.target.value;
                  setTamanos((prev) => prev.map((item, i) => (i === idx ? { ...item, tamanoNombre: val } : item)));
                }}
                placeholder="Tamaño, ej.: Regular 12 oz"
                aria-label="Nombre del tamaño"
                style={{
                  flex: 2,
                  minWidth: 0,
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  backgroundColor: 'var(--cp-white)',
                  padding: '0 12px',
                  fontSize: '14px',
                }}
              />
              <input
                type="text"
                inputMode="decimal"
                value={t.precio || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value.replace(',', '.')) || 0;
                  setTamanos((prev) => prev.map((item, i) => (i === idx ? { ...item, precio: val } : item)));
                }}
                placeholder="s/"
                aria-label="Precio"
                style={{
                  flex: 1,
                  minWidth: 0,
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  backgroundColor: 'var(--cp-white)',
                  padding: '0 12px',
                  fontSize: '14px',
                }}
              />
              {tamanos.length > 1 && (
                <button
                  type="button"
                  onClick={() => quitarTamano(idx)}
                  aria-label="Quitar tamaño"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '20px',
                    border: '1.5px solid var(--cp-rust)',
                    backgroundColor: 'transparent',
                    color: 'var(--cp-rust)',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={agregarTamano}
            style={{
              alignSelf: 'flex-start',
              minHeight: '38px',
              padding: '0 12px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-navy)',
              fontWeight: 700,
              fontSize: '12px',
              borderStyle: 'dashed',
              backgroundColor: 'transparent',
              color: 'var(--cp-navy)',
              cursor: 'pointer',
            }}
          >
            + Agregar tamaño
          </button>
        </div>

        {/* 2. ¿Qué lleva? */}
        <div
          style={{
            backgroundColor: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ fontWeight: 800 }}>2. ¿Qué lleva?</div>
          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
            Arma el combo por partes. Siempre con productos de la carta: así se descuentan solos y los informes cuentan cada producto.
          </div>

          {partes.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              Todavía no tiene partes. Agrega la primera con uno de los botones de abajo.
            </div>
          )}

          {partes.map((sl, idx) => {
            const isOpen = parteAbiertaIndex === idx;
            return (
              <div
                key={idx}
                style={{
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                {/* Cabecera de la parte */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    backgroundColor: 'var(--cp-sand)',
                  }}
                >
                  <span
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '13px',
                      backgroundColor: 'var(--cp-navy)',
                      color: 'var(--cp-cream)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '13px',
                      flex: 'none',
                    }}
                  >
                    {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setParteAbiertaIndex(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                      border: 0,
                      backgroundColor: 'transparent',
                      color: 'var(--cp-navy)',
                      padding: 0,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '14px', lineHeight: '18px' }}>
                      {sl.nombre || 'Parte sin nombre'} {isOpen ? '▴' : '▾'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--cp-soft)', lineHeight: '16px' }}>
                      {sl.tipoParte === 'A_ELECCION'
                        ? `${sl.cantidad} productos a elección (${(sl.categorias || []).join(', ')})`
                        : sl.tipoParte === 'FIJO'
                        ? `${sl.cantidad} × producto fijo`
                        : `1 opción entre ${(sl.opciones || []).length} opciones`}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => moverParte(idx, -1)}
                    aria-label="Subir"
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '17px',
                      border: '1.5px solid var(--cp-navy)',
                      backgroundColor: 'transparent',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moverParte(idx, 1)}
                    aria-label="Bajar"
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '17px',
                      border: '1.5px solid var(--cp-navy)',
                      backgroundColor: 'transparent',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => quitarParte(idx)}
                    aria-label="Quitar esta parte"
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '17px',
                      border: '1.5px solid var(--cp-rust)',
                      backgroundColor: 'transparent',
                      color: 'var(--cp-rust)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>

                {/* Contenido expandido de la parte */}
                {isOpen && (
                  <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {sl.tipoParte === 'A_ELECCION' && (
                      <>
                        <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                          El cliente escoge estos productos. Por ejemplo: 2 bebidas, cualquiera de Frappes, Iced o Calientes.
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div style={{ flex: '1 1 180px' }}>
                            <label style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                              Nombre de la parte
                            </label>
                            <input
                              type="text"
                              value={sl.nombre}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPartes((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, nombre: val } : item)),
                                );
                              }}
                              placeholder="Ej.: Bebida"
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                minHeight: '44px',
                                borderRadius: '10px',
                                border: '1.5px solid var(--cp-line)',
                                backgroundColor: 'var(--cp-white)',
                                padding: '0 12px',
                                fontSize: '14px',
                              }}
                            />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>Cuántos</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setPartes((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, cantidad: Math.max(1, (item.cantidad || 1) - 1) } : item,
                                    ),
                                  );
                                }}
                                aria-label="Menos"
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '20px',
                                  border: '1.5px solid var(--cp-navy)',
                                  backgroundColor: 'transparent',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                }}
                              >
                                −
                              </button>
                              <b style={{ minWidth: '26px', textAlign: 'center' }}>{sl.cantidad}</b>
                              <button
                                type="button"
                                onClick={() => {
                                  setPartes((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, cantidad: (item.cantidad || 1) + 1 } : item,
                                    ),
                                  );
                                }}
                                aria-label="Más"
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '20px',
                                  border: '1.5px solid var(--cp-navy)',
                                  backgroundColor: 'transparent',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        <div style={{ fontWeight: 700, fontSize: '13px' }}>
                          Puede elegir de estas categorías (todos sus productos)
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {categoriasDisponibles.map((cat) => {
                            const on = (sl.categorias || []).includes(cat);
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => toggleCategoriaEnParte(idx, cat)}
                                style={{
                                  minHeight: '38px',
                                  padding: '0 12px',
                                  borderRadius: '9999px',
                                  border: '1.5px solid var(--cp-navy)',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  backgroundColor: on ? 'var(--cp-navy)' : 'transparent',
                                  color: on ? 'var(--cp-cream)' : 'var(--cp-navy)',
                                  cursor: 'pointer',
                                }}
                              >
                                {cat}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {sl.tipoParte === 'FIJO' && (
                      <>
                        <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                          Este producto va siempre en el combo, sin que el cliente elija.
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>Cantidad</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPartes((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, cantidad: Math.max(1, (item.cantidad || 1) - 1) } : item,
                                ),
                              );
                            }}
                            aria-label="Menos"
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '20px',
                              border: '1.5px solid var(--cp-navy)',
                              backgroundColor: 'transparent',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            −
                          </button>
                          <b style={{ minWidth: '26px', textAlign: 'center' }}>{sl.cantidad}</b>
                          <button
                            type="button"
                            onClick={() => {
                              setPartes((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, cantidad: (item.cantidad || 1) + 1 } : item,
                                ),
                              );
                            }}
                            aria-label="Más"
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '20px',
                              border: '1.5px solid var(--cp-navy)',
                              backgroundColor: 'transparent',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            +
                          </button>
                        </div>
                        <input
                          type="search"
                          placeholder="Buscar un producto de la carta"
                          value={busquedaProducto}
                          onChange={(e) => setBusquedaProducto(e.target.value)}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: '44px',
                            borderRadius: '9999px',
                            border: '1.5px solid var(--cp-line)',
                            backgroundColor: 'var(--cp-white)',
                            padding: '0 12px',
                            fontSize: '14px',
                          }}
                        />
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '120px', overflowY: 'auto' }}>
                          {productosDisponibles
                            .filter((p) => !busquedaProducto.trim() || p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()))
                            .slice(0, 10)
                            .map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setPartes((prev) =>
                                    prev.map((item, i) =>
                                      i === idx
                                        ? { ...item, productos: [{ productoId: p.id, nombre: p.nombre }] }
                                        : item,
                                    ),
                                  );
                                }}
                                style={{
                                  minHeight: '34px',
                                  padding: '0 10px',
                                  borderRadius: '10px',
                                  border: '1.5px solid var(--cp-navy)',
                                  backgroundColor:
                                    sl.productos && sl.productos[0]?.nombre === p.nombre
                                      ? 'var(--cp-navy)'
                                      : 'var(--cp-white)',
                                  color:
                                    sl.productos && sl.productos[0]?.nombre === p.nombre
                                      ? 'var(--cp-cream)'
                                      : 'var(--cp-navy)',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                {p.nombre}
                              </button>
                            ))}
                        </div>
                      </>
                    )}

                    {sl.tipoParte === 'OPCIONES' && (
                      <>
                        <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                          El cliente escoge UNA opción. Cada opción puede llevar uno o varios productos.
                        </div>
                        <div>
                          <label style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                            Nombre de la parte
                          </label>
                          <input
                            type="text"
                            value={sl.nombre}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPartes((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, nombre: val } : item)),
                              );
                            }}
                            placeholder="Ej.: Complemento"
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              minHeight: '44px',
                              borderRadius: '10px',
                              border: '1.5px solid var(--cp-line)',
                              backgroundColor: 'var(--cp-white)',
                              padding: '0 12px',
                              fontSize: '14px',
                            }}
                          />
                        </div>

                        {(sl.opciones || []).map((al, altIdx) => (
                          <div
                            key={altIdx}
                            style={{
                              border: '1.5px solid var(--cp-line)',
                              borderRadius: '12px',
                              padding: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              backgroundColor: 'var(--cp-white)',
                            }}
                          >
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={al.nombre}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPartes((prev) =>
                                    prev.map((item, i) => {
                                      if (i !== idx) return item;
                                      const nextAlts = (item.opciones || []).map((o, j) =>
                                        j === altIdx ? { ...o, nombre: val } : o,
                                      );
                                      return { ...item, opciones: nextAlts };
                                    }),
                                  );
                                }}
                                aria-label="Nombre de la opción"
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  minHeight: '44px',
                                  borderRadius: '10px',
                                  border: '1.5px solid var(--cp-line)',
                                  backgroundColor: 'var(--cp-white)',
                                  padding: '0 12px',
                                  fontSize: '14px',
                                }}
                              />
                              {(sl.opciones || []).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPartes((prev) =>
                                      prev.map((item, i) => {
                                        if (i !== idx) return item;
                                        return {
                                          ...item,
                                          opciones: (item.opciones || []).filter((_, j) => j !== altIdx),
                                        };
                                      }),
                                    );
                                  }}
                                  aria-label="Quitar opción"
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '19px',
                                    border: '1.5px solid var(--cp-rust)',
                                    backgroundColor: 'transparent',
                                    color: 'var(--cp-rust)',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                  }}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => {
                            setPartes((prev) =>
                              prev.map((item, i) => {
                                if (i !== idx) return item;
                                return {
                                  ...item,
                                  opciones: [
                                    ...(item.opciones || []),
                                    {
                                      nombre: `Opción ${(item.opciones || []).length + 1}`,
                                      items: [],
                                    },
                                  ],
                                };
                              }),
                            );
                          }}
                          style={{
                            alignSelf: 'flex-start',
                            minHeight: '38px',
                            padding: '0 12px',
                            borderRadius: '9999px',
                            border: '1.5px solid var(--cp-navy)',
                            fontWeight: 700,
                            fontSize: '12px',
                            borderStyle: 'dashed',
                            backgroundColor: 'transparent',
                            color: 'var(--cp-navy)',
                            cursor: 'pointer',
                          }}
                        >
                          + Nueva opción
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => agregarParte('A_ELECCION')}
              style={{
                minHeight: '38px',
                padding: '0 12px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                backgroundColor: 'var(--cp-navy)',
                color: 'var(--cp-cream)',
                cursor: 'pointer',
              }}
            >
              + Productos a elección del cliente
            </button>
            <button
              type="button"
              onClick={() => agregarParte('OPCIONES')}
              style={{
                minHeight: '38px',
                padding: '0 12px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                backgroundColor: 'var(--cp-navy)',
                color: 'var(--cp-cream)',
                cursor: 'pointer',
              }}
            >
              + Una opción entre varias
            </button>
            <button
              type="button"
              onClick={() => agregarParte('FIJO')}
              style={{
                minHeight: '38px',
                padding: '0 12px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                backgroundColor: 'var(--cp-navy)',
                color: 'var(--cp-cream)',
                cursor: 'pointer',
              }}
            >
              + Un producto fijo
            </button>
          </div>
        </div>

        {/* 3. ¿Cuándo vale? */}
        <div
          style={{
            border: '1.5px dashed var(--cp-soft)',
            borderRadius: '12px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            backgroundColor: 'var(--cp-white)',
          }}
        >
          <div style={{ fontWeight: 800 }}>
            3. ¿Cuándo vale?{' '}
            <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--cp-soft)' }}>
              (si no marcas nada, vale siempre)
            </span>
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
              Días{' '}
              <span style={{ fontWeight: 600, color: 'var(--cp-soft)' }}>
                · {dias.length && dias.length < 7 ? 'solo los marcados' : 'todos los días (sin marcar)'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {DIAS.map(([code, , abrev]) => {
                const activo = dias.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleDia(code)}
                    aria-pressed={activo}
                    style={{
                      minWidth: '48px',
                      minHeight: '44px',
                      padding: '0 8px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-navy)',
                      backgroundColor: activo ? 'var(--cp-navy)' : 'transparent',
                      color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {abrev}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 110px' }}>
              <label htmlFor="cm-hd" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Desde la hora
              </label>
              <input
                id="cm-hd"
                type="time"
                value={horaDesde}
                onChange={(e) => setHoraDesde(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  backgroundColor: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '0 10px',
                  fontSize: '14px',
                }}
              />
            </div>
            <div style={{ flex: '1 1 110px' }}>
              <label htmlFor="cm-hh" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Hasta la hora
              </label>
              <input
                id="cm-hh"
                type="time"
                value={horaHasta}
                onChange={(e) => setHoraHasta(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  backgroundColor: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '0 10px',
                  fontSize: '14px',
                }}
              />
            </div>
            <div style={{ flex: '1 1 130px' }}>
              <label htmlFor="cm-vd" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Vigente desde
              </label>
              <input
                id="cm-vd"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  backgroundColor: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '0 10px',
                  fontSize: '14px',
                }}
              />
            </div>
            <div style={{ flex: '1 1 130px' }}>
              <label htmlFor="cm-vh" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Hasta
              </label>
              <input
                id="cm-vh"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  backgroundColor: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '0 10px',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>Dónde vale</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {CANALES.map((c) => (
                <button
                  key={c.clave}
                  type="button"
                  onClick={() => setCanal(c.clave)}
                  style={{
                    minHeight: '44px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: canal === c.clave ? 'var(--cp-navy)' : 'transparent',
                    color: canal === c.clave ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Así lo ve el cliente */}
        <div
          style={{
            backgroundColor: 'var(--cp-navy)',
            color: 'var(--cp-cream)',
            borderRadius: '14px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ fontWeight: 800 }}>Así lo ve el cliente</div>
          <div style={{ fontSize: '13px', color: '#F6A04D', fontWeight: 700 }}>
            {nombre ? `${nombre.toUpperCase()} · ${precioPrincipal}` : `COMBO · ${precioPrincipal}`}
          </div>
          {resumenPartes.map((p, i) => (
            <div key={i} style={{ fontSize: '13px' }}>
              • {p}
            </div>
          ))}
        </div>

        {/* Descripción */}
        <div>
          <label htmlFor="cm-d" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
            Descripción para la carta (opcional, si la dejas vacía se arma sola)
          </label>
          <input
            id="cm-d"
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '44px',
              borderRadius: '10px',
              border: '1.5px solid var(--cp-line)',
              backgroundColor: 'var(--cp-white)',
              padding: '0 12px',
              fontSize: '14px',
            }}
          />
        </div>

        {mensajeError && (
          <div role="alert" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
            {mensajeError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={validarYGuardar}
            disabled={guardando}
            style={{
              flex: 1,
              minHeight: '52px',
              border: 0,
              borderRadius: '12px',
              backgroundColor: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '15px',
              cursor: guardando ? 'not-allowed' : 'pointer',
            }}
          >
            {guardando ? 'Guardando...' : 'Guardar combo'}
          </button>
          <button
            type="button"
            onClick={onCerrar}
            style={{
              flex: 1,
              minHeight: '52px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '12px',
              backgroundColor: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
