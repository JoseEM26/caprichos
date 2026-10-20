/**
 * CARTA OFICIAL CAPRICHOS - BASE DE DATOS DE PRODUCTOS
 * Sincronizada con menu_dinamico.txt y carpeta assets/
 */

const CAPRICHOS_MENU = [
  // ==========================================
  // BEBIDAS CALIENTES
  // ==========================================
  {
    id: "cal-americano",
    name: "Americano",
    category: "calientes",
    categoryName: "Bebidas Calientes ☕",
    description: "Café espresso 100% orgánico recién extraído con agua caliente purificada a 90°.",
    image: "assets/AMERICANO.png",
    type: "bebidacaliente",
    sizes: [
      { name: "Regular (12oz)", price: 6.0 },
      { name: "Grande (16oz)", price: 7.0 },
      { name: "Extra (20oz)", price: 9.0 }
    ],
    defaultPrice: 6.0,
    allowsMilk: true,
    allowsSweetener: true
  },
  {
    id: "cal-cappuccino",
    name: "Cappuccino",
    category: "calientes",
    categoryName: "Bebidas Calientes ☕",
    description: "Café espresso doble, leche vaporizada sedosa y una corona de espuma cremosa perfecta.",
    image: "assets/CAPUCCINO.png",
    type: "bebidacaliente",
    sizes: [
      { name: "Regular (12oz)", price: 9.5 },
      { name: "Grande (16oz)", price: 11.0 },
      { name: "Extra (20oz)", price: 12.0 }
    ],
    defaultPrice: 9.5,
    allowsMilk: true,
    allowsSweetener: true
  },
  {
    id: "cal-chocolate",
    name: "Chocolate Caliente",
    category: "calientes",
    categoryName: "Bebidas Calientes ☕",
    description: "Cacao 100% puro seleccionado, leche cremosa vaporizada y un delicado toque de sirope de almendra.",
    image: "assets/CHOCOLATE.png",
    type: "bebidacaliente",
    sizes: [
      { name: "Regular (12oz)", price: 9.5 },
      { name: "Grande (16oz)", price: 11.0 },
      { name: "Extra (20oz)", price: 12.0 }
    ],
    defaultPrice: 9.5,
    allowsMilk: true,
    allowsSweetener: true
  },
  {
    id: "cal-mocaccino",
    name: "Mocaccino",
    category: "calientes",
    categoryName: "Bebidas Calientes ☕",
    description: "La armonía ideal entre sirope de cacao 100% puro, sirope de almendra, leche vaporizada y espresso doble.",
    image: "assets/MOCACCINO.png",
    type: "bebidacaliente",
    sizes: [
      { name: "Regular (12oz)", price: 12.0 },
      { name: "Grande (16oz)", price: 13.5 },
      { name: "Extra (20oz)", price: 14.5 }
    ],
    defaultPrice: 12.0,
    allowsMilk: true,
    allowsSweetener: true
  },
  {
    id: "cal-caramel-macchiato",
    name: "Caramel Macchiato",
    category: "calientes",
    categoryName: "Bebidas Calientes ☕",
    description: "Sirope de caramelo artesanal, manjar blanco, vainilla natural, leche vaporizada y café espresso.",
    image: "assets/CARAMEL_MACCHIATO.png",
    type: "bebidacaliente",
    sizes: [
      { name: "Regular (12oz)", price: 12.0 },
      { name: "Grande (16oz)", price: 13.5 },
      { name: "Extra (20oz)", price: 14.5 }
    ],
    defaultPrice: 12.0,
    allowsMilk: true,
    allowsSweetener: true
  },
  {
    id: "cal-oreo-latte",
    name: "Oreo Latte",
    category: "calientes",
    categoryName: "Bebidas Calientes ☕",
    description: "Chocolate negro intenso, trocitos crujientes de galleta Oreo, vainilla, leche vaporizada y espresso.",
    image: "assets/OREO_LATTE.png",
    type: "bebidacaliente",
    sizes: [
      { name: "Regular (12oz)", price: 12.0 },
      { name: "Grande (16oz)", price: 13.5 },
      { name: "Extra (20oz)", price: 14.5 }
    ],
    defaultPrice: 12.0,
    allowsMilk: true,
    allowsSweetener: true
  },
  {
    id: "cal-latte-vainilla",
    name: "Latte Vainilla",
    category: "calientes",
    categoryName: "Bebidas Calientes ☕",
    description: "Extracto de vainilla 100% natural infusionado con leche cremosa vaporizada y café espresso de especialidad.",
    image: "assets/LATTE_VAINILLA.png",
    type: "bebidacaliente",
    sizes: [
      { name: "Regular (12oz)", price: 12.0 },
      { name: "Grande (16oz)", price: 13.5 },
      { name: "Extra (20oz)", price: 14.5 }
    ],
    defaultPrice: 12.0,
    allowsMilk: true,
    allowsSweetener: true
  },
  {
    id: "cal-choconube",
    name: "Choconube",
    category: "calientes",
    categoryName: "Bebidas Calientes ☕",
    description: "Reconfortante chocolate premium con cacao puro, coronado con una suave nube de crema y tiernos marshmallows.",
    image: "assets/CHOCONUBE.png",
    type: "bebidacaliente",
    badge: "Especial",
    sizes: [
      { name: "Regular (12oz)", price: 12.0 },
      { name: "Grande (16oz)", price: 13.5 },
      { name: "Extra (20oz)", price: 14.5 }
    ],
    defaultPrice: 12.0,
    allowsMilk: true,
    allowsSweetener: true
  },
  {
    id: "cal-saltamel-brownie",
    name: "Saltamel Brownie",
    category: "calientes",
    categoryName: "Bebidas Calientes ☕",
    description: "Caramelo salado artesanal y espresso perfectamente balanceado, coronados con irresistibles trocitos de brownie.",
    image: "assets/SALTAMEL_BROWNIE.png",
    type: "bebidacaliente",
    sizes: [
      { name: "Regular (12oz)", price: 12.0 },
      { name: "Grande (16oz)", price: 13.5 },
      { name: "Extra (20oz)", price: 14.5 }
    ],
    defaultPrice: 12.0,
    allowsMilk: true,
    allowsSweetener: true
  },
  {
    id: "cal-canelatte-caramel",
    name: "Canelatte Caramel",
    category: "calientes",
    categoryName: "Bebidas Calientes ☕",
    description: "El equilibrio perfecto entre dulzura acaramelada, canela aromática y café espresso de calidad.",
    image: "assets/CANELATTE_CARAMEL.png",
    type: "bebidacaliente",
    sizes: [
      { name: "Regular (12oz)", price: 12.0 },
      { name: "Grande (16oz)", price: 13.5 },
      { name: "Extra (20oz)", price: 14.5 }
    ],
    defaultPrice: 12.0,
    allowsMilk: true,
    allowsSweetener: true
  },
  {
    id: "cal-capiberry-vainilla",
    name: "Capiberry Vainilla",
    category: "calientes",
    categoryName: "Bebidas Calientes ☕",
    description: "Propuesta artesanal que combina suave café espresso, vainilla 100% natural y el encanto de los frutos rojos.",
    image: "assets/CAPRIBERRY_VAINILLA.png",
    type: "bebidacaliente",
    sizes: [
      { name: "Regular (12oz)", price: 12.0 },
      { name: "Grande (16oz)", price: 13.5 },
      { name: "Extra (20oz)", price: 14.5 }
    ],
    defaultPrice: 12.0,
    allowsMilk: true,
    allowsSweetener: true
  },

  // ==========================================
  // FRAPPÉS ARTESANALES
  // ==========================================
  {
    id: "frappe-oreo",
    name: "Frappé Oreo",
    category: "frappes",
    categoryName: "Frappés Artesanales 🍹",
    description: "¡La bebida más vendida de Caprichos! Leche cremosa, galletas Oreo, espresso sutil, chantilly y topping de galleta Oreo.",
    image: "assets/FRAPPE_OREO.png",
    type: "frappe",
    badge: "⭐ Más Vendido",
    sizes: [
      { name: "Regular (12oz)", price: 14.5 },
      { name: "Grande (16oz)", price: 16.5 },
      { name: "Extra (20oz)", price: 17.5 }
    ],
    defaultPrice: 14.5,
    allowsMilk: true,
    allowsSweetener: true,
    allowsFrappeCustom: true
  },
  {
    id: "frappe-cafe",
    name: "Frappé Café",
    category: "frappes",
    categoryName: "Frappés Artesanales 🍹",
    description: "Espresso doble recién extraído, leche fresca con un sutil toque de canela, coronado con chantilly y chispas de chocolate.",
    image: "assets/FRAPPE_CAFÉ.png",
    type: "frappe",
    sizes: [
      { name: "Regular (12oz)", price: 14.5 },
      { name: "Grande (16oz)", price: 16.5 },
      { name: "Extra (20oz)", price: 17.5 }
    ],
    defaultPrice: 14.5,
    allowsMilk: true,
    allowsSweetener: true,
    allowsFrappeCustom: true
  },
  {
    id: "frappe-moca",
    name: "Frappé Moca",
    category: "frappes",
    categoryName: "Frappés Artesanales 🍹",
    description: "Combinación de espresso doble y chocolate 100% cacao puro, decorado con chantilly, sirope de cacao y chispas de chocolate.",
    image: "assets/FRAPPE_MOCA.png",
    type: "frappe",
    sizes: [
      { name: "Regular (12oz)", price: 14.5 },
      { name: "Grande (16oz)", price: 16.5 },
      { name: "Extra (20oz)", price: 17.5 }
    ],
    defaultPrice: 14.5,
    allowsMilk: true,
    allowsSweetener: true,
    allowsFrappeCustom: true
  },
  {
    id: "frappe-chocoberry",
    name: "Frappé Chocoberry",
    category: "frappes",
    categoryName: "Frappés Artesanales 🍹",
    description: "Receta exclusiva de la casa: la unión perfecta de galletas Oreo trituradas con fresas naturales y leche cremosa.",
    image: "assets/FRAPPE_CHOCOBERRY.png",
    type: "frappe",
    badge: "Firma de la Casa",
    sizes: [
      { name: "Regular (12oz)", price: 14.5 },
      { name: "Grande (16oz)", price: 16.5 },
      { name: "Extra (20oz)", price: 17.5 }
    ],
    defaultPrice: 14.5,
    allowsMilk: true,
    allowsSweetener: true,
    allowsFrappeCustom: true
  },
  {
    id: "frappe-strawberry",
    name: "Frappé Strawberry",
    category: "frappes",
    categoryName: "Frappés Artesanales 🍹",
    description: "Fresas selectas, helado cremoso de vainilla, espresso suave, mermelada artesanal de fresa, chantilly y topping mini chin chin.",
    image: "assets/FRAPPE_STRAWBERRY.png",
    type: "frappe",
    sizes: [
      { name: "Regular (12oz)", price: 14.5 },
      { name: "Grande (16oz)", price: 16.5 },
      { name: "Extra (20oz)", price: 17.5 }
    ],
    defaultPrice: 14.5,
    allowsMilk: true,
    allowsSweetener: true,
    allowsFrappeCustom: true
  },
  {
    id: "frappe-berries",
    name: "Frappé Berries",
    category: "frappes",
    categoryName: "Frappés Artesanales 🍹",
    description: "Arándanos, fresa y mermelada artesanal de frutos del bosque, leche cremosa, espresso suave, chantilly y mini chin chin.",
    image: "assets/FRAPPE_BERRIES.png",
    type: "frappe",
    sizes: [
      { name: "Regular (12oz)", price: 14.5 },
      { name: "Grande (16oz)", price: 16.5 },
      { name: "Extra (20oz)", price: 17.5 }
    ],
    defaultPrice: 14.5,
    allowsMilk: true,
    allowsSweetener: true,
    allowsFrappeCustom: true
  },
  {
    id: "frappe-caramel-clasico",
    name: "Frappé Caramel Clásico",
    category: "frappes",
    categoryName: "Frappés Artesanales 🍹",
    description: "Café espresso, caramelo artesanal, vainilla natural 100% orgánica, chantilly y topping de almendra triturada.",
    image: "assets/FRAPPE_CARAMEL_CLÁSICO.png",
    type: "frappe",
    sizes: [
      { name: "Regular (12oz)", price: 14.5 },
      { name: "Grande (16oz)", price: 16.5 },
      { name: "Extra (20oz)", price: 17.5 }
    ],
    defaultPrice: 14.5,
    allowsMilk: true,
    allowsSweetener: true,
    allowsFrappeCustom: true
  },
  {
    id: "frappe-caramel-chocolate",
    name: "Frappé Caramel Chocolate",
    category: "frappes",
    categoryName: "Frappés Artesanales 🍹",
    description: "Caramelo artesanal, chocolate 100% cacao puro, espresso y vainilla, decorado con chantilly y chispas de chocolate.",
    image: "assets/FRAPPE_CARAMEL_CHOCOLATE.png",
    type: "frappe",
    sizes: [
      { name: "Regular (12oz)", price: 14.5 },
      { name: "Grande (16oz)", price: 16.5 },
      { name: "Extra (20oz)", price: 17.5 }
    ],
    defaultPrice: 14.5,
    allowsMilk: true,
    allowsSweetener: true,
    allowsFrappeCustom: true
  },
  {
    id: "frappe-chocolucuma",
    name: "Frappé Chocolúcuma",
    category: "frappes",
    categoryName: "Frappés Artesanales 🍹",
    description: "El oro de los incas: pura pulpa de lúcuma peruana con cacao puro al 100%, decorado con chantilly y chispas de chocolate.",
    image: "assets/FRAPPE_CHOCOLÚCUMA.png",
    type: "frappe",
    badge: "Peruanísimo",
    sizes: [
      { name: "Regular (12oz)", price: 14.5 },
      { name: "Grande (16oz)", price: 16.5 },
      { name: "Extra (20oz)", price: 17.5 }
    ],
    defaultPrice: 14.5,
    allowsMilk: true,
    allowsSweetener: true,
    allowsFrappeCustom: true
  },
  {
    id: "frappe-algarrolucuma",
    name: "Frappé Algarrolúcuma",
    category: "frappes",
    categoryName: "Frappés Artesanales 🍹",
    description: "Algarrobina norteña y lúcuma con leche cremosa y espresso doble. Dulzor 100% natural sin necesidad de azúcar añadida.",
    image: "assets/FRAPPE_ALGARROLÚCUMA.png",
    type: "frappe",
    sizes: [
      { name: "Regular (12oz)", price: 14.5 },
      { name: "Grande (16oz)", price: 16.5 },
      { name: "Extra (20oz)", price: 17.5 }
    ],
    defaultPrice: 14.5,
    allowsMilk: true,
    allowsSweetener: true,
    allowsFrappeCustom: true
  },
  {
    id: "frappe-maracuya",
    name: "Frappé Maracuyá",
    category: "frappes",
    categoryName: "Frappés Artesanales 🍹",
    description: "Pura pulpa de maracuyá agridulce, leche fresca y espresso suave, decorado con chantilly y sirope artesanal de maracuyá.",
    image: "assets/FRAPPE_MARACUYÁ.png",
    type: "frappe",
    sizes: [
      { name: "Regular (12oz)", price: 14.5 },
      { name: "Grande (16oz)", price: 16.5 },
      { name: "Extra (20oz)", price: 17.5 }
    ],
    defaultPrice: 14.5,
    allowsMilk: true,
    allowsSweetener: true,
    allowsFrappeCustom: true
  },
  {
    id: "frappe-fit",
    name: "Frappé Fit",
    category: "frappes",
    categoryName: "Frappés Artesanales 🍹",
    description: "A base de mango, piña, coco, espinaca y nutrientes naturales, coronado con granola artesanal crujiente.",
    image: "assets/FRAPPE_FIT.png",
    type: "frappe",
    badge: "Saludable 🌱",
    sizes: [
      { name: "Regular (12oz)", price: 14.5 },
      { name: "Grande (16oz)", price: 16.5 },
      { name: "Extra (20oz)", price: 17.5 }
    ],
    defaultPrice: 14.5,
    allowsMilk: true,
    allowsSweetener: true,
    allowsFrappeCustom: true
  },

  // ==========================================
  // BEBIDAS ICED & FROZEN
  // ==========================================
  {
    id: "iced-coffee",
    name: "Iced Coffee (Americano Frío)",
    category: "iced_frozen",
    categoryName: "Iced & Frozen 🧊",
    description: "Espresso doble de especialidad sumergido en agua fresca purificada con abundantes cubos de hielo.",
    image: "assets/ICED_COFFEE.png",
    type: "iced",
    sizes: [
      { name: "Regular (12oz)", price: 9.0 },
      { name: "Grande (16oz)", price: 11.0 },
      { name: "Extra (20oz)", price: 12.0 }
    ],
    defaultPrice: 9.0,
    allowsMilk: false,
    allowsSweetener: true
  },
  {
    id: "iced-latte",
    name: "Iced Latte Coffee",
    category: "iced_frozen",
    categoryName: "Iced & Frozen 🧊",
    description: "Cappuccino frío: leche cremosa fresca con espresso doble sumergido en cubos de hielo y espuma sedosa.",
    image: "assets/ICED_LATTE_COFFEE.png",
    type: "iced",
    sizes: [
      { name: "Regular (12oz)", price: 11.5 },
      { name: "Grande (16oz)", price: 13.0 },
      { name: "Extra (20oz)", price: 14.0 }
    ],
    defaultPrice: 11.5,
    allowsMilk: true,
    allowsSweetener: true
  },
  {
    id: "iced-chocolate",
    name: "Iced Chocolate (Sin Café)",
    category: "iced_frozen",
    categoryName: "Iced & Frozen 🧊",
    description: "Chocolate al 100% cacao puro, pasta de cacao, sirope de almendra y leche cremosa sobre cubos de hielo. ¡Sin café!",
    image: "assets/ICED_CHOCOLATE.png",
    type: "iced",
    sizes: [
      { name: "Regular (12oz)", price: 11.5 },
      { name: "Grande (16oz)", price: 13.0 },
      { name: "Extra (20oz)", price: 14.0 }
    ],
    defaultPrice: 11.5,
    allowsMilk: true,
    allowsSweetener: true
  },
  {
    id: "iced-berry",
    name: "Iced Berry (Sin Café)",
    category: "iced_frozen",
    categoryName: "Iced & Frozen 🧊",
    description: "Mermelada artesanal de frutos del bosque elaborada en Caprichos, leche cremosa y hielo refrescante. ¡Sin café!",
    image: "assets/ICED_BERRY.png",
    type: "iced",
    sizes: [
      { name: "Regular (12oz)", price: 11.5 },
      { name: "Grande (16oz)", price: 13.0 },
      { name: "Extra (20oz)", price: 14.0 }
    ],
    defaultPrice: 11.5,
    allowsMilk: true,
    allowsSweetener: true
  },
  {
    id: "frozen-limonada",
    name: "Frozen Limonada",
    category: "iced_frozen",
    categoryName: "Iced & Frozen 🧊",
    description: "Limonada frozen intensa y súper refrescante con limón recién exprimido, hielo granizado y aroma a hierbabuena.",
    image: "assets/FROZEN_LIMONADA.png",
    type: "frozen",
    sizes: [
      { name: "Extra (20oz)", price: 14.5 }
    ],
    defaultPrice: 14.5,
    allowsMilk: false,
    allowsSweetener: true
  },
  {
    id: "frozen-maracuya",
    name: "Frozen Maracuyá",
    category: "iced_frozen",
    categoryName: "Iced & Frozen 🧊",
    description: "Pura pulpa natural de maracuyá con limón fresco y granizado de hielo perfecto. El toque tropical más refrescante.",
    image: "assets/FROZEN_MARACUYÁ.png",
    type: "frozen",
    sizes: [
      { name: "Extra (20oz)", price: 14.5 }
    ],
    defaultPrice: 14.5,
    allowsMilk: false,
    allowsSweetener: true
  },
  {
    id: "frozen-strawberry",
    name: "Frozen Strawberry",
    category: "iced_frozen",
    categoryName: "Iced & Frozen 🧊",
    description: "Delicioso frozen de fresas naturales con limón fresco, hielo granizado y un aroma sutil de hierbabuena fresca.",
    image: "assets/FROZEN_STRAWBERRY.png",
    type: "frozen",
    sizes: [
      { name: "Extra (20oz)", price: 14.5 }
    ],
    defaultPrice: 14.5,
    allowsMilk: false,
    allowsSweetener: true
  },

  // ==========================================
  // SALADOS & SÁNDWICHES
  // ==========================================
  {
    id: "sal-club-sandwich",
    name: "Club Sándwich",
    category: "salados",
    categoryName: "Salados & Sándwiches 🥪",
    description: "¡El rey de la casa! 4 pisos de pan artesanal con pollo deshilachado, doble jamón inglés, doble queso derretido, tocino crujiente, lechuga y tomate + 350g de papas nativas frescas del día.",
    image: "assets/CLUB_SANDWICH.png",
    type: "salado",
    badge: "⭐ El Favorito",
    defaultPrice: 27.0
  },
  {
    id: "sal-sandwich-clasico",
    name: "Sándwich Clásico",
    category: "salados",
    categoryName: "Salados & Sándwiches 🥪",
    description: "4 pisos de pan pullman artesanal recién horneado, relleno con pollo deshilachado en salsa de la casa, jamón inglés y queso.",
    image: "assets/SANDWICH_CLÁSICO.png",
    type: "salado",
    defaultPrice: 9.9
  },
  {
    id: "sal-sandwich-especial",
    name: "Sándwich Especial",
    category: "salados",
    categoryName: "Salados & Sándwiches 🥪",
    description: "4 pisos de pan pullman con pollo deshilachado, doble queso, doble jamón, tocino culinario crujiente, huevo, lechuga fresca y tomate.",
    image: "assets/SANDWICH_ESPECIAL.png",
    type: "salado",
    defaultPrice: 16.5
  },
  {
    id: "sal-suprema",
    name: "Suprema",
    category: "salados",
    categoryName: "Salados & Sándwiches 🥪",
    description: "Filete de pollo a la plancha (90g), huevo frito, doble tocino, doble jamón inglés y doble queso derretido + 350g de papas nativas crujientes.",
    image: "assets/SUPREMA.png",
    type: "salado",
    defaultPrice: 18.5
  },
  {
    id: "sal-parrillero",
    name: "Parrillero",
    category: "salados",
    categoryName: "Salados & Sándwiches 🥪",
    description: "200g de carne artesanal jugosa, huevo, doble tocino, doble jamón inglés y queso Edam derretido en pan artesanal esponjoso + 350g de papas nativas doradas.",
    image: "assets/PARRILLERO.png",
    type: "salado",
    defaultPrice: 21.0
  },
  {
    id: "sal-caprisabroso",
    name: "Caprisabroso",
    category: "salados",
    categoryName: "Salados & Sándwiches 🥪",
    description: "La hamburguesa más contundente y deliciosa de la casa con carnes selectas y acompañamiento completo.",
    image: "assets/CAPRISABROSO.png",
    type: "salado",
    defaultPrice: 33.0
  },
  {
    id: "sal-petit-pan",
    name: "Petit Pan Clásico",
    category: "salados",
    categoryName: "Salados & Sándwiches 🥪",
    description: "Petit Pan artesanal con abundante relleno jugoso de pollo deshilachado y salsa especial de la casa.",
    image: "assets/PETIT_PAN.png",
    type: "salado",
    defaultPrice: 5.5
  },
  {
    id: "sal-empanada",
    name: "Empanada Artesanal",
    category: "salados",
    categoryName: "Salados & Sándwiches 🥪",
    description: "Dorado y suculento trío de opciones: Jamón y queso con bechamel cremosa, Pollo casero o Carne tradicional.",
    image: "assets/EMPANADA_ARTESANAL.jpg",
    type: "salado",
    options: [
      { name: "Jamón y Queso con Bechamel", price: 7.5 },
      { name: "Pollo Casero", price: 7.5 },
      { name: "Carne Tradicional", price: 7.5 }
    ],
    defaultPrice: 7.5
  },

  // ==========================================
  // CROISSANTS ARTESANALES
  // ==========================================
  {
    id: "croissant-pollo",
    name: "Croissant de Pollo y Frutos Secos",
    category: "croissants",
    categoryName: "Croissants Artesanales 🥐",
    description: "Croissant artesanal francés hojaldrado con mantequilla fina, relleno de pollo deshilachado y frutos secos seleccionados.",
    image: "assets/CROISSANT-POLLO.png",
    type: "croissant",
    defaultPrice: 9.5
  },
  {
    id: "croissant-jamon-queso",
    name: "Croissant de Jamón y Queso",
    category: "croissants",
    categoryName: "Croissants Artesanales 🥐",
    description: "Croissant hojaldrado artesanal relleno de abundante jamón inglés y queso derretido.",
    image: "assets/CROISSANT-JAMONYQUESO.png",
    type: "croissant",
    defaultPrice: 9.5
  },
  {
    id: "croissant-cacao",
    name: "Croissant de Cacao",
    category: "croissants",
    categoryName: "Croissants Artesanales 🥐",
    description: "Croissant hojaldrado artesanal con exquisito relleno fundente de crema de cacao puro al 100%.",
    image: "assets/CROISSANT-CACAO.png",
    type: "croissant",
    defaultPrice: 9.5
  },

  // ==========================================
  // WAFFLES ARTESANALES
  // ==========================================
  {
    id: "waffle-frutos-bosque",
    name: "Waffle Frutos del Bosque",
    category: "waffles",
    categoryName: "Waffles Artesanales 🧇",
    description: "Arándanos, fresas, frambuesa y mora sobre waffle artesanal, con crema cheesecake, helado de vainilla y chantilly.",
    image: "assets/WAFFLE_FRUTOS_DEL_BOSQUE.png",
    type: "waffle",
    sizes: [
      { name: "Entero", price: 21.0 },
      { name: "Mitad", price: 15.0 }
    ],
    defaultPrice: 21.0
  },
  {
    id: "waffle-pop",
    name: "Waffle Pop",
    category: "waffles",
    categoryName: "Waffles Artesanales 🧇",
    description: "Pasta de cacao, fresas frescas, mini galletas artesanales y chin chin crujiente con chantilly, helado y tu sirope favorito.",
    image: "assets/WAFFLE_POP.png",
    type: "waffle",
    sizes: [
      { name: "Entero", price: 21.0 },
      { name: "Mitad", price: 15.0 }
    ],
    defaultPrice: 21.0
  },
  {
    id: "waffle-tropical",
    name: "Waffle Tropical",
    category: "waffles",
    categoryName: "Waffles Artesanales 🧇",
    description: "¡El verano en un waffle! Mango, fresa fresca, piña y arándanos con bola de helado y sirope a tu elección.",
    image: "assets/WAFFLE_TROPICAL.png",
    type: "waffle",
    sizes: [
      { name: "Entero", price: 19.5 },
      { name: "Mitad", price: 14.0 }
    ],
    defaultPrice: 19.5
  },
  {
    id: "waffle-nutella",
    name: "Waffle Nutella",
    category: "waffles",
    categoryName: "Waffles Artesanales 🧇",
    description: "Base de waffle artesanal con pasta de cacao estilo Nutella, fresas jugosas, chantilly, chips y bola de helado.",
    image: "assets/WAFFLE_NUTELLA.png",
    type: "waffle",
    badge: "Antojo Favorito",
    sizes: [
      { name: "Entero", price: 21.0 },
      { name: "Mitad", price: 15.0 }
    ],
    defaultPrice: 21.0
  },
  {
    id: "waffle-fresa-split",
    name: "Waffle Fresa Split",
    category: "waffles",
    categoryName: "Waffles Artesanales 🧇",
    description: "Fresas frescas y plátano sobre waffle artesanal, bañado con sirope a tu elección, choco chips, chantilly y helado.",
    image: "assets/WAFFLE_FRESA_SPLIT.png",
    type: "waffle",
    sizes: [
      { name: "Entero", price: 17.5 },
      { name: "Mitad", price: 12.5 }
    ],
    defaultPrice: 17.5
  },
  {
    id: "waffle-banana-split",
    name: "Waffle Banana Split",
    category: "waffles",
    categoryName: "Waffles Artesanales 🧇",
    description: "Plátano, arándanos y granola sobre waffle artesanal con chantilly, tu sirope favorito y TRIPLE bola de helado.",
    image: "assets/WAFFLE_BANANA_SPLIT.png",
    type: "waffle",
    sizes: [
      { name: "Entero", price: 19.9 },
      { name: "Mitad", price: 15.0 }
    ],
    defaultPrice: 19.9
  },
  {
    id: "waffle-manjar",
    name: "Waffle Manjar",
    category: "waffles",
    categoryName: "Waffles Artesanales 🧇",
    description: "Manjar blanco cremoso, plátano, granola artesanal, arándanos frescos, chantilly y bola de helado.",
    image: "assets/WAFFLE_MANJAR.png",
    type: "waffle",
    sizes: [
      { name: "Entero", price: 17.0 },
      { name: "Mitad", price: 12.0 }
    ],
    defaultPrice: 17.0
  },
  {
    id: "waffle-oreo",
    name: "Waffle Oreo",
    category: "waffles",
    categoryName: "Waffles Artesanales 🧇",
    description: "Cubierto con Oreo en trozos y molida, fresas frescas, chantilly, sirope y una bola de helado de vainilla.",
    image: "assets/WAFFLE_OREO.png",
    type: "waffle",
    sizes: [
      { name: "Entero", price: 18.0 },
      { name: "Mitad", price: 12.0 }
    ],
    defaultPrice: 18.0
  },
  {
    id: "waffle-kiwiberry",
    name: "Waffle Kiwiberry",
    category: "waffles",
    categoryName: "Waffles Artesanales 🧇",
    description: "Waffle recién horneado coronado con kiwi fresco, fresa, plátano, chantilly y helado de vainilla.",
    image: "assets/WAFFLE_KIWI.png",
    type: "waffle",
    sizes: [
      { name: "Entero", price: 23.0 },
      { name: "Mitad", price: 17.0 }
    ],
    defaultPrice: 23.0
  },
  {
    id: "waffle-brownie",
    name: "Waffle Brownie",
    category: "waffles",
    categoryName: "Waffles Artesanales 🧇",
    description: "Waffle recién preparado coronado con suave brownie esponjoso, fresas frescas, helado de vainilla y sirope de cacao 100%.",
    image: "assets/WAFFLE_BROWNIE.png",
    type: "waffle",
    sizes: [
      { name: "Entero", price: 21.0 },
      { name: "Mitad", price: 15.0 }
    ],
    defaultPrice: 21.0
  },

  // ==========================================
  // POSTRES & DONAS ARTESANALES
  // ==========================================
  {
    id: "pos-dona-oreo",
    name: "Dona de Oreo",
    category: "postres",
    categoryName: "Postres & Donas 🍩",
    description: "Dona esponjosa cubierta de queso crema especial, galleta Oreo triturada y una galleta Oreo completa.",
    image: "assets/DONA_OREO.png",
    type: "dona",
    defaultPrice: 4.0
  },
  {
    id: "pos-dona-choco-negro",
    name: "Dona de Chocolate Negro",
    category: "postres",
    categoryName: "Postres & Donas 🍩",
    description: "Bañada en abundante chocolate puro artesanal y decorada con divertidas grajeas de colores.",
    image: "assets/DONA_CHOCOLATE_NEGRO.png",
    type: "dona",
    defaultPrice: 4.0
  },
  {
    id: "pos-dona-choco-blanco",
    name: "Dona de Chocolate Blanco",
    category: "postres",
    categoryName: "Postres & Donas 🍩",
    description: "Cubierta de sedoso y delicado chocolate blanco artesanal con lluvia de toppings.",
    image: "assets/DONA_CHOCOLATE_BLANCO.png",
    type: "dona",
    defaultPrice: 4.0
  },
  {
    id: "pos-dona-fresa",
    name: "Dona de Fresa",
    category: "postres",
    categoryName: "Postres & Donas 🍩",
    description: "Cubierta de queso crema dulce y trocitos de fresa natural recién picada.",
    image: "assets/DONA_FRESA.png",
    type: "dona",
    defaultPrice: 4.0
  },
  {
    id: "pos-dona-manjar",
    name: "Dona de Manjar Blanco",
    category: "postres",
    categoryName: "Postres & Donas 🍩",
    description: "Generoso relleno de manjar blanco artesanal tradicional y decorada con sirope de chocolate.",
    image: "assets/DONA_MANJAR_BLANCO.png",
    type: "dona",
    defaultPrice: 4.0
  },
  {
    id: "pos-dona-glass",
    name: "Dona de Glass (Crema Pastelera)",
    category: "postres",
    categoryName: "Postres & Donas 🍩",
    description: "Rellena de suave crema pastelera casera y glaseada delicadamente al estilo tradicional.",
    image: "assets/DONA_GLASS.png",
    type: "dona",
    defaultPrice: 4.0
  },
  {
    id: "pos-galleta-choco-chips",
    name: "Galleta Choco Chips (90g)",
    category: "postres",
    categoryName: "Postres & Donas 🍩",
    description: "Una verdadera galleta artesanal de 90 gramos con abundante chispas de chocolate fino al estilo de Ruthy Bances.",
    image: "assets/GALLETA.png",
    type: "postre",
    defaultPrice: 4.0
  },
  {
    id: "pos-carrot-cake-tajada",
    name: "Carrot Cake (Tajada)",
    category: "postres",
    categoryName: "Postres & Donas 🍩",
    description: "Tajada generosa de suave keke artesanal de zanahoria con frosting de queso crema al estilo de Ruthy Bances.",
    image: "assets/CARROT_CAKE_TAJADA.png",
    type: "postre",
    defaultPrice: 8.0
  },
  {
    id: "pos-keke-marmoleado-tajada",
    name: "Keke Marmoleado (Tajada)",
    category: "postres",
    categoryName: "Postres & Donas 🍩",
    description: "Masa artesanal esponjosa con cacao intenso 100%, chispas de chocolate y frutos del bosque.",
    image: "assets/KEKE_MARMOLEADO_TAJADA.png",
    type: "postre",
    defaultPrice: 8.0
  },
  {
    id: "pos-torta-chocolate",
    name: "Torta de Chocolate",
    category: "postres",
    categoryName: "Postres & Donas 🍩",
    description: "Tajada húmeda de torta de chocolate rellena con fudge artesanal de olla y cubierta de virutas de chocolate.",
    image: "assets/TORTA_DE_CHOCOLATE.png",
    type: "postre",
    badge: "Clásico",
    defaultPrice: 9.5
  },
  {
    id: "pos-crema-volteada",
    name: "Crema Volteada",
    category: "postres",
    categoryName: "Postres & Donas 🍩",
    description: "Sedosa crema volteada tradicional con su toque exacto de caramelo rubio y vainilla.",
    image: "assets/CREMA_VOLTEADA.png",
    type: "postre",
    defaultPrice: 9.5
  },
  {
    id: "pos-pie-limon",
    name: "Pie de Limón",
    category: "postres",
    categoryName: "Postres & Donas 🍩",
    description: "Base crujiente de galleta dorada, crema cítrica sedosa de limón y merengue tostado.",
    image: "assets/PIE_DE_LIMON.jpeg",
    type: "postre",
    defaultPrice: 7.5
  },
  {
    id: "pos-tartaleta-frutas",
    name: "Tartaleta Mix de Frutas",
    category: "postres",
    categoryName: "Postres & Donas 🍩",
    description: "Masa quebrada crocante rellena de crema pastelera fina y cubierta de frutas frescas de estación.",
    image: "assets/TARTALETA_FRUTOS_MIXTO.png",
    type: "postre",
    defaultPrice: 7.5
  },
  {
    id: "pos-gelatina-mosaico",
    name: "Gelatina Mosaico (12oz)",
    category: "postres",
    categoryName: "Postres & Donas 🍩",
    description: "Vaso de 12oz con cubitos multicolores de gelatina de sabores sumergidos en crema tres leches.",
    image: "assets/GELATINA_MOSAICO.png",
    type: "postre",
    defaultPrice: 5.5
  },

  // ==========================================
  // COMBOS & PROMOCIONES VIGENTES
  // ==========================================
  {
    id: "combo-duo-compartir",
    name: "Dúo Compartir (2 Bebidas + 1 Complemento)",
    category: "combos",
    categoryName: "Combos & Dúos 🎁",
    description: "¡Ahorra en pareja o con amigos! 2 Bebidas a tu elección (frías o calientes, excepto frozens) + 1 Complemento a elegir (2 donas, 2 galletas, 1 dona + 1 galleta, Carrot Cake, Keke Marmoleado, Empanada o 4 Petit Pan).",
    image: "assets/DUO_COMPARTIR.png",
    type: "combo_duo_compartir",
    badge: "🔥 Super Promo",
    sizes: [
      { name: "12oz (Regular)", price: 33.0 },
      { name: "16oz (Grande)", price: 36.0 },
      { name: "20oz (Extra)", price: 38.0 }
    ],
    defaultPrice: 33.0
  },
  {
    id: "combo-duo-irresistible",
    name: "Dúo Irresistible (Club Sándwich + Papas + 2 Bebidas)",
    category: "combos",
    categoryName: "Combos & Dúos 🎁",
    description: "Club Sándwich gigante de 4 pisos + 350g de papas nativas doradas + 2 Bebidas a elegir (Americano, Cappuccino, Chocolate Caliente, Iced Coffee, Iced Latte o Iced Chocolate).",
    image: "assets/DUO_IRRESISTIBLE.png",
    type: "combo_duo_irresistible",
    badge: "🔥 Más Pedido",
    sizes: [
      { name: "12oz (Regular)", price: 37.0 },
      { name: "16oz (Grande)", price: 40.0 },
      { name: "21oz (Extra)", price: 42.0 }
    ],
    defaultPrice: 37.0
  },
  {
    id: "combo-media-docena",
    name: "Promoción Media Docena (6 Unidades)",
    category: "combos",
    categoryName: "Combos & Dúos 🎁",
    description: "Llévate 6 unidades recién horneadas del día al mejor precio. Puedes combinarlas como quieras: 6 donas, 6 galletas choco chips, o mixtas (donas + galletas sumando 6).",
    image: "assets/MEDIA_DOCENA_DONAS.png",
    type: "combo",
    badge: "S/ 21.00",
    defaultPrice: 21.0
  },
  {
    id: "combo-caprikids",
    name: "Combo Cajita Caprikids",
    category: "combos",
    categoryName: "Combos & Dúos 🎁",
    description: "Frappé Oreo de 12oz + Nuggets artesanales crocantes + Papas nativas con salchichas ahumadas + 2 Juguetes a elección (Pistola de burbujas, Burbujas o Squishy).",
    image: "assets/caprikids.jpg",
    type: "combo",
    badge: "Para los Peques",
    defaultPrice: 27.0
  }
];

// Opciones globales de personalización de bebidas
const BEVERAGE_CUSTOM_OPTIONS = {
  milks: [
    { id: "entera", name: "Leche Entera UHT (Tradicional)", price: 0 },
    { id: "sin_lactosa", name: "Leche Sin Lactosa (¡Gratis!)", price: 0 },
    { id: "almendras", name: "Leche de Almendras", price: 2.50 }
  ],
  sweeteners: [
    { id: "azucar", name: "Azúcar Blanca (Normal)", price: 0 },
    { id: "stevia", name: "Stevia Natural (¡Gratis!)", price: 0 },
    { id: "sin_azucar", name: "Sin Azúcar / Al Natural", price: 0 }
  ],
  toppings: [
    { id: "std", name: "Topping Estándar del Producto", price: 0 },
    { id: "extra_oreo", name: "Topping Extra: Triturado de Oreo (+ S/ 1.00)", price: 1.00 },
    { id: "extra_chispas", name: "Topping Extra: Chispas de Chocolate (+ S/ 1.00)", price: 1.00 },
    { id: "extra_chinchin", name: "Topping Extra: Mini Chin Chin (+ S/ 1.00)", price: 1.00 },
    { id: "extra_almendra", name: "Topping Extra: Almendra Triturada (+ S/ 1.00)", price: 1.00 },
    { id: "extra_chantilly", name: "Chantilly Extra (4oz) (+ S/ 2.00)", price: 2.00 }
  ]
};

// Número oficial de recepción de pedidos de Caprichos
const CAPRICHOS_WHATSAPP_PHONE = "51977503006";

// Coordenadas centrales de la tienda Caprichos
const CAPRICHOS_STORE_LOCATION = {
  lat: -12.0188,
  lng: -76.9645,
  name: "Caprichos Cafetería & Pastelería",
  address: "San Juan de Lurigancho, Lima, Perú",
  schedule: "2:00 pm a 10:00 pm"
};
