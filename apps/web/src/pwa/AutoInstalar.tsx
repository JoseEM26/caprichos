import { BotonInstalarApp } from './BotonInstalarApp';
import { appSolicitada } from './instalar';

/** Pestaña abierta con ?instalar=carta|admin|asistencia: abre sola la ventana de instalar con esa app marcada. */
export function AutoInstalar() {
  return appSolicitada() ? <BotonInstalarApp abrirInicial sinBoton siempre /> : null;
}
