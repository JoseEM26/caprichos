import { main } from './cli';
import { arrancarProtegido } from './arranque';

// Punto de entrada del programa (node dist/entrada.js y el .exe). Sin `require.main === module`:
// ese chequeo es frágil dentro del bundle de esbuild/pkg y puede dejar el programa mudo.
void arrancarProtegido(main);
