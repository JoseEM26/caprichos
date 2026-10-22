import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Producto de la carta -> foto en docs/recursos/imagenes-carta-web (nombre del producto, sin la extensión del archivo)
const FOTOS: Record<string, string> = {
  'CAFÉ AMERICANO': 'americano',
  'CANELATTE CARAMEL': 'canelatte_caramel',
  'CAPRIBERRY VAINILLA': 'capriberry_vainilla',
  CAPUCCINO: 'capuccino',
  'CARAMEL MACCHIATO': 'caramel_macchiato',
  'CHOCOLATE CALIENTE': 'chocolate',
  CHOCONUBE: 'choconube',
  'LATTE VAINILLA': 'latte_vainilla',
  MOCACCINO: 'mocaccino',
  'OREO LATTE': 'oreo_latte',
  'SALTAMEL BROWNIE': 'saltamel_brownie',
  '1/2 DOCENA DONUTS O GALLETAS': 'media_docena_donas',
  'COMBO CAJITA CAPRIKIDS': 'caprikids',
  'DÚO IRRESISTIBLE': 'duo_irresistible',
  'DÚO PARA COMPARTIR': 'duo_compartir',
  'CROISSANT DE CACAO': 'croissant_cacao',
  'CROISSANT DE JAMÓN Y QUESO': 'croissant_jamonyqueso',
  'CROISSANT DE POLLO Y FRUTOS SECOS': 'croissant_pollo',
  'FRAPPE ALGARRO LÚCUMA': 'frappe_algarrolucuma',
  'FRAPPE BERRIES': 'frappe_berries',
  'FRAPPE CAFÉ': 'frappe_cafe',
  'FRAPPE CARAMEL CHOCOLATE': 'frappe_caramel_chocolate',
  'FRAPPE CARAMEL CLÁSICO': 'frappe_caramel_clasico',
  'FRAPPE CHOCO BERRY': 'frappe_chocoberry',
  'FRAPPE CHOCO LÚCUMA': 'frappe_chocolucuma',
  'FRAPPE FIT': 'frappe_fit',
  'FRAPPE MARACUYÁ': 'frappe_maracuya',
  'FRAPPE MOCA': 'frappe_moca',
  'FRAPPE OREO': 'frappe_oreo',
  'FRAPPE STRAWBERRY': 'frappe_strawberry',
  'FROZEN LIMONADA': 'frozen_limonada',
  'FROZEN MARACUYÁ': 'frozen_maracuya',
  'FROZEN STRAWBERRY': 'frozen_strawberry',
  'ICE BERRY': 'iced_berry',
  'ICED CHOCOLATE': 'iced_chocolate',
  'ICED COFFE': 'iced_coffee',
  'LATTE COFFE': 'iced_latte_coffee',
  'CARROT CAKE': 'carrot_cake_tajada',
  'CREMA VOLTEADA': 'crema_volteada',
  'DONAS ARTESANALES': 'dona_chocolate_blanco',
  'GALLETA CHOCO CHIPS': 'galleta',
  'GELATINA MOSAICO': 'gelatina_mosaico',
  'MARMOLEADO CHIPS': 'keke_marmoleado_tajada',
  'PIE DE LIMÓN': 'pie_de_limon',
  'TARTALETA MIX DE FRUTAS': 'tartaleta_frutos_mixto',
  'TORTA DE CHOCOLATE': 'torta_de_chocolate',
  CAPRISABROSO: 'caprisabroso',
  'CLUB SANDWICH': 'club_sandwich',
  'EMPANADA ARTESANAL': 'empanada_artesanal',
  PARRILLERO: 'parrillero',
  'PETIT PAN RELLENO DE POLLO': 'petit_pan',
  SUPREMA: 'suprema',
  'SÁNDWICH CLÁSICO': 'sandwich_clasico',
  'SÁNDWICH ESPECIAL': 'sandwich_especial',
  NUTEWAFFLE: 'waffle_nutella',
  'WAFFLE BANANA SPLIT': 'waffle_banana_split',
  'WAFFLE BROWNIE': 'waffle_brownie',
  'WAFFLE FRESA SPLIT': 'waffle_fresa_split',
  'WAFFLE FRUTOS DEL BOSQUE': 'waffle_frutos_del_bosque',
  'WAFFLE KIWIBERRY': 'waffle_kiwi',
  'WAFFLE MANJAR': 'waffle_manjar',
  'WAFFLE OREO': 'waffle_oreo',
  'WAFFLE POP': 'waffle_pop',
  'WAFFLE TROPICAL': 'waffle_tropical',
};

/** Copia las fotos de docs/recursos a la carpeta de subidas y las enlaza a cada producto (idempotente). */
export async function main() {
  const origen = path.resolve(__dirname, '../../../docs/recursos/imagenes-carta-web');
  const destino = path.resolve(process.env.UPLOADS_DIR ?? './data/uploads', 'publico/seed');
  fs.mkdirSync(destino, { recursive: true });

  let enlazadas = 0;
  for (const [nombre, archivoFoto] of Object.entries(FOTOS)) {
    const producto = await prisma.producto.findFirst({ where: { nombre } });
    const fuente = path.join(origen, `${archivoFoto}.webp`);
    if (!producto || !fs.existsSync(fuente)) {
      console.warn(`Sin enlazar: ${nombre} (${archivoFoto}.webp)`);
      continue;
    }
    fs.copyFileSync(fuente, path.join(destino, `${archivoFoto}.webp`));
    const ruta = `publico/seed/${archivoFoto}.webp`;
    const archivo = await prisma.archivo.upsert({
      where: { ruta },
      update: { bytes: fs.statSync(fuente).size },
      create: { ruta, tipo_mime: 'image/webp', bytes: fs.statSync(fuente).size, privado: false },
    });
    await prisma.producto.update({ where: { id: producto.id }, data: { foto_archivo_id: archivo.id } });
    enlazadas++;
  }
  console.log(`Fotos enlazadas: ${enlazadas} de ${Object.keys(FOTOS).length}`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
