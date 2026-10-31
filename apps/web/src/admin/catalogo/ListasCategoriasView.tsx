import { useState, useEffect, useMemo } from 'react';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { FiltroCombo } from '../../comun/FiltroCombo';
import { Confirmar } from '../../comun/Confirmar';
import {
  catalogoApi,
  CategoriaAdmin,
  ListaAdmin,
  GrupoOpcionItem,
  ProductoAdmin,
} from './catalogoApi';

// Detectar si una lista es un grupo interno de combos para no mostrarla en la columna izquierda
function esGrupoInternoCombo(lst: ListaAdmin): boolean {
  const n = lst.nombre.trim();
  const c = lst.codigo || '';
  if (n.includes(' · ')) return true;
  if (/^(Bebida|Complemento|Dona|Galleta|Juguete|Porción|Poción)\s+\d+/i.test(n)) return true;
  if (/\(elige\s+\d+\)/i.test(n)) return true;
  if (c.startsWith('GRP_COMBO_') || /_BEBIDA_\d|_COMPLEMENTO_\d|_DONA_\d|_GALLETA_\d/i.test(c)) return true;
  return false;
}

export function ListasCategoriasView() {
  const [categoriasCarta, setCategoriasCarta] = useState<CategoriaAdmin[]>([]);
  const [listas, setListas] = useState<ListaAdmin[]>([]);
  const [grupos, setGrupos] = useState<GrupoOpcionItem[]>([]);
  const [productos, setProductos] = useState<ProductoAdmin[]>([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Categoría/Lista seleccionada a la izquierda
  // 'carta' | 'preg' | lista.id
  const [seleccionId, setSeleccionId] = useState<string>('carta');

  // Formulario nueva categoría de opciones (+ Nueva categoría a la izquierda)
  const [nuevaCatAbierta, setNuevaCatAbierta] = useState(false);
  const [nuevaCatNombre, setNuevaCatNombre] = useState('');

  // Formulario renombrar categoría seleccionada
  const [renombrando, setRenombrando] = useState(false);
  const [renombrarValor, setRenombrarValor] = useState('');

  // Formulario agregar elemento a la lista actual
  const [nuevoItemNombre, setNuevoItemNombre] = useState('');

  // Formulario editar un elemento de la lista
  const [editandoItemId, setEditandoItemId] = useState<string | null>(null);
  const [editandoItemValor, setEditandoItemValor] = useState('');

  // Mensaje de validación / error local
  const [mensajeLocal, setMensajeLocal] = useState('');
  const [filtroGrupos, setFiltroGrupos] = useState<'activos' | 'desactivados' | 'todos'>('activos');

  // Cuadro de confirmación
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

  const pedirConfirmacion = (titulo: string, mensaje: string, accion: () => Promise<void> | void) => {
    setConfirmarProps({
      abierto: true,
      titulo,
      mensaje,
      accion: async () => {
        setConfirmarProps((prev) => ({ ...prev, abierto: false }));
        await accion();
      },
    });
  };

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(null);
      const [cats, lsts, grps, prods] = await Promise.all([
        catalogoApi.listarCategorias(),
        catalogoApi.listarListas(),
        catalogoApi.listarGrupos(),
        catalogoApi.listarProductos({ incluyeOcultos: true }),
      ]);
      setCategoriasCarta(cats);
      setListas(lsts);
      setGrupos(grps);
      setProductos(prods);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar listas y categorías');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Construir categorías de la izquierda
  const opcionesIzquierda = useMemo(() => {
    const catsItems: Array<{
      id: string;
      nombre: string;
      tipo: 'carta' | 'preg' | 'tam' | 'opc' | 'grp';
      subtitulo: string;
      itemsCount: number;
    }> = [];

    // 1. Categorías de la carta
    catsItems.push({
      id: 'carta',
      nombre: 'Categorías de la carta',
      tipo: 'carta',
      subtitulo: `Productos · ${categoriasCarta.length} ${categoriasCarta.length === 1 ? 'elemento' : 'elementos'}`,
      itemsCount: categoriasCarta.length,
    });

    // 2. Dónde se pregunta cada grupo
    catsItems.push({
      id: 'preg',
      nombre: 'Dónde se pregunta cada grupo',
      tipo: 'preg',
      subtitulo: `Preguntas · ${grupos.length} ${grupos.length === 1 ? 'elemento' : 'elementos'}`,
      itemsCount: grupos.length,
    });

    // 3. Listas administradas desde API (ocultando grupos internos de combos)
    listas
      .filter((lst) => !esGrupoInternoCombo(lst))
      .forEach((lst) => {
      let tipo: 'tam' | 'opc' | 'grp' = 'opc';
      let tipoTxt = 'Opciones';
      const cLower = lst.codigo?.toLowerCase() || '';
      const nLower = lst.nombre.toLowerCase();

      if (cLower.includes('tam') || nLower.includes('tamaño') || nLower.includes('presentac')) {
        tipo = 'tam';
        tipoTxt = 'Tamaños';
      } else if (cLower.includes('grp') || nLower.includes('tipos de grupo')) {
        tipo = 'grp';
        tipoTxt = 'Tipos de grupo';
      }

      const count = lst.valores?.filter((v) => v.activo).length ?? 0;
      catsItems.push({
        id: lst.id,
        nombre: lst.nombre,
        tipo,
        subtitulo: `${tipoTxt} · ${count} ${count === 1 ? 'elemento' : 'elementos'}`,
        itemsCount: count,
      });
    });

    return catsItems;
  }, [categoriasCarta, grupos, listas]);

  // Categoría seleccionada actualmente
  const itemIzquierdaActual = opcionesIzquierda.find((x) => x.id === seleccionId) || opcionesIzquierda[0];

  // Textos y ayudas según la selección
  const { tituloDerecha, subtituloDerecha, textoAyuda, labelAgregar, puedeRenombrar } = useMemo(() => {
    if (!itemIzquierdaActual) {
      return {
        tituloDerecha: '',
        subtituloDerecha: '',
        textoAyuda: '',
        labelAgregar: '',
        puedeRenombrar: false,
      };
    }

    if (itemIzquierdaActual.id === 'carta') {
      return {
        tituloDerecha: 'Categorías de la carta',
        subtituloDerecha: 'Productos',
        textoAyuda:
          'Las categorías del menú (Frappes, Postres, Pizzas…). Cada una dice si sus productos llevan tamaños y opciones (como un cappuccino) o se venden fijos (como la media docena de donas). Si falta una, créala aquí o al agregar un producto.',
        labelAgregar: 'Nueva categoría de la carta (se crea con tamaños y opciones; puedes cambiarlo abajo)',
        puedeRenombrar: false,
      };
    }

    if (itemIzquierdaActual.id === 'preg') {
      return {
        tituloDerecha: 'Dónde se pregunta cada grupo',
        subtituloDerecha: 'Preguntas',
        textoAyuda:
          'Cada grupo de opciones (tipo de leche, endulzante, extras…) se pregunta en las categorías que marques: todos sus productos lo llevan. Para un producto suelto se usa Opciones y tamaños. Un cambio aquí vale para todos los productos de esas categorías.',
        labelAgregar: '',
        puedeRenombrar: false,
      };
    }

    const lst = listas.find((l) => l.id === itemIzquierdaActual.id);
    const nom = lst?.nombre || itemIzquierdaActual.nombre;
    const tipo = itemIzquierdaActual.tipo;

    let sub = 'Opciones';
    let ayuda = `Solo opciones de esta categoría. Los grupos de tipo «${nom}» solo muestran esta lista al elegir la opción.`;
    let lbl = `Nuevo elemento de «${nom}»`;

    if (tipo === 'tam') {
      sub = 'Tamaños';
      if (nom.toLowerCase().includes('bebida')) {
        ayuda = 'Solo tamaños de bebida (12 oz, 16 oz…). Los productos de bebidas solo ven esta lista en «Tamaño».';
      } else {
        ayuda =
          'Cómo se vende un producto que no es bebida: media docena, porción, bandeja, tajada… Los demás productos solo ven esta lista en «Tamaño».';
      }
      lbl = 'Nuevo tamaño';
    } else if (tipo === 'grp') {
      sub = 'Tipos de grupo';
      ayuda =
        'Los tipos de grupo son las preguntas que se le hacen al cliente (Tipo de leche, Endúlzalo con…). Cada uno usa una categoría de opciones.';
      lbl = 'Nuevo tipo de grupo';
    }

    return {
      tituloDerecha: nom,
      subtituloDerecha: sub,
      textoAyuda: ayuda,
      labelAgregar: lbl,
      puedeRenombrar: tipo === 'opc',
    };
  }, [itemIzquierdaActual, listas]);

  // Handlers para la izquierda
  const handleCrearCategoriaOpciones = async () => {
    const val = nuevaCatNombre.trim();
    if (val.length < 2) {
      setMensajeLocal('Escribe el nombre de la categoría (mínimo 2 letras).');
      return;
    }
    const existe = listas.some((l) => l.nombre.toLowerCase() === val.toLowerCase());
    if (existe) {
      setMensajeLocal(`Ya existe una categoría llamada «${val}».`);
      return;
    }

    try {
      const nueva = await catalogoApi.crearLista({ nombre: val });
      setListas((prev) => [...prev, nueva]);
      setSeleccionId(nueva.id);
      setNuevaCatNombre('');
      setNuevaCatAbierta(false);
      setMensajeLocal('');
    } catch (err: any) {
      setMensajeLocal(err?.message || 'Error al crear la categoría');
    }
  };

  const handleGuardarRenombrar = async () => {
    const val = renombrarValor.trim();
    if (val.length < 2) {
      setMensajeLocal('El nombre necesita al menos 2 letras.');
      return;
    }
    try {
      await catalogoApi.actualizarLista(itemIzquierdaActual.id, { nombre: val });
      setListas((prev) =>
        prev.map((l) => (l.id === itemIzquierdaActual.id ? { ...l, nombre: val } : l)),
      );
      setRenombrando(false);
      setMensajeLocal('');
    } catch (err: any) {
      setMensajeLocal(err?.message || 'Error al renombrar');
    }
  };

  // Handlers para agregar elemento a la derecha
  const handleAgregarItem = async () => {
    const val = nuevoItemNombre.trim();
    if (itemIzquierdaActual.id === 'carta') {
      if (val.length < 3) {
        setMensajeLocal('Escribe el nombre (mínimo 3 letras).');
        return;
      }
      const existe = categoriasCarta.some((c) => c.nombre.toLowerCase() === val.toLowerCase());
      if (existe) {
        setMensajeLocal(`«${val}» ya existe.`);
        return;
      }
      try {
        const nueva = await catalogoApi.crearCategoria({
          nombre: val,
          llevaOpciones: true,
          oculta: false,
        });
        setCategoriasCarta((prev) => [...prev, nueva]);
        setNuevoItemNombre('');
        setMensajeLocal('');
      } catch (err: any) {
        setMensajeLocal(err?.message || 'Error al crear categoría de carta');
      }
      return;
    }

    if (val.length < 2) {
      setMensajeLocal('Escribe el nombre (mínimo 2 letras).');
      return;
    }

    const lst = listas.find((l) => l.id === itemIzquierdaActual.id);
    if (!lst) return;

    const existe = lst.valores?.some((v) => v.nombre.toLowerCase() === val.toLowerCase());
    if (existe) {
      setMensajeLocal(`«${val}» ya está en esta lista.`);
      return;
    }

    try {
      const nuevo = await catalogoApi.agregarValor(lst.id, { nombre: val });
      setListas((prev) =>
        prev.map((l) =>
          l.id === lst.id ? { ...l, valores: [...(l.valores || []), nuevo] } : l,
        ),
      );
      setNuevoItemNombre('');
      setMensajeLocal('');
    } catch (err: any) {
      setMensajeLocal(err?.message || 'Error al agregar elemento');
    }
  };

  // Guardar edición de un item
  const handleGuardarEdicionItem = async (itemId: string) => {
    const val = editandoItemValor.trim();
    if (itemIzquierdaActual.id === 'carta') {
      if (val.length < 3) {
        setMensajeLocal('El nombre necesita al menos 3 letras.');
        return;
      }
      try {
        await catalogoApi.actualizarCategoria(itemId, { nombre: val });
        setCategoriasCarta((prev) =>
          prev.map((c) => (c.id === itemId ? { ...c, nombre: val } : c)),
        );
        setEditandoItemId(null);
        setMensajeLocal('');
      } catch (err: any) {
        setMensajeLocal(err?.message || 'Error al editar categoría');
      }
      return;
    }

    if (val.length < 2) {
      setMensajeLocal('El nombre necesita al menos 2 letras.');
      return;
    }

    try {
      await catalogoApi.actualizarValor(itemId, { nombre: val });
      setListas((prev) =>
        prev.map((l) => {
          if (l.id !== itemIzquierdaActual.id) return l;
          return {
            ...l,
            valores: l.valores?.map((v) => (v.id === itemId ? { ...v, nombre: val } : v)),
          };
        }),
      );
      setEditandoItemId(null);
      setMensajeLocal('');
    } catch (err: any) {
      setMensajeLocal(err?.message || 'Error al editar valor');
    }
  };

  // Alternar visibilidad de categoría de la carta
  const handleAlternarCategoriaCarta = (cat: CategoriaAdmin) => {
    pedirConfirmacion(
      `¿${cat.oculta ? 'Mostrar' : 'Ocultar'} categoría «${cat.nombre}»?`,
      cat.oculta
        ? 'Volverá a aparecer en la carta virtual y en las búsquedas.'
        : 'Los clientes no verán esta categoría en la carta virtual. No se borra nada.',
      async () => {
        if (cat.oculta) {
          await catalogoApi.mostrarCategoria(cat.id);
          setCategoriasCarta((prev) =>
            prev.map((c) => (c.id === cat.id ? { ...c, oculta: false } : c)),
          );
        } else {
          await catalogoApi.ocultarCategoria(cat.id);
          setCategoriasCarta((prev) =>
            prev.map((c) => (c.id === cat.id ? { ...c, oculta: true } : c)),
          );
        }
      },
    );
  };

  // Alternar si la categoría lleva opciones o se vende fijo
  const handleAlternarLlevaOpciones = async (cat: CategoriaAdmin) => {
    const nuevoValor = !cat.llevaOpciones;
    try {
      await catalogoApi.actualizarCategoria(cat.id, { llevaOpciones: nuevoValor });
      setCategoriasCarta((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, llevaOpciones: nuevoValor } : c)),
      );
    } catch (err: any) {
      setMensajeLocal(err?.message || 'Error al cambiar modo de opciones');
    }
  };

  // Alternar valor de una lista
  const handleAlternarValor = (valorId: string, nombreValor: string, activoActual: boolean) => {
    pedirConfirmacion(
      `¿${activoActual ? 'Ocultar' : 'Activar'} «${nombreValor}»?`,
      activoActual
        ? 'Dejará de ofrecerse en opciones y tamaños. Los productos que ya lo usan conservan su valor hasta que se editen.'
        : 'Volverá a estar disponible para seleccionarse.',
      async () => {
        await catalogoApi.alternarValor(valorId);
        setListas((prev) =>
          prev.map((l) => {
            if (l.id !== itemIzquierdaActual.id) return l;
            return {
              ...l,
              valores: l.valores?.map((v) =>
                v.id === valorId ? { ...v, activo: !activoActual } : v,
              ),
            };
          }),
        );
      },
    );
  };

  const gruposVisibles = grupos.filter((g) =>
    filtroGrupos === 'todos' ? true : filtroGrupos === 'activos' ? g.activo !== false : g.activo === false,
  );

  const pedirAlternarGrupo = (grp: GrupoOpcionItem, n: number) => {
    const activar = grp.activo === false;
    pedirConfirmacion(
      activar ? `Activar «${grp.nombre}»` : `Desactivar «${grp.nombre}»`,
      activar
        ? `Volverá a mostrarse en ${n} ${n === 1 ? 'producto' : 'productos'} de la carta, el bot y el mozo.`
        : `Dejará de mostrarse en ${n} ${n === 1 ? 'producto' : 'productos'} de la carta, el bot y el mozo.`,
      async () => {
        try {
          const r = await catalogoApi.actualizarGrupo(grp.id, { activo: activar });
          setGrupos((prev) => prev.map((g) => (g.id === grp.id ? { ...g, activo: r.activo ?? activar } : g)));
        } catch (err: any) {
          setMensajeLocal(err?.message || 'No se pudo cambiar el grupo');
        }
      },
    );
  };

  // Dónde se pregunta cada grupo: alternar asignación a una categoría
  const handleAlternarGrupoCategoria = async (grupo: GrupoOpcionItem, catId: string) => {
    const actuales = grupo.categoriaIds || [];
    const asignada = actuales.includes(catId);
    const nuevas = asignada ? actuales.filter((id) => id !== catId) : [...actuales, catId];

    try {
      await catalogoApi.asignarGrupoCategorias(grupo.id, nuevas);
      setGrupos((prev) =>
        prev.map((g) => (g.id === grupo.id ? { ...g, categoriaIds: nuevas } : g)),
      );
    } catch (err: any) {
      setMensajeLocal(err?.message || 'Error al asignar categoría al grupo');
    }
  };

  if (cargando && categoriasCarta.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Cargando mensaje="Cargando listas y categorías…" />
      </div>
    );
  }

  if (error && categoriasCarta.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <EstadoError mensaje={error} alReintentar={cargarDatos} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 1. Tarjeta informativa superior igualita al mockup */}
      <div
        style={{
          fontSize: 13,
          lineHeight: '19px',
          background: 'var(--cp-white)',
          border: '1px dashed var(--cp-navy)',
          borderRadius: 12,
          padding: '10px 12px',
        }}
      >
        Cada apartado tiene <b>su propia lista</b>: «Tamaños» solo tiene tamaños, «Endulzantes» solo
        endulzantes, y así. Aquí se crean y se corrigen; en Opciones y tamaños, cada combo muestra
        únicamente la lista que le corresponde y también deja crear uno nuevo al momento. Nada se
        elimina: lo oculto deja de ofrecerse y se puede volver a activar.
      </div>

      {/* 2. Disposición en 2 columnas (responsive) */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        {/* COLUMNA IZQUIERDA: Menú de categorías / listas */}
        <div
          style={{
            flex: '1 1 260px',
            maxWidth: 340,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Botón + Nueva categoría */}
          <button
            onClick={() => {
              setNuevaCatAbierta(!nuevaCatAbierta);
              setNuevaCatNombre('');
              setMensajeLocal('');
            }}
            style={{
              minHeight: 48,
              padding: '0 16px',
              border: 0,
              borderRadius: 12,
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {nuevaCatAbierta ? 'Cerrar' : '+ Nueva categoría'}
          </button>

          {/* Formulario desplegable para nueva categoría */}
          {nuevaCatAbierta && (
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
              <label htmlFor="lsnew" style={{ fontWeight: 700, fontSize: 13 }}>
                Nombre de la categoría de opciones
              </label>
              <input
                id="lsnew"
                type="text"
                value={nuevaCatNombre}
                onChange={(e) => setNuevaCatNombre(e.target.value)}
                placeholder="Ejemplo: Salsas, Toppings, Rellenos"
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
              <button
                onClick={handleCrearCategoriaOpciones}
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
              <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
                Se crea vacía y también aparece como tipo de grupo para usarla en Opciones y tamaños.
              </div>
            </div>
          )}

          {/* Lista de botones de categorías de la izquierda */}
          {opcionesIzquierda.map((opc) => {
            const activa = seleccionId === opc.id;
            return (
              <button
                key={opc.id}
                onClick={() => {
                  setSeleccionId(opc.id);
                  setNuevoItemNombre('');
                  setEditandoItemId(null);
                  setRenombrando(false);
                  setMensajeLocal('');
                }}
                style={{
                  textAlign: 'left',
                  minHeight: 56,
                  padding: '8px 14px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: 12,
                  background: activa ? 'var(--cp-navy)' : 'var(--cp-white)',
                  color: activa ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  {opc.nombre}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: activa ? 'var(--cp-cream)' : 'var(--cp-soft)',
                  }}
                >
                  {opc.subtitulo}
                </span>
              </button>
            );
          })}
        </div>

        {/* COLUMNA DERECHA: Contenido de la categoría seleccionada */}
        <div
          style={{
            flex: '2 1 380px',
            minWidth: 0,
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Cabecera del panel derecho */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 20,
                }}
              >
                {tituloDerecha}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>
                {subtituloDerecha}
              </div>
            </div>

            {puedeRenombrar && (
              <button
                onClick={() => {
                  setRenombrando(!renombrando);
                  setRenombrarValor(tituloDerecha);
                  setMensajeLocal('');
                }}
                style={{
                  minHeight: 44,
                  padding: '0 14px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: 10,
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Cambiar nombre
              </button>
            )}
          </div>

          {/* Formulario cambiar nombre de la categoría */}
          {renombrando && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                id="lsren"
                type="text"
                value={renombrarValor}
                onChange={(e) => setRenombrarValor(e.target.value)}
                aria-label="Nuevo nombre de la categoría"
                style={{
                  flex: '1 1 200px',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  minHeight: 44,
                  borderRadius: 10,
                  border: '1.5px solid var(--cp-navy)',
                  background: 'var(--cp-white)',
                  padding: '0 12px',
                  fontSize: 14,
                }}
              />
              <button
                onClick={handleGuardarRenombrar}
                style={{
                  minHeight: 44,
                  padding: '0 14px',
                  border: 0,
                  borderRadius: 10,
                  background: 'var(--cp-navy)',
                  color: 'var(--cp-cream)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Guardar
              </button>
              <button
                onClick={() => setRenombrando(false)}
                style={{
                  minHeight: 44,
                  padding: '0 14px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: 10,
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Texto de ayuda descriptivo */}
          <div style={{ fontSize: 13, lineHeight: '19px', color: 'var(--cp-soft)' }}>
            {textoAyuda}
          </div>

          {/* Caja para agregar elemento nuevo */}
          {itemIzquierdaActual.id !== 'preg' && (
            <div
              style={{
                background: 'var(--cp-sand)',
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <label htmlFor="lsadd" style={{ fontWeight: 800, fontSize: 13 }}>
                {labelAgregar}
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  id="lsadd"
                  type="text"
                  value={nuevoItemNombre}
                  onChange={(e) => setNuevoItemNombre(e.target.value)}
                  placeholder="Escribe el nombre"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAgregarItem();
                  }}
                  style={{
                    flex: '1 1 200px',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    minHeight: 44,
                    borderRadius: 10,
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 12px',
                    fontSize: 14,
                  }}
                />
                <button
                  onClick={handleAgregarItem}
                  style={{
                    minHeight: 44,
                    padding: '0 16px',
                    border: 0,
                    borderRadius: 10,
                    background: 'var(--cp-navy)',
                    color: 'var(--cp-cream)',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Agregar a la lista
                </button>
              </div>
            </div>
          )}

          {/* Mensaje de error/alerta local si hay */}
          {mensajeLocal && (
            <div
              role="alert"
              style={{
                border: '1.5px solid var(--cp-rust)',
                borderRadius: 10,
                padding: '8px 10px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--cp-rust)',
              }}
            >
              {mensajeLocal}
            </div>
          )}

          {/* Listado de elementos */}
          {/* CASO 1: Categorías de la carta */}
          {itemIzquierdaActual.id === 'carta' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categoriasCarta.length === 0 ? (
                <div
                  style={{
                    border: '1.5px dashed var(--cp-line)',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 13,
                    color: 'var(--cp-soft)',
                  }}
                >
                  Esta lista está vacía. Agrega la primera categoría arriba.
                </div>
              ) : (
                categoriasCarta.map((cat) => {
                  const enEdicion = editandoItemId === cat.id;
                  const cantProductos = productos.filter((p) => p.categoriaId === cat.id).length;
                  const usosTexto = cantProductos
                    ? `${cantProductos} ${cantProductos === 1 ? 'producto' : 'productos'}`
                    : 'Sin productos todavía';

                  return (
                    <div
                      key={cat.id}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        border: '1px solid var(--cp-line)',
                        borderRadius: 12,
                        padding: '8px 10px',
                        opacity: cat.oculta ? 0.6 : 1,
                      }}
                    >
                      {!enEdicion ? (
                        <>
                          <div style={{ flex: '2 1 180px', minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{cat.nombre}</div>
                            <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
                              {usosTexto}
                            </div>
                          </div>

                          <button
                            onClick={() => handleAlternarLlevaOpciones(cat)}
                            style={{
                              minHeight: 44,
                              padding: '0 12px',
                              borderRadius: 9999,
                              border: '1.5px solid var(--cp-navy)',
                              fontWeight: 700,
                              fontSize: 12,
                              background: cat.llevaOpciones
                                ? 'var(--cp-gold)'
                                : 'transparent',
                              color: 'var(--cp-navy)',
                              cursor: 'pointer',
                            }}
                          >
                            {cat.llevaOpciones ? 'Con tamaños y opciones' : 'Se vende fijo'}
                          </button>

                          <button
                            onClick={() => {
                              setEditandoItemId(cat.id);
                              setEditandoItemValor(cat.nombre);
                              setMensajeLocal('');
                            }}
                            aria-label={`Editar nombre de ${cat.nombre}`}
                            style={{
                              minHeight: 44,
                              padding: '0 12px',
                              border: '1.5px solid var(--cp-navy)',
                              borderRadius: 10,
                              background: 'transparent',
                              color: 'var(--cp-navy)',
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            ✎ Editar
                          </button>

                          <button
                            onClick={() => handleAlternarCategoriaCarta(cat)}
                            style={{
                              minHeight: 44,
                              padding: '0 12px',
                              borderRadius: 9999,
                              border: '1.5px solid var(--cp-navy)',
                              fontWeight: 700,
                              fontSize: 12,
                              background: !cat.oculta ? 'var(--cp-green)' : 'transparent',
                              color: !cat.oculta ? 'var(--cp-white)' : 'var(--cp-navy)',
                              cursor: 'pointer',
                            }}
                          >
                            {!cat.oculta ? 'Visible' : 'Oculta'}
                          </button>
                        </>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, flex: '1 1 100%', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            value={editandoItemValor}
                            onChange={(e) => setEditandoItemValor(e.target.value)}
                            aria-label="Nuevo nombre"
                            style={{
                              flex: '1 1 180px',
                              minWidth: 0,
                              boxSizing: 'border-box',
                              minHeight: 44,
                              borderRadius: 10,
                              border: '1.5px solid var(--cp-navy)',
                              background: 'var(--cp-white)',
                              padding: '0 12px',
                              fontSize: 14,
                            }}
                          />
                          <button
                            onClick={() => handleGuardarEdicionItem(cat.id)}
                            style={{
                              minHeight: 44,
                              padding: '0 14px',
                              border: 0,
                              borderRadius: 10,
                              background: 'var(--cp-navy)',
                              color: 'var(--cp-cream)',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditandoItemId(null)}
                            style={{
                              minHeight: 44,
                              padding: '0 14px',
                              border: '1.5px solid var(--cp-navy)',
                              borderRadius: 10,
                              background: 'transparent',
                              color: 'var(--cp-navy)',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* CASO 2: Dónde se pregunta cada grupo */}
          {itemIzquierdaActual.id === 'preg' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <FiltroCombo
                  etiqueta="Grupos"
                  valor={filtroGrupos}
                  valorPorDefecto="activos"
                  opciones={[
                    { valor: 'activos', etiqueta: 'Activos' },
                    { valor: 'desactivados', etiqueta: 'Desactivados' },
                    { valor: 'todos', etiqueta: 'Todos' },
                  ]}
                  alCambiar={(v) => setFiltroGrupos(v as typeof filtroGrupos)}
                />
              </div>
              {gruposVisibles.length === 0 ? (
                <div
                  style={{
                    border: '1.5px dashed var(--cp-line)',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 13,
                    color: 'var(--cp-soft)',
                  }}
                >
                  No hay grupos de opciones en esta vista.
                </div>
              ) : (
                gruposVisibles.map((grp) => {
                  const desactivado = grp.activo === false;
                  const cantProds =
                    grp.productosCount ??
                    productos.filter((p) => p.grupos?.some((g) => g.id === grp.id)).length;
                  const optsActivas = grp.opciones?.filter((o) => o.activo !== false).length ?? 0;
                  const usesTexto = `Se pregunta en ${cantProds} ${
                    cantProds === 1 ? 'producto' : 'productos'
                  }${optsActivas ? ` · ${optsActivas} opciones activas` : ' · sin opciones todavía'}`;

                  return (
                    <div
                      key={grp.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        border: '1px solid var(--cp-line)',
                        borderRadius: 12,
                        padding: '10px 12px',
                        opacity: desactivado ? 0.55 : 1,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {grp.nombre}
                          {desactivado && (
                            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--cp-soft)' }}>
                              Desactivado
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
                          {usesTexto}
                        </div>
                      </div>

                      {/* Chips de categorías de la carta */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {categoriasCarta.map((cat) => {
                          const estaEnCat = (grp.categoriaIds || []).includes(cat.id);
                          return (
                            <button
                              key={cat.id}
                              onClick={() => handleAlternarGrupoCategoria(grp, cat.id)}
                              style={{
                                minHeight: 44,
                                padding: '0 12px',
                                borderRadius: 9999,
                                border: '1.5px solid var(--cp-navy)',
                                fontWeight: 700,
                                fontSize: 12,
                                background: estaEnCat ? 'var(--cp-navy)' : 'transparent',
                                color: estaEnCat ? 'var(--cp-cream)' : 'var(--cp-navy)',
                                cursor: 'pointer',
                              }}
                            >
                              {cat.nombre}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => pedirAlternarGrupo(grp, cantProds)}
                        style={{
                          minHeight: 44,
                          alignSelf: 'flex-start',
                          padding: '0 14px',
                          borderRadius: 9999,
                          border: '1.5px solid var(--cp-navy)',
                          background: 'transparent',
                          color: 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {desactivado ? 'Activar grupo' : 'Desactivar grupo'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* CASO 3: Listas y valores (Tamaños, Leches, Endulzantes, etc.) */}
          {itemIzquierdaActual.id !== 'carta' && itemIzquierdaActual.id !== 'preg' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(() => {
                const lstActual = listas.find((l) => l.id === itemIzquierdaActual.id);
                const valores = lstActual?.valores || [];

                if (valores.length === 0) {
                  return (
                    <div
                      style={{
                        border: '1.5px dashed var(--cp-line)',
                        borderRadius: 12,
                        padding: 14,
                        fontSize: 13,
                        color: 'var(--cp-soft)',
                      }}
                    >
                      Esta lista está vacía. Agrega el primer elemento arriba.
                    </div>
                  );
                }

                return valores.map((val) => {
                  const enEdicion = editandoItemId === val.id;
                  const isTam = itemIzquierdaActual.tipo === 'tam';
                  const isGrp = itemIzquierdaActual.tipo === 'grp';

                  // Calcular uso aproximado
                  let usosTexto = 'Sin usar todavía';
                  if (isTam) {
                    const k = productos.filter((p) =>
                      p.tamanos?.some((t) => t.nombre.toLowerCase() === val.nombre.toLowerCase()),
                    ).length;
                    if (k > 0) {
                      usosTexto = `En ${k} ${k === 1 ? 'producto' : 'productos'}`;
                    }
                  } else if (isGrp) {
                    const k = grupos.filter(
                      (g) => g.nombre.toLowerCase() === val.nombre.toLowerCase(),
                    ).length;
                    if (k > 0) {
                      usosTexto = `${k} ${k === 1 ? 'grupo lo usa' : 'grupos lo usan'}`;
                    }
                  } else {
                    const k = productos.filter((p) =>
                      p.grupos?.some((g) =>
                        g.opciones?.some(
                          (o) => o.nombre.toLowerCase() === val.nombre.toLowerCase(),
                        ),
                      ),
                    ).length;
                    if (k > 0) {
                      usosTexto = `Se ofrece en ${k} ${k === 1 ? 'producto' : 'productos'}`;
                    }
                  }

                  return (
                    <div
                      key={val.id}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        border: '1px solid var(--cp-line)',
                        borderRadius: 12,
                        padding: '8px 10px',
                        opacity: val.activo ? 1 : 0.6,
                      }}
                    >
                      {!enEdicion ? (
                        <>
                          <div style={{ flex: '2 1 180px', minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{val.nombre}</div>
                            <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
                              {usosTexto}
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setEditandoItemId(val.id);
                              setEditandoItemValor(val.nombre);
                              setMensajeLocal('');
                            }}
                            aria-label={`Editar nombre de ${val.nombre}`}
                            style={{
                              minHeight: 44,
                              padding: '0 12px',
                              border: '1.5px solid var(--cp-navy)',
                              borderRadius: 10,
                              background: 'transparent',
                              color: 'var(--cp-navy)',
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            ✎ Editar
                          </button>

                          <button
                            onClick={() => handleAlternarValor(val.id, val.nombre, val.activo)}
                            style={{
                              minHeight: 44,
                              padding: '0 12px',
                              borderRadius: 9999,
                              border: '1.5px solid var(--cp-navy)',
                              fontWeight: 700,
                              fontSize: 12,
                              background: val.activo ? 'var(--cp-green)' : 'transparent',
                              color: val.activo ? 'var(--cp-white)' : 'var(--cp-navy)',
                              cursor: 'pointer',
                            }}
                          >
                            {val.activo ? 'Activo' : 'Oculto'}
                          </button>
                        </>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, flex: '1 1 100%', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            value={editandoItemValor}
                            onChange={(e) => setEditandoItemValor(e.target.value)}
                            aria-label="Nuevo nombre"
                            style={{
                              flex: '1 1 180px',
                              minWidth: 0,
                              boxSizing: 'border-box',
                              minHeight: 44,
                              borderRadius: 10,
                              border: '1.5px solid var(--cp-navy)',
                              background: 'var(--cp-white)',
                              padding: '0 12px',
                              fontSize: 14,
                            }}
                          />
                          <button
                            onClick={() => handleGuardarEdicionItem(val.id)}
                            style={{
                              minHeight: 44,
                              padding: '0 14px',
                              border: 0,
                              borderRadius: 10,
                              background: 'var(--cp-navy)',
                              color: 'var(--cp-cream)',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditandoItemId(null)}
                            style={{
                              minHeight: 44,
                              padding: '0 14px',
                              border: '1.5px solid var(--cp-navy)',
                              borderRadius: 10,
                              background: 'transparent',
                              color: 'var(--cp-navy)',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* Nota al pie idéntica al mockup */}
          <div style={{ fontSize: 12, color: 'var(--cp-soft)', lineHeight: '17px' }}>
            Al cambiar un nombre aquí, los productos que ya lo usan lo conservan hasta que se editen
            en Opciones y tamaños.
          </div>
        </div>
      </div>

      {/* Cuadro de confirmación modal */}
      <Confirmar
        abierto={confirmarProps.abierto}
        titulo={confirmarProps.titulo}
        mensaje={confirmarProps.mensaje}
        textoConfirmar="Sí"
        textoNo="No"
        alConfirmar={confirmarProps.accion}
        alCancelar={() => setConfirmarProps((prev) => ({ ...prev, abierto: false }))}
      />
    </div>
  );
}
