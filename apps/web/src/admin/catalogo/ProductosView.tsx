import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useUrlArchivo } from '../../comun/useUrlArchivo';
import { useSubidaArchivo } from '../../comun/useSubidaArchivo';
import { IndicadorSubida } from '../../comun/IndicadorSubida';
import { useNavigate } from 'react-router-dom';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import './productos-tarjeta.css';
import {
  catalogoApi,
  ProductoAdmin,
  CategoriaAdmin,
  ListaAdmin,
  GrupoOpcionItem,
} from './catalogoApi';
import { EditorOpcionesTamanos } from './EditorOpcionesTamanos';
import { BotonVistaPrevia } from './VistaPreviaProducto';
import { ESTADO_VACIO, EstadoOpciones, validarTamanos } from './editorOpcionesTipos';

const PPAGE = 24;


/** Aviso de producto en promoción: reemplaza al botón «no suma puntos». */
function AvisoPromocion({ p }: { p: ProductoAdmin }) {
  const promos = p.promociones ?? [];
  const enCurso = promos.filter((x) => x.estado === 'EN_CURSO');
  const vencidas = promos.filter((x) => x.estado === 'VENCIDA');
  const lista = enCurso.length ? enCurso : vencidas.length ? vencidas : promos;
  const titulo = enCurso.length
    ? 'En promoción: no suma puntos'
    : vencidas.length
      ? 'Promoción vencida: desactívala para volver a sumar'
      : 'Promoción programada';
  const nombre = lista.length === 1 ? lista[0].nombre : `En ${lista.length} promociones`;
  return (
    <div
      data-testid="aviso-promocion"
      style={{
        border: '1.5px solid var(--cp-rust)',
        borderRadius: 10,
        padding: '8px 10px',
        fontSize: 12,
        color: 'var(--cp-navy)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <strong>{titulo}</strong>
        <span
          role="img"
          aria-label="Ayuda"
          tabIndex={0}
          title="Mientras esté en una promoción, lo que se vende con descuento no suma puntos ni se paga con puntos. Cuando termine o se desactive la promoción, vuelve a sumar."
          style={{ minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontWeight: 800 }}
        >
          ?
        </span>
      </div>
      <span>{nombre}</span>
      {p.noSumaBeneficios && <span>También marcado como no suma puntos</span>}
    </div>
  );
}

export function ProductosView() {
  const navigate = useNavigate();
  const { usuario, tiene } = useSesion();

  // Roles y permisos
  const esAdmin = usuario?.rol === 'ADMIN' || tiene('catalogo/crear');
  const esCajero = usuario?.rol === 'CAJERO';
  const esMozo = usuario?.rol === 'MOZO';
  const puedeEditar = (esAdmin || esCajero) && !esMozo;
  const puedeGestionarListas = esAdmin || tiene('catalogo/ver');

  // Estados de datos
  const [productos, setProductos] = useState<ProductoAdmin[]>([]);
  const [categorias, setCategorias] = useState<CategoriaAdmin[]>([]);
  const [, setListas] = useState<ListaAdmin[]>([]);
  const [gruposGenerales, setGruposGenerales] = useState<GrupoOpcionItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [catSeleccionada, setCatSeleccionada] = useState<string>('Todos');
  const [busqueda, setBusqueda] = useState('');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtroDisponibilidad, setFiltroDisponibilidad] = useState<'all' | 'avail' | 'off'>('all');
  const [filtroRegistro, setFiltroRegistro] = useState<'activos' | 'desactivados' | 'todos'>('activos');
  const [filtroOrden, setFiltroOrden] = useState<'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'>('name-asc');
  const [filtroPromo, setFiltroPromo] = useState(false);
  const [verTodosSinPagina, setVerTodosSinPagina] = useState(false);
  const [pagina, setPagina] = useState(1);

  // Dropdowns en filtros
  const [ddDispAbierto, setDdDispAbierto] = useState(false);
  const [ddOrdenAbierto, setDdOrdenAbierto] = useState(false);

  // Modales
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [productoEnEdicion, setProductoEnEdicion] = useState<ProductoAdmin | null>(null);
  const [productoEnOpciones, setProductoEnOpciones] = useState<ProductoAdmin | null>(null);

  // Formulario Nuevo Producto
  const [npNombre, setNpNombre] = useState('');
  const [npCategoriaId, setNpCategoriaId] = useState<string>('');
  const [npPrecio, setNpPrecio] = useState('');
  const [npDesc, setNpDesc] = useState('');
  // «¿Cómo se vende?»: null = lo decide la categoría (llevaOpciones); al tocar una tarjeta queda la elección
  const [npModoElegido, setNpModoElegido] = useState<'unico' | 'opciones' | null>(null);
  const [npOpc, setNpOpc] = useState<EstadoOpciones>(ESTADO_VACIO);
  const [npFoto, setNpFoto] = useState<File | null>(null);
  const npFotoUrl = useUrlArchivo(npFoto);
  /** La imagen nueva se sube al elegirla; «Agregar» espera a que el servidor la tenga. */
  const [npFotoArchivoId, setNpFotoArchivoId] = useState<string | null>(null);
  const subidaNpFoto = useSubidaArchivo();
  const npModo: 'unico' | 'opciones' =
    npModoElegido ?? (categorias.find((c) => c.id === npCategoriaId)?.llevaOpciones ? 'opciones' : 'unico');
  const [npError, setNpError] = useState('');
  const [npNuevaCatAbierta, setNpNuevaCatAbierta] = useState(false);
  const [npNuevaCatNombre, setNpNuevaCatNombre] = useState('');
  const [npNuevaCatConOpc, setNpNuevaCatConOpc] = useState(true);

  // Formulario Editar Producto
  const [edNombre, setEdNombre] = useState('');
  const [edCategoriaId, setEdCategoriaId] = useState('');
  const [edPrecio, setEdPrecio] = useState('');
  const [edOculto, setEdOculto] = useState(false);
  const [edFotoUrl, setEdFotoUrl] = useState<string | null>(null);
  const [edFotoArchivoId, setEdFotoArchivoId] = useState<string | null>(null);
  const subidaEdFoto = useSubidaArchivo();
  const [edSabores, setEdSabores] = useState<Array<{ id?: string; nombre: string; activo?: boolean }>>([]);
  const [edNuevoSabor, setEdNuevoSabor] = useState('');
  const [edError, setEdError] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  // Confirmación
  const [confirmarProps, setConfirmarProps] = useState<{
    abierto: boolean;
    titulo: string;
    mensaje: string;
    accion: () => Promise<void> | void;
  }>({
    abierto: false,
    titulo: '',
    mensaje: '',
    accion: () => {},
  });

  const refStrip = useRef<HTMLDivElement>(null);

  // Cargar datos
  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(null);
      const [prods, cats, lsts, grps] = await Promise.all([
        catalogoApi.listarProductos({ incluyeOcultos: true }),
        catalogoApi.listarCategorias(),
        catalogoApi.listarListas(),
        catalogoApi.listarGrupos(),
      ]);
      setProductos(prods);
      setCategorias(cats);
      setListas(lsts);
      setGruposGenerales(grps);
      if (cats.length > 0 && !npCategoriaId) {
        setNpCategoriaId(cats[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar el catálogo');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Lista de nombres de categorías para las pestañas
  const categoriasPills = useMemo(() => {
    const nombres = ['TODOS'];
    categorias.forEach((c) => {
      nombres.push(c.nombre.toUpperCase());
    });
    return nombres;
  }, [categorias]);

  // Filtrado y ordenamiento de productos
  const productosFiltrados = useMemo(() => {
    let res = [...productos];

    // Por registro (activo = visible en la carta)
    if (filtroRegistro === 'activos') res = res.filter((p) => !p.oculto);
    else if (filtroRegistro === 'desactivados') res = res.filter((p) => p.oculto);

    // Por categoría
    if (catSeleccionada.toUpperCase() !== 'TODOS') {
      res = res.filter(
        (p) => p.categoria?.nombre?.toUpperCase() === catSeleccionada.toUpperCase(),
      );
    }

    // Por texto de búsqueda
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      res = res.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.descripcion && p.descripcion.toLowerCase().includes(q)),
      );
    }

    // Por disponibilidad
    if (filtroDisponibilidad === 'avail') {
      res = res.filter((p) => p.disponible);
    } else if (filtroDisponibilidad === 'off') {
      res = res.filter((p) => !p.disponible);
    }

    // Por promoción (en mock: hasPromo)
    if (filtroPromo) {
      res = res.filter((p) => p.noSumaBeneficios);
    }

    // Ordenamiento
    res.sort((a, b) => {
      if (filtroOrden === 'name-asc') return a.nombre.localeCompare(b.nombre);
      if (filtroOrden === 'name-desc') return b.nombre.localeCompare(a.nombre);
      if (filtroOrden === 'price-asc') return a.precio - b.precio;
      if (filtroOrden === 'price-desc') return b.precio - a.precio;
      return 0;
    });

    return res;
  }, [productos, catSeleccionada, busqueda, filtroDisponibilidad, filtroOrden, filtroPromo, filtroRegistro]);

  // Paginación
  const totalPaginas = Math.ceil(productosFiltrados.length / PPAGE) || 1;
  const productosVisibles = useMemo(() => {
    if (verTodosSinPagina) return productosFiltrados;
    const inicio = (pagina - 1) * PPAGE;
    return productosFiltrados.slice(inicio, inicio + PPAGE);
  }, [productosFiltrados, verTodosSinPagina, pagina]);

  // Scroll del strip de categorías
  const scrollStrip = (direccion: 'izq' | 'der') => {
    if (refStrip.current) {
      refStrip.current.scrollBy({
        left: direccion === 'izq' ? -220 : 220,
        behavior: 'smooth',
      });
    }
  };

  // Conteo de filtros activos
  const filtrosActivosCount = useMemo(() => {
    let c = 0;
    if (filtroDisponibilidad !== 'all') c++;
    if (filtroOrden !== 'name-asc') c++;
    if (filtroPromo) c++;
    return c;
  }, [filtroDisponibilidad, filtroOrden, filtroPromo]);

  const textoResumenFiltros = useMemo(() => {
    const partes: string[] = [];
    if (filtroDisponibilidad === 'avail') partes.push('Disponibles');
    if (filtroDisponibilidad === 'off') partes.push('Agotados');
    if (filtroOrden === 'name-desc') partes.push('Nombre Z-A');
    if (filtroOrden === 'price-asc') partes.push('Precio menor');
    if (filtroOrden === 'price-desc') partes.push('Precio mayor');
    if (filtroPromo) partes.push('Con promoción');
    return partes.join(', ');
  }, [filtroDisponibilidad, filtroOrden, filtroPromo]);

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltroDisponibilidad('all');
    setFiltroOrden('name-asc');
    setFiltroPromo(false);
  };

  // Acciones sobre productos
  const toggleDisponibilidad = (p: ProductoAdmin) => {
    const nuevoEstado = !p.disponible;
    setConfirmarProps({
      abierto: true,
      titulo: nuevoEstado
        ? `¿Marcar disponible "${p.nombre}"?`
        : `¿Marcar agotado "${p.nombre}"?`,
      mensaje: nuevoEstado
        ? 'Volverá a ofrecerse en la carta y el chatbot.'
        : 'Dejará de ofrecerse en la carta y el chatbot.',
      accion: async () => {
        try {
          if (nuevoEstado) {
            await catalogoApi.disponibilizarProducto(p.id);
          } else {
            await catalogoApi.agotarProducto(p.id, { alcance: 'INDEFINIDO' });
          }
          await cargarDatos();
        } catch (err: any) {
          alert(err?.message || 'Error al cambiar disponibilidad');
        }
      },
    });
  };

  const toggleActivo = (p: ProductoAdmin) => {
    const activar = p.oculto === true;
    setConfirmarProps({
      abierto: true,
      titulo: activar ? `¿Activar «${p.nombre}»?` : `¿Desactivar «${p.nombre}»?`,
      mensaje: activar
        ? 'Volverá a mostrarse en la carta, en el pedido del mozo y en el bot de WhatsApp.'
        : 'Agotado: se ve en la carta pero no se puede pedir (temporal, vuelve sola si pusiste hora). Desactivado: desaparece de la carta, del pedido del mozo y del bot de WhatsApp hasta que lo actives. No se borra: su historial de ventas se conserva.',
      accion: async () => {
        try {
          if (activar) await catalogoApi.mostrarProducto(p.id);
          else await catalogoApi.ocultarProducto(p.id);
          await cargarDatos();
        } catch (err: any) {
          alert(err?.message || 'Error al cambiar el registro del producto');
        }
      },
    });
  };

  const toggleNoSuma = (p: ProductoAdmin) => {
    const actual = p.noSumaBeneficios;
    setConfirmarProps({
      abierto: true,
      titulo: actual
        ? `¿Volver a sumar puntos con «${p.nombre}»?`
        : `¿Marcar «${p.nombre}» como «no suma puntos ni aplica cupones»?`,
      mensaje: actual
        ? 'Vuelve a sumar puntos, a pagarse con puntos y a aceptar cupones.'
        : 'Mientras esté activo, el producto no suma puntos, no se puede pagar con puntos y no aplica cupones. Sirve para promociones muy ajustadas (por ejemplo, un 2×1 de campaña). Vale en la carta, la caja y el chatbot.',
      accion: async () => {
        try {
          await catalogoApi.editarProducto(p.id, { noSumaBeneficios: !actual });
          await cargarDatos();
        } catch (err: any) {
          alert(err?.message || 'Error al cambiar configuración');
        }
      },
    });
  };

  // Abrir modal Editar
  const abrirEditar = (p: ProductoAdmin) => {
    setProductoEnEdicion(p);
    setEdNombre(p.nombre);
    setEdCategoriaId(p.categoriaId);
    setEdPrecio(p.precio.toFixed(2));
    setEdOculto(p.oculto === true);
    setEdFotoUrl(p.fotoUrl || null);
    setEdFotoArchivoId(null);
    setEdSabores(p.sabores.map((s) => ({ ...s })));
    setEdNuevoSabor('');
    setEdError('');
  };

  // Guardar Edición
  const guardarEdicion = async () => {
    if (!productoEnEdicion) return;
    const precioNum = parseFloat(edPrecio);
    if (isNaN(precioNum) || precioNum < 0) {
      setEdError('Ingresa un precio válido');
      return;
    }
    setConfirmarProps({
      abierto: true,
      titulo: '¿Guardar los cambios?',
      mensaje: `Se actualizará el producto "${productoEnEdicion.nombre}".`,
      accion: async () => {
        try {
          setGuardandoEdicion(true);
          await catalogoApi.editarProducto(productoEnEdicion.id, {
            nombre: edNombre.trim(),
            categoriaId: edCategoriaId,
            precio: precioNum,
            oculto: edOculto,
            fotoArchivoId: edFotoArchivoId,
            sabores: edSabores.map((s) => ({
              id: s.id,
              nombre: s.nombre,
              activo: s.activo !== false,
            })),
          });
          setProductoEnEdicion(null);
          await cargarDatos();
        } catch (err: any) {
          setEdError(err?.message || 'Error al guardar');
        } finally {
          setGuardandoEdicion(false);
        }
      },
    });
  };

  // Subir imagen en edición: «Subiendo imagen…» hasta que el servidor responde
  const manejarSubidaFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void subidaEdFoto.ejecutar(async () => {
      const res = await catalogoApi.subirFoto(file);
      setEdFotoUrl(res.url);
      setEdFotoArchivoId(res.id);
    });
  };

  const elegirNpFoto = (archivo: File | null) => {
    setNpFoto(archivo);
    setNpFotoArchivoId(null);
    subidaNpFoto.reiniciar();
    if (!archivo) return;
    void subidaNpFoto.ejecutar(async () => {
      const res = await catalogoApi.subirFoto(archivo);
      setNpFotoArchivoId(res.id);
    });
  };

  const quitarFoto = () => {
    setConfirmarProps({
      abierto: true,
      titulo: '¿Quitar la imagen?',
      mensaje: 'Se quitará al guardar. Puedes subir otra.',
      accion: () => {
        setEdFotoUrl(null);
        setEdFotoArchivoId(null);
      },
    });
  };

  // Abrir modal Tamaños y opciones (el contenido vive en EditorOpcionesTamanos)
  const abrirOpciones = (p: ProductoAdmin) => setProductoEnOpciones(p);

  // Resumen para la insignia del botón: «3 tamaños · 2 grupos»
  const resumenOpciones = (p: ProductoAdmin) => {
    const t = p.tamanos.length;
    const g = p.grupos.length;
    if (t === 0 && g === 0) return 'Sin tamaños ni opciones';
    return `${t} ${t === 1 ? 'tamaño' : 'tamaños'} · ${g} ${g === 1 ? 'grupo' : 'grupos'}`;
  };

  // Guardar Nuevo Producto
  const guardarNuevoProducto = async () => {
    if (!npNombre.trim()) {
      setNpError('Escribe el nombre del producto');
      return;
    }
    const conOpciones = npModo === 'opciones';
    let precioNum = parseFloat(npPrecio);
    if (conOpciones) {
      if (!npOpc.tamanos.some((t) => t.activo)) {
        setNpError('Agrega al menos un tamaño activo, o elige «Un solo precio».');
        return;
      }
      const errT = validarTamanos(npOpc.tamanos);
      if (errT) {
        setNpError(errT);
        return;
      }
      // el precio base del producto es el del primer tamaño activo
      precioNum = npOpc.tamanos.find((t) => t.activo)!.precio;
    } else if (isNaN(precioNum) || precioNum < 0) {
      setNpError('Ingresa un precio válido');
      return;
    }
    if (!npCategoriaId) {
      setNpError('Elige una categoría');
      return;
    }

    if (npFoto && !npFotoArchivoId) {
      setNpError(subidaNpFoto.subiendo ? 'Espera a que termine de subir la imagen.' : 'La imagen no se subió. Reintenta la subida o quítala.');
      return;
    }

    setConfirmarProps({
      abierto: true,
      titulo: `¿Agregar "${npNombre.trim().toUpperCase()}" a la carta?`,
      mensaje:
        'Aparece en la carta virtual, en Nuevo pedido y en Productos. No se elimina: se puede marcar agotado.',
      accion: async () => {
        try {
          await catalogoApi.crearProducto({
            nombre: npNombre.trim().toUpperCase(),
            categoriaId: npCategoriaId,
            precio: precioNum,
            descripcion: npDesc.trim() || undefined,
            ...(npFotoArchivoId ? { fotoArchivoId: npFotoArchivoId } : {}),
            ...(conOpciones
              ? {
                  tamanos: npOpc.tamanos.map((t) => ({ tamanoValorId: t.tamanoValorId, precio: t.precio, activo: t.activo })),
                  grupos: npOpc.grupos.map((g, orden) => ({ grupoId: g.grupoId, orden })),
                }
              : {}),
          });
          setModalNuevoAbierto(false);
          setNpNombre('');
          setNpPrecio('');
          setNpDesc('');
          setNpModoElegido(null);
          setNpOpc(ESTADO_VACIO);
          elegirNpFoto(null);
          setNpError('');
          await cargarDatos();
        } catch (err: any) {
          setNpError(err?.message || 'Error al crear el producto');
        }
      },
    });
  };

  // Crear categoría nueva desde modal Nuevo Producto
  const crearCategoriaRapida = async () => {
    if (!npNuevaCatNombre.trim() || npNuevaCatNombre.trim().length < 2) {
      setNpError('El nombre de la categoría debe tener al menos 2 letras');
      return;
    }
    try {
      const nueva = await catalogoApi.crearCategoria({
        nombre: npNuevaCatNombre.trim().toUpperCase(),
        llevaOpciones: npNuevaCatConOpc,
      });
      setCategorias((prev) => [...prev, nueva]);
      setNpCategoriaId(nueva.id);
      setNpNuevaCatAbierta(false);
      setNpNuevaCatNombre('');
    } catch (err: any) {
      setNpError(err?.message || 'Error al crear categoría');
    }
  };

  if (cargando && productos.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Cargando mensaje="Cargando catálogo de productos…" />
      </div>
    );
  }

  if (error && productos.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <EstadoError mensaje={error} alReintentar={cargarDatos} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 0. Recuadro de gestionar listas idéntico al mockup */}
      {puedeGestionarListas && (
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
            Las listas que se eligen en este módulo (categorías, tipos u origen) se crean y se gestionan aquí mismo.
          </span>
          <button
            onClick={() => navigate('/admin/listas')}
            style={{
              minHeight: 44,
              padding: '0 16px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: 12,
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Gestionar listas
          </button>
        </div>
      )}

      {/* 1. Frase descriptiva idéntica al mockup */}
      <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
        Lo que se marca aquí se refleja de inmediato en la carta virtual y en el chatbot. Un producto agotado no se ofrece.
      </div>

      {/* 2. Botón + Nuevo producto (solo visible para admin) */}
      {esAdmin && (
        <button
          onClick={() => {
            setNpNombre('');
            setNpPrecio('');
            setNpDesc('');
            setNpError('');
            setNpNuevaCatAbierta(false);
            setModalNuevoAbierto(true);
          }}
          style={{
            alignSelf: 'flex-start',
            minHeight: 44,
            padding: '0 16px',
            border: 0,
            borderRadius: 12,
            background: 'var(--cp-orange)',
            color: 'var(--cp-navy)',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          + Nuevo producto
        </button>
      )}

      {/* 3. Strip horizontal de categorías con flechas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => scrollStrip('izq')}
          aria-label="Ver categorías anteriores"
          style={{
            flex: 'none',
            width: 36,
            height: 36,
            border: '1.5px solid var(--cp-navy)',
            borderRadius: 18,
            background: 'transparent',
            color: 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: 18,
            lineHeight: '18px',
            cursor: 'pointer',
          }}
        >
          ‹
        </button>
        <div
          ref={refStrip}
          className="noscroll"
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            cursor: 'grab',
          }}
        >
          {categoriasPills.map((cNombre) => {
            const activo =
              (cNombre === 'TODOS' && catSeleccionada === 'Todos') ||
              cNombre.toUpperCase() === catSeleccionada.toUpperCase();
            return (
              <button
                key={cNombre}
                onClick={() => {
                  setCatSeleccionada(cNombre === 'TODOS' ? 'Todos' : cNombre);
                  setPagina(1);
                }}
                style={{
                  flex: 'none',
                  minHeight: 44,
                  padding: '0 14px',
                  borderRadius: 9999,
                  border: '1.5px solid var(--cp-navy)',
                  background: activo ? 'var(--cp-navy)' : 'transparent',
                  color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                }}
              >
                {cNombre}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => scrollStrip('der')}
          aria-label="Ver más categorías"
          style={{
            flex: 'none',
            width: 36,
            height: 36,
            border: '1.5px solid var(--cp-navy)',
            borderRadius: 18,
            background: 'transparent',
            color: 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: 18,
            lineHeight: '18px',
            cursor: 'pointer',
          }}
        >
          ›
        </button>
      </div>

      {/* 4. Buscador y Filtros */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: 12,
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label htmlFor="prod-q" style={{ position: 'absolute', left: -9999 }}>
            Buscar
          </label>
          <input
            id="prod-q"
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar producto"
            style={{
              flex: 1,
              minWidth: 0,
              boxSizing: 'border-box',
              minHeight: 44,
              borderRadius: 9999,
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-cream)',
              color: 'var(--cp-navy)',
              padding: '0 16px',
              fontSize: 14,
            }}
          />
          <button
            onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
            aria-expanded={filtrosAbiertos}
            style={{
              flex: 'none',
              minHeight: 44,
              padding: '0 12px',
              borderRadius: 9999,
              border: '1.5px solid var(--cp-navy)',
              background: filtrosAbiertos ? 'var(--cp-navy)' : 'transparent',
              color: filtrosAbiertos ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: 13,
              display: 'inline-flex',
              gap: 6,
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 5h18l-7 8v6l-4 2v-8z" />
            </svg>
            Filtros
            {filtrosActivosCount > 0 && (
              <span
                style={{
                  minWidth: 20,
                  height: 20,
                  boxSizing: 'border-box',
                  borderRadius: 10,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 5px',
                }}
              >
                {filtrosActivosCount}
              </span>
            )}
          </button>
        </div>

        {/* Resumen de filtros */}
        {filtrosActivosCount > 0 && (
          <div style={{ fontSize: 12, lineHeight: '17px', color: 'var(--cp-soft)' }}>
            <b>Filtrando:</b> {textoResumenFiltros}
          </div>
        )}

        {/* Panel de filtros expandible */}
        {filtrosAbiertos && (
          <div
            style={{
              borderTop: '1px solid var(--cp-line)',
              paddingTop: 8,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px 20px',
            }}
          >
            {/* Disponibilidad */}
            <div style={{ flex: '1 1 200px', minWidth: 0, position: 'relative' }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: 'var(--cp-soft)',
                  marginBottom: 3,
                }}
              >
                DISPONIBILIDAD
              </div>
              <button
                onClick={() => setDdDispAbierto(!ddDispAbierto)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 44,
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1.5px solid var(--cp-navy)',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: 13,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span>
                  {filtroDisponibilidad === 'all'
                    ? 'Todos'
                    : filtroDisponibilidad === 'avail'
                    ? 'Solo disponibles'
                    : 'Solo agotados'}
                </span>
                <span>▾</span>
              </button>
              {ddDispAbierto && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    marginTop: 4,
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: 10,
                    background: 'var(--cp-white)',
                    overflow: 'hidden',
                  }}
                >
                  {[
                    { id: 'all', n: 'Todos' },
                    { id: 'avail', n: 'Solo disponibles' },
                    { id: 'off', n: 'Solo agotados' },
                  ].map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        setFiltroDisponibilidad(o.id as any);
                        setDdDispAbierto(false);
                      }}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: 44,
                        padding: '0 12px',
                        border: 0,
                        borderBottom: '1px solid var(--cp-sand)',
                        background:
                          filtroDisponibilidad === o.id ? 'var(--cp-cream)' : 'var(--cp-white)',
                        color: 'var(--cp-navy)',
                        fontWeight: filtroDisponibilidad === o.id ? 800 : 600,
                        fontSize: 13,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      {o.n}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ordenar */}
            <div style={{ flex: '1 1 200px', minWidth: 0, position: 'relative' }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: 'var(--cp-soft)',
                  marginBottom: 3,
                }}
              >
                ORDENAR
              </div>
              <button
                onClick={() => setDdOrdenAbierto(!ddOrdenAbierto)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 44,
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1.5px solid var(--cp-navy)',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: 13,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span>
                  {filtroOrden === 'name-asc'
                    ? 'Nombre A-Z'
                    : filtroOrden === 'name-desc'
                    ? 'Nombre Z-A'
                    : filtroOrden === 'price-asc'
                    ? 'Precio menor'
                    : 'Precio mayor'}
                </span>
                <span>▾</span>
              </button>
              {ddOrdenAbierto && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    marginTop: 4,
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: 10,
                    background: 'var(--cp-white)',
                    overflow: 'hidden',
                  }}
                >
                  {[
                    { id: 'name-asc', n: 'Nombre A-Z' },
                    { id: 'name-desc', n: 'Nombre Z-A' },
                    { id: 'price-asc', n: 'Precio menor' },
                    { id: 'price-desc', n: 'Precio mayor' },
                  ].map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        setFiltroOrden(o.id as any);
                        setDdOrdenAbierto(false);
                      }}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: 44,
                        padding: '0 12px',
                        border: 0,
                        borderBottom: '1px solid var(--cp-sand)',
                        background:
                          filtroOrden === o.id ? 'var(--cp-cream)' : 'var(--cp-white)',
                        color: 'var(--cp-navy)',
                        fontWeight: filtroOrden === o.id ? 800 : 600,
                        fontSize: 13,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      {o.n}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Promoción */}
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: 'var(--cp-soft)',
                  marginBottom: 3,
                }}
              >
                PROMOCIÓN
              </div>
              <button
                onClick={() => setFiltroPromo(!filtroPromo)}
                style={{
                  minHeight: 44,
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1.5px solid var(--cp-navy)',
                  background: filtroPromo ? 'var(--cp-navy)' : 'transparent',
                  color: filtroPromo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Con promoción
              </button>
            </div>

            {/* Botones inferiores del panel de filtros */}
            <div
              style={{
                flex: '1 1 100%',
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={limpiarFiltros}
                style={{
                  minHeight: 34,
                  padding: '0 10px',
                  border: 0,
                  background: 'transparent',
                  color: 'var(--cp-rust)',
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Limpiar filtros
              </button>
              <button
                onClick={() => setFiltrosAbiertos(false)}
                style={{
                  minHeight: 34,
                  padding: '0 16px',
                  border: 0,
                  borderRadius: 10,
                  background: 'var(--cp-navy)',
                  color: 'var(--cp-cream)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Listo
              </button>
            </div>
          </div>
        )}

        {/* Registro: activos / desactivados */}
        <div role="group" aria-label="Registro" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-navy)' }}>Registro</span>
          {(
            [
              ['activos', 'Activos', productos.filter((x) => !x.oculto).length],
              ['desactivados', 'Desactivados', productos.filter((x) => x.oculto).length],
              ['todos', 'Todos', productos.length],
            ] as const
          ).map(([id, n, c]) => (
            <button
              key={id}
              aria-pressed={filtroRegistro === id}
              onClick={() => {
                setFiltroRegistro(id);
                setPagina(1);
              }}
              style={{
                minHeight: 44,
                padding: '0 14px',
                border: '1.5px solid var(--cp-navy)',
                borderRadius: 9999,
                background: filtroRegistro === id ? 'var(--cp-navy)' : 'transparent',
                color: filtroRegistro === id ? 'var(--cp-white)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {n} ({c})
            </button>
          ))}
        </div>

        {/* Resumen inferior del box de búsqueda */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: 'var(--cp-soft)', fontWeight: 600 }}>
            Mostrando {productosVisibles.length} de {productosFiltrados.length} productos
          </div>
          <button
            onClick={() => setVerTodosSinPagina(!verTodosSinPagina)}
            style={{
              minHeight: 44,
              padding: '0 14px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: 9999,
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {verTodosSinPagina
              ? 'Ver por páginas (24 por página)'
              : 'Ver todos en una sola lista'}
          </button>
        </div>
      </div>

      {/* 5. Grilla de tarjetas de productos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
          gap: 12,
        }}
      >
        {productosVisibles.map((p) => {
          const off = !p.disponible;
          const minTamPrecio =
            p.tamanos.length > 0
              ? Math.min(...p.tamanos.map((t) => Number(t.precio) || 0))
              : p.precio;
          const precioTexto =
            p.tamanos.length > 1
              ? `Desde s/ ${minTamPrecio.toFixed(2)}`
              : `s/ ${(Number(p.precio) || 0).toFixed(2)}`;

          return (
            <div
              key={p.id}
              className="pt-tarjeta"
              data-oculto={p.oculto ? 'si' : 'no'}
              style={{
                opacity: p.oculto ? 0.5 : off ? 0.65 : 1,
              }}
            >
              <div className="pt-insignias">
                {p.oculto && <span className="pt-ins pt-ins--desactivado">Desactivado</span>}
                <span className={off ? 'pt-ins pt-ins--agotado' : 'pt-ins'}>
                  {off ? 'AGOTADO' : 'DISPONIBLE'}
                </span>
                {p.promociones && p.promociones.length > 0 && (
                  <span className="pt-ins pt-ins--promo">En promoción</span>
                )}
              </div>
              {p.fotoUrl && (
                <img
                  src={p.fotoUrl}
                  alt={p.nombre}
                  style={{
                    width: '100%',
                    height: 140,
                    objectFit: 'contain',
                    background: 'var(--cp-sand)',
                    borderRadius: 10,
                  }}
                />
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: 16,
                    lineHeight: '21px',
                    minWidth: 0,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {p.nombre}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '8px 12px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      color: 'var(--cp-soft)',
                    }}
                  >
                    CATEGORÍA
                  </div>
                  <div style={{ fontSize: 13 }}>{p.categoria?.nombre || 'General'}</div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      color: 'var(--cp-soft)',
                    }}
                  >
                    PRECIO
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
                    {precioTexto}
                  </div>
                </div>
              </div>

              {/* Producto en promoción: sin botón, con aviso (los combos no cuentan: suelto sí suma) */}
              {(p.promociones?.length ?? 0) > 0 && (
                <AvisoPromocion p={p} />
              )}

              {/* Acciones: una principal y el resto en cuadrícula de 2 columnas dentro de la tarjeta */}
              <div className="pt-acciones">
                {puedeEditar && (
                  <button className="pt-btn pt-btn--principal" onClick={() => abrirEditar(p)}>
                    Editar
                  </button>
                )}
                {puedeEditar && (
                  <button className="pt-btn pt-btn--opciones" onClick={() => abrirOpciones(p)}>
                    <span>Tamaños y opciones</span>
                    <small>{resumenOpciones(p)}</small>
                  </button>
                )}
                <button
                  className="pt-btn"
                  onClick={() => toggleDisponibilidad(p)}
                  aria-label={`Cambiar disponibilidad de ${p.nombre}`}
                >
                  {off ? 'Marcar disponible' : 'Marcar agotado'}
                </button>
                {puedeEditar && (
                  <button
                    className="pt-btn"
                    onClick={() => toggleActivo(p)}
                    aria-label={`${p.oculto ? 'Activar' : 'Desactivar'} ${p.nombre}`}
                  >
                    {p.oculto ? 'Activar' : 'Desactivar'}
                  </button>
                )}
                {esAdmin && !(p.promociones?.length) && (
                  <button
                    className={p.noSumaBeneficios ? 'pt-btn pt-btn--ancho pt-btn--alerta' : 'pt-btn pt-btn--ancho'}
                    title="En combos no suma puntos, pero vendido suelto sí"
                    onClick={() => toggleNoSuma(p)}
                  >
                    {p.noSumaBeneficios
                      ? 'No suma puntos ni aplica cupones'
                      : 'Suma puntos y acepta cupones'}
                  </button>
                )}
                <div className="pt-ancho">
                  <BotonVistaPrevia
                    bloque
                    borrador={p}
                    gruposGenerales={gruposGenerales}
                    nombreProducto={p.nombre}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Estado vacío si no hay coincidencias */}
      {productosVisibles.length === 0 && (
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
            color: 'var(--cp-soft)',
          }}
        >
          Ningún producto coincide con los filtros.
        </div>
      )}

      {/* 6. Nota de pie */}
      <div style={{ fontSize: 12, color: 'var(--cp-soft)', textAlign: 'center' }}>
        Un producto agotado deja de ofrecerse en la carta y el chatbot; no se elimina.
      </div>

      {/* 7. Paginación */}
      {!verTodosSinPagina && totalPaginas > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
          <button
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina === 1}
            style={{
              minHeight: 44,
              padding: '0 12px',
              borderRadius: 12,
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
              opacity: pagina === 1 ? 0.4 : 1,
              cursor: pagina === 1 ? 'default' : 'pointer',
            }}
          >
            ← Anterior
          </button>
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => {
            const activo = num === pagina;
            return (
              <button
                key={num}
                onClick={() => setPagina(num)}
                aria-label={`Página ${num}`}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  borderRadius: 12,
                  border: '1.5px solid var(--cp-navy)',
                  background: activo ? 'var(--cp-navy)' : 'transparent',
                  color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {num}
              </button>
            );
          })}
          <button
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={pagina === totalPaginas}
            style={{
              minHeight: 44,
              padding: '0 12px',
              borderRadius: 12,
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
              opacity: pagina === totalPaginas ? 0.4 : 1,
              cursor: pagina === totalPaginas ? 'default' : 'pointer',
            }}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: + NUEVO PRODUCTO                                            */}
      {/* =================================================================== */}
      {modalNuevoAbierto && (
        <>
          <div
            onClick={() => setModalNuevoAbierto(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              background: 'rgba(11,44,62,0.55)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nuevo producto"
            style={{
              position: 'fixed',
              zIndex: 60,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%,-50%)',
              width: 'min(810px, calc(100% - 24px))',
              maxHeight: 'calc(100% - 24px)',
              overflowY: 'auto',
              background: 'var(--cp-cream)',
              borderRadius: 20,
              boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 22,
                  lineHeight: '27px',
                }}
              >
                Nuevo producto
              </div>
              <button
                onClick={() => setModalNuevoAbierto(false)}
                aria-label="Cerrar"
                style={{
                  flex: 'none',
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  border: '1.5px solid var(--cp-navy)',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontSize: 20,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
              Aparece de inmediato en la carta, en Nuevo pedido y en Productos. No se elimina: se desactiva.
            </div>

            {/* Nombre */}
            <div>
              <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                Nombre
              </label>
              <input
                type="text"
                value={npNombre}
                onChange={(e) => setNpNombre(e.target.value)}
                placeholder="Ej.: BROWNIE CON HELADO"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 42,
                  borderRadius: 10,
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  padding: '0 10px',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  color: 'var(--cp-navy)',
                }}
              />
            </div>

            {/* Categoría */}
            <div style={{ fontWeight: 700, fontSize: 13 }}>Categoría</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categorias.map((cat) => {
                const on = npCategoriaId === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setNpCategoriaId(cat.id);
                      setNpModoElegido(null);
                    }}
                    style={{
                      minHeight: 44,
                      padding: '0 12px',
                      borderRadius: 9999,
                      border: '1.5px solid var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: 12,
                      background: on ? 'var(--cp-navy)' : 'transparent',
                      color: on ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      cursor: 'pointer',
                    }}
                  >
                    {cat.nombre}
                  </button>
                );
              })}
              <button
                onClick={() => setNpNuevaCatAbierta(!npNuevaCatAbierta)}
                style={{
                  minHeight: 44,
                  padding: '0 12px',
                  borderRadius: 9999,
                  border: '1.5px dashed var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: 12,
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  cursor: 'pointer',
                }}
              >
                + Nueva categoría
              </button>
            </div>

            {/* Formulario rápido para crear categoría */}
            {npNuevaCatAbierta && (
              <div
                style={{
                  background: 'var(--cp-white)',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <label style={{ fontWeight: 700, fontSize: 13 }}>
                  Nombre de la categoría nueva
                </label>
                <input
                  type="text"
                  value={npNuevaCatNombre}
                  onChange={(e) => setNpNuevaCatNombre(e.target.value)}
                  placeholder="Ejemplo: Pizzas, Hamburguesas, Ensaladas"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: 44,
                    borderRadius: 10,
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-cream)',
                    padding: '0 12px',
                    fontSize: 14,
                  }}
                />
                <div style={{ fontWeight: 700, fontSize: 13 }}>¿Cómo se venden sus productos?</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setNpNuevaCatConOpc(true)}
                    style={{
                      minHeight: 44,
                      padding: '0 12px',
                      borderRadius: 12,
                      border: '1.5px solid var(--cp-navy)',
                      textAlign: 'left',
                      fontWeight: 700,
                      fontSize: 12,
                      background: npNuevaCatConOpc ? 'var(--cp-navy)' : 'transparent',
                      color: npNuevaCatConOpc ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      cursor: 'pointer',
                    }}
                  >
                    Con tamaños y opciones (como bebidas y waffles)
                  </button>
                  <button
                    onClick={() => setNpNuevaCatConOpc(false)}
                    style={{
                      minHeight: 44,
                      padding: '0 12px',
                      borderRadius: 12,
                      border: '1.5px solid var(--cp-navy)',
                      textAlign: 'left',
                      fontWeight: 700,
                      fontSize: 12,
                      background: !npNuevaCatConOpc ? 'var(--cp-navy)' : 'transparent',
                      color: !npNuevaCatConOpc ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      cursor: 'pointer',
                    }}
                  >
                    Se vende fijo (como postres sueltos)
                  </button>
                </div>
                <button
                  onClick={crearCategoriaRapida}
                  style={{
                    minHeight: 44,
                    border: 0,
                    borderRadius: 10,
                    background: 'var(--cp-navy)',
                    color: 'var(--cp-cream)',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Crear categoría
                </button>
              </div>
            )}

            {/* ¿Cómo se vende? */}
            <div style={{ fontWeight: 700, fontSize: 13 }}>¿Cómo se vende?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  aria-pressed={npModo === 'unico'}
                  onClick={() => setNpModoElegido('unico')}
                  style={{
                    flex: '1 1 220px',
                    minHeight: 44,
                    padding: '10px 12px',
                    borderRadius: 12,
                    textAlign: 'left',
                    border: '1.5px solid var(--cp-navy)',
                    background: npModo === 'unico' ? 'var(--cp-navy)' : 'transparent',
                    color: npModo === 'unico' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 14 }}>Un solo precio</div>
                  <div style={{ fontWeight: 500, fontSize: 12, marginTop: 2 }}>Sirve para productos que se venden siempre igual. Ej.: Brownie S/ 8.</div>
                </button>
                <button
                  type="button"
                  aria-pressed={npModo === 'opciones'}
                  onClick={() => setNpModoElegido('opciones')}
                  style={{
                    flex: '1 1 220px',
                    minHeight: 44,
                    padding: '10px 12px',
                    borderRadius: 12,
                    textAlign: 'left',
                    border: '1.5px solid var(--cp-navy)',
                    background: npModo === 'opciones' ? 'var(--cp-navy)' : 'transparent',
                    color: npModo === 'opciones' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 14 }}>Con tamaños y opciones</div>
                  <div style={{ fontWeight: 500, fontSize: 12, marginTop: 2 }}>Sirve cuando el cliente elige. Ej.: Café Regular 12 oz S/ 6, Grande 16 oz S/ 7; pregunta tipo de leche.</div>
                </button>
            </div>

            {npModo === 'opciones' && (
              <EditorOpcionesTamanos
                modo="borrador"
                valor={npOpc}
                onChange={setNpOpc}
                precioBase={parseFloat(npPrecio) || 0}
                puedeEditar
              />
            )}

            {/* Precio y descripción */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {npModo === 'unico' && (
              <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                  Precio (s/)
                </label>
                <input
                  type="number"
                  step="0.50"
                  value={npPrecio}
                  onChange={(e) => setNpPrecio(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: 42,
                    borderRadius: 10,
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 10px',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    color: 'var(--cp-navy)',
                  }}
                />
              </div>
              )}
              <div style={{ flex: '2 1 260px', minWidth: 0 }}>
                <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                  Descripción corta (opcional)
                </label>
                <input
                  type="text"
                  value={npDesc}
                  onChange={(e) => setNpDesc(e.target.value)}
                  placeholder=""
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: 42,
                    borderRadius: 10,
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 10px',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    color: 'var(--cp-navy)',
                  }}
                />
              </div>
            </div>


            {/* Foto */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 12,
                  background: 'var(--cp-sand)',
                  border: '1.5px dashed var(--cp-soft)',
                  overflow: 'hidden',
                }}
              >
                {npFotoUrl && <img src={npFotoUrl} alt="Foto del producto nuevo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label
                  style={{
                    minHeight: 44,
                    padding: '0 16px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {subidaNpFoto.subiendo ? 'Subiendo imagen…' : npFoto ? 'Cambiar imagen' : 'Subir imagen'}
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Imagen del producto nuevo"
                    disabled={subidaNpFoto.subiendo}
                    onChange={(e) => elegirNpFoto(e.target.files?.[0] ?? null)}
                    style={{ position: 'absolute', left: -9999 }}
                  />
                </label>
                {npFoto && (
                  <button
                    type="button"
                    onClick={() => elegirNpFoto(null)}
                    style={{
                      minHeight: 44,
                      padding: '0 16px',
                      border: '1.5px solid var(--cp-rust)',
                      borderRadius: 12,
                      background: 'transparent',
                      color: 'var(--cp-rust)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Quitar imagen
                  </button>
                )}
              </div>
              <IndicadorSubida estado={subidaNpFoto.estado} error={subidaNpFoto.error} onReintentar={subidaNpFoto.reintentar} />
            </div>

            {npError && (
              <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
                {npError}
              </div>
            )}

            <BotonVistaPrevia
              bloque
              sinGuardar
              gruposGenerales={gruposGenerales}
              borrador={() => ({
                nombre: npNombre.trim().toUpperCase(),
                descripcion: npDesc,
                precio: npModo === 'opciones' ? (npOpc.tamanos.find((t) => t.activo)?.precio ?? 0) : npPrecio,
                categoriaNombre: categorias.find((c) => c.id === npCategoriaId)?.nombre,
                fotoArchivo: npFoto,
                ...(npModo === 'opciones'
                  ? {
                      tamanos: npOpc.tamanos.map((t) => ({ id: t.tamanoValorId, nombre: t.nombre, precio: t.precio, activo: t.activo })),
                      grupos: npOpc.grupos.map((g) => ({ id: g.grupoId, nombre: g.nombre, minimo: g.minimo, maximo: g.maximo, obligatorio: g.requerido })),
                    }
                  : {}),
              })}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={guardarNuevoProducto}
                style={{
                  flex: 1,
                  minHeight: 52,
                  borderRadius: 12,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 15,
                  border: 0,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  cursor: 'pointer',
                }}
              >
                Agregar a la carta
              </button>
              <button
                onClick={() => setModalNuevoAbierto(false)}
                style={{
                  flex: 1,
                  minHeight: 52,
                  borderRadius: 12,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 15,
                  border: '1.5px solid var(--cp-navy)',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* MODAL: EDITAR PRODUCTO                                              */}
      {/* =================================================================== */}
      {productoEnEdicion && (
        <>
          <div
            onClick={() => setProductoEnEdicion(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              background: 'rgba(11,44,62,0.55)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Editar: ${productoEnEdicion.nombre}`}
            style={{
              position: 'fixed',
              zIndex: 60,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%,-50%)',
              width: 'min(620px, calc(100% - 24px))',
              maxHeight: 'calc(100% - 24px)',
              overflowY: 'auto',
              background: 'var(--cp-cream)',
              borderRadius: 20,
              boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 20,
                  lineHeight: '26px',
                }}
              >
                Editar: {productoEnEdicion.nombre}
              </div>
              <button
                onClick={() => setProductoEnEdicion(null)}
                aria-label="Cerrar"
                style={{
                  flex: 'none',
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  border: '1.5px solid var(--cp-navy)',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontSize: 20,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            {/* Nombre */}
            <div>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>Nombre</label>
              <input
                type="text"
                value={edNombre}
                onChange={(e) => setEdNombre(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 48,
                  borderRadius: 12,
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '0 12px',
                  fontSize: 14,
                }}
              />
            </div>

            {/* Categoría */}
            <div>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>
                Categoría
              </label>
              <select
                value={edCategoriaId}
                onChange={(e) => setEdCategoriaId(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 48,
                  borderRadius: 12,
                  border: '1.5px solid var(--cp-navy)',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '0 12px',
                  fontSize: 14,
                }}
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Precio */}
            <div>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>
                Precio (s/)
              </label>
              <input
                type="number"
                step="0.50"
                value={edPrecio}
                onChange={(e) => setEdPrecio(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 48,
                  borderRadius: 12,
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '0 12px',
                  fontSize: 14,
                }}
              />
            </div>

            {/* Mostrar en la carta (misma lógica que Desactivar/Activar) */}
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontWeight: 700 }}
            >
              <input
                type="checkbox"
                checked={!edOculto}
                onChange={(e) => setEdOculto(!e.target.checked)}
                style={{ width: 22, height: 22 }}
              />
              Mostrar en la carta
            </label>

            {/* Sabores gestionables (Donas, Galletas, Pizzas, etc.) */}
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Sabores o variantes</div>
              <div
                style={{
                  background: 'var(--cp-white)',
                  borderRadius: 12,
                  padding: 10,
                  border: '1px solid var(--cp-line)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {edSabores.map((s, sIdx) => {
                    const activo = s.activo !== false;
                    return (
                      <button
                        key={sIdx}
                        onClick={() => {
                          const clon = [...edSabores];
                          clon[sIdx].activo = !activo;
                          setEdSabores(clon);
                        }}
                        style={{
                          minHeight: 36,
                          padding: '0 10px',
                          borderRadius: 9999,
                          border: '1.5px solid var(--cp-navy)',
                          background: activo ? 'var(--cp-navy)' : 'transparent',
                          color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {s.nombre} {activo ? '✓' : '(Agotado)'}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={edNuevoSabor}
                    onChange={(e) => setEdNuevoSabor(e.target.value)}
                    placeholder="Nuevo sabor (ej.: Pistacho, Nutella, Americana)"
                    style={{
                      flex: 1,
                      minHeight: 38,
                      borderRadius: 8,
                      border: '1.5px solid var(--cp-line)',
                      padding: '0 10px',
                      fontSize: 13,
                    }}
                  />
                  <button
                    onClick={() => {
                      if (!edNuevoSabor.trim()) return;
                      setEdSabores([...edSabores, { nombre: edNuevoSabor.trim(), activo: true }]);
                      setEdNuevoSabor('');
                    }}
                    style={{
                      minHeight: 38,
                      padding: '0 14px',
                      borderRadius: 8,
                      border: 0,
                      background: 'var(--cp-navy)',
                      color: 'var(--cp-cream)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    + Agregar
                  </button>
                </div>
              </div>
            </div>

            {/* Imagen */}
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Imagen</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <img
                  src={edFotoUrl || '/logo.png'}
                  alt="Imagen actual"
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 12,
                    objectFit: 'contain',
                    background: 'var(--cp-sand)',
                    border: '1.5px dashed var(--cp-soft)',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label
                    style={{
                      minHeight: 44,
                      padding: '0 16px',
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {subidaEdFoto.subiendo ? 'Subiendo imagen…' : 'Subir imagen'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={manejarSubidaFoto}
                      disabled={subidaEdFoto.subiendo}
                      style={{ position: 'absolute', left: -9999 }}
                    />
                  </label>
                  <IndicadorSubida estado={subidaEdFoto.estado} error={subidaEdFoto.error} onReintentar={subidaEdFoto.reintentar} />
                  {edFotoUrl && (
                    <button
                      onClick={quitarFoto}
                      style={{
                        minHeight: 44,
                        padding: '0 16px',
                        border: '1.5px solid var(--cp-rust)',
                        borderRadius: 12,
                        background: 'transparent',
                        color: 'var(--cp-rust)',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Quitar imagen
                    </button>
                  )}
                </div>
              </div>
            </div>

            {edError && (
              <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
                {edError}
              </div>
            )}

            {puedeEditar && (
              <button
                type="button"
                onClick={() => abrirOpciones(productoEnEdicion!)}
                style={{
                  minHeight: 44,
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: 12,
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Tamaños y opciones · {resumenOpciones(productoEnEdicion!)}
              </button>
            )}

            <BotonVistaPrevia
              bloque
              sinGuardar
              gruposGenerales={gruposGenerales}
              borrador={() => ({
                ...productoEnEdicion,
                nombre: edNombre,
                precio: edPrecio,
                fotoUrl: edFotoUrl,
                categoriaNombre: categorias.find((c) => c.id === edCategoriaId)?.nombre,
                sabores: edSabores,
              })}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={guardarEdicion}
                disabled={guardandoEdicion}
                style={{
                  flex: 1,
                  minHeight: 52,
                  border: 0,
                  borderRadius: 12,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: 'pointer',
                }}
              >
                Guardar
              </button>
              <button
                onClick={() => setProductoEnEdicion(null)}
                style={{
                  flex: 1,
                  minHeight: 52,
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: 12,
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* MODAL: OPCIONES Y TAMAÑOS                                          */}
      {/* =================================================================== */}
      {productoEnOpciones && (
        <>
          <div
            onClick={() => setProductoEnOpciones(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              background: 'rgba(11,44,62,0.55)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Tamaños y opciones"
            style={{
              position: 'fixed',
              zIndex: 60,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%,-50%)',
              width: 'min(1120px, calc(100% - 24px))',
              maxHeight: 'calc(100% - 24px)',
              overflowY: 'auto',
              background: 'var(--cp-cream)',
              borderRadius: 20,
              boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: 22,
                    lineHeight: '27px',
                  }}
                >
                  Tamaños y opciones: {productoEnOpciones.nombre}
                </div>
                <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
                  Tamaños y opciones de este producto.
                </div>
              </div>
              <button
                onClick={() => setProductoEnOpciones(null)}
                aria-label="Cerrar"
                style={{
                  flex: 'none',
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  border: '1.5px solid var(--cp-navy)',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontSize: 20,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <EditorOpcionesTamanos
              key={productoEnOpciones.id}
              modo="guardado"
              producto={productoEnOpciones}
              precioBase={productoEnOpciones.precio}
              puedeEditar={puedeEditar}
              alGuardar={async () => {
                setProductoEnOpciones(null);
                await cargarDatos();
              }}
              alCancelar={() => setProductoEnOpciones(null)}
            />
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* DIÁLOGO GENERAL DE CONFIRMACIÓN (SÍ / NO)                          */}
      {/* =================================================================== */}
      <Confirmar
        abierto={confirmarProps.abierto}
        titulo={confirmarProps.titulo}
        mensaje={confirmarProps.mensaje}
        textoSi="Sí, continuar"
        textoNo="No, cancelar"
        alConfirmar={async () => {
          setConfirmarProps((prev) => ({ ...prev, abierto: false }));
          await confirmarProps.accion();
        }}
        alCancelar={() => setConfirmarProps((prev) => ({ ...prev, abierto: false }))}
      />
    </div>
  );
}
