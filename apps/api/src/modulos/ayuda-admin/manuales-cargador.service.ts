import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { MATRIZ } from '../acceso/permisos';
import { FrontmatterManual, ManualAyuda, EnlaceAyuda } from './ayuda-admin.tipos';

const PALABRAS_VACIAS = new Set([
  'como', 'hago', 'hacer', 'puedo', 'puede', 'para', 'que', 'los', 'las', 'por',
  'favor', 'del', 'una', 'uno', 'unos', 'unas', 'con', 'sin', 'sobre', 'este',
  'esta', 'estos', 'estas', 'donde', 'cual', 'cuales', 'cuando', 'quien', 'quienes',
  'sistema', 'caprichos', 'capri', 'hola', 'buenas', 'duda', 'ayuda', 'quiero',
  'necesito', 'saber', 'hace', 'hacen', 'hizo', 'hacia', 'paso', 'pasos',
]);

@Injectable()
export class ManualesCargadorService implements OnModuleInit {
  private readonly logger = new Logger(ManualesCargadorService.name);
  private rutaCarpetaManuales: string;
  private manualesPorModulo = new Map<string, ManualAyuda>();
  private manualesPorRuta = new Map<string, ManualAyuda>();
  private cargado = false;

  constructor() {
    const distPath = path.join(__dirname, 'manuales');
    const srcPath = path.resolve(__dirname, '../../../src/modulos/ayuda-admin/manuales');
    const cwdSrcPath = path.resolve(process.cwd(), 'src/modulos/ayuda-admin/manuales');

    if (fs.existsSync(distPath)) {
      this.rutaCarpetaManuales = distPath;
    } else if (fs.existsSync(srcPath)) {
      this.rutaCarpetaManuales = srcPath;
    } else if (fs.existsSync(cwdSrcPath)) {
      this.rutaCarpetaManuales = cwdSrcPath;
    } else {
      this.rutaCarpetaManuales = distPath;
    }
  }

  onModuleInit() {
    this.cargarManuales();
  }

  /**
   * Permite configurar dinámicamente la carpeta de manuales (usado principalmente en pruebas).
   */
  establecerCarpeta(rutaAbsoluta: string): void {
    this.rutaCarpetaManuales = rutaAbsoluta;
    this.cargado = false;
    this.cargarManuales();
  }

  obtenerCarpetaActual(): string {
    return this.rutaCarpetaManuales;
  }

  /**
   * Carga todos los manuales Markdown de la carpeta configurada en memoria una sola vez.
   */
  cargarManuales(rutaAlternativa?: string): Map<string, ManualAyuda> {
    const carpeta = rutaAlternativa || this.rutaCarpetaManuales;
    this.manualesPorModulo.clear();
    this.manualesPorRuta.clear();

    if (!fs.existsSync(carpeta)) {
      this.logger.warn(`La carpeta de manuales no existe: ${carpeta}`);
      this.cargado = true;
      return this.manualesPorModulo;
    }

    try {
      const archivos = fs.readdirSync(carpeta).filter((f) => f.endsWith('.md'));
      for (const archivo of archivos) {
        const rutaCompleta = path.join(carpeta, archivo);
        const contenidoCrudo = fs.readFileSync(rutaCompleta, 'utf-8');
        const manual = this.parsearManual(archivo, contenidoCrudo);
        if (manual) {
          this.manualesPorModulo.set(manual.modulo, manual);
          this.manualesPorRuta.set(manual.ruta, manual);
        }
      }
      this.logger.log(`Cargados ${this.manualesPorModulo.size} manuales desde ${carpeta}`);
    } catch (err: any) {
      this.logger.error(`Error al cargar manuales de ${carpeta}: ${err.message}`);
    }

    this.cargado = true;
    return this.manualesPorModulo;
  }

  /**
   * Parsea el contenido Markdown con frontmatter YAML y secciones estructuradas.
   */
  parsearManual(nombreArchivo: string, contenido: string): ManualAyuda | null {
    const partes = contenido.split(/^---\r?\n/m);
    if (partes.length < 3) {
      this.logger.warn(`El manual ${nombreArchivo} no tiene formato frontmatter delimitado por ---`);
      return null;
    }

    const yamlTexto = partes[1];
    const markdownCuerpo = partes.slice(2).join('---').trim();

    const fm = this.parsearFrontmatter(yamlTexto);
    if (!fm.modulo || !fm.titulo || !fm.ruta) {
      this.logger.warn(`El manual ${nombreArchivo} carece de campos obligatorios (modulo, titulo, ruta)`);
      return null;
    }

    const { paraQueSirve, seccionesComoSeHace, erroresYDudas, quienPuedeHacerlo, mencionesDoblesCorchetes } =
      this.extraerSeccionesMarkdown(markdownCuerpo);

    return {
      archivo: nombreArchivo,
      modulo: fm.modulo,
      titulo: fm.titulo,
      ruta: fm.ruta,
      permiso: fm.permiso,
      roles: fm.roles,
      sugerencias: fm.sugerencias,
      relacionados: fm.relacionados,
      contenido: markdownCuerpo,
      paraQueSirve,
      seccionesComoSeHace,
      erroresYDudas,
      quienPuedeHacerlo,
      mencionesDoblesCorchetes,
    };
  }

  private parsearFrontmatter(yaml: string): FrontmatterManual {
    const lineas = yaml.split(/\r?\n/);
    let modulo = '';
    let titulo = '';
    let ruta = '';
    let permiso: string | undefined = undefined;
    const roles: string[] = [];
    const sugerencias: string[] = [];
    const relacionados: string[] = [];

    let leyendoLista: 'roles' | 'sugerencias' | 'relacionados' | null = null;

    for (const rawLinea of lineas) {
      const linea = rawLinea.trim();
      if (!linea || linea.startsWith('#')) continue;

      if (linea.startsWith('- ')) {
        const item = linea.slice(2).trim().replace(/^['"]|['"]$/g, '');
        if (leyendoLista === 'sugerencias') {
          sugerencias.push(item);
        } else if (leyendoLista === 'roles') {
          roles.push(item.toUpperCase());
        } else if (leyendoLista === 'relacionados') {
          relacionados.push(item.toLowerCase());
        }
        continue;
      }

      const matchRolesInline = linea.match(/^roles:\s*\[(.*)\]/i);
      if (matchRolesInline) {
        leyendoLista = null;
        const items = matchRolesInline[1]
          .split(',')
          .map((r) => r.trim().replace(/^['"]|['"]$/g, '').toUpperCase())
          .filter(Boolean);
        roles.push(...items);
        continue;
      }

      const matchRelacionadosInline = linea.match(/^relacionados:\s*\[(.*)\]/i);
      if (matchRelacionadosInline) {
        leyendoLista = null;
        const items = matchRelacionadosInline[1]
          .split(',')
          .map((r) => r.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
          .filter(Boolean);
        relacionados.push(...items);
        continue;
      }

      const matchClave = linea.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (matchClave) {
        const clave = matchClave[1].toLowerCase();
        const valor = matchClave[2].trim().replace(/^['"]|['"]$/g, '');

        if (clave === 'modulo') {
          modulo = valor;
          leyendoLista = null;
        } else if (clave === 'titulo') {
          titulo = valor;
          leyendoLista = null;
        } else if (clave === 'ruta') {
          ruta = valor;
          leyendoLista = null;
        } else if (clave === 'permiso') {
          permiso = valor ? valor : undefined;
          leyendoLista = null;
        } else if (clave === 'roles') {
          leyendoLista = 'roles';
        } else if (clave === 'sugerencias') {
          leyendoLista = 'sugerencias';
        } else if (clave === 'relacionados') {
          leyendoLista = 'relacionados';
        }
      }
    }

    return {
      modulo,
      titulo,
      ruta,
      permiso,
      roles,
      sugerencias,
      relacionados,
    };
  }

  private extraerSeccionesMarkdown(markdown: string) {
    const lineas = markdown.split(/\r?\n/);
    let seccionActual = '';
    let bufferSeccion: string[] = [];
    const seccionesMap = new Map<string, string[]>();
    const mencionesDoblesCorchetesSet = new Set<string>();

    // Buscar todas las menciones [[clave]] en todo el contenido
    const matchesGlobales = markdown.matchAll(/\[\[([a-zA-Z0-9_-]+)\]\]/g);
    for (const m of matchesGlobales) {
      if (m[1]) {
        mencionesDoblesCorchetesSet.add(m[1].toLowerCase().trim());
      }
    }

    for (const linea of lineas) {
      const encabezadoMatch = linea.match(/^##\s+(.+)$/);
      if (encabezadoMatch) {
        if (seccionActual) {
          seccionesMap.set(seccionActual, bufferSeccion);
        }
        seccionActual = encabezadoMatch[1].trim();
        bufferSeccion = [];
      } else if (seccionActual) {
        bufferSeccion.push(linea);
      }
    }
    if (seccionActual) {
      seccionesMap.set(seccionActual, bufferSeccion);
    }

    let paraQueSirve: string | undefined;
    let erroresYDudas: string | undefined;
    let quienPuedeHacerlo: string | undefined;
    const seccionesComoSeHace: import('./ayuda-grafo.tipos').SeccionComoSeHace[] = [];

    for (const [tituloSec, lineasSec] of seccionesMap.entries()) {
      const tNorm = this.normalizarTexto(tituloSec);

      if (tNorm.includes('para que sirve')) {
        paraQueSirve = lineasSec.join('\n').trim();
      } else if (tNorm.startsWith('como se hace')) {
        const tituloLimpio = tituloSec.replace(/^como\s+se\s+hace:?\s*/i, '').trim();
        const slug = this.generarSlug(tituloLimpio || tituloSec);

        // Extraer relaciones tipadas de las líneas de la tarea
        const relaciones: import('./ayuda-grafo.tipos').RelacionTarea[] = [];
        const lineasPasosLimpias: string[] = [];

        for (const rawL of lineasSec) {
          const lTrim = rawL.trim();
          const matchRel = lTrim.match(/^(Requiere|Antes|Despues|Ver\s+tambien):\s*(.+)$/i);
          if (matchRel) {
            const tipoPrefijo = matchRel[1].toLowerCase().replace(/\s+/g, '_');
            const resto = matchRel[2];
            let tipoRel: 'requiere' | 'antes' | 'despues' | 'ver_tambien' = 'ver_tambien';
            if (tipoPrefijo === 'requiere') tipoRel = 'requiere';
            else if (tipoPrefijo === 'antes') tipoRel = 'antes';
            else if (tipoPrefijo === 'despues') tipoRel = 'despues';
            else if (tipoPrefijo === 'ver_tambien') tipoRel = 'ver_tambien';

            const matchesDest = resto.matchAll(/\[\[([a-zA-Z0-9_-]+)\]\]/g);
            for (const md of matchesDest) {
              const destClave = md[1].toLowerCase().trim();
              if (destClave) {
                relaciones.push({ tipo: tipoRel, destinoModulo: destClave });
                mencionesDoblesCorchetesSet.add(destClave);
              }
            }
          } else {
            lineasPasosLimpias.push(rawL);
          }
        }

        seccionesComoSeHace.push({
          slug,
          titulo: tituloLimpio || tituloSec,
          pasos: lineasPasosLimpias.join('\n').trim(),
          relaciones,
        });
      } else if (tNorm.includes('errores') || tNorm.includes('dudas')) {
        erroresYDudas = lineasSec.join('\n').trim();
      } else if (tNorm.includes('quien puede')) {
        quienPuedeHacerlo = lineasSec.join('\n').trim();
      }
    }

    return {
      paraQueSirve,
      seccionesComoSeHace,
      erroresYDudas,
      quienPuedeHacerlo,
      mencionesDoblesCorchetes: Array.from(mencionesDoblesCorchetesSet),
    };
  }

  generarSlug(texto: string): string {
    return this.normalizarTexto(texto)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Obtiene todos los manuales actualmente en memoria.
   */
  obtenerTodos(): ManualAyuda[] {
    if (!this.cargado) {
      this.cargarManuales();
    }
    return Array.from(this.manualesPorModulo.values());
  }

  /**
   * Obtiene un manual por la clave de su módulo (e.g. 'caja', 'productos').
   */
  obtenerPorModulo(modulo: string): ManualAyuda | undefined {
    if (!this.cargado) this.cargarManuales();
    return this.manualesPorModulo.get(modulo);
  }

  /**
   * Obtiene un manual por la ruta del admin (e.g. '/admin/caja').
   */
  obtenerPorRuta(ruta: string): ManualAyuda | undefined {
    if (!this.cargado) this.cargarManuales();
    const rutaBase = ruta.split('?')[0].replace(/\/+$/, '');
    if (this.manualesPorRuta.has(rutaBase)) {
      return this.manualesPorRuta.get(rutaBase);
    }
    for (const manual of this.manualesPorRuta.values()) {
      if (rutaBase === manual.ruta || rutaBase.startsWith(manual.ruta + '/')) {
        return manual;
      }
    }
    return undefined;
  }

  /**
   * Determina si el rol tiene acceso al manual según su permiso y lista de roles.
   */
  esManualAccesibleParaRol(manual: ManualAyuda, rol: string): boolean {
    const rolNorm = (rol || '').toUpperCase().trim();
    if (rolNorm === 'ADMIN') return true;

    // Verificar si el rol figura explícitamente en la lista de roles del manual
    const enRoles = manual.roles.some((r) => r.toUpperCase() === rolNorm || r === '*');

    // Verificar si tiene el permiso mínimo requerido según la MATRIZ de permisos
    let tienePermiso = true;
    if (manual.permiso && manual.permiso.trim().length > 0) {
      const permisosRol = MATRIZ[rolNorm] || [];
      tienePermiso = permisosRol.includes(manual.permiso.trim());
    }

    return enRoles && tienePermiso;
  }

  /**
   * Retorna únicamente los manuales que el usuario autenticado tiene permitido consultar.
   */
  obtenerManualesAccesibles(rol: string): ManualAyuda[] {
    const todos = this.obtenerTodos();
    return todos.filter((m) => this.esManualAccesibleParaRol(m, rol));
  }

  /**
   * Construye la lista blanca de enlaces permitidos para el rol.
   */
  obtenerEnlacesAccesibles(rol: string): EnlaceAyuda[] {
    const accesibles = this.obtenerManualesAccesibles(rol);
    return accesibles.map((m) => ({
      texto: `Ir a ${m.titulo}`,
      ruta: m.ruta,
    }));
  }

  /**
   * Busca los manuales relevantes para una pregunta y ruta actual:
   * 1. El manual del módulo actual (si la ruta coincide y el rol puede verlo).
   * 2. Los 2 manuales más parecidos por palabras clave entre los que el rol tiene acceso.
   */
  buscarManualesRelevantes(
    pregunta: string,
    rutaActual?: string,
    rol: string = 'ADMIN',
  ): { manualModuloActual?: ManualAyuda; relevantes: ManualAyuda[] } {
    const accesibles = this.obtenerManualesAccesibles(rol);
    let manualModuloActual: ManualAyuda | undefined;

    if (rutaActual) {
      const manualRuta = this.obtenerPorRuta(rutaActual);
      if (manualRuta && this.esManualAccesibleParaRol(manualRuta, rol)) {
        manualModuloActual = manualRuta;
      }
    }

    const restantes = accesibles.filter(
      (m) => !manualModuloActual || m.modulo !== manualModuloActual.modulo,
    );

    const tokensPregunta = this.tokenizarTexto(pregunta);

    const puntuados = restantes.map((manual) => {
      let score = 0;
      const tituloTokens = this.tokenizarTexto(manual.titulo);
      const moduloTokens = this.tokenizarTexto(manual.modulo);

      for (const t of tokensPregunta) {
        if (tituloTokens.includes(t)) score += 6;
        if (moduloTokens.includes(t)) score += 5;
      }

      // Evaluar coincidencia en sugerencias
      for (const sug of manual.sugerencias) {
        const sugTokens = this.tokenizarTexto(sug);
        for (const t of tokensPregunta) {
          if (sugTokens.includes(t)) score += 4;
        }
      }

      // Evaluar coincidencia en tareas "como se hace"
      for (const tarea of manual.seccionesComoSeHace) {
        const tareaTokens = this.tokenizarTexto(tarea.titulo);
        for (const t of tokensPregunta) {
          if (tareaTokens.includes(t)) score += 5;
        }
      }

      // Evaluar coincidencia en texto general
      const textoTokens = this.tokenizarTexto(manual.contenido);
      for (const t of tokensPregunta) {
        if (textoTokens.includes(t)) score += 1;
      }

      return { manual, score };
    });

    puntuados.sort((a, b) => b.score - a.score);

    const relevantes = puntuados.slice(0, 2).map((p) => p.manual);

    return {
      manualModuloActual,
      relevantes,
    };
  }

  /**
   * Genera una respuesta de contingencia SIN IA extrayendo los pasos directamente del manual más relevante.
   */
  generarRespuestaRespaldo(
    pregunta: string,
    rutaActual?: string,
    rol: string = 'ADMIN',
  ): { respuesta: string; enlaces: EnlaceAyuda[] } {
    const { manualModuloActual, relevantes } = this.buscarManualesRelevantes(
      pregunta,
      rutaActual,
      rol,
    );

    const manualObjetivo = manualModuloActual || relevantes[0];

    if (!manualObjetivo) {
      return {
        respuesta:
          'No encontré manuales disponibles para tu rol en esta sección. Si requieres asistencia sobre alguna función del sistema, consulta con tu Administrador.\n\nYo solo te guío. Tú realizas el cambio y confirmas con Sí o No en la pantalla.',
        enlaces: [],
      };
    }

    // Buscar si alguna tarea concreta "como se hace" coincide con la pregunta
    const tokens = this.tokenizarTexto(pregunta);
    let mejorSeccion: { titulo: string; pasos: string } | null = null;
    let mejorScore = 0;

    for (const sec of manualObjetivo.seccionesComoSeHace) {
      const secTokens = this.tokenizarTexto(sec.titulo + ' ' + sec.pasos);
      let s = 0;
      for (const t of tokens) {
        if (secTokens.includes(t)) s++;
      }
      if (s > mejorScore) {
        mejorScore = s;
        mejorSeccion = sec;
      }
    }

    let textoRespuesta = '';

    if (mejorSeccion) {
      textoRespuesta = `Para **${mejorSeccion.titulo}** en **${manualObjetivo.titulo}**:\n\n${mejorSeccion.pasos}`;
    } else if (manualObjetivo.seccionesComoSeHace.length > 0) {
      const primera = manualObjetivo.seccionesComoSeHace[0];
      textoRespuesta = `En el módulo **${manualObjetivo.titulo}**, los pasos para **${primera.titulo}** son:\n\n${primera.pasos}`;
    } else if (manualObjetivo.paraQueSirve) {
      textoRespuesta = `**${manualObjetivo.titulo}**:\n\n${manualObjetivo.paraQueSirve}`;
    } else {
      textoRespuesta = `Puedes consultar las funciones de **${manualObjetivo.titulo}** navegando a la pantalla correspondiente.`;
    }

    // Regla de oro: recordatorio fijo
    textoRespuesta +=
      '\n\nYo solo te guío. Tú realizas la acción y confirmas con Sí o No en la pantalla.';

    const enlaces: EnlaceAyuda[] = [
      {
        texto: `Ir a ${manualObjetivo.titulo}`,
        ruta: manualObjetivo.ruta,
      },
    ];

    return {
      respuesta: textoRespuesta,
      enlaces,
    };
  }

  private normalizarTexto(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private tokenizarTexto(texto: string): string[] {
    const limpio = this.normalizarTexto(texto).replace(/[^a-z0-9\s]/g, ' ');
    return limpio
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !PALABRAS_VACIAS.has(w));
  }
}
