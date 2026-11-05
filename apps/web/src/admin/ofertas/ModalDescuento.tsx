import { IndicadorSubida } from '../../comun/IndicadorSubida';
import { useSubidaArchivo } from '../../comun/useSubidaArchivo';
import { CasillaBot, canalesDesdeSelector, opcionesCanal, selectorDesdeCanales } from './canalesPromo';
import { useState, useEffect, useMemo, useRef } from 'react';
import { OfertaItem, ofertasApi } from './ofertasApi';
import { ModalConfirmacion } from './ModalConfirmacion';
import { PrevisualizacionCarta } from './PrevisualizacionCarta';

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

interface ModalDescuentoProps {
  abierto: boolean;
  descuentoAEditar?: OfertaItem | null;
  onCerrar: () => void;
  onGuardar: (datos: any) => Promise<void>;
  productosDisponibles?: Array<{ id: string; nombre: string; categoriaId?: string; categoria?: string; precio?: number; noSumaBeneficios?: boolean }>;
  categoriasDisponibles?: string[];
  categorias?: Array<{ id: string; nombre: string; productos?: any[] }>;
}

export function ModalDescuento({
  abierto,
  descuentoAEditar,
  onCerrar,
  onGuardar,
  productosDisponibles = [],
  categoriasDisponibles = CATEGORIAS_DEF,
  categorias = [],
}: ModalDescuentoProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Paso del asistente (1 a 4)
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);

  // Paso 1: Nombre, foto y a qué aplica
  const [nombre, setNombre] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoArchivoId, setFotoArchivoId] = useState<string | null>(null);
  const subidaFoto = useSubidaArchivo();
  const [confirmarQuitarFoto, setConfirmarQuitarFoto] = useState(false);
  const [aplica, setAplica] = useState<'toda' | 'cat' | 'prod'>('toda');
  const [categoria, setCategoria] = useState('');
  const [producto, setProducto] = useState('');
  const [productoBusqueda, setProductoBusqueda] = useState('');
  const [productoComboAbierto, setProductoComboAbierto] = useState(false);

  // Paso 2: Condiciones
  const [dias, setDias] = useState<string[]>([]);
  const [horaDesde, setHoraDesde] = useState('');
  const [horaHasta, setHoraHasta] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [canal, setCanal] = useState('todos');
  const [valeBot, setValeBot] = useState(false);
  const [mostrarEnSaludo, setMostrarEnSaludo] = useState(false);
  const [soloPrimeraCompra, setSoloPrimeraCompra] = useState(false);
  const [minima, setMinima] = useState('');

  // Paso 3: Beneficio
  const [tipo, setTipo] = useState<'pct' | 'monto'>('pct');
  const [valor, setValor] = useState('');

  // Control y avisos
  const [avisoValor, setAvisoValor] = useState('');
  const [avisoMinima, setAvisoMinima] = useState('');
  const [mostrarAyudaValor, setMostrarAyudaValor] = useState(false);
  const [mostrarAyudaMinima, setMostrarAyudaMinima] = useState(false);
  const [mensajeError, setMensajeError] = useState('');
  const [confirmarGuardar, setConfirmarGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const listaCategoriasNombres = useMemo(() => {
    if (categorias && categorias.length > 0) {
      return categorias.map((c) => c.nombre);
    }
    return categoriasDisponibles;
  }, [categorias, categoriasDisponibles]);

  useEffect(() => {
    if (!abierto) return;

    if (descuentoAEditar) {
      setNombre(descuentoAEditar.nombre || '');
      setFotoUrl(descuentoAEditar.imagenUrl || null);
      setFotoArchivoId(descuentoAEditar.imagenArchivoId || null);
      setTipo(descuentoAEditar.descuentoTipo === 'PORCENTAJE' ? 'pct' : 'monto');
      setValor(descuentoAEditar.descuentoValor ? String(descuentoAEditar.descuentoValor) : '');
      setMinima(descuentoAEditar.compraMinima ? String(descuentoAEditar.compraMinima) : '');

      if (descuentoAEditar.alcanceCategoriaId || descuentoAEditar.categoriaNombre) {
        setAplica('cat');
        setCategoria(descuentoAEditar.categoriaNombre || '');
        setProducto('');
      } else if (descuentoAEditar.alcanceProductoId || descuentoAEditar.productoNombre) {
        setAplica('prod');
        setProducto(descuentoAEditar.productoNombre || '');
        setCategoria('');
      } else {
        setAplica('toda');
        setCategoria('');
        setProducto('');
      }

      setDias((descuentoAEditar.dias || descuentoAEditar.diasSemana || []).map((d) => DIAS[d % 7]?.[0] || 'lun'));
      setHoraDesde(descuentoAEditar.horaDesde || descuentoAEditar.horaInicio || '');
      setHoraHasta(descuentoAEditar.horaHasta || descuentoAEditar.horaFin || '');
      const fDesde = descuentoAEditar.fechaDesde || descuentoAEditar.fechaInicio;
      const fHasta = descuentoAEditar.fechaHasta || descuentoAEditar.fechaFin;
      setFechaDesde(fDesde ? fDesde.slice(0, 10) : '');
      setFechaHasta(fHasta ? fHasta.slice(0, 10) : '');
      { const sel = selectorDesdeCanales(descuentoAEditar.canales); setCanal(sel.canal); setValeBot(sel.valeBot); }
      setMostrarEnSaludo(Boolean(descuentoAEditar.mostrarEnSaludoBot));
      setSoloPrimeraCompra(Boolean(descuentoAEditar.soloPrimeraCompra));
      setPaso(1);
      setMensajeError('');
      setProductoComboAbierto(false);
      setProductoBusqueda('');
    } else {
      setNombre('');
      setFotoUrl(null);
      setFotoArchivoId(null);
      setTipo('pct');
      setValor('10');
      setMinima('');
      setAplica('toda');
      setCategoria(listaCategoriasNombres[0] || '');
      setProducto('');
      setDias([]);
      setHoraDesde('');
      setHoraHasta('');
      setFechaDesde('');
      setFechaHasta('');
      setCanal('todos');
      setValeBot(false);
      setMostrarEnSaludo(false);
      setSoloPrimeraCompra(false);
      setPaso(1);
      setMensajeError('');
      setProductoComboAbierto(false);
      setProductoBusqueda('');
    }
  }, [descuentoAEditar, abierto, listaCategoriasNombres]);

  // Accesibilidad: auto-focus y Escape
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

  const prodsFiltrados = productosDisponibles.filter((p) =>
    !productoBusqueda.trim() || p.nombre.toLowerCase().includes(productoBusqueda.toLowerCase()),
  );

  // CÁLCULO DEL EJEMPLO DIDÁCTICO CON PRODUCTOS REALES
  const ejemploCalculado = useMemo(() => {
    let prodEjemplo = null;
    if (aplica === 'prod' && producto) {
      prodEjemplo = productosDisponibles.find((p) => p.nombre.toLowerCase() === producto.toLowerCase());
    } else if (aplica === 'cat' && categoria) {
      prodEjemplo = productosDisponibles.find((p) => p.categoria && p.categoria.toLowerCase() === categoria.toLowerCase());
    }
    if (!prodEjemplo && productosDisponibles.length > 0) {
      prodEjemplo = productosDisponibles[0];
    }

    const nombreProd = prodEjemplo?.nombre || 'Iced Coffee';
    const precioProd = prodEjemplo?.precio || 9;
    const valNum = parseFloat(valor.replace(',', '.')) || 0;
    const cMinima = parseFloat(minima) || 0;

    let totalBase = precioProd;
    let cantidadEjemplo = 1;

    if (cMinima > 0 && precioProd > 0) {
      cantidadEjemplo = Math.ceil(cMinima / precioProd);
      totalBase = cantidadEjemplo * precioProd;
    }

    let ahorro = 0;
    let precioFinal = totalBase;

    if (tipo === 'pct') {
      ahorro = (totalBase * valNum) / 100;
      precioFinal = Math.max(0, totalBase - ahorro);
    } else {
      ahorro = Math.min(valNum, totalBase);
      precioFinal = Math.max(0, totalBase - ahorro);
    }

    const descTexto = tipo === 'pct' ? `${valNum} %` : `S/ ${valNum.toFixed(2)}`;

    let texto = '';
    if (cantidadEjemplo > 1) {
      texto = `Si el cliente pide ${cantidadEjemplo} ${nombreProd} de S/ ${precioProd.toFixed(2)} (total S/ ${totalBase.toFixed(2)}, cumple compra mínima de S/ ${cMinima.toFixed(2)}): paga S/ ${precioFinal.toFixed(2)}, ahorra S/ ${ahorro.toFixed(2)} (${descTexto}).`;
    } else {
      texto = `Si el cliente pide 1 ${nombreProd} de S/ ${precioProd.toFixed(2)}: paga S/ ${precioFinal.toFixed(2)}, ahorra S/ ${ahorro.toFixed(2)} (${descTexto}).`;
    }

    return {
      nombreProducto: nombreProd,
      precioUnitario: precioProd,
      totalBase,
      precioFinal,
      ahorro,
      texto,
    };
  }, [aplica, producto, categoria, productosDisponibles, tipo, valor, minima]);

  const textoDinamicoValor = useMemo(() => {
    const valNum = parseFloat(valor.replace(',', '.')) || 0;
    if (tipo === 'pct') {
      if (valNum <= 0) return 'Ingresa un porcentaje de 1 a 100';
      const ahorro40 = (40 * valNum) / 100;
      const ahorroStr = ahorro40 % 1 === 0 ? ahorro40.toFixed(0) : ahorro40.toFixed(2);
      return `Con ${valNum} %: en una compra de S/ 40 el cliente ahorra S/ ${ahorroStr}`;
    } else {
      if (valNum <= 0) return 'Ingresa un monto mayor a 0';
      const ahorroMonto = Math.min(valNum, 40);
      const ahorroStr = ahorroMonto % 1 === 0 ? ahorroMonto.toFixed(0) : ahorroMonto.toFixed(2);
      return `Con S/ ${valNum.toFixed(2)} de descuento: en una compra de S/ 40 el cliente ahorra S/ ${ahorroStr}`;
    }
  }, [tipo, valor]);

  const textoDinamicoMinima = useMemo(() => {
    const minNum = parseFloat(minima.replace(',', '.')) || 0;
    if (minNum > 0) {
      const menor = Math.max(0, minNum - 5);
      const mayor = minNum + 5;
      const minStr = minNum % 1 === 0 ? minNum.toFixed(0) : minNum.toFixed(2);
      const menorStr = menor % 1 === 0 ? menor.toFixed(0) : menor.toFixed(2);
      const mayorStr = mayor % 1 === 0 ? mayor.toFixed(0) : mayor.toFixed(2);
      return `Compra minima S/ ${minStr}: una compra de S/ ${menorStr} no recibe descuento, una de S/ ${mayorStr} si`;
    }
    return '';
  }, [minima]);

  const manejarCambioValor = (inputStr: string) => {
    setAvisoValor('');
    setMensajeError('');

    if (!inputStr) {
      setValor('');
      return;
    }

    // Bloquear letras y caracteres negativos: solo números y un punto decimal
    let limpio = inputStr.replace(/,/g, '.').replace(/[^0-9.]/g, '');

    // Evitar múltiples puntos decimales
    const partes = limpio.split('.');
    if (partes.length > 2) {
      limpio = partes[0] + '.' + partes.slice(1).join('');
    }

    // Máximo 2 decimales
    const partesLimpio = limpio.split('.');
    if (partesLimpio.length === 2 && partesLimpio[1].length > 2) {
      limpio = partesLimpio[0] + '.' + partesLimpio[1].slice(0, 2);
    }

    if (tipo === 'pct') {
      if (limpio === '0') {
        setValor('');
        setAvisoValor('El porcentaje va de 1 a 100');
        return;
      }
      const num = parseFloat(limpio);
      if (!isNaN(num)) {
        if (num > 100) {
          setValor('100');
          setAvisoValor('El porcentaje va de 1 a 100');
          return;
        }
      }
    } else {
      if (limpio === '0') {
        setValor('');
        setAvisoValor('El monto debe ser mayor que 0');
        return;
      }
      const num = parseFloat(limpio);
      if (!isNaN(num)) {
        if (num > 9999.99) {
          setValor('9999.99');
          setAvisoValor('El monto no puede superar S/ 9999.99');
          return;
        }
      }
    }

    setValor(limpio);
  };

  const manejarCambioMinima = (inputStr: string) => {
    setAvisoMinima('');
    setMensajeError('');

    if (!inputStr) {
      setMinima('');
      return;
    }

    // Bloquear letras y signo negativo: solo números y un punto
    let limpio = inputStr.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const partes = limpio.split('.');
    if (partes.length > 2) {
      limpio = partes[0] + '.' + partes.slice(1).join('');
    }
    if (partes.length === 2 && partes[1].length > 2) {
      limpio = partes[0] + '.' + partes[1].slice(0, 2);
    }

    setMinima(limpio);
  };

  // Validación por paso
  const validarPasoActual = (pasoAValidar: number): boolean => {
    setMensajeError('');
    if (pasoAValidar === 1) {
      if (!nombre.trim()) {
        setMensajeError('Escribe el nombre del descuento.');
        return false;
      }
      if (aplica === 'cat' && !categoria) {
        setMensajeError('Elige la categoría.');
        return false;
      }
      if (aplica === 'prod' && !producto) {
        setMensajeError('Elige el producto.');
        return false;
      }
      return true;
    }

    if (pasoAValidar === 2) {
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
      const minNum = parseFloat(minima.replace(',', '.'));
      if (!isNaN(minNum) && minNum < 0) {
        setMensajeError('La compra mínima no puede ser negativa.');
        return false;
      }
      return true;
    }

    if (pasoAValidar === 3) {
      const valNum = parseFloat(valor.replace(',', '.'));
      if (isNaN(valNum) || valNum <= 0) {
        setMensajeError(tipo === 'pct' ? 'El porcentaje va de 1 a 100.' : 'El monto debe ser mayor que 0.');
        return false;
      }
      if (tipo === 'pct' && (valNum < 1 || valNum > 100)) {
        setMensajeError('El porcentaje va de 1 a 100.');
        return false;
      }
      if (tipo === 'monto' && valNum > 9999.99) {
        setMensajeError('El monto no puede superar S/ 9999.99.');
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
    setGuardando(true);
    setMensajeError('');
    try {
      const diasNum = dias.map((code) => {
        const idx = DIAS.findIndex((x) => x[0] === code);
        return idx + 1;
      });
      const valNum = parseFloat(valor.replace(',', '.'));
      const prodObj = productosDisponibles.find((p) => p.nombre.toLowerCase() === producto.toLowerCase());

      const payload = {
        nombre: nombre.trim(),
        tipo: 'DESCUENTO',
        aplicaA: aplica === 'toda' ? 'TODA_LA_CARTA' : aplica === 'cat' ? 'CATEGORIA' : 'PRODUCTO',
        categoriaNombre: aplica === 'cat' ? categoria : undefined,
        productoId: aplica === 'prod' && prodObj ? prodObj.id : undefined,
        productoNombre: aplica === 'prod' ? producto : undefined,
        descuentoTipo: tipo === 'pct' ? 'PORCENTAJE' : 'MONTO',
        descuentoValor: valNum,
        compraMinima: parseFloat(minima) || 0,
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
        // La primera compra solo se canjea en la carta web
        canales: soloPrimeraCompra ? ['CARTA'] : canalesDesdeSelector(canal, valeBot),
        mostrarEnSaludoBot: mostrarEnSaludo,
        soloPrimeraCompra,
        imagenArchivoId: fotoArchivoId,
      };

      await onGuardar(payload);
      onCerrar();
    } catch (err: any) {
      setMensajeError(err.response?.data?.mensaje || err.message || 'Error al guardar el descuento.');
    } finally {
      setGuardando(false);
    }
  };

  const letraInicial = (nombre.trim()[0] || 'D').toUpperCase();

  const ofertaEnVivo: Partial<OfertaItem> = {
    id: descuentoAEditar?.id || 'nuevo-descuento',
    nombre: nombre || 'Descuento automático',
    tipo: 'DESCUENTO',
    descuentoTipo: tipo === 'pct' ? 'PORCENTAJE' : 'MONTO',
    descuentoValor: parseFloat(valor.replace(',', '.')) || 0,
    compraMinima: parseFloat(minima) || 0,
    aplicaA: aplica === 'toda' ? 'TODA_LA_CARTA' : aplica === 'cat' ? 'CATEGORIA' : 'PRODUCTO',
    categoriaNombre: aplica === 'cat' ? categoria : undefined,
    productoNombre: aplica === 'prod' ? producto : undefined,
    imagenUrl: fotoUrl,
    imagenArchivoId: fotoArchivoId,
    dias: dias.map((code) => DIAS.findIndex((x) => x[0] === code) + 1),
    horaDesde: horaDesde || null,
    horaHasta: horaHasta || null,
    fechaDesde: fechaDesde || null,
    fechaHasta: fechaHasta || null,
    canales: canalesDesdeSelector(canal, valeBot),
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
        aria-label={descuentoAEditar ? 'Editar descuento' : 'Nuevo descuento automático'}
        tabIndex={-1}
        style={{
          position: 'relative',
          zIndex: 65,
          width: 'min(920px, calc(100% - 24px))',
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
        {/* Cabecera */}
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
              {descuentoAEditar ? 'Editar descuento' : 'Nuevo descuento automático'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              Asistente por pasos para configurar descuentos por porcentaje o monto
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar modal"
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

        {/* Progreso por pasos */}
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
            { num: 1, titulo: '1. Nombre y a qué aplica' },
            { num: 2, titulo: '2. Condiciones' },
            { num: 3, titulo: '3. Beneficio' },
            { num: 4, titulo: '4. Vista previa y ejemplo' },
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

        {/* Error de validación */}
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
        {/* PASO 1: NOMBRE Y A QUÉ APLICA                                 */}
        {/* ============================================================== */}
        {paso === 1 && (
          <div
            data-testid="paso-1-descuento"
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
              Paso 1 de 4: Nombre y a qué aplica
            </div>

            <div>
              <label htmlFor="desc-nombre" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Nombre del descuento *
              </label>
              <input
                id="desc-nombre"
                type="text"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  setMensajeError('');
                }}
                placeholder="Ejemplo: Happy hour de la tarde, 15% en Waffles"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 12px',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* Foto opcional */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>Foto del descuento (opcional)</div>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                {fotoUrl ? (
                  <div style={{ width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden' }}>
                    <img src={fotoUrl} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--cp-gold)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '28px',
                      color: 'var(--cp-navy)',
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
                      minHeight: '36px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {subidaFoto.subiendo ? 'Subiendo imagen…' : fotoUrl ? 'Cambiar foto' : 'Subir foto'}
                    <input type="file" accept="image/*" onChange={manejarSubidaFoto} disabled={subidaFoto.subiendo} style={{ display: 'none' }} />
                  </label>
                  <IndicadorSubida estado={subidaFoto.estado} error={subidaFoto.error} onReintentar={subidaFoto.reintentar} />
                  {fotoUrl && (
                    <button
                      type="button"
                      onClick={() => setConfirmarQuitarFoto(true)}
                      style={{ border: 0, background: 'transparent', color: 'var(--cp-rust)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
                    >
                      Quitar foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* A qué aplica */}
            <div style={{ borderTop: '1px solid var(--cp-line)', paddingTop: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>Aplica a</div>
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginBottom: '8px' }}>Los productos con descuento no suman puntos ni se pagan con puntos mientras la promoción esté activa</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setAplica('toda');
                    setMensajeError('');
                  }}
                  style={{
                    minHeight: '44px',
                    padding: '0 14px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: aplica === 'toda' ? 'var(--cp-navy)' : 'transparent',
                    color: aplica === 'toda' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Toda la carta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAplica('cat');
                    setMensajeError('');
                  }}
                  style={{
                    minHeight: '44px',
                    padding: '0 14px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: aplica === 'cat' ? 'var(--cp-navy)' : 'transparent',
                    color: aplica === 'cat' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Una categoría
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAplica('prod');
                    setMensajeError('');
                  }}
                  style={{
                    minHeight: '44px',
                    padding: '0 14px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    backgroundColor: aplica === 'prod' ? 'var(--cp-navy)' : 'transparent',
                    color: aplica === 'prod' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Un producto
                </button>
              </div>

              {aplica === 'cat' && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {listaCategoriasNombres.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setCategoria(cat);
                          setMensajeError('');
                        }}
                        style={{
                          minHeight: '38px',
                          padding: '0 12px',
                          borderRadius: '9999px',
                          border: '1.5px solid var(--cp-navy)',
                          backgroundColor: categoria === cat ? 'var(--cp-navy)' : 'transparent',
                          color: categoria === cat ? 'var(--cp-cream)' : 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {aplica === 'prod' && (
                <div style={{ marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setProductoComboAbierto(!productoComboAbierto)}
                    aria-haspopup="listbox"
                    aria-expanded={productoComboAbierto}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '44px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-navy)',
                      backgroundColor: 'var(--cp-white)',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '13px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{producto ? `PRODUCTO: ${producto}` : 'PRODUCTO: Elige un producto'}</span>
                    <span>{productoComboAbierto ? '▲' : '▼'}</span>
                  </button>

                  {productoComboAbierto && (
                    <div
                      style={{
                        marginTop: '4px',
                        border: '1.5px solid var(--cp-navy)',
                        borderRadius: '10px',
                        backgroundColor: 'var(--cp-white)',
                        padding: '8px',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <input
                        type="search"
                        value={productoBusqueda}
                        onChange={(e) => setProductoBusqueda(e.target.value)}
                        placeholder="Buscar producto..."
                        style={{ width: '100%', boxSizing: 'border-box', minHeight: '36px', borderRadius: '8px', border: '1px solid var(--cp-line)', padding: '0 8px', fontSize: '13px', marginBottom: '4px' }}
                      />
                      {prodsFiltrados.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          role="option"
                          aria-selected={producto === p.nombre}
                          onClick={() => {
                            setProducto(p.nombre);
                            setProductoComboAbierto(false);
                            setMensajeError('');
                          }}
                          style={{
                            textAlign: 'left',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: 0,
                            backgroundColor: producto === p.nombre ? 'var(--cp-sand)' : 'transparent',
                            color: 'var(--cp-navy)',
                            fontWeight: producto === p.nombre ? 800 : 600,
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span>{p.nombre}</span>
                          {p.precio ? <span style={{ opacity: 0.7, fontSize: '12px' }}>s/ {p.precio.toFixed(2)}</span> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 2: CONDICIONES (DÍAS, HORARIO, CANALES, VIGENCIA)        */}
        {/* ============================================================== */}
        {paso === 2 && (
          <div
            data-testid="paso-2-descuento"
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
              Paso 2 de 4: Condiciones y vigencia
            </div>

            {/* Días */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>Días que aplica:</div>
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
            </div>

            {/* Horas */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label htmlFor="desc-h-desde" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                  Hora desde:
                </label>
                <input
                  id="desc-h-desde"
                  type="time"
                  value={horaDesde}
                  onChange={(e) => setHoraDesde(e.target.value)}
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label htmlFor="desc-h-hasta" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                  Hora hasta:
                </label>
                <input
                  id="desc-h-hasta"
                  type="time"
                  value={horaHasta}
                  onChange={(e) => setHoraHasta(e.target.value)}
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
                />
              </div>
            </div>

            {/* Saludo del chat y primera compra */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              <label htmlFor="desc-saludo" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', fontWeight: 600 }}>
                <input
                  id="desc-saludo"
                  type="checkbox"
                  checked={mostrarEnSaludo}
                  onChange={(e) => setMostrarEnSaludo(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span>
                  Mostrar al inicio del chat de WhatsApp
                  <span style={{ display: 'block', fontSize: '11px', fontWeight: 400, color: 'var(--cp-soft)' }}>
                    Cuando el cliente escribe «hola», el bot le ofrece esta promoción para pedir en la carta online (sin costo por mensaje). Solo se muestra una: la de menor orden que esté vigente hoy.
                  </span>
                </span>
              </label>
              <label htmlFor="desc-primera" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', fontWeight: 600 }}>
                <input
                  id="desc-primera"
                  type="checkbox"
                  checked={soloPrimeraCompra}
                  onChange={(e) => setSoloPrimeraCompra(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span>
                  Solo primera compra del cliente (celular con sesión)
                  <span style={{ display: 'block', fontSize: '11px', fontWeight: 400, color: 'var(--cp-soft)' }}>
                    Se aplica solo si el cliente inició sesión en la carta online y su celular nunca tuvo un pedido válido. No aplica a promociones ni combos. Solo en la carta web y como máximo un mes: pon una fecha de fin.
                  </span>
                </span>
              </label>
            </div>

            {/* Canales, Fechas y Compra mínima */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label htmlFor="desc-canal" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                  Canales válidos:
                </label>
                <select
                  id="desc-canal"
                  value={canal}
                  onChange={(e) => setCanal(e.target.value)}
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
                >
                  {opcionesCanal(canal).map((c) => (
                    <option key={c.clave} value={c.clave}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                  <CasillaBot id="desc-canal-bot" checked={valeBot} onChange={setValeBot} bloqueada={canal === 'solo-bot'} />
              </div>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <label htmlFor="desc-minima" style={{ fontSize: '12px', fontWeight: 700 }}>
                    Compra mínima (S/):
                  </label>
                  <button
                    type="button"
                    onClick={() => setMostrarAyudaMinima((prev) => !prev)}
                    aria-label="Ayuda sobre compra mínima"
                    title="Monto mínimo que debe sumar el pedido para que el descuento se active."
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--cp-sand)',
                      border: '1px solid var(--cp-line)',
                      color: 'var(--cp-navy)',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    ?
                  </button>
                </div>
                <input
                  id="desc-minima"
                  type="text"
                  inputMode="decimal"
                  value={minima}
                  onChange={(e) => manejarCambioMinima(e.target.value)}
                  placeholder="0.00 (sin mínimo)"
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
                />
                <div style={{ fontSize: '11px', color: 'var(--cp-soft)', marginTop: '4px', lineHeight: '14px' }}>
                  Opcional. El descuento solo se aplica si la compra llega a este monto. Deja 0 si no hay minimo
                </div>
                {textoDinamicoMinima && (
                  <div
                    data-testid="ejemplo-dinamico-minima"
                    style={{ fontSize: '11px', color: '#2E7D32', fontWeight: 700, marginTop: '3px' }}
                  >
                    {textoDinamicoMinima}
                  </div>
                )}
                {avisoMinima && (
                  <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>
                    {avisoMinima}
                  </div>
                )}
                {mostrarAyudaMinima && (
                  <div style={{ fontSize: '11px', backgroundColor: 'var(--cp-sand)', padding: '6px 8px', borderRadius: '6px', marginTop: '4px', color: 'var(--cp-navy)', lineHeight: '14px' }}>
                    Monto mínimo que debe sumar el pedido para que el descuento se active. Deja 0 si no hay mínimo.
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label htmlFor="desc-f-desde" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                  Fecha inicio (opcional):
                </label>
                <input
                  id="desc-f-desde"
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label htmlFor="desc-f-hasta" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                  Fecha fin (opcional):
                </label>
                <input
                  id="desc-f-hasta"
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  style={{ width: '100%', minHeight: '38px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 3: BENEFICIO (TIPO Y VALOR)                              */}
        {/* ============================================================== */}
        {paso === 3 && (
          <div
            data-testid="paso-3-descuento"
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
              Paso 3 de 4: Beneficio del descuento
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>Tipo de descuento</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTipo('pct');
                      setAvisoValor('');
                      const n = parseFloat(valor);
                      if (!isNaN(n) && n > 100) {
                        setValor('100');
                        setAvisoValor('El porcentaje va de 1 a 100');
                      }
                    }}
                    style={{
                      minHeight: '42px',
                      padding: '0 16px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-navy)',
                      backgroundColor: tipo === 'pct' ? 'var(--cp-navy)' : 'transparent',
                      color: tipo === 'pct' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Porcentaje (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipo('monto');
                      setAvisoValor('');
                      const n = parseFloat(valor);
                      if (!isNaN(n) && n > 9999.99) {
                        setValor('9999.99');
                        setAvisoValor('El monto no puede superar S/ 9999.99');
                      }
                    }}
                    style={{
                      minHeight: '42px',
                      padding: '0 16px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-navy)',
                      backgroundColor: tipo === 'monto' ? 'var(--cp-navy)' : 'transparent',
                      color: tipo === 'monto' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Monto fijo (S/)
                  </button>
                </div>
              </div>

              <div style={{ flex: '1 1 200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <label htmlFor="desc-valor" style={{ fontWeight: 700, fontSize: '13px' }}>
                    Valor del descuento *
                  </label>
                  <button
                    type="button"
                    onClick={() => setMostrarAyudaValor((prev) => !prev)}
                    aria-label="Ayuda sobre valor del descuento"
                    title={tipo === 'pct' ? 'Porcentaje de 1 a 100.' : 'Monto en soles mayor a 0.'}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--cp-sand)',
                      border: '1px solid var(--cp-line)',
                      color: 'var(--cp-navy)',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    ?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="desc-valor"
                    type="text"
                    inputMode="decimal"
                    value={valor}
                    onChange={(e) => manejarCambioValor(e.target.value)}
                    placeholder={tipo === 'pct' ? '15' : '5.00'}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '42px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--cp-line)',
                      padding: '0 32px 0 12px',
                      fontSize: '16px',
                      fontWeight: 800,
                    }}
                  />
                  <span style={{ position: 'absolute', right: '12px', top: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>
                    {tipo === 'pct' ? '%' : 'S/'}
                  </span>
                </div>
                {avisoValor && (
                  <div
                    role="alert"
                    data-testid="aviso-valor-descuento"
                    style={{
                      color: 'var(--cp-rust)',
                      fontSize: '12px',
                      fontWeight: 700,
                      marginTop: '4px',
                    }}
                  >
                    {avisoValor}
                  </div>
                )}
                <div
                  data-testid="texto-dinamico-valor"
                  style={{
                    fontSize: '12px',
                    color: '#2E7D32',
                    fontWeight: 700,
                    marginTop: '4px',
                    lineHeight: '16px',
                  }}
                >
                  {textoDinamicoValor}
                </div>
                {mostrarAyudaValor && (
                  <div style={{ fontSize: '11px', backgroundColor: 'var(--cp-sand)', padding: '6px 8px', borderRadius: '6px', marginTop: '4px', color: 'var(--cp-navy)', lineHeight: '14px' }}>
                    {tipo === 'pct'
                      ? 'Porcentaje que se descuenta del precio regular. Solo admite números del 1 al 100.'
                      : 'Monto fijo en soles que se descuenta del pedido. Debe ser mayor a 0 y hasta 9999.99.'}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--cp-sand)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '13px',
                color: 'var(--cp-navy)',
              }}
            >
              <strong>Beneficio configurado:</strong> Descuento de{' '}
              <strong>{tipo === 'pct' ? `${valor || 0} %` : `S/ ${parseFloat(valor) ? parseFloat(valor).toFixed(2) : '0.00'}`}</strong>{' '}
              {aplica === 'toda' ? 'en toda la carta' : aplica === 'cat' ? `en la categoría ${categoria}` : `en ${producto}`}.
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 4: PREVISUALIZACIÓN Y EJEMPLO CALCULADO                   */}
        {/* ============================================================== */}
        {paso === 4 && (
          <div
            data-testid="paso-4-descuento"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {/* Ejemplo didáctico calculado con productos reales */}
            <div
              data-testid="ejemplo-calculado-descuento"
              style={{
                backgroundColor: '#DCFCE7',
                border: '1.5px solid #2E7D32',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '15px', color: '#166534' }}>
                Ejemplo real calculado para el cliente
              </div>
              <div style={{ fontSize: '14px', lineHeight: '20px', color: '#14532D', fontWeight: 700 }}>
                {ejemploCalculado.texto}
              </div>
              <div
                data-testid="ejemplo-calculado-dinamico-valor"
                style={{ fontSize: '13px', color: '#166534', fontWeight: 700, marginTop: '2px' }}
              >
                {textoDinamicoValor}
              </div>
              {textoDinamicoMinima && (
                <div
                  data-testid="ejemplo-calculado-dinamico-minima"
                  style={{ fontSize: '13px', color: '#166534', fontWeight: 700, marginTop: '2px' }}
                >
                  {textoDinamicoMinima}
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#166534' }}>
                Calculado con los precios reales del catálogo para demostrar exactamente cómo impacta este descuento.
              </div>
            </div>

            {/* Previsualización en carta */}
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '14px',
                padding: '16px',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)', marginBottom: '8px' }}>
                Previsualización en la carta
              </div>
              <PrevisualizacionCarta
                oferta={ofertaEnVivo}
                productosDisponibles={productosDisponibles}
                categoriasDisponibles={categorias}
                vistaInicial="tarjeta"
                dispositivoInicial="pc"
              />
            </div>
          </div>
        )}

        {/* Navegación inferior */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            borderTop: '1.5px solid var(--cp-line)',
            paddingTop: '12px',
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
              data-testid="btn-guardar-descuento"
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
              {guardando ? 'Guardando...' : 'Guardar descuento'}
            </button>
          )}
        </div>

        {/* Confirmación para quitar foto */}
        <ModalConfirmacion
          abierto={confirmarQuitarFoto}
          titulo="¿Quitar foto del descuento?"
          mensaje="El descuento se mostrará con la letra inicial sobre fondo dorado."
          onConfirmar={confirmarQuitar}
          onCancelar={() => setConfirmarQuitarFoto(false)}
        />

        {/* Confirmación para guardar */}
        <ModalConfirmacion
          abierto={confirmarGuardar}
          titulo={descuentoAEditar ? '¿Guardar cambios del descuento?' : '¿Guardar nuevo descuento?'}
          mensaje={`¿Deseas confirmar y guardar "${nombre}" en la carta virtual?`}
          onConfirmar={ejecutarGuardar}
          onCancelar={() => setConfirmarGuardar(false)}
        />
      </div>
    </div>
  );
}
