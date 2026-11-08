import { IndicadorSubida } from '../../comun/IndicadorSubida';
import { useSubidaArchivo } from '../../comun/useSubidaArchivo';
import { CanalesEstado, ERROR_SIN_CANALES, SelectorCanales, SelectorVisibleCarta, canalesDesdeEstado, canalesPorDefecto, estadoDesdeCanales } from './canalesPromo';
import { useState, useEffect, useMemo, useRef } from 'react';
import { OfertaItem, ComboPrecioItem, ComboParteItem, ofertasApi } from './ofertasApi';
import { ModalConfirmacion } from './ModalConfirmacion';
import { ModalConPestanas } from '../../comun/ModalConPestanas';
import { AvisoErrorOferta, ConfirmarSalir, PieOferta, primeraConError, useCambiosSinGuardar, useCierreConConfirmacion } from './modalOfertaComun';
import { PrevisualizacionCarta } from './PrevisualizacionCarta';
import { EditorPartesCombo, ResumenPartesCombo } from './EditorPartesCombo';
import { CategoriaEditor, ProductoEditor, errorDePartes, normalizarPartes, partesParaGuardar, bloquesDe, opcionesDeGrupo, perteneceACategoria, idsProductos, tipoDe } from './partesComboModelo';

import { catalogoApi } from '../catalogo/catalogoApi';
import { mezclarTamanos, tamanosHeredados, tamanosVigentes } from './tamanosCombo';

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
  productosDisponibles?: ProductoEditor[];
  categoriasDisponibles?: string[];
  categorias?: Array<{ id: string; nombre: string; productos?: any[] }>;
}

type ProductoPrecio = { id: string; nombre: string; categoriaId?: string; categoria?: string; precio?: number };

/** Suma de los precios sueltos de las partes. Un complemento a elegir cuenta una vez, con el promedio de sus opciones. */
export function calcularSumaPreciosSueltos(
  partes: ComboParteItem[],
  productos: ProductoPrecio[],
  categorias: CategoriaEditor[] = [],
): number {
  const precioDe = (id: unknown) => Number(productos.find((p) => String(p.id) === String(id))?.precio) || 0;
  // Una categoría puede venir como id o como nombre (combos viejos)
  const delasCategorias = (cats: unknown[]) =>
    productos.filter((p) =>
      cats.some((c) => {
        const t = String(c).toLowerCase();
        return p.categoriaId === String(c) || p.categoria?.toLowerCase() === t || categorias.some((k) => k.id === String(c) && perteneceACategoria(p, k));
      }),
    );
  const sumaParte = (parte: ComboParteItem): number => {
    const cant = parte.cantidad || 1;
    const ids = idsProductos(parte);
    if (tipoDe(parte) === 'FIJO') return ids.reduce((acc, id) => acc + precioDe(id) * cant, 0);
    // Con productos marcados valen solo esos; si no, los de sus categorías (sin los quitados)
    const quitados = parte.productosExcluidos ?? [];
    const candidatos = ids.length > 0 ? ids.map(precioDe) : delasCategorias(parte.categorias ?? []).filter((p) => !quitados.includes(String(p.id))).map((p) => Number(p.precio) || 0);
    const con = candidatos.filter((x) => x > 0);
    return con.length > 0 ? (con.reduce((x, y) => x + y, 0) / con.length) * cant : 0;
  };
  let total = 0;
  for (const bloque of bloquesDe(partes)) {
    if (bloque.tipo === 'COMPLEMENTO') {
      const sumas = opcionesDeGrupo(partes, bloque.grupo).map((o) => o.idxs.reduce((acc, i) => acc + sumaParte(partes[i]), 0)).filter((x) => x > 0);
      if (sumas.length > 0) total += sumas.reduce((x, y) => x + y, 0) / sumas.length;
    } else {
      total += sumaParte(partes[bloque.idxs[0]]);
    }
  }
  return Math.round(total * 100) / 100;
}

const estiloBotonTamano: React.CSSProperties = {
  minHeight: '36px',
  padding: '0 14px',
  borderRadius: '8px',
  border: '1.5px dashed var(--cp-navy)',
  backgroundColor: 'transparent',
  color: 'var(--cp-navy)',
  fontWeight: 700,
  fontSize: '12px',
  cursor: 'pointer',
};

// Referencia estable: un [] nuevo en cada render reiniciaría el formulario sin parar.
const SIN_CATEGORIAS: never[] = [];

export function ModalCombo({
  abierto,
  comboAEditar,
  onCerrar,
  onGuardar,
  productosDisponibles = [],
  categoriasDisponibles = CATEGORIAS_DEF,
  categorias = SIN_CATEGORIAS,
}: ModalComboProps) {
  const [pestana, setPestana] = useState('datos');
  const [verErrores, setVerErrores] = useState(false);

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

  // Para el editor de partes: las categorías con su id real (sin categorías de la carta, el nombre hace de id y el servidor lo resuelve)
  const categoriasEditor: CategoriaEditor[] = useMemo(
    () => (categorias.length > 0 ? listaCategorias : listaCategorias.map((c) => ({ id: c.nombre, nombre: c.nombre }))),
    [categorias, listaCategorias],
  );
  const productosRef = useRef(productosDisponibles);
  productosRef.current = productosDisponibles;

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
          ? preciosLista.map((t) => ({ ...t, precio: Number(t.precio) || 0, activo: true }))
          : [{ tamanoNombre: 'Regular', precio: comboAEditar.descuentoValor || 0 }],
      );

      // Partes
      const partesLista = comboAEditar.combosParte || comboAEditar.combosPartes;
      setPartes(partesLista && partesLista.length > 0 ? normalizarPartes(partesLista, categoriasEditor, productosRef.current) : []);

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
      setPestana('datos');
      setVerErrores(false);
      setMensajeError('');
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
      setPestana('datos');
      setVerErrores(false);
      setMensajeError('');
    }
  }, [comboAEditar, abierto, listaCategorias, categoriasEditor]);

  // Esc cierra primero las confirmaciones abiertas (el modal queda bloqueado mientras tanto)
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmarQuitarFoto) setConfirmarQuitarFoto(false);
      else if (confirmarGuardar) setConfirmarGuardar(false);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto, confirmarQuitarFoto, confirmarGuardar]);

  // Tamaños heredados de las bebidas del combo (valores reales de la lista TAMANO)
  const heredados = useMemo(() => tamanosHeredados(partes, productosDisponibles, categoriasEditor), [partes, productosDisponibles, categoriasEditor]);
  const [valoresTamano, setValoresTamano] = useState<Array<{ id: string; nombre: string }>>([]);
  useEffect(() => {
    if (!abierto) return;
    // Sin lista (sin permiso o sin red) solo se pierde el botón «+ Tamaño» de la lista: queda el nombre escrito a mano
    void Promise.resolve(catalogoApi.listarListas?.())
      .then((ls) => setValoresTamano((ls ?? []).find((l) => l.codigo === 'TAMANO')?.valores.filter((v) => v.activo).map((v) => ({ id: String(v.id), nombre: v.nombre })) ?? []))
      .catch(() => {});
  }, [abierto]);
  // Al armar las bebidas aparecen sus tamaños (en combo nuevo listos para poner precio; en uno ya guardado, apagados)
  useEffect(() => {
    if (!abierto) return;
    setTamanos((prev) => mezclarTamanos(prev, heredados, !comboAEditar));
  }, [abierto, heredados, comboAEditar]);

  // Acciones en tamaños
  const traerTamanos = () => setTamanos((prev) => mezclarTamanos(prev, heredados, true));
  const agregarTamano = (valorId?: string) => {
    const v = valoresTamano.find((x) => x.id === valorId);
    setTamanos((prev) => [...prev, v ? { tamanoValorId: v.id, tamanoNombre: v.nombre, precio: 0, activo: true } : { tamanoNombre: '', precio: 0, activo: true }]);
  };

  const quitarTamano = (index: number) => {
    setTamanos((prev) => prev.filter((_, i) => i !== index));
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
    return calcularSumaPreciosSueltos(partes, productosDisponibles, categoriasEditor);
  }, [partes, productosDisponibles, categoriasEditor]);

  const vigentes = tamanosVigentes(tamanos);
  const precioBaseCombo = Number(vigentes[0]?.precio) || 0;
  const ahorroCalculado = sumaIndividuales > 0 && precioBaseCombo > 0 ? sumaIndividuales - precioBaseCombo : 0;
  const porcentajeAhorro = sumaIndividuales > 0 && ahorroCalculado > 0 ? Math.round((ahorroCalculado / sumaIndividuales) * 100) : 0;
  const esMasCaroQueSueltos = sumaIndividuales > 0 && precioBaseCombo > sumaIndividuales;

  // Letra inicial para vista cuando no hay foto
  const letraInicial = (nombre.trim()[0] || 'C').toUpperCase();

  // Errores pendientes por pestaña (sin efectos): null = la pestaña está bien.
  const errorDatos = (): string | null => {
    if (!nombre.trim()) return 'Escribe el nombre del combo.';
    if (vigentes.length === 0) return 'Pon el precio del combo en al menos un tamaño.';
    if (vigentes.some((t) => !t.tamanoNombre.trim())) return 'Cada tamaño con precio necesita un nombre.';
    return null;
  };
  const errorPartes = (): string | null => errorDePartes(partes, categoriasEditor);
  const errorCuando = (): string | null => {
    if ((horaDesde && !horaHasta) || (!horaDesde && horaHasta)) return 'Escribe las dos horas (desde y hasta) o déjalas vacías.';
    if (horaDesde && horaHasta && horaDesde >= horaHasta) return 'La hora de inicio debe ser antes de la hora final.';
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) return 'La fecha de inicio no puede ser después de la final.';
    if (!canales.carta && !canales.local && !canales.bot) return ERROR_SIN_CANALES;
    return null;
  };
  const erroresPestanas = [
    { id: 'datos', error: errorDatos() },
    { id: 'partes', error: errorPartes() },
    { id: 'cuando', error: errorCuando() },
  ];
  const marca = (id: string) => {
    const hay = verErrores && !!erroresPestanas.find((e) => e.id === id)?.error;
    return hay ? { insignia: '!', insigniaError: true } : {};
  };
  const firma = JSON.stringify([nombre, descripcion, categoriaId, fotoArchivoId, partes, vigentes, dias, horaDesde, horaHasta, fechaDesde, fechaHasta, canales, visibleCarta]);
  const sucio = useCambiosSinGuardar(abierto, firma);
  const { cerrar, confirmando, setConfirmando } = useCierreConConfirmacion(sucio, onCerrar);

  // Guardar: si hay un error, salta a la primera pestaña con error y lo muestra; si no, pide confirmar.
  const intentarGuardar = () => {
    setVerErrores(true);
    const e = primeraConError(erroresPestanas);
    if (e) {
      setPestana(e.id);
      setMensajeError(e.error as string);
      return;
    }
    setMensajeError('');
    setConfirmarGuardar(true);
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

      const partesGuardar = partesParaGuardar(partes, categoriasEditor, productosDisponibles);
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
        tamanos: vigentes.map((t) => ({
          ...(t.tamanoValorId ? { tamanoValorId: t.tamanoValorId } : {}),
          tamanoNombre: t.tamanoNombre.trim(),
          precio: Number(t.precio),
        })),
        combosPrecios: vigentes.map((t) => ({
          ...(t.tamanoValorId ? { tamanoValorId: t.tamanoValorId } : {}),
          tamanoNombre: t.tamanoNombre.trim(),
          precio: Number(t.precio),
        })),
        partes: partesGuardar,
        combosPartes: partesGuardar,
      };

      await onGuardar(payload);
      onCerrar();
    } catch (err: any) {
      setMensajeError(err.response?.data?.mensaje || err.message || 'Error al guardar el combo.');
    } finally {
      setGuardando(false);
    }
  };

  // La vista previa reconoce las categorías por nombre
  const partesVista = partes.map((p) => ({ ...p, categorias: (p.categorias ?? []).map((id) => categoriasEditor.find((c) => c.id === id)?.nombre ?? id) }));

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
    combosPrecio: vigentes,
    combosPrecios: vigentes,
    combosParte: partesVista,
    combosPartes: partesVista,
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
    <>
      <ModalConPestanas
        titulo={comboAEditar ? 'Editar combo' : 'Constructor de combos'}
        subtitulo="Combo con partes fijas, a elección o alternativas"
        alCerrar={cerrar}
        bloquearCierre={guardando || confirmarQuitarFoto || confirmarGuardar || confirmando}
        pestanaActiva={pestana}
        alCambiarPestana={setPestana}
        ancho={960}
        bajoPestanas={<AvisoErrorOferta mensaje={mensajeError} />}
        pie={<PieOferta sucio={sucio} alCancelar={cerrar} alGuardar={intentarGuardar} guardando={guardando} textoGuardar="Guardar combo" testidGuardar="btn-guardar-combo" />}
        pestanas={[
          { id: 'datos', etiqueta: 'Datos', ...marca('datos'), contenido: (
<>
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
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)', marginTop: '-8px' }}>
              Define el precio por tamaño del combo y compara automáticamente con el valor de compra suelta.
            </div>

            {/* Lista de precios por tamaño */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>
                Tamaños del combo *
              </div>
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                Salen de las bebidas del combo. Pon el precio de cada tamaño; sin precio o apagado, ese tamaño no se ofrece.
              </div>

              {tamanos.map((t, idx) => (
                <div key={t.tamanoValorId ?? `manual-${idx}`} data-testid="fila-tamano-combo" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={t.activo !== false}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setTamanos((prev) => prev.map((item, i) => (i === idx ? { ...item, activo: val } : item)));
                    }}
                    aria-label={`Ofrecer ${t.tamanoNombre || 'tamaño'}`}
                  />
                  {t.tamanoValorId ? (
                    <div style={{ flex: 2, fontSize: '14px', fontWeight: 600, opacity: t.activo === false ? 0.55 : 1 }}>
                      {t.tamanoNombre}
                      {heredados.length > 0 && !heredados.some((h) => h.valorId === t.tamanoValorId && h.enTodas) && heredados.some((h) => h.valorId === t.tamanoValorId) && (
                        <span style={{ display: 'block', fontSize: '11px', fontWeight: 400, color: 'var(--cp-soft)' }}>No todas las bebidas lo tienen</span>
                      )}
                    </div>
                  ) : (
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
                  )}
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
                  {tamanos.length > 1 && !heredados.some((h) => h.valorId === t.tamanoValorId) && (
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

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                {heredados.length > 0 && (
                  <button type="button" onClick={traerTamanos} style={estiloBotonTamano}>
                    Traer tamaños de las bebidas
                  </button>
                )}
                {valoresTamano.length > 0 ? (
                  <select
                    aria-label="+ Tamaño"
                    value=""
                    onChange={(e) => e.target.value && agregarTamano(e.target.value)}
                    style={estiloBotonTamano}
                  >
                    <option value="">+ Tamaño</option>
                    {valoresTamano
                      .filter((v) => !tamanos.some((t) => t.tamanoValorId === v.id))
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nombre}
                        </option>
                      ))}
                  </select>
                ) : (
                  <button type="button" onClick={() => agregarTamano()} style={estiloBotonTamano}>
                    + Tamaño
                  </button>
                )}
              </div>
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
                  Precio del combo ({vigentes[0]?.tamanoNombre || 'Regular'}):
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

          </div>
</>
          ) },
          { id: 'partes', etiqueta: 'Partes y alternativas', ...marca('partes'), contenido: (
          <div data-testid="paso-2-combo" className="mo-tarjeta">
            <EditorPartesCombo partes={partes} onCambiar={(p) => { setPartes(p); setMensajeError(''); }} productos={productosDisponibles} categorias={categoriasEditor} mostrarErrores={verErrores} />
          </div>
          ) },
          { id: 'cuando', etiqueta: 'Cuándo y dónde', ...marca('cuando'), contenido: (
          <div
            data-testid="paso-cuando-combo"
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
          ) },
          { id: 'resumen', etiqueta: 'Resumen', contenido: (
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

            <div style={{ backgroundColor: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '14px 16px' }}>
              <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)', marginBottom: '8px' }}>El cliente verá:</div>
              <ResumenPartesCombo partes={partes} productos={productosDisponibles} categorias={categoriasEditor} />
              {errorPartes() && <p className="epc-error" role="alert" data-testid="aviso-partes">{errorPartes()}</p>}
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
          ) },
        ]}
      />
      <ConfirmarSalir abierto={confirmando} alSalir={() => { setConfirmando(false); onCerrar(); }} alQuedarse={() => setConfirmando(false)} />
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
    </>
  );
}
