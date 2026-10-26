import * as fs from 'fs';
import * as path from 'path';
import { obtenerConfiguracion } from './config';
import { ImpresoraUsb } from './impresora/impresoraUsb';
import type { IDispositivoImpresora } from './impresora/dispositivo.interface';
import { ClienteApiImpresion } from './api/clienteApi';
import { AgenteLocalServicio } from './agente/bucle';
import {
  generarTsplTrabajo,
  generarBytesTrabajo,
} from './tspl/generadorTspl';
import {
  muestraEtiquetaGeneral,
  muestraEtiquetaArea,
  muestraEtiquetaBebida,
} from './datosMuestra';

export async function ejecutarComandoProbar(
  impresora?: IDispositivoImpresora,
  logger: (msg: string) => void = console.log
): Promise<{ exito: boolean; impresas: number; error?: string }> {
  const config = obtenerConfiguracion();
  const dispositivo = impresora || new ImpresoraUsb(config.impresoraRuta);

  logger('=====================================================');
  logger('  MODO PRUEBA: Imprimiendo 3 etiquetas de muestra   ');
  logger('  (1 General, 1 de Área y 1 por Vaso de Bebida)     ');
  logger(`  Dispositivo destino: ${dispositivo.obtenerRuta()} `);
  logger('=====================================================');

  try {
    // 1. General
    logger('Enviando Etiqueta General de Pedido (PED-101)...');
    const bytesGeneral = generarBytesTrabajo('ETIQUETA_GENERAL', muestraEtiquetaGeneral);
    await dispositivo.escribir(bytesGeneral);

    // 2. Área
    logger('Enviando Etiqueta de Área (COCINA 1 de 2)...');
    const bytesArea = generarBytesTrabajo('ETIQUETA_AREA', muestraEtiquetaArea);
    await dispositivo.escribir(bytesArea);

    // 3. Bebida
    logger('Enviando Etiqueta por Bebida (CAPPUCCINO VAINILLA - MARÍA ELENA)...');
    const bytesBebida = generarBytesTrabajo('ETIQUETA_BEBIDA', muestraEtiquetaBebida);
    await dispositivo.escribir(bytesBebida);

    logger('-----------------------------------------------------');
    logger('✔ 3 etiquetas impresas correctamente en el dispositivo.');
    return { exito: true, impresas: 3 };
  } catch (err: any) {
    logger('-----------------------------------------------------');
    logger(`✖ Error durante la prueba de impresión: ${err.message}`);
    if (err.codigoOriginal === 'ENOENT') {
      logger('  Asegúrese de que el cable USB de la etiquetera esté conectado.');
    } else if (err.codigoOriginal === 'EACCES') {
      logger('  Permiso denegado. Ejecute: sudo usermod -a -G lp $USER');
    }
    return { exito: false, impresas: 0, error: err.message };
  }
}

export async function ejecutarComandoVolcar(
  directorioDestino: string = path.join(process.cwd(), 'etiquetas-tspl'),
  logger: (msg: string) => void = console.log
): Promise<string[]> {
  logger('=====================================================');
  logger('  MODO VOLCADO: Generando archivos TSPL en disco    ');
  logger(`  Directorio: ${directorioDestino}                  `);
  logger('=====================================================');

  if (!fs.existsSync(directorioDestino)) {
    fs.mkdirSync(directorioDestino, { recursive: true });
  }

  const archivosGenerados: string[] = [];

  // 1. General
  const tsplGeneral = generarTsplTrabajo('ETIQUETA_GENERAL', muestraEtiquetaGeneral);
  const rutaGeneral = path.join(directorioDestino, 'etiqueta-general.tspl');
  fs.writeFileSync(rutaGeneral, tsplGeneral, 'utf-8');
  archivosGenerados.push(rutaGeneral);
  logger(`✔ Escrito: ${rutaGeneral} (${tsplGeneral.length} bytes)`);

  // 2. Área
  const tsplArea = generarTsplTrabajo('ETIQUETA_AREA', muestraEtiquetaArea);
  const rutaArea = path.join(directorioDestino, 'etiqueta-area.tspl');
  fs.writeFileSync(rutaArea, tsplArea, 'utf-8');
  archivosGenerados.push(rutaArea);
  logger(`✔ Escrito: ${rutaArea} (${tsplArea.length} bytes)`);

  // 3. Bebida
  const tsplBebida = generarTsplTrabajo('ETIQUETA_BEBIDA', muestraEtiquetaBebida);
  const rutaBebida = path.join(directorioDestino, 'etiqueta-bebida.tspl');
  fs.writeFileSync(rutaBebida, tsplBebida, 'utf-8');
  archivosGenerados.push(rutaBebida);
  logger(`✔ Escrito: ${rutaBebida} (${tsplBebida.length} bytes)`);

  logger('-----------------------------------------------------');
  logger('Archivos TSPL volcados listos para inspección o pruebas.');
  return archivosGenerados;
}

export async function main(): Promise<void> {
  const comando = process.argv[2]?.trim().toLowerCase();

  if (comando === 'probar') {
    const res = await ejecutarComandoProbar();
    process.exit(res.exito ? 0 : 1);
  }

  if (comando === 'volcar') {
    await ejecutarComandoVolcar();
    process.exit(0);
  }

  // Modo servicio (bucle continuo)
  const config = obtenerConfiguracion();
  const clienteApi = new ClienteApiImpresion(config.apiUrl, config.agenteKey);
  const impresora = new ImpresoraUsb(config.impresoraRuta);

  const agente = new AgenteLocalServicio({
    config,
    clienteApi,
    impresora,
  });

  const finalizar = () => {
    console.log('\nSeñal de terminación recibida. Deteniendo agente...');
    agente.detener();
    process.exit(0);
  };

  process.on('SIGINT', finalizar);
  process.on('SIGTERM', finalizar);

  await agente.iniciar();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error fatal en el agente:', err);
    process.exit(1);
  });
}
