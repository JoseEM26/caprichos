import { IndicadorSubida } from '../../comun/IndicadorSubida';
import { useSubidaArchivo } from '../../comun/useSubidaArchivo';
import { CanalesEstado, ERROR_SIN_CANALES, SelectorCanales, SelectorVisibleCarta, canalesDesdeEstado, canalesPorDefecto, estadoDesdeCanales } from './canalesPromo';
import { useState, useEffect, useMemo, useRef } from 'react';
import { OfertaItem, ComboPrecioItem, ComboParteItem, ofertasApi } from './ofertasApi';
import { ModalConfirmacion } from './ModalConfirmacion';
import { PrevisualizacionCarta } from './PrevisualizacionCarta';
import { AlternativasParte } from './AlternativasParte';

const DIAS = [
  ['lun', 'Lunes', 'Lun'],
  ['mar', 'Martes', 'Mar'],
  ['mie', 'Miércoles', 'Mié'],
  ['jue', 'Jueves', 'Jue'],
  ['vie', 'Viernes', 'Vie'],
  ['sab', 'Sábado', 'Sáb'],
  ['dom', 'Domingo', 'Dom'],
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
  productosDisponibles?: Array<{ id: string; nombre: string; categoriaId?: string; categoria?: string; precio?: number; tamanos?: Array<{ id: string; nombre: string; precio?: number }> }>;
  categoriasDisponibles?: string[];
  categorias?: Array<{ id: string; nombre: string; productos?: any[] }>;
}

export function calcularSumaPreciosSueltos(
  partes: ComboParteItem[],
  productos: Array<{ id: string; nombre: string; categoriaId?: string; categoria?: string; precio?: number }>,
): number {
  let total = 0;
  for (const parte of partes) {
    const cant = parte.cantidad || 1;
    const tipo = parte.tipoParte || parte.tipo || 'A_ELECCION';

    if (tipo === 'FIJO') {
      const prods = (parte.productos || []).map((pr: any) =>
        typeof pr === 'object' ? pr.productoId || pr.id : pr,
      );
      for (const pid of prods) {
        const prod = productos.find((p) => String(p.id) === String(pid));
        if (prod && prod.precio) {
          total += Number(prod.precio) * cant;
        }
      }
    } else if (tipo === 'OPCIONES') {
      const opcs = parte.opciones || [];
      if (opcs.length > 0) {
        const preciosOpciones: number[] = [];
        for (const opc of opcs) {
          let sumaOpc = 0;
          for (const it of opc.items || []) {
            const itId = typeof it === 'object' ? it.productoId || it.id : it;
            const prod = productos.find((p) => String(p.id) === String(itId));
            if (prod && prod.precio) sumaOpc += Number(prod.precio);
          }
          if (sumaOpc > 0) preciosOpciones.push(sumaOpc);
        }
        if (preciosOpciones.length > 0) {
          const prom = preciosOpciones.reduce((a, b) => a + b, 0) / preciosOpciones.length;
          total += prom * cant;
        }
      }
    } else {
      // A_ELECCION
      const prodsEnParte: number[] = [];
      const idsProds = (parte.productos || []).map((pr: any) =>
        typeof pr === 'object' ? pr.productoId || pr.id : pr,
      );
      if (idsProds.length > 0) {
        for (const pid of idsProds) {
          const prod = productos.find((p) => String(p.id) === String(pid));
          if (prod && prod.precio) prodsEnParte.push(Number(prod.precio));
        }
      }
      if (parte.categorias && parte.categorias.length > 0) {
        const cats = parte.categorias.map((c: any) => String(c).toLowerCase());
        const prodsDeCat = productos.filter((p) => p.categoria && cats.includes(p.categoria.toLowerCase()));
        for (const prod of prodsDeCat) {
          if (prod.precio) prodsEnParte.push(Number(prod.precio));
        }
      }
      if (prodsEnParte.length > 0) {
        const prom = prodsEnParte.reduce((a, b) => a + b, 0) / prodsEnParte.length;
        total += prom * cant;
      }
    }
  }
  return Math.round(total * 100) / 100;
}

export function ModalCombo({
  abierto,
  comboAEditar,
  onCerrar,
  onGuardar,
  productosDisponibles = [],
  categoriasDisponibles = CATEGORIAS_DEF,
  categorias = [],
}: ModalComboProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Paso del asistente (1 a 4)
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);

  // Paso 1: Nombre, descripción, categoría y foto
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoArchivoId, setFotoArchivoId] = useState<string | null>(null);
  const subidaFoto = useSubidaArchivo();
  const [confirmarQuitarFoto, setConfirmarQuitarFoto] = useState(false);

  // Paso 2: Partes del combo
  const [partes, setPartes] = useState<ComboParteItem[]>([]);
  const [parteAbiertaIndex, setParteAbiertaIndex] = useState<number | null>(0);

  // Paso 3: Cuánto vale (precios y condiciones)
  const [tamanos, setTamanos] = useState<ComboPrecioItem[]>([{ tamanoNombre: 'Regular', precio: 0 }]);
  const [dias, setDias] = useState<string[]>([]);
  const [horaDesde, setHoraDesde] = useState('');
  const [horaHasta, setHoraHasta] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [canales, setCanales] = useState<CanalesEstado>(canalesPorDefecto('COMBO'));
  const [visibleCarta, setVisibleCarta] = useState(true);

  // Estados de control
  const [mensajeError, setMensajeError] = useState('');
  const [confirmarGuardar, setConfirmarGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Categorías reales disponibles normalizadas
  const listaCategorias = useMemo(() => {
    if (categorias && categorias.length > 0) {
      return categorias.map((c) => ({ id: String(c.id), nombre: c.nombre }));
    }
    if (categoriasDisponibles && categoriasDisponibles.length > 0) {
      return categoriasDisponibles.map((c, i) => ({ id: String(i + 1), nombre: c }));
    }
    return CATEGORIAS_DEF.map((c, i) => ({ id: String(i + 1), nombre: c }));
  }, [categorias, categoriasDisponibles]);

  // Inicializar o resetear formulario
  useEffect(() => {
    if (!abierto) return;

    if (comboAEditar) {
      setNombre(comboAEditar.nombre || '');
      setDescripcion(comboAEditar.descripcion || '');
      setFotoUrl(comboAEditar.imagenUrl || null);
      setFotoArchivoId(comboAEditar.imagenArchivoId || null);

      // Categoría
      const catEncontrada = listaCategorias.find(
        (c) =>
          c.id === String(comboAEditar.alcanceCategoriaId || comboAEditar.categoriaId) ||
          c.nombre.toLowerCase() === (comboAEditar.categoriaNombre || '').toLowerCase(),
      );
      setCategoriaId(catEncontrada ? catEncontrada.id : listaCategorias[0]?.id || '');

      // Precios
      const preciosLista = comboAEditar.combosPrecio || comboAEditar.combosPrecios;
      setTamanos(
        preciosLista && preciosLista.length > 0
          ? preciosLista.map((t) => ({ ...t, precio: Number(t.precio) || 0 }))
          : [{ tamanoNombre: 'Regular', precio: comboAEditar.descuentoValor || 0 }],
      );

      // Partes
      const partesLista = comboAEditar.combosParte || comboAEditar.combosPartes;
      setPartes(
        partesLista && partesLista.length > 0
          ? partesLista.map((p) => ({
              ...p,
              nombre: p.nombre || (p.tipo === 'A_ELECCION' ? 'Bebida a elección' : 'Parte'),
              tipoParte: p.tipoParte || (p.tipo === 'FIJO' ? 'FIJO' : 'A_ELECCION'),
              cantidad: p.cantidad || 1,
              alternativas: p.alternativas || [],
              tamanoId: p.tamanoId ?? null,
            }))
          : [],
      );

      // Días, horas, fechas
      const diasArr = comboAEditar.dias || comboAEditar.diasSemana;
      setDias((diasArr || []).map((d) => DIAS[d % 7]?.[0] || 'lun'));
      setHoraDesde(comboAEditar.horaDesde || comboAEditar.horaInicio || '');
      setHoraHasta(comboAEditar.horaHasta || comboAEditar.horaFin || '');
      const fDesde = comboAEditar.fechaDesde || comboAEditar.fechaInicio;
      const fHasta = comboAEditar.fechaHasta || comboAEditar.fechaFin;
      setFechaDesde(fDesde ? fDesde.slice(0, 10) : '');
      setFechaHasta(fHasta ? fHasta.slice(0, 10) : '');
      setCanales(estadoDesdeCanales(comboAEditar.canales));
      setVisibleCarta(comboAEditar.visibleCarta !== false);
      setPaso(1);
      setMensajeError('');
      setParteAbiertaIndex(0);
    } else {
      // Valores por defecto para nuevo combo
      setNombre('');
      setDescripcion('');
      // Por defecto categoría "COMBOS"
      const catCombos = listaCategorias.find((c) => c.nombre.toUpperCase() === 'COMBOS') || listaCategorias[0];
      setCategoriaId(catCombos ? catCombos.id : '');
      setFotoUrl(null);
      setFotoArchivoId(null);
      setTamanos([{ tamanoNombre: 'Regular', precio: 0 }]);
      setPartes([]);
      setDias([]);
      setHoraDesde('');
      setHoraHasta('');
      setFechaDesde('');
      setFechaHasta('');
      setCanales(canalesPorDefecto('COMBO'));
      setPaso(1);
      setMensajeError('');
      setParteAbiertaIndex(0);
    }
  }, [comboAEditar, abierto, listaCategorias]);

  // Accesibilidad: auto-focus y tecla Escape
  useEffect(() => {
    if (!abierto) return;

    const timer = setTimeout(() => {
      dialogRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmarQuitarFoto) {
          setConfirmarQuitarFoto(false);
          return;
        }
        if (confirmarGuardar) {
          setConfirmarGuardar(false);
          return;
        }
        onCerrar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [abierto, confirmarQuitarFoto, confirmarGuardar, onCerrar]);

  // Acciones en tamaños
  const agregarTamano = () => {
    setTamanos((prev) => [...prev, { tamanoNombre: '', precio: 0 }]);
  };

  const quitarTamano = (index: number) => {
    setTamanos((prev) => prev.filter((_, i) => i !== index));
  };

  // Acciones en partes
  const agregarParte = (tipo: 'A_ELECCION' | 'FIJO' | 'OPCIONES') => {
    const nuevaParte: ComboParteItem = {
      nombre: tipo === 'A_ELECCION' ? 'Bebidas a elección' : tipo === 'FIJO' ? 'Complemento fijo' : 'Una de estas opciones',
      tipoParte: tipo,
      cantidad: tipo === 'A_ELECCION' ? 2 : 1,
      categorias: tipo === 'A_ELECCION' ? [listaCategorias[0]?.nombre || 'Cafetería'] : [],
      productos: [],
      opciones: tipo === 'OPCIONES' ? [{ nombre: 'Opción 1', items: [] }] : undefined,
    };
    setPartes((prev) => [...prev, nuevaParte]);
    setParteAbiertaIndex(partes.length);
    setMensajeError('');
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
    setMensajeError('');
  };

  const toggleDia = (d: string) => {
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const manejarSubidaFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void subidaFoto.ejecutar(async () => {
      const res = await ofertasApi.subirFoto(file);
      setFotoUrl(res.url);
      setFotoArchivoId(res.id);
    });
  };

  const confirmarQuitar = () => {
    setFotoUrl(null);
    setFotoArchivoId(null);
    setConfirmarQuitarFoto(false);
  };

  // Cálculo de suma de precios individuales y ahorro
  const sumaIndividuales = useMemo(() => {
    return calcularSumaPreciosSueltos(partes, productosDisponibles);
  }, [partes, productosDisponibles]);

  const precioBaseCombo = Number(tamanos[0]?.precio) || 0;
  const ahorroCalculado = sumaIndividuales > 0 && precioBaseCombo > 0 ? sumaIndividuales - precioBaseCombo : 0;
  const porcentajeAhorro = sumaIndividuales > 0 && ahorroCalculado > 0 ? Math.round((ahorroCalculado / sumaIndividuales) * 100) : 0;
  const esMasCaroQueSueltos = sumaIndividuales > 0 && precioBaseCombo > sumaIndividuales;

  // Letra inicial para vista cuando no hay foto
  const letraInicial = (nombre.trim()[0] || 'C').toUpperCase();

  // VALIDACIÓN POR PASO
  const validarPasoActual = (pasoAValidar: number): boolean => {
    setMensajeError('');
    if (pasoAValidar === 1) {
      if (!nombre.trim()) {
        setMensajeError('Escribe el nombre del combo.');
        return false;
      }
      return true;
    }

    if (pasoAValidar === 2) {
      if (partes.length === 0) {
        setMensajeError('Agrega al menos una parte al combo.');
        return false;
      }
      for (let i = 0; i < partes.length; i++) {
        const p = partes[i];
        if (!p.nombre || !p.nombre.trim()) {
          setMensajeError(`La parte ${i + 1} debe tener un nombre.`);
          return false;
        }
        const tipoP = p.tipoParte || p.tipo || 'A_ELECCION';
        if (tipoP === 'FIJO') {
          const prods = p.productos || [];
          if (prods.length === 0) {
            setMensajeError(`La parte "${p.nombre}" debe tener al menos un producto seleccionado.`);
            return false;
          }
        } else if (tipoP === 'OPCIONES') {
          const opcs = p.opciones || [];
          if (opcs.length === 0) {
            setMensajeError(`La parte "${p.nombre}" debe tener al menos una opción configurada.`);
            return false;
          }
        } else {
          // A_ELECCION
          const cats = p.categorias || [];
          const prods = p.productos || [];
          if (cats.length === 0 && prods.length === 0) {
            setMensajeError(`La parte "${p.nombre}" debe tener al menos una categoría o producto seleccionado.`);
            return false;
          }
        }
      }
      return true;
    }

    if (pasoAValidar === 3) {
      if (tamanos.length === 0 || tamanos.some((t) => !t.tamanoNombre.trim() || !(Number(t.precio) > 0))) {
        setMensajeError('Cada tamaño debe tener un nombre y un precio mayor a 0.');
        return false;
      }
      if ((horaDesde && !horaHasta) || (!horaDesde && horaHasta)) {
        setMensajeError('Escribe las dos horas (desde y hasta) o déjalas vacías.');
        return false;
      }
      if (horaDesde && horaHasta && horaDesde >= horaHasta) {
        setMensajeError('La hora de inicio debe ser antes de la hora final.');
        return false;
      }
      if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
        setMensajeError('La fecha de inicio no puede ser después de la final.');
        return false;
      }
      return true;
    }

    return true;
  };

  const irSiguientePaso = () => {
    if (validarPasoActual(paso)) {
      if (paso < 4) {
        setPaso((prev) => (prev + 1) as any);
      }
    }
  };

  const irPasoAnterior = () => {
    setMensajeError('');
    if (paso > 1) {
      setPaso((prev) => (prev - 1) as any);
    }
  };

  const ejecutarGuardar = async () => {
    setConfirmarGuardar(false);
    if (!canales.carta && !canales.local && !canales.bot) {
      setMensajeError(ERROR_SIN_CANALES);
      return;
    }
    setGuardando(true);
    setMensajeError('');
    try {
      const diasNum = dias.map((code) => {
        const idx = DIAS.findIndex((x) => x[0] === code);
        return idx + 1;
      });

      const catObj = listaCategorias.find((c) => c.id === categoriaId);

      const payload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        tipo: 'COMBO',
        aplicaA: 'TODA_LA_CARTA',
        alcanceCategoriaId: categoriaId || undefined,
        categoriaId: categoriaId || undefined,
        categoriaNombre: catObj?.nombre || undefined,
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
        canales: canalesDesdeEstado(canales),
        activo: comboAEditar ? comboAEditar.activo : true,
        ...(comboAEditar ? { visibleCarta } : {}),
        imagenArchivoId: fotoArchivoId,
        tamanos: tamanos.map((t) => ({
          tamanoNombre: t.tamanoNombre.trim(),
          precio: Number(t.precio),
        })),
        combosPrecios: tamanos.map((t) => ({
          tamanoNombre: t.tamanoNombre.trim(),
          precio: Number(t.precio),
        })),
        partes: partes.map((p, idx) => ({
          nombre: (p.nombre ?? '').trim(),
          tipo: (p.tipoParte === 'OPCIONES' || p.tipoParte === 'UNA_DE' ? 'A_ELECCION' : p.tipoParte || p.tipo || 'A_ELECCION') as any,
          tipoParte: p.tipoParte,
          cantidad: p.cantidad || 1,
          categorias: (p.categorias || []).map((c: any) => String(c)),
          productos: (p.productos || []).map((pr: any) => String(typeof pr === 'object' ? pr.productoId || pr.id : pr)),
          alternativas: (p.alternativas || []).map((a) => ({ productoId: String(a.id), cantidad: a.cantidad || 1 })),
          tamanoId: p.tamanoId || null,
          orden: idx + 1,
        })),
        combosPartes: partes.map((p, idx) => ({
          nombre: (p.nombre ?? '').trim(),
          tipo: (p.tipoParte === 'OPCIONES' || p.tipoParte === 'UNA_DE' ? 'A_ELECCION' : p.tipoParte || p.tipo || 'A_ELECCION') as any,
          tipoParte: p.tipoParte,
          cantidad: p.cantidad || 1,
          categorias: (p.categorias || []).map((c: any) => String(c)),
          productos: (p.productos || []).map((pr: any) => String(typeof pr === 'object' ? pr.productoId || pr.id : pr)),
          alternativas: (p.alternativas || []).map((a) => ({ productoId: String(a.id), cantidad: a.cantidad || 1 })),
          tamanoId: p.tamanoId || null,
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

  // Oferta armada en vivo para PrevisualizacionCarta
  const ofertaEnVivo: Partial<OfertaItem> = {
    id: comboAEditar?.id || 'nuevo-combo',
    nombre: nombre || 'Nuevo combo',
    descripcion,
    tipo: 'COMBO',
    imagenUrl: fotoUrl,
    imagenArchivoId: fotoArchivoId,
    alcanceCategoriaId: categoriaId,
    categoriaNombre: listaCategorias.find((c) => c.id === categoriaId)?.nombre,
    combosPrecio: tamanos,
    combosPrecios: tamanos,
    combosParte: partes,
    combosPartes: partes,
    dias: dias.map((code) => DIAS.findIndex((x) => x[0] === code) + 1),
    horaDesde: horaDesde || null,
    horaHasta: horaHasta || null,
    fechaDesde: fechaDesde || null,
    fechaHasta: fechaHasta || null,
    canales: canalesDesdeEstado(canales),
    activo: true,
  };

  if (!abierto) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Fondo oscuro clickeable */}
      <div
        onClick={onCerrar}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(11, 44, 62, 0.55)',
          zIndex: 60,
        }}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={comboAEditar ? 'Editar combo' : 'Constructor de combos'}
        tabIndex={-1}
        style={{
          position: 'relative',
          zIndex: 65,
          width: 'min(980px, calc(100% - 24px))',
          maxHeight: 'min(860px, calc(100% - 24px))',
          backgroundColor: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
      >
        {/* Cabecera del asistente */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid var(--cp-line)', paddingBottom: '12px' }}>
          <div>
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
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              Crea o edita combos por pasos con previsualización en vivo para la carta virtual
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar constructor de combos"
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Indicador de progreso por pasos */}
        <nav
          aria-label="Progreso del asistente"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--cp-white)',
            borderRadius: '14px',
            padding: '10px 14px',
            border: '1px solid var(--cp-line)',
            flexWrap: 'wrap',
          }}
        >
          {[
            { num: 1, titulo: '1. Nombre y categoría' },
            { num: 2, titulo: '2. Qué lleva' },
            { num: 3, titulo: '3. Cuánto vale' },
            { num: 4, titulo: '4. Visualización' },
          ].map((st) => {
            const esActivo = paso === st.num;
            const esCompletado = paso > st.num;
            return (
              <button
                key={st.num}
                type="button"
                onClick={() => {
                  if (st.num < paso || validarPasoActual(paso)) {
                    setPaso(st.num as any);
                  }
                }}
                aria-current={esActivo ? 'step' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'transparent',
                  border: 0,
                  padding: '6px 10px',
                  borderRadius: '8px',
                  backgroundColor: esActivo ? 'var(--cp-sand)' : 'transparent',
                  color: esActivo ? 'var(--cp-navy)' : esCompletado ? '#2E7D32' : 'var(--cp-soft)',
                  fontWeight: esActivo ? 800 : 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '12px',
                    backgroundColor: esActivo ? 'var(--cp-navy)' : esCompletado ? '#2E7D32' : 'var(--cp-line)',
                    color: esActivo || esCompletado ? '#fff' : 'var(--cp-navy)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}
                >
                  {esCompletado ? '✓' : st.num}
                </span>
                <span>{st.titulo}</span>
              </button>
            );
          })}
        </nav>

        {/* Mensaje de error / advertencia de validación */}
        {mensajeError && (
          <div
            role="alert"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--cp-rust) 15%, var(--cp-cream))',
              border: '1.5px solid var(--cp-rust)',
              borderRadius: '12px',
              padding: '10px 14px',
              color: 'var(--cp-rust)',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            {mensajeError}
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 1: NOMBRE Y CATEGORÍA                                    */}
        {/* ============================================================== */}
        {paso === 1 && (
          <div
            data-testid="paso-1-combo"
            style={{
              backgroundColor: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--cp-navy)' }}>
              Paso 1 de 4: Nombre y categoría de la carta
            </div>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)', marginTop: '-8px' }}>
              Define cómo se llamará el combo, en qué categoría de la carta vivirá y su imagen ilustrativa.
            </div>

            {/* Nombre del combo */}
            <div>
              <label htmlFor="combo-nombre" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Nombre del combo *
              </label>
              <input
                id="combo-nombre"
                type="text"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  setMensajeError('');
                }}
                placeholder="Ej.: Dúo para compartir, Combo Desayuno Criollo"
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

            {/* Categoría donde vive en la carta */}
            <div>
              <label htmlFor="combo-categoria" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Categoría de la carta donde vive *
              </label>
              <select
                id="combo-categoria"
                value={categoriaId}
                onChange={(e) => {
                  setCategoriaId(e.target.value);
                  setMensajeError('');
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  backgroundColor: 'var(--cp-white)',
                  padding: '0 12px',
                  fontSize: '14px',
                  color: 'var(--cp-navy)',
                }}
              >
                {listaCategorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '12px', color: 'var(--cp-soft)', display: 'block', marginTop: '4px' }}>
                Por defecto se ubica en «COMBOS». Puedes asignarlo a cualquier otra sección de tu carta virtual.
              </span>
            </div>

            {/* Descripción corta */}
            <div>
              <label htmlFor="combo-descripcion" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Descripción corta (opcional)
              </label>
              <textarea
                id="combo-descripcion"
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej.: Incluye 2 bebidas medianas a elección y 1 porción de waffles artesanales."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  backgroundColor: 'var(--cp-white)',
                  padding: '8px 12px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Foto opcional */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>Foto de la oferta (opcional)</div>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                {fotoUrl ? (
                  <div
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: '1.5px solid var(--cp-line)',
                      position: 'relative',
                    }}
                  >
                    <img src={fotoUrl} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--cp-gold)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: '32px',
                      color: 'var(--cp-navy)',
                      border: '1.5px solid var(--cp-line)',
                    }}
                  >
                    {letraInicial}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      minHeight: '38px',
                      padding: '0 14px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-navy)',
                      backgroundColor: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    {subidaFoto.subiendo ? 'Subiendo imagen…' : fotoUrl ? 'Cambiar foto' : 'Subir foto (WebP / JPG)'}
                    <input type="file" accept="image/*" onChange={manejarSubidaFoto} disabled={subidaFoto.subiendo} style={{ display: 'none' }} />
                  </label>
                  <IndicadorSubida estado={subidaFoto.estado} error={subidaFoto.error} onReintentar={subidaFoto.reintentar} />
                  {fotoUrl && (
                    <button
                      type="button"
                      onClick={() => setConfirmarQuitarFoto(true)}
                      style={{
                        alignSelf: 'flex-start',
                        minHeight: '32px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: 0,
                        backgroundColor: 'transparent',
                        color: 'var(--cp-rust)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Quitar foto
                    </button>
                  )}
                  <span style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
                    Si no subes foto, la carta mostrará la letra inicial sobre fondo dorado de la marca.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 2: QUÉ LLEVA (PARTES DEL COMBO)                           */}
        {/* ============================================================== */}
        {paso === 2 && (
          <div
            data-testid="paso-2-combo"
            style={{
              backgroundColor: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--cp-navy)' }}>
              Paso 2 de 4: ¿Qué lleva el combo?
            </div>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)', marginTop: '-8px' }}>
              Arma las partes del combo con lenguaje claro. Al venderse, cada producto se descuenta individualmente de stock. Del combo se puede comprar cada producto suelto; vendido suelto sí suma puntos.
            </div>

            {/* Guía didáctica con ejemplos escritos */}
            <div
              style={{
                backgroundColor: 'var(--cp-sand)',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '13px',
                lineHeight: '18px',
                color: 'var(--cp-navy)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ fontWeight: 800 }}>Elige cómo se armará cada parte:</div>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                <li><strong>2 bebidas a elección:</strong> el cliente escoge entre las categorías seleccionadas (ej. Frappes, Iced o Calientes).</li>
                <li><strong>1 complemento fijo:</strong> un producto específico e invariable (ej. 1 Croissant de Jamón y Queso).</li>
                <li><strong>Una de estas opciones:</strong> el cliente escoge una alternativa armada (ej. porción de torta o dona artesanal).</li>
              </ul>
            </div>

            {/* Lista de partes agregadas */}
            {partes.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px',
                  backgroundColor: 'var(--cp-cream)',
                  borderRadius: '12px',
                  border: '1.5px dashed var(--cp-line)',
                  color: 'var(--cp-soft)',
                  fontSize: '14px',
                }}
              >
                Todavía no has agregado partes a este combo. Usa los botones de abajo para agregar la primera parte.
              </div>
            ) : (
              partes.map((sl, idx) => {
                const isOpen = parteAbiertaIndex === idx;
                const tipoParte = sl.tipoParte || sl.tipo || 'A_ELECCION';

                return (
                  <div
                    key={idx}
                    style={{
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      backgroundColor: 'var(--cp-white)',
                    }}
                  >
                    {/* Barra cabecera de la parte */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 12px',
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
                          {sl.nombre || 'Parte sin nombre'} {isOpen ? '▲' : '▼'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--cp-soft)', lineHeight: '16px' }}>
                          {tipoParte === 'A_ELECCION'
                            ? `${sl.cantidad} a elección de (${(sl.categorias || []).join(', ') || 'sin categoría'})`
                            : tipoParte === 'FIJO'
                            ? `${sl.cantidad} × producto fijo (${(sl.productos || []).length} seleccionado)`
                            : `1 de ${(sl.opciones || []).length} opciones`}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => moverParte(idx, -1)}
                        aria-label="Subir orden"
                        title="Subir"
                        disabled={idx === 0}
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '17px',
                          border: '1.5px solid var(--cp-navy)',
                          backgroundColor: 'transparent',
                          fontWeight: 800,
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          opacity: idx === 0 ? 0.4 : 1,
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moverParte(idx, 1)}
                        aria-label="Bajar orden"
                        title="Bajar"
                        disabled={idx === partes.length - 1}
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '17px',
                          border: '1.5px solid var(--cp-navy)',
                          backgroundColor: 'transparent',
                          fontWeight: 800,
                          cursor: idx === partes.length - 1 ? 'not-allowed' : 'pointer',
                          opacity: idx === partes.length - 1 ? 0.4 : 1,
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => quitarParte(idx)}
                        aria-label="Quitar esta parte"
                        title="Quitar"
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

                    {/* Detalle expandido de la parte */}
                    {isOpen && (
                      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div style={{ flex: '1 1 200px' }}>
                            <label style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                              Nombre de la parte
                            </label>
                            <input
                              type="text"
                              value={sl.nombre}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPartes((prev) => prev.map((p, i) => (i === idx ? { ...p, nombre: val } : p)));
                              }}
                              placeholder="Ej.: 2 bebidas a elección, 1 complemento"
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                minHeight: '40px',
                                borderRadius: '8px',
                                border: '1.5px solid var(--cp-line)',
                                padding: '0 10px',
                                fontSize: '14px',
                              }}
                            />
                          </div>

                          <div style={{ width: '120px' }}>
                            <label style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                              Cantidad
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={sl.cantidad || 1}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                setPartes((prev) => prev.map((p, i) => (i === idx ? { ...p, cantidad: val } : p)));
                              }}
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                minHeight: '40px',
                                borderRadius: '8px',
                                border: '1.5px solid var(--cp-line)',
                                padding: '0 10px',
                                fontSize: '14px',
                              }}
                            />
                          </div>
                        </div>

                        {/* Configuración según tipo */}
                        {tipoParte === 'A_ELECCION' && (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                              Categorías donde el cliente puede elegir:
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {listaCategorias.map((cat) => {
                                const seleccionada = (sl.categorias || []).includes(cat.nombre);
                                return (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => toggleCategoriaEnParte(idx, cat.nombre)}
                                    aria-pressed={seleccionada}
                                    style={{
                                      minHeight: '34px',
                                      padding: '0 12px',
                                      borderRadius: '9999px',
                                      border: '1.5px solid var(--cp-navy)',
                                      backgroundColor: seleccionada ? 'var(--cp-navy)' : 'transparent',
                                      color: seleccionada ? 'var(--cp-cream)' : 'var(--cp-navy)',
                                      fontWeight: 700,
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {seleccionada ? '✓ ' : '+ '}
                                    {cat.nombre}
                                  </button>
                                );
                              })}
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--cp-soft)', display: 'block', marginTop: '6px' }}>
                              Ejemplo: si marcas Frappes e Iced, el cliente podrá elegir {sl.cantidad} productos de esas categorías.
                            </span>
                          </div>
                        )}

                        {tipoParte === 'FIJO' && (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                              Producto fijo del combo:
                            </div>
                            <select
                              value={sl.productos?.[0] ? String(typeof sl.productos[0] === 'object' ? sl.productos[0].id || sl.productos[0].productoId : sl.productos[0]) : ''}
                              onChange={(e) => {
                                const prodId = e.target.value;
                                setPartes((prev) =>
                                  prev.map((p, i) =>
                                    i === idx
                                      ? { ...p, productos: prodId ? [prodId] : [], tamanoId: null, alternativas: (p.alternativas || []).filter((a) => String(a.id) !== prodId) }
                                      : p,
                                  ),
                                );
                              }}
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                minHeight: '40px',
                                borderRadius: '8px',
                                border: '1.5px solid var(--cp-line)',
                                padding: '0 10px',
                                fontSize: '14px',
                              }}
                            >
                              <option value="">Selecciona un producto del catálogo...</option>
                              {productosDisponibles.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nombre} {p.precio ? `(s/ ${p.precio.toFixed(2)})` : ''}
                                </option>
                              ))}
                            </select>
                            <span style={{ fontSize: '12px', color: 'var(--cp-soft)', display: 'block', marginTop: '6px' }}>
                              Ejemplo: Este producto vendrá siempre incluido en el combo de manera fija.
                            </span>
                          </div>
                        )}

                        {tipoParte === 'FIJO' && (() => {
                          const prodFijo = productosDisponibles.find((x) => String(x.id) === String(sl.productos?.[0] ?? ''));
                          const tamanosFijo = prodFijo?.tamanos ?? [];
                          if (tamanosFijo.length === 0) return null;
                          return (
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>Tamaño del producto fijo:</div>
                              <select
                                aria-label="Tamaño del producto fijo"
                                value={sl.tamanoId ?? ''}
                                onChange={(e) => {
                                  const valor = e.target.value || null;
                                  setPartes((prev) => prev.map((p, i) => (i === idx ? { ...p, tamanoId: valor } : p)));
                                }}
                                style={{ width: '100%', boxSizing: 'border-box', minHeight: '40px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 10px', fontSize: '14px' }}
                              >
                                <option value="">Sin tamaño</option>
                                {tamanosFijo.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })()}

                        {tipoParte !== 'OPCIONES' && (
                          <AlternativasParte
                            principalId={tipoParte === 'FIJO' ? String(sl.productos?.[0] ?? '') : undefined}
                            alternativas={sl.alternativas || []}
                            productos={productosDisponibles}
                            onCambiar={(alts) => setPartes((prev) => prev.map((p, i) => (i === idx ? { ...p, alternativas: alts } : p)))}
                          />
                        )}

                        {tipoParte === 'OPCIONES' && (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                              Productos de esta opción:
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {productosDisponibles.slice(0, 8).map((p) => {
                                const sel = (sl.productos || []).some((x: any) => String(typeof x === 'object' ? x.id || x.productoId : x) === String(p.id));
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      setPartes((prev) =>
                                        prev.map((item, i) => {
                                          if (i !== idx) return item;
                                          const actual = (item.productos || []).map((x: any) => String(typeof x === 'object' ? x.id || x.productoId : x));
                                          const next = actual.includes(String(p.id))
                                            ? actual.filter((x) => x !== String(p.id))
                                            : [...actual, String(p.id)];
                                          return { ...item, productos: next };
                                        }),
                                      );
                                    }}
                                    style={{
                                      minHeight: '32px',
                                      padding: '0 10px',
                                      borderRadius: '8px',
                                      border: '1.5px solid var(--cp-navy)',
                                      backgroundColor: sel ? 'var(--cp-navy)' : 'transparent',
                                      color: sel ? 'var(--cp-cream)' : 'var(--cp-navy)',
                                      fontSize: '12px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {sel ? '✓ ' : '+ '}
                                    {p.nombre}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Botones para agregar partes */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '8px' }}>
              <button
                type="button"
                onClick={() => agregarParte('A_ELECCION')}
                style={{
                  minHeight: '40px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-navy)',
                  backgroundColor: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                + 2 bebidas a elección
              </button>
              <button
                type="button"
                onClick={() => agregarParte('FIJO')}
                style={{
                  minHeight: '40px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-navy)',
                  backgroundColor: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                + 1 complemento fijo
              </button>
              <button
                type="button"
                onClick={() => agregarParte('OPCIONES')}
                style={{
                  minHeight: '40px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: '1.5px dashed var(--cp-navy)',
                  backgroundColor: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                + Una de estas opciones
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 3: CUÁNTO VALE (PRECIOS Y CONDICIONES)                   */}
        {/* ============================================================== */}
        {paso === 3 && (
          <div
            data-testid="paso-3-combo"
            style={{
              backgroundColor: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--cp-navy)' }}>
              Paso 3 de 4: ¿Cuánto vale el combo y cuándo aplica?
            </div>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)', marginTop: '-8px' }}>
              Define el precio por tamaño del combo y compara automáticamente con el valor de compra suelta.
            </div>

            {/* Lista de precios por tamaño */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>
                Precios del combo por tamaño *
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
                    placeholder="Tamaño, ej.: Regular, Grande"
                    aria-label="Nombre del tamaño"
                    style={{
                      flex: 2,
                      minHeight: '42px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--cp-line)',
                      padding: '0 12px',
                      fontSize: '14px',
                    }}
                  />
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span style={{ position: 'absolute', left: '10px', top: '12px', fontSize: '14px', fontWeight: 700, color: 'var(--cp-soft)' }}>
                      S/
                    </span>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      value={t.precio || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setTamanos((prev) => prev.map((item, i) => (i === idx ? { ...item, precio: val } : item)));
                      }}
                      placeholder="0.00"
                      aria-label="Precio del tamaño"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: '42px',
                        borderRadius: '8px',
                        border: '1.5px solid var(--cp-line)',
                        padding: '0 12px 0 32px',
                        fontSize: '14px',
                        fontWeight: 700,
                      }}
                    />
                  </div>
                  {tamanos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitarTamano(idx)}
                      aria-label="Quitar tamaño"
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
              ))}

              <button
                type="button"
                onClick={agregarTamano}
                style={{
                  alignSelf: 'flex-start',
                  minHeight: '36px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  border: '1.5px dashed var(--cp-navy)',
                  backgroundColor: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginTop: '4px',
                }}
              >
                + Agregar otro tamaño
              </button>
            </div>

            {/* COMPARACIÓN AUTOMÁTICA CONTRA PRECIOS SUELTOS */}
            <div
              data-testid="caja-ahorro-combo"
              style={{
                backgroundColor: esMasCaroQueSueltos
                  ? 'color-mix(in srgb, #D97706 15%, var(--cp-cream))'
                  : ahorroCalculado > 0
                  ? 'color-mix(in srgb, #2E7D32 15%, var(--cp-cream))'
                  : 'var(--cp-sand)',
                border: `1.5px solid ${esMasCaroQueSueltos ? '#D97706' : ahorroCalculado > 0 ? '#2E7D32' : 'var(--cp-line)'}`,
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                  Suma estimada de productos por separado:
                </span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--cp-navy)' }}>
                  S/ {sumaIndividuales.toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                  Precio del combo ({tamanos[0]?.tamanoNombre || 'Regular'}):
                </span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cp-rust)' }}>
                  S/ {precioBaseCombo.toFixed(2)}
                </span>
              </div>

              {/* Mensaje de ahorro o aviso de combo caro */}
              {esMasCaroQueSueltos ? (
                <div
                  data-testid="aviso-combo-caro"
                  style={{
                    marginTop: '6px',
                    padding: '8px 10px',
                    backgroundColor: '#FEF3C7',
                    borderRadius: '8px',
                    color: '#92400E',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  Aviso: el combo (S/ {precioBaseCombo.toFixed(2)}) sale más caro que comprar por separado (S/ {sumaIndividuales.toFixed(2)}).
                </div>
              ) : ahorroCalculado > 0 ? (
                <div
                  data-testid="mensaje-ahorro-combo"
                  style={{
                    marginTop: '6px',
                    padding: '8px 10px',
                    backgroundColor: '#DCFCE7',
                    borderRadius: '8px',
                    color: '#166534',
                    fontWeight: 800,
                    fontSize: '13px',
                  }}
                >
                  Ahorro para el cliente: S/ {ahorroCalculado.toFixed(2)} ({porcentajeAhorro} %)
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '4px' }}>
                  El precio coincide con la suma individual de sus partes.
                </div>
              )}
            </div>

            {/* Condiciones opcionales: Días, horarios, canales y fechas */}
            <div style={{ borderTop: '1px solid var(--cp-line)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy)' }}>
                Días de la semana y horarios en que aplica:
              </div>

              {/* Días */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {DIAS.map(([code, full]) => {
                  const on = dias.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleDia(code)}
                      aria-pressed={on}
                      style={{
                        minHeight: '34px',
                        padding: '0 12px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        backgroundColor: on ? 'var(--cp-navy)' : 'transparent',
                        color: on ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {full}
                    </button>
                  );
                })}
              </div>

              {/* Horas */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '130px' }}>
                  <label htmlFor="hora-desde" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                    Hora desde:
                  </label>
                  <input
                    id="hora-desde"
                    type="time"
                    value={horaDesde}
                    onChange={(e) => setHoraDesde(e.target.value)}
                    style={{ width: '100%', minHeight: '38px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '130px' }}>
                  <label htmlFor="hora-hasta" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                    Hora hasta:
                  </label>
                  <input
                    id="hora-hasta"
                    type="time"
                    value={horaHasta}
                    onChange={(e) => setHoraHasta(e.target.value)}
                    style={{ width: '100%', minHeight: '38px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <SelectorCanales id="canal-combo" tipo="COMBO" valor={canales} onChange={setCanales} />
                  {comboAEditar && <SelectorVisibleCarta id="combo-visible-carta" visibleCarta={visibleCarta} onChange={setVisibleCarta} />}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 4: VISUALIZACIÓN Y PREVIEW                               */}
        {/* ============================================================== */}
        {paso === 4 && (
          <div
            data-testid="paso-4-combo"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {/* Resumen arriba */}
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--cp-navy)' }}>
                Resumen del combo
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '13px' }}>
                <div><strong>Nombre:</strong> {nombre}</div>
                <div><strong>Categoría:</strong> {listaCategorias.find((c) => c.id === categoriaId)?.nombre || 'COMBOS'}</div>
                <div><strong>Partes:</strong> {partes.map((p) => `${p.cantidad} × ${p.nombre}`).join(', ')}</div>
                <div><strong>Precio base:</strong> S/ {precioBaseCombo.toFixed(2)}</div>
                {ahorroCalculado > 0 && (
                  <div style={{ color: '#166534', fontWeight: 800 }}>
                    Ahorro cliente: S/ {ahorroCalculado.toFixed(2)} ({porcentajeAhorro} %)
                  </div>
                )}
                {esMasCaroQueSueltos && (
                  <div style={{ color: '#B45309', fontWeight: 800 }}>
                    Aviso: Combo más caro que compras sueltas
                  </div>
                )}
              </div>
            </div>

            {/* Preview interactivo en la carta abajo */}
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '14px',
                padding: '16px',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)', marginBottom: '8px' }}>
                Previsualización en la carta virtual
              </div>
              <PrevisualizacionCarta
                oferta={ofertaEnVivo}
                productosDisponibles={productosDisponibles}
                categoriasDisponibles={listaCategorias}
                vistaInicial="tarjeta"
                dispositivoInicial="pc"
              />
            </div>
          </div>
        )}

        {/* Barra inferior de navegación: Atrás / Siguiente / Guardar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            borderTop: '1.5px solid var(--cp-line)',
            paddingTop: '12px',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={irPasoAnterior}
            disabled={paso === 1}
            style={{
              minHeight: '44px',
              padding: '0 20px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-navy)',
              backgroundColor: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '14px',
              cursor: paso === 1 ? 'not-allowed' : 'pointer',
              opacity: paso === 1 ? 0.3 : 1,
            }}
          >
            ← Atrás
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {paso < 4 ? (
              <button
                type="button"
                onClick={irSiguientePaso}
                data-testid="btn-siguiente-paso"
                style={{
                  minHeight: '44px',
                  padding: '0 24px',
                  borderRadius: '12px',
                  border: 0,
                  backgroundColor: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Siguiente →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmarGuardar(true)}
                disabled={guardando}
                data-testid="btn-guardar-combo"
                style={{
                  minHeight: '44px',
                  padding: '0 28px',
                  borderRadius: '12px',
                  border: 0,
                  backgroundColor: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: guardando ? 'wait' : 'pointer',
                }}
              >
                {guardando ? 'Guardando...' : 'Guardar combo'}
              </button>
            )}
          </div>
        </div>

        {/* Modal de confirmación para quitar foto */}
        <ModalConfirmacion
          abierto={confirmarQuitarFoto}
          titulo="¿Quitar foto del combo?"
          mensaje="La oferta se mostrará con la letra inicial sobre fondo dorado."
          onConfirmar={confirmarQuitar}
          onCancelar={() => setConfirmarQuitarFoto(false)}
        />

        {/* Modal de confirmación para guardar combo */}
        <ModalConfirmacion
          abierto={confirmarGuardar}
          titulo={comboAEditar ? '¿Guardar cambios del combo?' : '¿Guardar nuevo combo?'}
          mensaje={`¿Deseas confirmar y guardar "${nombre}" en la carta virtual?`}
          onConfirmar={ejecutarGuardar}
          onCancelar={() => setConfirmarGuardar(false)}
        />
      </div>
    </div>
  );
}
