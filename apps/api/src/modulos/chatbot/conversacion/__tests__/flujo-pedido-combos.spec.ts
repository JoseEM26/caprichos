import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';
import { carritoTrasComboRechazado } from '../flujos/pedido/flujo-pedido';
import { comboVendibleBot, productosComboNoBot } from '../flujos/pedido/combo-bot';
import { TEXTOS_BOT } from '../textos-bot';

/**
 * Combos por WhatsApp: el bot guía el tamaño, las opciones del anfitrión y las partes del combo (plan B, listas
 * con «Ver más», sabores) y manda la línea con ofertaId y comboElecciones, igual que la carta.
 */
describe('Flujo de Pedido: combos con elecciones', () => {
  const bebidas = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `op_f${i + 1}`, nombre: `Frappe ${i + 1}`, precioExtra: 0, disponible: true }));
  const grupoBebida = (paso: number, n = 3) => ({
    id: `grp_beb${paso}`,
    nombre: `Bebida ${paso} · Bebida`,
    minimo: 1,
    maximo: 1,
    obligatorio: true,
    opciones: bebidas(n),
  });

  const duo = {
    id: 'prod_duo',
    nombre: 'Combo Dúo Irresistible',
    precio: 37,
    disponible: true,
    tamanos: [
      { id: 'tam_reg', nombre: 'Regular', precio: 37 },
      { id: 'tam_gra', nombre: 'Grande', precio: 41 },
    ],
    grupos: [grupoBebida(1), grupoBebida(2)],
  };
  const cajita = { id: 'prod_cajita', nombre: 'Cajita Caprikids', precio: 27, disponible: true, tamanos: [], grupos: [] };
  const duoSoloCarta = { id: 'prod_duo_carta', nombre: 'Combo Dúo Compartir', precio: 33, disponible: true, tamanos: [], grupos: [] };
  const categoriaCombos = { id: 'cat_combos', nombre: 'Combos', productos: [duo, cajita, duoSoloCarta] };

  const opcion = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({ id, nombre, disponible: true, ...extra });
  const parteClub = (extra: Record<string, unknown> = {}) => ({
    id: 'parte_club',
    tipo: 'FIJO',
    cantidad: 1,
    categorias: [],
    productos: ['p_club'],
    principalNombre: 'Club Sándwich',
    disponible: true,
    alternativasActivas: false,
    alternativas: [
      { ...opcion('p_emp', 'Empanada'), cantidad: 1 },
      { ...opcion('p_cro', 'Croissant'), cantidad: 1 },
    ],
    ...extra,
  });
  const parteBebidas = { id: 'parte_beb', tipo: 'A_ELECCION', cantidad: 2, categorias: ['cat_frappes'], productos: [], alternativas: [] };
  const comboDuo = (extra: Record<string, unknown> = {}, parteFija: Record<string, unknown> = {}) => ({
    id: 'of_duo',
    tipo: 'COMBO',
    nombre: 'Combo Dúo Irresistible',
    activo: true,
    vigenteAhora: true,
    disponible: true,
    canales: ['CARTA', 'ADMIN', 'BOT'],
    alcanceProductoId: 'prod_duo',
    combosPrecio: [
      { tamanoNombre: 'Regular', precio: 37 },
      { tamanoNombre: 'Grande', precio: 41 },
    ],
    combosParte: [parteBebidas, parteClub(parteFija)],
    ...extra,
  });
  const comboCajita = (opciones: any[], extra: Record<string, unknown> = {}) => ({
    id: 'of_cajita',
    tipo: 'COMBO',
    nombre: 'Cajita Caprikids',
    activo: true,
    vigenteAhora: true,
    disponible: true,
    canales: ['CARTA', 'ADMIN', 'BOT'],
    alcanceProductoId: 'prod_cajita',
    combosPrecio: [],
    combosParte: [{ id: 'parte_jug', tipo: 'A_ELECCION', cantidad: 2, categorias: [], productos: opciones.map((o) => o.id), alternativas: [], opcionesDetalle: opciones }],
    ...extra,
  });
  const juguetes = [opcion('j_sirena', 'Sirena'), opcion('j_burbujas', 'Burbujas'), opcion('j_pelota', 'Pelota')];

  const ctx = (ofertas: any[], extra: Partial<ContextoConversacion> = {}): ContextoConversacion => ({
    nombreCliente: 'Carlos Test',
    telefonoCliente: '987654321',
    cartaUrlPublica: 'https://carta.caprichos.pe',
    datosLocal: { abierta: true, abre: '12:00', cierra: '23:00', direccion: 'Campoy', enlaceMapa: 'https://m', pausaAltaDemanda: false, altaDemandaMinutosExtra: 0 },
    datosLocalPublicos: { tiempo_base: 25, tiempo_maximo: 35, mediosPagoVisibles: { efectivo: { activo: true } } },
    categoriasCarta: [categoriaCombos],
    ofertas,
    productosComboNoBot: productosComboNoBot([comboDuo(), comboCajita(juguetes), { ...comboDuo({ id: 'of_carta', alcanceProductoId: 'prod_duo_carta', canales: ['CARTA'] }) }], ofertas),
    ...extra,
  });

  type R = ReturnType<typeof transicionarEstado>;
  const paso = (r: R, c: ContextoConversacion, e: Parameters<typeof normalizarEntrada>[0]): R => transicionarEstado(r.nuevoFlujo as FlujoConversacion, normalizarEntrada(e), c);
  const boton = (r: R, c: ContextoConversacion, id: string) => paso(r, c, { buttonPayload: id });
  const fila = (r: R, c: ContextoConversacion, id: string) => paso(r, c, { listRowId: id });

  /** Desde «Hacer pedido» hasta elegir el producto anfitrión. */
  function elegirProducto(c: ContextoConversacion, productoId: string): R {
    let r = transicionarEstado(null, normalizarEntrada({ listRowId: 'pedir' }), c);
    r = boton(r, c, 'ped_mod_recojer');
    r = fila(r, c, 'ped_cat_cat_combos');
    return fila(r, c, `ped_prod_${productoId}`);
  }
  const textos = (r: R) => r.acciones.map((a: any) => a.texto).join('\n');
  const todasLasFilas = (r: R) => r.acciones.flatMap((a: any) => a.filas ?? a.botones ?? []);
  const crear = (r: R, c: ContextoConversacion) => {
    let x = boton(r, c, 'ped_cart_continuar');
    x = boton(x, c, 'ped_nombre_si');
    x = boton(x, c, 'ped_tel_mismo');
    x = boton(x, c, 'ped_pago_efectivo');
    x = paso(x, c, { texto: '100' });
    x = boton(x, c, 'ped_comp_ninguno');
    if (x.nuevoEstado === 'PEDIDO_COMPROBANTE_TIPO') x = boton(x, c, 'ped_comp_boleta');
    if (x.nuevoEstado === 'PEDIDO_COMPROBANTE_DNI') x = paso(x, c, { texto: '12345678', textoOriginal: '12345678' });
    x = boton(x, c, 'ped_confirmar_si');
    return x.acciones.find((a: any) => a.tipo === 'crearPedido') as any;
  };

  /** Dúo: tamaño, dos bebidas, cantidad 1 y los nombres de los envases hasta el paso en curso. */
  function duoHastaNombres(c: ContextoConversacion): R {
    let r = elegirProducto(c, 'prod_duo');
    r = boton(r, c, 'ped_tam_tam_gra');
    r = fila(r, c, 'ped_op_op_f1');
    r = fila(r, c, 'ped_op_op_f3');
    return boton(r, c, 'ped_cant_1');
  }
  function conNombres(r: R, c: ContextoConversacion): R {
    let x = paso(r, c, { texto: 'Ana', textoOriginal: 'Ana' });
    x = paso(x, c, { texto: 'Luis', textoOriginal: 'Luis' });
    return x;
  }

  describe('Dúo con tamaño y parte fija', () => {
    const c = ctx([comboDuo()]);

    it('presenta el combo con «Incluye», pregunta tamaño y bebidas, y confirma con el resumen', () => {
      let r = elegirProducto(c, 'prod_duo');
      expect(r.nuevoEstado).toBe('PEDIDO_TAMANO');
      expect(textos(r)).toContain('Vamos a armar tu *Combo Dúo Irresistible*');
      expect(textos(r)).toContain('Incluye: Club Sándwich');
      r = boton(r, c, 'ped_tam_tam_gra');
      expect(r.nuevoEstado).toBe('PEDIDO_GRUPO_OPCION');
      r = fila(r, c, 'ped_op_op_f1');
      r = fila(r, c, 'ped_op_op_f3');
      expect(r.nuevoEstado).toBe('PEDIDO_CANTIDAD');
      r = boton(r, c, 'ped_cant_1');
      // las dos bebidas llevan su nombre en el envase
      expect(r.nuevoEstado).toBe('PEDIDO_NOMBRES_ENVASE');
      r = conNombres(r, c);
      r = boton(r, c, 'ped_nom_si');
      expect(r.nuevoEstado).toBe('PEDIDO_COMBO_CONFIRMAR');
      const resumen = textos(r);
      expect(resumen).toContain('Combo Dúo Irresistible');
      expect(resumen).toContain('Grande');
      expect(resumen).toContain('Frappe 1');
      expect(resumen).toContain('Club Sándwich');
      expect(resumen).toContain('S/ 41.00');
      expect((r.acciones[0] as any).botones.map((b: any) => b.id)).toEqual(['ped_combo_ok', 'ped_combo_cambiar', 'ped_cancelar']);
    });

    it('al confirmar entra al carrito y al pago como una línea de combo con ofertaId y comboElecciones', () => {
      let r = duoHastaNombres(c);
      r = boton(conNombres(r, c), c, 'ped_nom_si');
      r = boton(r, c, 'ped_combo_ok');
      expect(r.nuevoEstado).toBe('PEDIDO_ACCION_CARRITO');
      const linea = (r.nuevoFlujo as any).pedido.items[0];
      expect(linea).toMatchObject({ productoId: 'prod_duo', tamanoId: 'tam_gra', precioUnitario: 41, subtotal: 41, ofertaId: 'of_duo' });
      expect(linea.comboElecciones).toEqual([{ parteId: 'parte_club', productoId: 'p_club' }]);
      expect(linea.personas).toEqual(['Ana', 'Luis']);
      const accion = crear(r, c);
      expect(accion.dto.lineas[0]).toMatchObject({
        productoId: 'prod_duo',
        tamanoId: 'tam_gra',
        ofertaId: 'of_duo',
        comboElecciones: [{ parteId: 'parte_club', productoId: 'p_club' }],
        opciones: ['op_f1', 'op_f3'],
        personas: ['Ana', 'Luis'],
      });
    });

    it('«Cambiar elección» empieza de nuevo el combo', () => {
      let r = duoHastaNombres(c);
      r = boton(conNombres(r, c), c, 'ped_nom_si');
      r = boton(r, c, 'ped_combo_cambiar');
      expect(r.nuevoEstado).toBe('PEDIDO_TAMANO');
      expect(textos(r)).toContain('Empecemos de nuevo');
    });
  });

  describe('Cajita con juguetes (A_ELECCION 2 de 3)', () => {
    const c = ctx([comboCajita(juguetes)]);

    it('pide cada juguete («1 de 2», «2 de 2») con botones y manda las dos elecciones', () => {
      let r = elegirProducto(c, 'prod_cajita');
      expect(r.nuevoEstado).toBe('PEDIDO_CANTIDAD');
      r = boton(r, c, 'ped_cant_1');
      expect(r.nuevoEstado).toBe('PEDIDO_COMBO_PARTE');
      expect(textos(r)).toContain('Elige tu opción 1 de 2');
      expect(r.acciones[0].tipo).toBe('enviarBotones');
      expect(todasLasFilas(r).map((b: any) => b.id)).toEqual(['ped_cb_j_sirena', 'ped_cb_j_burbujas', 'ped_cb_j_pelota']);
      r = boton(r, c, 'ped_cb_j_sirena');
      expect(textos(r)).toContain('Elige tu opción 2 de 2');
      r = boton(r, c, 'ped_cb_j_sirena');
      expect(r.nuevoEstado).toBe('PEDIDO_COMBO_CONFIRMAR');
      expect(textos(r)).toContain('Sirena x2');
      r = boton(r, c, 'ped_combo_ok');
      const linea = (r.nuevoFlujo as any).pedido.items[0];
      expect(linea.comboElecciones).toEqual([
        { parteId: 'parte_jug', productoId: 'j_sirena' },
        { parteId: 'parte_jug', productoId: 'j_sirena' },
      ]);
      const accion = crear(r, c);
      expect(accion.dto.lineas[0]).toMatchObject({ ofertaId: 'of_cajita', comboElecciones: linea.comboElecciones });
    });

    it('con 2 cajitas pide 4 elecciones', () => {
      let r = boton(elegirProducto(c, 'prod_cajita'), c, 'ped_cant_2');
      expect(textos(r)).toContain('Elige tu opción 1 de 4');
      for (const id of ['ped_cb_j_sirena', 'ped_cb_j_burbujas', 'ped_cb_j_pelota']) r = boton(r, c, id);
      expect(textos(r)).toContain('Elige tu opción 4 de 4');
      r = boton(r, c, 'ped_cb_j_pelota');
      expect(r.nuevoEstado).toBe('PEDIDO_COMBO_CONFIRMAR');
    });

    it('acepta el nombre escrito y una búsqueda que coincide con una sola opción', () => {
      let r = boton(elegirProducto(c, 'prod_cajita'), c, 'ped_cant_1');
      r = paso(r, c, { texto: 'burb', textoOriginal: 'burb' });
      expect(textos(r)).toContain('Elige tu opción 2 de 2');
      r = paso(r, c, { texto: 'Pelota', textoOriginal: 'Pelota' });
      expect(r.nuevoEstado).toBe('PEDIDO_COMBO_CONFIRMAR');
    });

    it('si no entiende la opción, la repregunta con la misma lista', () => {
      let r = boton(elegirProducto(c, 'prod_cajita'), c, 'ped_cant_1');
      r = paso(r, c, { texto: 'zzz', textoOriginal: 'zzz' });
      expect(r.nuevoEstado).toBe('PEDIDO_COMBO_PARTE');
      expect(textos(r)).toContain('No encontré esa opción');
      expect(textos(r)).toContain('Elige tu opción 1 de 2');
    });

    it('más de 5 combos con elecciones: pide una cantidad menor', () => {
      const r = boton(elegirProducto(c, 'prod_cajita'), c, 'ped_cant_3');
      expect(r.nuevoEstado).toBe('PEDIDO_COMBO_PARTE');
      const r6 = paso(elegirProducto(c, 'prod_cajita'), c, { texto: '8', textoOriginal: '8' });
      expect(r6.nuevoEstado).toBe('PEDIDO_CANTIDAD');
      expect(textos(r6)).toContain('hasta 5');
    });
  });

  describe('opciones agotadas', () => {
    it('las opciones sin stock no se muestran (ni un sabor sin saldo)', () => {
      const lista = [
        opcion('j_sirena', 'Sirena'),
        opcion('j_agotado', 'Dinosaurio', { disponible: false, sinStock: true }),
        opcion('j_dona', 'Dona', { sabores: [{ id: 's_fresa', nombre: 'Fresa', disponible: true, saldo: 0 }] }),
        opcion('j_pelota', 'Pelota'),
      ];
      const c = ctx([comboCajita(lista)]);
      const r = boton(elegirProducto(c, 'prod_cajita'), c, 'ped_cant_1');
      expect(todasLasFilas(r).map((b: any) => b.id)).toEqual(['ped_cb_j_sirena', 'ped_cb_j_pelota']);
    });

    it('un sabor no se ofrece más veces que su saldo y cada unidad lleva su sabor', () => {
      const lista = [
        opcion('j_dona', 'Dona', {
          sabores: [
            { id: 's_fresa', nombre: 'Fresa', disponible: true, saldo: 1 },
            { id: 's_choco', nombre: 'Chocolate', disponible: true, saldo: 5 },
          ],
        }),
        opcion('j_pelota', 'Pelota'),
      ];
      const c = ctx([comboCajita(lista)]);
      let r = boton(elegirProducto(c, 'prod_cajita'), c, 'ped_cant_1');
      r = boton(r, c, 'ped_cb_j_dona');
      expect(textos(r)).toContain('¿De qué sabor quieres Dona?');
      expect(todasLasFilas(r).map((b: any) => b.id)).toEqual(['ped_cbs_s_fresa', 'ped_cbs_s_choco']);
      r = boton(r, c, 'ped_cbs_s_fresa');
      r = boton(r, c, 'ped_cb_j_dona');
      // Fresa ya no tiene saldo para la segunda unidad
      expect(todasLasFilas(r).map((b: any) => b.id)).toEqual(['ped_cbs_s_choco']);
      r = boton(r, c, 'ped_cbs_s_choco');
      const linea = (boton(r, c, 'ped_combo_ok').nuevoFlujo as any).pedido.items[0];
      expect(linea.comboElecciones).toEqual([
        { parteId: 'parte_jug', productoId: 'j_dona', saborId: 's_fresa' },
        { parteId: 'parte_jug', productoId: 'j_dona', saborId: 's_choco' },
      ]);
    });

    it('un grupo de opciones del anfitrión con una opción agotada avisa el plan B y no la ofrece', () => {
      const prod = { ...duo, grupos: [{ ...grupoBebida(1), aviso: 'Se acabaron: Frappe 2. Elige entre: Frappe 1, Frappe 3', opciones: [bebidas(3)[0], { ...bebidas(3)[1], disponible: false }, bebidas(3)[2]] }] };
      const c = ctx([comboDuo()], { categoriasCarta: [{ ...categoriaCombos, productos: [prod, cajita] }] });
      let r = elegirProducto(c, 'prod_duo');
      r = boton(r, c, 'ped_tam_tam_reg');
      expect(r.nuevoEstado).toBe('PEDIDO_GRUPO_OPCION');
      expect(textos(r)).toContain('Se acabaron: Frappe 2');
      expect(todasLasFilas(r).map((b: any) => b.id)).toEqual(['ped_op_op_f1', 'ped_op_op_f3']);
    });
  });

  describe('plan B de una parte fija agotada', () => {
    const planB = { alternativasActivas: true, disponible: false };
    const c = ctx([comboDuo({}, planB)]);

    it('avisa «Hoy no hay X, ¿lo cambiamos por Y?» y manda la alternativa elegida', () => {
      let r = duoHastaNombres(c);
      expect(r.nuevoEstado).toBe('PEDIDO_COMBO_PARTE');
      expect(textos(r)).toContain('Hoy no hay Club Sándwich');
      expect(textos(r)).toContain('Empanada o Croissant');
      expect(todasLasFilas(r).map((b: any) => b.id)).toEqual(['ped_cb_p_emp', 'ped_cb_p_cro']);
      r = boton(r, c, 'ped_cb_p_cro');
      // luego los nombres de los envases y el resumen
      expect(r.nuevoEstado).toBe('PEDIDO_NOMBRES_ENVASE');
      r = boton(conNombres(r, c), c, 'ped_nom_si');
      expect(r.nuevoEstado).toBe('PEDIDO_COMBO_CONFIRMAR');
      expect(textos(r)).toContain('Croissant');
      expect(textos(r)).not.toContain('Club Sándwich');
      r = boton(r, c, 'ped_combo_ok');
      expect((r.nuevoFlujo as any).pedido.items[0].comboElecciones).toEqual([{ parteId: 'parte_club', productoId: 'p_cro' }]);
    });

    it('el aviso usa el texto configurado del plan B', () => {
      const cc = ctx([comboDuo({}, planB)], { textosPersonalizados: { chatbot_texto_combo_plan_b: 'Ups, sin {faltante}. ¿{alternativas}?' } });
      const r = duoHastaNombres(cc);
      expect(textos(r)).toBe('Ups, sin Club Sándwich. ¿Empanada o Croissant?');
    });

    it('una alternativa agotada no se ofrece', () => {
      const alt = [{ ...opcion('p_emp', 'Empanada', { disponible: false }), cantidad: 1 }, { ...opcion('p_cro', 'Croissant'), cantidad: 1 }, { ...opcion('p_san', 'Sándwich'), cantidad: 1 }];
      const cc = ctx([comboDuo({}, { ...planB, alternativas: alt })]);
      const r = duoHastaNombres(cc);
      expect(todasLasFilas(r).map((b: any) => b.id)).toEqual(['ped_cb_p_cro', 'ped_cb_p_san']);
    });

    it('una alternativa por sabor pide el sabor de cada unidad (2 galletas = 2 sabores)', () => {
      const alt = [{ ...opcion('p_gal', 'Galleta', { sabores: [{ id: 's_a', nombre: 'Avena', disponible: true, saldo: 3 }, { id: 's_b', nombre: 'Choco', disponible: true, saldo: 3 }] }), cantidad: 2 }];
      const cc = ctx([comboDuo({}, { ...planB, alternativas: alt })]);
      let r = duoHastaNombres(cc);
      expect(textos(r)).toContain('Hoy no hay Club Sándwich');
      r = boton(r, cc, 'ped_cb_p_gal');
      expect(textos(r)).toContain('Galleta (1 de 2)');
      r = boton(r, cc, 'ped_cbs_s_a');
      expect(textos(r)).toContain('Galleta (2 de 2)');
      r = boton(r, cc, 'ped_cbs_s_b');
      r = boton(conNombres(r, cc), cc, 'ped_nom_si');
      expect(r.nuevoEstado).toBe('PEDIDO_COMBO_CONFIRMAR');
      expect(boton(r, cc, 'ped_combo_ok').nuevoFlujo.pedido!.items[0].comboElecciones).toEqual([
        { parteId: 'parte_club', productoId: 'p_gal', saborId: 's_a' },
        { parteId: 'parte_club', productoId: 'p_gal', saborId: 's_b' },
      ]);
    });
  });

  describe('canal y disponibilidad', () => {
    it('un combo sin la casilla WhatsApp no se ofrece: su producto no sale en la lista ni se puede pedir', () => {
      const soloCarta = comboDuo({ canales: ['CARTA', 'ADMIN'] });
      expect(comboVendibleBot([soloCarta], 'prod_duo')).toBeNull();
      expect(productosComboNoBot([soloCarta, comboCajita(juguetes)], [comboCajita(juguetes)])).toEqual(['prod_duo']);
      const c = ctx([comboCajita(juguetes)], { productosComboNoBot: ['prod_duo', 'prod_duo_carta'] });
      let r = transicionarEstado(null, normalizarEntrada({ listRowId: 'pedir' }), c);
      r = boton(r, c, 'ped_mod_recojer');
      r = fila(r, c, 'ped_cat_cat_combos');
      const ids = JSON.stringify(r.acciones);
      expect(ids).toContain('prod_cajita');
      expect(ids).not.toContain('prod_duo"');
      expect(ids).not.toContain('prod_duo_carta');
      // aunque toque el botón viejo, no arma el combo
      const directo = fila(r, c, 'ped_prod_prod_duo');
      expect(directo.nuevoEstado).toBe('PEDIDO_PRODUCTOS');
      expect(JSON.stringify(directo.acciones)).toContain('ped_cat_cat_combos');
    });

    it('un combo agotado, fuera de horario o desactivado tampoco se vende por el bot', () => {
      for (const extra of [{ disponible: false }, { vigenteAhora: false }, { activo: false }, { canales: [] }]) {
        expect(comboVendibleBot([comboDuo(extra)], 'prod_duo')).toBeNull();
      }
      expect(comboVendibleBot([comboDuo()], 'prod_duo')).not.toBeNull();
    });

    it('los combos se muestran en promociones con el precio de cada tamaño', () => {
      const texto = TEXTOS_BOT.promocionesHoy([comboDuo() as any]);
      expect(texto).toContain('Combo Dúo Irresistible');
      expect(texto).toContain('Regular S/ 37.00 · Grande S/ 41.00');
    });
  });

  describe('cancelar y atrás', () => {
    const c = ctx([comboCajita(juguetes)]);

    it('«cancelar» en medio del combo pide confirmar y «no» vuelve al mismo paso', () => {
      let r = boton(elegirProducto(c, 'prod_cajita'), c, 'ped_cant_1');
      r = boton(r, c, 'ped_cb_j_sirena');
      r = paso(r, c, { texto: 'cancelar', textoOriginal: 'cancelar' });
      expect(r.nuevoEstado).toBe('PEDIDO_CANCELAR_CONFIRMAR');
      r = boton(r, c, 'ped_cancelar_no');
      expect(r.nuevoEstado).toBe('PEDIDO_COMBO_PARTE');
      expect(textos(r)).toContain('Elige tu opción 2 de 2');
      r = paso(r, c, { texto: 'cancelar', textoOriginal: 'cancelar' });
      r = boton(r, c, 'ped_cancelar_si');
      expect(r.nuevoEstado).toBe('MENU');
      expect((r.nuevoFlujo as any).pedido).toBeNull();
    });

    it('«atrás» deshace la última elección; sin elecciones vuelve a empezar el combo', () => {
      let r = boton(elegirProducto(c, 'prod_cajita'), c, 'ped_cant_1');
      r = boton(r, c, 'ped_cb_j_sirena');
      r = paso(r, c, { texto: 'atrás', textoOriginal: 'atrás' });
      expect(textos(r)).toContain('Elige tu opción 1 de 2');
      expect((r.nuevoFlujo as any).pedido.itemEnConfiguracion.combo.elecciones).toEqual([]);
      r = paso(r, c, { texto: 'atras', textoOriginal: 'atras' });
      expect(textos(r)).toContain('Empecemos de nuevo');
    });
  });

  describe('listas largas (27 opciones)', () => {
    const muchas = Array.from({ length: 27 }, (_, i) => opcion(`j_${i + 1}`, `Juguete ${i + 1}`));
    const c = ctx([comboCajita(muchas)]);

    it('muestra 9 y «Ver más», pagina hasta el final y todas las filas respetan los límites de WhatsApp', () => {
      let r = boton(elegirProducto(c, 'prod_cajita'), c, 'ped_cant_1');
      const vistos: string[] = [];
      for (let pagina = 1; pagina <= 3; pagina++) {
        const lista = r.acciones[0] as any;
        expect(lista.tipo).toBe('enviarLista');
        expect(lista.filas.length).toBeLessThanOrEqual(10);
        for (const f of lista.filas) {
          expect(f.titulo.length).toBeLessThanOrEqual(24);
          expect((f.descripcion ?? '').length).toBeLessThanOrEqual(72);
        }
        vistos.push(...lista.filas.filter((f: any) => !f.id.startsWith('ped_cb_pag_')).map((f: any) => f.id));
        const mas = lista.filas.find((f: any) => f.id.startsWith('ped_cb_pag_'));
        if (pagina < 3) {
          expect(mas.id).toBe(`ped_cb_pag_${pagina + 1}`);
          r = fila(r, c, mas.id);
        } else {
          expect(mas).toBeUndefined();
        }
      }
      expect(new Set(vistos).size).toBe(27);
      // elegir una de la última página
      r = fila(r, c, 'ped_cb_j_27');
      expect(textos(r)).toContain('Elige tu opción 2 de 2');
    });

    it('buscar por texto muestra solo las que coinciden', () => {
      let r = boton(elegirProducto(c, 'prod_cajita'), c, 'ped_cant_1');
      r = paso(r, c, { texto: 'juguete 2', textoOriginal: 'Juguete 2' });
      // «juguete 2» coincide con Juguete 2 exacto: se elige directo
      expect(textos(r)).toContain('Elige tu opción 2 de 2');
      r = paso(r, c, { texto: 'juguete 1', textoOriginal: 'Juguete 1' });
      expect(r.nuevoEstado).toBe('PEDIDO_COMBO_CONFIRMAR');
      const r2 = paso(boton(elegirProducto(c, 'prod_cajita'), c, 'ped_cant_1'), c, { texto: 'juguete', textoOriginal: 'juguete' });
      expect((r2.acciones[0] as any).filas.length).toBeLessThanOrEqual(10);
    });
  });

  describe('combo rechazado por el servidor al confirmar', () => {
    const c = ctx([comboCajita(juguetes)]);
    const carritoConCajita = () => {
      let r = boton(elegirProducto(c, 'prod_cajita'), c, 'ped_cant_1');
      r = boton(r, c, 'ped_cb_j_sirena');
      r = boton(r, c, 'ped_cb_j_pelota');
      r = boton(r, c, 'ped_combo_ok');
      return (r.nuevoFlujo as any).pedido;
    };

    it('stock insuficiente de un juguete: vuelve a elegir esa parte con lo que hay, sin escalar a una persona', () => {
      const carrito = carritoConCajita();
      const hoy = [comboCajita([juguetes[1], juguetes[2]])];
      const vuelta = carritoTrasComboRechazado(carrito, { codigo: 'STOCK_INSUFICIENTE', mensaje: 'Solo quedan 0 de Sirena', productoId: 'j_sirena' }, c.categoriasCarta!, hoy);
      expect(vuelta).not.toBeNull();
      expect(vuelta!.pedido.estadoInterno).toBe('PEDIDO_COMBO_PARTE');
      expect(vuelta!.pedido.items).toHaveLength(0);
      expect(vuelta!.pedido.itemEnConfiguracion?.combo?.pasos[0].opciones.map((o) => o.id)).toEqual(['j_burbujas', 'j_pelota']);
      const textosVuelta = vuelta!.acciones.map((a: any) => a.texto).join('\n');
      expect(textosVuelta).toContain('Solo quedan 0 de Sirena');
      expect(textosVuelta).toContain('Elige tu opción 1 de 2');
    });

    it('stock insuficiente del producto anfitrión (no de una parte) no toca el combo', () => {
      const vuelta = carritoTrasComboRechazado(carritoConCajita(), { codigo: 'STOCK_INSUFICIENTE', mensaje: 'x', productoId: 'prod_cajita' }, c.categoriasCarta!, [comboCajita(juguetes)]);
      expect(vuelta).toBeNull();
    });

    it('COMBO_PARTE_NO_DISPONIBLE rehace el combo; si ya no se puede armar, no hay vuelta', () => {
      const carrito = carritoConCajita();
      const err = { codigo: 'COMBO_PARTE_NO_DISPONIBLE', mensaje: 'Pelota se acaba de agotar' };
      expect(carritoTrasComboRechazado(carrito, err, c.categoriasCarta!, [comboCajita(juguetes)])).not.toBeNull();
      expect(carritoTrasComboRechazado(carrito, err, c.categoriasCarta!, [comboCajita(juguetes, { disponible: false })])).toBeNull();
    });
  });
});
