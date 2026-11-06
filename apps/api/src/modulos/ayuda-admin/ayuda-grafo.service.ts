import { Injectable, Logger } from '@nestjs/common';
import { ROLES, MATRIZ } from '../acceso/permisos';
import { ManualesCargadorService } from './manuales-cargador.service';
import {
  NodoGrafo,
  NodoModulo,
  NodoTarea,
  AristaGrafo,
  TipoAristaGrafo,
  ResumenGrafoRespuesta,
  ResultadoRecuperacionGrafo,
} from './ayuda-grafo.tipos';
import { ManualAyuda } from './ayuda-admin.tipos';

const DICCIONARIO_SINONIMOS: Record<string, string[]> = {
  anular: ['cancelar', 'anulacion', 'eliminar', 'anula', 'cancela'],
  cancelar: ['anular', 'cancelacion', 'cancela', 'anula'],
  cobrar: ['pagar', 'cobro', 'pago', 'cobranza', 'cobra', 'paga'],
  pagar: ['cobrar', 'pago', 'abono', 'paga', 'cobra'],
  abrir: ['apertura', 'inicio', 'empezar', 'abre'],
  cerrar: ['cierre', 'liquidar', 'finalizar', 'cierra'],
  crear: ['nuevo', 'registrar', 'alta', 'agregar', 'crea', 'registra'],
  agotar: ['disponible', 'quitar', 'stock', 'agota'],
  editar: ['modificar', 'cambiar', 'actualizar', 'edita', 'cambia'],
  eliminar: ['borrar', 'desactivar', 'baja', 'elimina'],
  diferencia: ['cuadre', 'faltante', 'sobrante', 'descuadre'],
  supervisor: ['codigo', 'totp', 'autorizacion', 'pin'],
};

/** Palabras que no distinguen un ajuste de otro al buscar «¿dónde cambio…?». */
const TOKENS_GENERICOS = new Set([
  'donde', 'dónde', 'cambio', 'cambiar', 'configuro', 'configurar', 'configuracion', 'configura', 'como', 'puedo',
  'quiero', 'local', 'sistema', 'ajuste', 'ajustes', 'seccion', 'pantalla', 'hago', 'pongo', 'poner', 'activo',
  'activar', 'apago', 'apagar', 'para', 'que', 'los', 'las', 'del', 'una', 'por', 'con',
  // palabras de todo el sistema: por sí solas no señalan un ajuste concreto
  'pedido', 'pedidos', 'cliente', 'clientes', 'carta', 'anulo', 'anular', 'anula', 'cancelar', 'cancela',
  'mensaje', 'mensajes', 'minutos', 'minuto', 'valor', 'cuantos', 'cuanto',
]);

@Injectable()
export class AyudaGrafoService {
  private readonly logger = new Logger(AyudaGrafoService.name);

  private nodos = new Map<string, NodoGrafo>();
  private aristas: AristaGrafo[] = [];
  private aristasPorOrigen = new Map<string, AristaGrafo[]>();
  private aristasPorDestino = new Map<string, AristaGrafo[]>();
  private inicializado = false;

  constructor(private readonly manualesCargador: ManualesCargadorService) {}

  /**
   * Construye o reconstruye el grafo en memoria a partir de los manuales cargados.
   */
  construirGrafo(): void {
    const manuales = this.manualesCargador.obtenerTodos();
    this.nodos.clear();
    this.aristas = [];
    this.aristasPorOrigen.clear();
    this.aristasPorDestino.clear();

    const aristasSet = new Set<string>();

    const agregarArista = (tipo: TipoAristaGrafo, origen: string, destino: string) => {
      if (!origen || !destino || origen === destino) return;
      const key = `${tipo}:${origen}->${destino}`;
      if (aristasSet.has(key)) return;
      aristasSet.add(key);

      const arista: AristaGrafo = { id: key, tipo, origen, destino };
      this.aristas.push(arista);

      if (!this.aristasPorOrigen.has(origen)) this.aristasPorOrigen.set(origen, []);
      this.aristasPorOrigen.get(origen)!.push(arista);

      if (!this.aristasPorDestino.has(destino)) this.aristasPorDestino.set(destino, []);
      this.aristasPorDestino.get(destino)!.push(arista);
    };

    // 1. Crear nodos de roles del sistema
    for (const r of ROLES) {
      const idRol = `rol:${r.codigo.toUpperCase()}`;
      this.nodos.set(idRol, {
        id: idRol,
        tipo: 'rol',
        codigo: r.codigo.toUpperCase(),
      });
    }

    // 2. Crear nodos de módulos y permisos
    for (const manual of manuales) {
      const nodoMod: NodoModulo = {
        id: manual.modulo,
        tipo: 'modulo',
        clave: manual.modulo,
        titulo: manual.titulo,
        ruta: manual.ruta,
        permiso: manual.permiso,
        paraQueSirve: manual.paraQueSirve,
      };
      this.nodos.set(manual.modulo, nodoMod);

      if (manual.permiso) {
        const idPermiso = `permiso:${manual.permiso}`;
        if (!this.nodos.has(idPermiso)) {
          this.nodos.set(idPermiso, {
            id: idPermiso,
            tipo: 'permiso',
            codigo: manual.permiso,
          });
        }
        agregarArista('requiere_permiso', manual.modulo, idPermiso);
      }

      // Aristas puede_usar (rol -> modulo)
      for (const r of ROLES) {
        if (this.manualesCargador.esManualAccesibleParaRol(manual, r.codigo)) {
          agregarArista('puede_usar', `rol:${r.codigo.toUpperCase()}`, manual.modulo);
        }
      }

      // Aristas relacionado_con (frontmatter relacionados)
      if (Array.isArray(manual.relacionados)) {
        for (const rel of manual.relacionados) {
          const dest = rel.trim().toLowerCase();
          if (dest && dest !== manual.modulo) {
            agregarArista('relacionado_con', manual.modulo, dest);
            agregarArista('relacionado_con', dest, manual.modulo);
          }
        }
      }

      // Aristas relacionado_con (menciones [[clave]] en el texto)
      if (Array.isArray(manual.mencionesDoblesCorchetes)) {
        for (const men of manual.mencionesDoblesCorchetes) {
          const dest = men.trim().toLowerCase();
          if (dest && dest !== manual.modulo) {
            agregarArista('relacionado_con', manual.modulo, dest);
          }
        }
      }

      // 3. Crear nodos de tareas y aristas tipadas
      for (const tarea of manual.seccionesComoSeHace) {
        const idTarea = `${manual.modulo}#${tarea.slug}`;
        const nodoTarea: NodoTarea = {
          id: idTarea,
          tipo: 'tarea',
          modulo: manual.modulo,
          titulo: tarea.titulo,
          pasos: tarea.pasos,
          texto: `## Como se hace: ${tarea.titulo}\n${tarea.pasos}`,
        };
        this.nodos.set(idTarea, nodoTarea);
        agregarArista('pertenece_a', idTarea, manual.modulo);

        for (const rel of tarea.relaciones) {
          const dest = rel.destinoModulo.trim().toLowerCase();
          if (dest) {
            agregarArista(rel.tipo, idTarea, dest);
            agregarArista(rel.tipo, manual.modulo, dest);
          }
        }
      }
    }

    // 4. Manuales de sección y temáticos: sus tareas cuelgan del módulo y mantienen su sección
    for (const sec of this.manualesCargador.obtenerSecciones()) {
      if (!this.nodos.has(sec.modulo)) continue;
      for (const tarea of sec.seccionesComoSeHace) {
        const idTarea = `${sec.modulo}#${sec.seccion}#${tarea.slug}`;
        this.nodos.set(idTarea, {
          id: idTarea,
          tipo: 'tarea',
          modulo: sec.modulo,
          seccion: sec.seccion,
          titulo: tarea.titulo,
          pasos: tarea.pasos,
          texto: `## Como se hace: ${tarea.titulo}\n${tarea.pasos}`,
        } as NodoTarea);
        agregarArista('pertenece_a', idTarea, sec.modulo);
        for (const rel of tarea.relaciones) {
          const dest = rel.destinoModulo.trim().toLowerCase();
          if (dest) agregarArista(rel.tipo, idTarea, dest);
        }
      }
      for (const men of sec.mencionesDoblesCorchetes || []) {
        const dest = men.trim().toLowerCase();
        if (dest && dest !== sec.modulo) agregarArista('relacionado_con', sec.modulo, dest);
      }
    }

    this.inicializado = true;
    this.logger.log(`Grafo de documentación construido: ${this.nodos.size} nodos, ${this.aristas.length} aristas`);
  }

  asegurarInicializado(): void {
    if (!this.inicializado || this.nodos.size === 0) {
      this.construirGrafo();
    }
  }

  obtenerNodos(): Map<string, NodoGrafo> {
    this.asegurarInicializado();
    return this.nodos;
  }

  obtenerAristas(): AristaGrafo[] {
    this.asegurarInicializado();
    return this.aristas;
  }

  /**
   * Retorna resumen del grafo serializable para el endpoint GET /admin/ayuda/grafo
   */
  obtenerResumenGrafo(): ResumenGrafoRespuesta {
    this.asegurarInicializado();

    const nodosResumen = Array.from(this.nodos.values()).map((n) => {
      let etiqueta = n.id;
      let modulo: string | undefined;
      let ruta: string | undefined;

      if (n.tipo === 'modulo') {
        etiqueta = `${n.titulo} (${n.clave})`;
        modulo = n.clave;
        ruta = n.ruta;
      } else if (n.tipo === 'tarea') {
        etiqueta = n.titulo;
        modulo = n.modulo;
      } else if (n.tipo === 'rol') {
        etiqueta = `Rol: ${n.codigo}`;
      } else if (n.tipo === 'permiso') {
        etiqueta = `Permiso: ${n.codigo}`;
      }

      return {
        id: n.id,
        tipo: n.tipo,
        etiqueta,
        modulo,
        ruta,
      };
    });

    const aristasResumen = this.aristas.map((a) => ({
      tipo: a.tipo,
      origen: a.origen,
      destino: a.destino,
    }));

    return {
      nodos: nodosResumen,
      aristas: aristasResumen,
    };
  }

  /**
   * Genera el diagrama de módulos en formato Mermaid (flowchart TD) para la documentación.
   */
  generarMermaidGrafo(): string {
    this.asegurarInicializado();

    const lineas: string[] = ['flowchart TD'];
    const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, '_');

    // Módulos
    const modulos = Array.from(this.nodos.values()).filter(
      (n): n is NodoModulo => n.tipo === 'modulo',
    );

    for (const m of modulos) {
      const tituloLimpio = (m.titulo || m.clave).replace(/"/g, "'");
      lineas.push(`  ${safeId(m.clave)}["${tituloLimpio} (${m.ruta})"]`);
    }

    // Aristas entre módulos
    const aristasModulos = new Set<string>();
    for (const a of this.aristas) {
      // Filtrar aristas entre módulos
      if (this.nodos.get(a.origen)?.tipo === 'modulo' && this.nodos.get(a.destino)?.tipo === 'modulo') {
        const clave = `${a.origen}->${a.destino}:${a.tipo}`;
        if (!aristasModulos.has(clave)) {
          aristasModulos.add(clave);
          lineas.push(`  ${safeId(a.origen)} -->|${a.tipo}| ${safeId(a.destino)}`);
        }
      }
    }

    return lineas.join('\n');
  }

  /**
   * Recupera contexto mediante recorrido de 1 salto en el grafo de documentación:
   * 1. Encuentra tareas candidatas por coincidencia léxica expandida con sinónimos y bonus de módulo actual.
   * 2. Expande 1 salto (relacionados, requiere, antes, despues, ver_tambien) SOLO por módulos que el rol puede ver.
   * 3. Ensambla el contexto priorizando tarea principal, módulo y vecinos bajo presupuesto de caracteres.
   */
  recuperarContexto(
    pregunta: string,
    rutaActual?: string,
    rol: string = 'ADMIN',
    presupuestoMax = 6000,
  ): ResultadoRecuperacionGrafo {
    this.asegurarInicializado();
    const rolNorm = (rol || '').toUpperCase();

    // 1. Obtener lista de módulos accesibles para este rol
    const manualesAccesibles = this.manualesCargador.obtenerManualesAccesibles(rolNorm);
    const modulosAccesiblesSet = new Set(manualesAccesibles.map((m) => m.modulo));

    // Determinar módulo de la ruta actual si es accesible, y la sección (pestaña) si la URL la lleva
    let moduloActualClave: string | undefined;
    let manualSeccionActual: ManualAyuda | undefined;
    if (rutaActual) {
      const { manual: manualRuta, seccion } = this.manualesCargador.resolverRuta(rutaActual);
      if (manualRuta && modulosAccesiblesSet.has(manualRuta.modulo)) {
        moduloActualClave = manualRuta.modulo;
        if (seccion && this.manualesCargador.esManualAccesibleParaRol(seccion, rolNorm)) {
          manualSeccionActual = seccion;
        }
      }
    }
    const seccionesAccesibles = this.manualesCargador
      .obtenerSecciones()
      .filter((m) => this.manualesCargador.esManualAccesibleParaRol(m, rolNorm));
    const clavesSeccionesAccesibles = new Set(seccionesAccesibles.map((m) => `${m.modulo}#${m.seccion}`));
    presupuestoMax = manualSeccionActual ? presupuestoMax + 4500 : presupuestoMax;

    // 2. Tokenizar pregunta y expandir con sinónimos
    const tokensOriginales = this.tokenizar(pregunta);
    const tokensExpandidos = new Set<string>(tokensOriginales);

    for (const t of tokensOriginales) {
      const sinonimos = DICCIONARIO_SINONIMOS[t];
      if (sinonimos) {
        for (const s of sinonimos) tokensExpandidos.add(s);
      }
    }

    const tokensArr = Array.from(tokensExpandidos);

    // 3. Puntuación de tareas candidatas accesibles
    const tareasCandidatas: Array<{
      tarea: NodoTarea;
      score: number;
    }> = [];

    const todasTareas = Array.from(this.nodos.values()).filter(
      (n): n is NodoTarea =>
        n.tipo === 'tarea' &&
        modulosAccesiblesSet.has(n.modulo) &&
        (!n.seccion || clavesSeccionesAccesibles.has(`${n.modulo}#${n.seccion}`)),
    );

    for (const tarea of todasTareas) {
      let score = 0;
      const tTokens = this.tokenizar(tarea.titulo);
      const pasosTokens = this.tokenizar(tarea.pasos);

      for (const t of tokensArr) {
        if (tTokens.includes(t)) score += 8;
        if (pasosTokens.includes(t)) score += 3;
      }

      // Bonus si la tarea pertenece al módulo actual de la ruta, y más si es de la sección abierta
      if (moduloActualClave && tarea.modulo === moduloActualClave) {
        score += 6;
        if (score > 6 && manualSeccionActual && tarea.seccion === manualSeccionActual.seccion) score += 10;
      }

      // Coincidencia con el nombre del módulo
      const mod = this.nodos.get(tarea.modulo) as NodoModulo | undefined;
      if (mod) {
        const modTokens = this.tokenizar(mod.titulo);
        for (const t of tokensArr) {
          if (modTokens.includes(t)) score += 4;
        }
      }

      if (score > 0) {
        tareasCandidatas.push({ tarea, score });
      }
    }

    tareasCandidatas.sort((a, b) => b.score - a.score);

    const mejorCandidata = tareasCandidatas[0]?.tarea;
    const moduloPrincipal = mejorCandidata
      ? (this.nodos.get(mejorCandidata.modulo) as NodoModulo)
      : moduloActualClave
      ? (this.nodos.get(moduloActualClave) as NodoModulo)
      : (this.nodos.get(manualesAccesibles[0]?.modulo) as NodoModulo);

    // 4. Expansión de 1 salto por el grafo desde la tarea y desde su módulo
    const vecinosMap = new Map<string, NodoModulo>();
    const relacionesFormateadas: string[] = [];

    const idsParaExpandir = new Set<string>();
    if (mejorCandidata) idsParaExpandir.add(mejorCandidata.id);
    if (moduloPrincipal) idsParaExpandir.add(moduloPrincipal.id);

    for (const idOrigen of idsParaExpandir) {
      const aristasSalientes = this.aristasPorOrigen.get(idOrigen) || [];

      for (const a of aristasSalientes) {
        // Solo considerar relaciones hacia módulos que el rol tiene permitido ver
        const nodoDestino = this.nodos.get(a.destino);
        if (nodoDestino && nodoDestino.tipo === 'modulo' && modulosAccesiblesSet.has(nodoDestino.clave)) {
          if (!moduloPrincipal || nodoDestino.clave !== moduloPrincipal.clave) {
            vecinosMap.set(nodoDestino.clave, nodoDestino);
          }

          if (a.tipo === 'requiere') {
            relacionesFormateadas.push(
              `Requiere: ${nodoDestino.titulo} (${nodoDestino.ruta}) para autorizaciones o códigos necesarios.`,
            );
          } else if (a.tipo === 'despues') {
            relacionesFormateadas.push(
              `Después de esta acción suele continuarse en: ${nodoDestino.titulo} (${nodoDestino.ruta}).`,
            );
          } else if (a.tipo === 'antes') {
            relacionesFormateadas.push(
              `Antes de esta acción se recomienda verificar: ${nodoDestino.titulo} (${nodoDestino.ruta}).`,
            );
          } else if (a.tipo === 'ver_tambien' || a.tipo === 'relacionado_con') {
            relacionesFormateadas.push(
              `Relacionado con: ${nodoDestino.titulo} (${nodoDestino.ruta}).`,
            );
          }
        }
      }
    }

    // Dedup relaciones formateadas
    const relacionesUnicas = Array.from(new Set(relacionesFormateadas));

    // 5. Construir contexto ensamblado bajo presupuesto de caracteres
    const partes: string[] = [];
    let caracteresAcumulados = 0;

    // Ajustes con enlace directo que coinciden con la pregunta (de cualquier manual que el rol pueda ver)
    const ajustesCoincidentes = this.buscarAjustes(
      tokensArr,
      tokensOriginales,
      [...manualesAccesibles, ...seccionesAccesibles],
      rolNorm,
    );

    // Prioridad 0: la sección abierta en pantalla (p. ej. la pestaña de Configuración), con sus ajustes
    if (manualSeccionActual) {
      const ajustesSeccion = [...manualSeccionActual.ajustes].sort(
        (a, b) => this.puntuarLinea(b, tokensArr) - this.puntuarLinea(a, tokensArr),
      );
      const lineas = [
        `### SECCIÓN ABIERTA EN PANTALLA: ${manualSeccionActual.titulo} (${this.manualesCargador.rutaDeSeccion(manualSeccionActual)})`,
        manualSeccionActual.paraQueSirve || '',
        ajustesSeccion.length ? 'Ajustes de esta sección (con su enlace directo):' : '',
      ];
      let bloqueSeccion = lineas.filter(Boolean).join('\n');
      for (const aj of ajustesSeccion) {
        if (bloqueSeccion.length + aj.length + 3 > 4500) break;
        bloqueSeccion += `\n- ${aj}`;
      }
      partes.push(bloqueSeccion);
      caracteresAcumulados += bloqueSeccion.length;
    }

    // Prioridad 1: Mejor tarea completa
    if (mejorCandidata && moduloPrincipal) {
      const bloqueTarea = [
        `### TAREA IDENTIFICADA EN EL GRAFO: ${mejorCandidata.titulo} (Módulo: ${moduloPrincipal.titulo}, Ruta: ${moduloPrincipal.ruta})`,
        `Pasos a seguir:`,
        mejorCandidata.pasos,
      ].join('\n');
      partes.push(bloqueTarea);
      caracteresAcumulados += bloqueTarea.length;
    }

    // Prioridad 2: Propósito del módulo principal ("Para que sirve")
    if (moduloPrincipal?.paraQueSirve) {
      const bloqueModulo = `\n### PROPÓSITO DEL MÓDULO ${moduloPrincipal.titulo}:\n${moduloPrincipal.paraQueSirve}`;
      if (caracteresAcumulados + bloqueModulo.length < presupuestoMax) {
        partes.push(bloqueModulo);
        caracteresAcumulados += bloqueModulo.length;
      }
    }

    // Prioridad 3: Relaciones tipadas entre corchetes / conexiones del grafo
    if (relacionesUnicas.length > 0) {
      const bloqueRelaciones = `\n### CONEXIONES Y FLUJOS CONECTADOS (1 SALTO EN EL GRAFO):\n${relacionesUnicas.join('\n')}`;
      if (caracteresAcumulados + bloqueRelaciones.length < presupuestoMax) {
        partes.push(bloqueRelaciones);
        caracteresAcumulados += bloqueRelaciones.length;
      }
    }

    // Prioridad 4: Resumen de módulos vecinos accesibles
    const vecinos = Array.from(vecinosMap.values());
    if (vecinos.length > 0) {
      const lineasVecinos: string[] = ['\n### MÓDULOS VECINOS RELACIONADOS:'];
      for (const v of vecinos) {
        const desc = v.paraQueSirve ? v.paraQueSirve.slice(0, 200) : '';
        lineasVecinos.push(`- **${v.titulo}** (${v.ruta}): ${desc}`);
      }
      const bloqueVecinos = lineasVecinos.join('\n');
      if (caracteresAcumulados + bloqueVecinos.length < presupuestoMax) {
        partes.push(bloqueVecinos);
        caracteresAcumulados += bloqueVecinos.length;
      }
    }

    // Ajustes encontrados: el cliente puede pedir «¿dónde cambio…?» desde cualquier pantalla
    const ajustesFuera = ajustesCoincidentes.filter((a) => !manualSeccionActual?.ajustes.includes(a));
    if (ajustesFuera.length > 0) {
      const bloqueAjustes = `\n### AJUSTES QUE COINCIDEN CON LA PREGUNTA (con enlace directo):\n${ajustesFuera.map((a) => `- ${a}`).join('\n')}`;
      if (caracteresAcumulados + bloqueAjustes.length < presupuestoMax) {
        partes.push(bloqueAjustes);
        caracteresAcumulados += bloqueAjustes.length;
      }
    }

    // Enlaces sugeridos: sección/ajuste concreto primero, luego módulo principal y vecinos (hasta 3)
    const enlacesSugeridos: Array<{ texto: string; ruta: string }> = [];
    const empujar = (e: { texto: string; ruta: string }) => {
      if (enlacesSugeridos.length < 3 && !enlacesSugeridos.some((x) => x.ruta === e.ruta)) enlacesSugeridos.push(e);
    };
    for (const aj of ajustesCoincidentes.slice(0, 2)) {
      for (const e of this.manualesCargador.extraerEnlacesProfundos(aj)) {
        if (this.manualesCargador.esEnlacePermitido(e.ruta, rolNorm)) empujar(e);
      }
    }
    if (mejorCandidata?.seccion) {
      const secMejor = seccionesAccesibles.find(
        (m) => m.modulo === mejorCandidata.modulo && m.seccion === mejorCandidata.seccion,
      );
      if (secMejor?.activaCon?.length) {
        empujar({ texto: `Ir a ${secMejor.titulo}`, ruta: this.manualesCargador.rutaDeSeccion(secMejor) });
      }
    }
    const baseDe = (r: string) => r.split('?')[0];
    if (
      moduloPrincipal &&
      modulosAccesiblesSet.has(moduloPrincipal.clave) &&
      !enlacesSugeridos.some((e) => baseDe(e.ruta) === moduloPrincipal.ruta)
    ) {
      empujar({ texto: `Ir a ${moduloPrincipal.titulo}`, ruta: moduloPrincipal.ruta });
    }

    for (const v of vecinos) {
      if (enlacesSugeridos.length >= 3) break;
      if (!enlacesSugeridos.some((e) => e.ruta === v.ruta)) {
        enlacesSugeridos.push({
          texto: `Ir a ${v.titulo}`,
          ruta: v.ruta,
        });
      }
    }

    return {
      contextoTexto: partes.join('\n\n'),
      mejorTarea: mejorCandidata,
      moduloPrincipal,
      vecinos,
      seccionActual: manualSeccionActual
        ? { modulo: manualSeccionActual.modulo, seccion: manualSeccionActual.seccion ?? '', titulo: manualSeccionActual.titulo }
        : undefined,
      ajustesCoincidentes,
      relacionesFormateadas: relacionesUnicas,
      enlacesSugeridos,
    };
  }

  private puntuarLinea(linea: string, tokens: string[]): number {
    const t = new Set(this.tokenizar(linea));
    return tokens.reduce((n, tok) => n + (!TOKENS_GENERICOS.has(tok) && t.has(tok) ? 1 : 0), 0);
  }

  /** Líneas de «Ajustes» / «Donde se configura» que mejor coinciden con la pregunta (máx. 4). */
  private buscarAjustes(tokens: string[], originales: string[], manuales: ManualAyuda[], rol: string): string[] {
    // con preguntas largas se exige más de una palabra en común para no mezclar ajustes ajenos
    const significativas = originales.filter((t) => !TOKENS_GENERICOS.has(t)).length;
    const minimo = significativas >= 3 ? 2 : 1;
    const puntuadas: Array<{ linea: string; score: number }> = [];
    const vistas = new Set<string>();
    for (const m of manuales) {
      for (const linea of m.ajustes) {
        if (vistas.has(linea)) continue;
        vistas.add(linea);
        const score = this.puntuarLinea(linea, tokens);
        if (score < minimo) continue;
        // un enlace profundo que el rol no puede abrir no se ofrece
        const enlaces = this.manualesCargador.extraerEnlacesProfundos(linea);
        if (enlaces.length && !enlaces.some((e) => this.manualesCargador.esEnlacePermitido(e.ruta, rol))) continue;
        puntuadas.push({ linea, score });
      }
    }
    return puntuadas.sort((a, b) => b.score - a.score).slice(0, 4).map((p) => p.linea);
  }

  private tokenizar(texto: string): string[] {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3);
  }
}
