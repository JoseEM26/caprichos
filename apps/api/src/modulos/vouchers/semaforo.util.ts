export type SemaforoVoucher =
  | 'CONFIABLE'
  | 'OBSERVADO'
  | 'RARO'
  | 'ILEGIBLE'
  | 'SIN_LECTURA';

export interface DatosVoucherExtraidos {
  legible: boolean;
  monto: number | null;
  moneda?: string | null;
  operacion: string | null;
  fecha: string | null; // e.g. 'YYYY-MM-DD' o texto
  hora: string | null;
  titular: string | null;
  destinoNumero: string | null;
  medioDetectado: 'YAPE' | 'PLIN' | 'OTRO' | null;
  confianza: number; // 0..1
  notas?: string;
}

export interface ContextoSemaforo {
  pedidoTotal?: number | null;
  medioEsperado?: 'YAPE' | 'PLIN' | null;
  titularEsperado?: string | null;
  yapeNumeroEsperado?: string | null;
  plinNumeroEsperado?: string | null;
  fechaActual?: string | Date; // YYYY-MM-DD o Date
  operacionDuplicada?: boolean;
  hashDuplicado?: boolean;
  sinLectura?: boolean;
}

export interface ResultadoSemaforo {
  semaforo: SemaforoVoucher;
  motivos: string[];
}

/**
 * Normaliza una cadena de texto para comparación flexible:
 * - Pasa a minúsculas
 * - Remueve tildes y signos diacríticos
 * - Remueve caracteres especiales conservando letras, números y espacios
 */
export function normalizarTexto(txt: string): string {
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compara titulares de forma flexible:
 * Yape/Plin suelen mostrar "Maria Jose M." o nombres parciales.
 * Coincidencia flexible si alguno de los tokens significativos (>= 3 letras)
 * del titular esperado coincide con el titular leído o viceversa.
 */
export function titularesCoinciden(
  leido?: string | null,
  esperado?: string | null,
): boolean {
  if (!leido || !esperado) return true;
  const nLeido = normalizarTexto(leido);
  const nEsperado = normalizarTexto(esperado);

  if (!nLeido || !nEsperado) return true;
  if (nLeido === nEsperado) return true;

  const tokensEsperados = nEsperado.split(' ').filter((t) => t.length >= 3);
  const tokensLeidos = nLeido.split(' ').filter((t) => t.length >= 3);

  // Si cualquier token significativo coincide exactamente
  for (const tEsp of tokensEsperados) {
    if (tokensLeidos.includes(tEsp)) return true;
    if (nLeido.includes(tEsp)) return true;
  }

  for (const tLei of tokensLeidos) {
    if (tokensEsperados.includes(tLei)) return true;
    if (nEsperado.includes(tLei)) return true;
  }

  // Verificación de iniciales, e.g. "Maria Jose M." vs "Maria Jose Morillo Ruiz"
  const partesEsperado = nEsperado.split(' ').filter(Boolean);
  const partesLeido = nLeido.split(' ').filter(Boolean);
  if (partesEsperado.length > 0 && partesLeido.length > 0) {
    if (partesEsperado[0] === partesLeido[0]) {
      return true;
    }
  }

  return false;
}

/**
 * Compara los últimos 9 dígitos de dos números telefónicos.
 */
export function compararUltimos9Digitos(
  num1?: string | null,
  num2?: string | null,
): boolean {
  if (!num1 || !num2) return false;
  const d1 = num1.replace(/\D/g, '').slice(-9);
  const d2 = num2.replace(/\D/g, '').slice(-9);
  if (d1.length < 9 || d2.length < 9) return false;
  return d1 === d2;
}

/**
 * Normaliza una fecha a formato YYYY-MM-DD.
 */
export function normalizarFecha(fechaStr?: string | Date | null): string | null {
  if (!fechaStr) return null;
  if (fechaStr instanceof Date) {
    return fechaStr.toISOString().slice(0, 10);
  }

  const s = String(fechaStr).trim();
  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // Formato DD/MM/YYYY o DD-MM-YYYY
  const mDmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (mDmy) {
    const dia = mDmy[1].padStart(2, '0');
    const mes = mDmy[2].padStart(2, '0');
    const anio = mDmy[3];
    return `${anio}-${mes}-${dia}`;
  }

  return s;
}

/**
 * Función pura que calcula el semáforo y los motivos de un voucher.
 * Respeta rigurosamente las reglas del contrato de Caprichos:
 *
 * 1. SIN_LECTURA: IA apagada, sin clave o error técnico.
 * 2. ILEGIBLE: legible=false o confianza < 0.5 o sin monto.
 * 3. RARO: no parece Yape/Plin (medioDetectado OTRO/null con legible),
 *    operación ya usada en otro voucher/pedido, o misma imagen (hash) registrada en otro pedido.
 * 4. OBSERVADO: monto distinto al total del pedido, titular o número destino que no coincide,
 *    fecha de otro día, medio detectado distinto al elegido, o 0.5 <= confianza < 0.8.
 * 5. CONFIABLE: todo coincide y confianza >= 0.8.
 */
export function calcularSemaforo(
  extraido: DatosVoucherExtraidos | null,
  contexto: ContextoSemaforo = {},
): ResultadoSemaforo {
  // 1. SIN_LECTURA
  if (contexto.sinLectura || !extraido) {
    return {
      semaforo: 'SIN_LECTURA',
      motivos: ['Lectura de IA no disponible o apagada; revisión visual requerida'],
    };
  }

  // 2. ILEGIBLE
  const esIlegible =
    !extraido.legible ||
    extraido.confianza < 0.5 ||
    extraido.monto === null ||
    extraido.monto === undefined;

  if (esIlegible) {
    const motivosIlegible: string[] = [];
    if (!extraido.legible) {
      motivosIlegible.push('Voucher no legible');
    }
    if (extraido.monto === null || extraido.monto === undefined) {
      motivosIlegible.push('No se detectó el monto en la captura');
    }
    if (extraido.confianza < 0.5) {
      motivosIlegible.push(
        `Baja confianza en la lectura (${Math.round(extraido.confianza * 100)}%)`,
      );
    }
    return {
      semaforo: 'ILEGIBLE',
      motivos: motivosIlegible.length > 0 ? motivosIlegible : ['Voucher no legible'],
    };
  }

  const motivosRaro: string[] = [];
  const motivosObservado: string[] = [];

  // 3. Evaluaciones de RARO
  // - No parece Yape/Plin (medioDetectado OTRO o null con legible=true)
  if (!extraido.medioDetectado || extraido.medioDetectado === 'OTRO') {
    motivosRaro.push('No parece ser un comprobante de Yape ni Plin');
  }

  // - Operación ya usada en otro voucher/pedido
  if (contexto.operacionDuplicada) {
    const op = extraido.operacion ? ` (${extraido.operacion})` : '';
    motivosRaro.push(`Número de operación${op} ya registrado en otro pedido`);
  }

  // - Misma imagen (hash sha256) ya registrada en otro pedido
  if (contexto.hashDuplicado) {
    motivosRaro.push('La misma imagen de voucher ya fue utilizada en otro pedido');
  }

  // 4. Evaluaciones de OBSERVADO
  // - Monto distinto al total del pedido
  if (contexto.pedidoTotal != null && extraido.monto != null) {
    const diff = Math.round((extraido.monto - contexto.pedidoTotal) * 100) / 100;
    if (diff < -0.01) {
      motivosObservado.push(
        `Monto menor al pedido: leído S/ ${extraido.monto.toFixed(2)}, pedido S/ ${contexto.pedidoTotal.toFixed(2)}`,
      );
    } else if (diff > 0.01) {
      motivosObservado.push(
        `Monto mayor al pedido: leído S/ ${extraido.monto.toFixed(2)}, pedido S/ ${contexto.pedidoTotal.toFixed(2)}`,
      );
    }
  }

  // - Titular no coincide con el configurado
  if (extraido.titular && contexto.titularEsperado) {
    if (!titularesCoinciden(extraido.titular, contexto.titularEsperado)) {
      motivosObservado.push(
        `Titular no coincide con el configurado (leído: "${extraido.titular}", esperado: "${contexto.titularEsperado}")`,
      );
    }
  }

  // - Número destino no coincide con el configurado
  if (extraido.destinoNumero) {
    const medioParaNumero =
      contexto.medioEsperado || extraido.medioDetectado || 'YAPE';
    const numeroEsperado =
      medioParaNumero === 'PLIN'
        ? contexto.plinNumeroEsperado
        : contexto.yapeNumeroEsperado;

    if (
      numeroEsperado &&
      !compararUltimos9Digitos(extraido.destinoNumero, numeroEsperado)
    ) {
      const numLeido9 = extraido.destinoNumero.replace(/\D/g, '').slice(-9);
      const numEsp9 = numeroEsperado.replace(/\D/g, '').slice(-9);
      motivosObservado.push(
        `Número destino no coincide con el configurado (leído: ${numLeido9}, esperado: ${numEsp9})`,
      );
    }
  }

  // - Fecha de otro día
  if (extraido.fecha && contexto.fechaActual) {
    const fLeida = normalizarFecha(extraido.fecha);
    const fActual = normalizarFecha(contexto.fechaActual);
    if (fLeida && fActual && fLeida !== fActual) {
      motivosObservado.push(
        `Fecha de otro día: leído ${fLeida}, hoy es ${fActual}`,
      );
    }
  }

  // - Medio detectado distinto al elegido
  if (
    contexto.medioEsperado &&
    extraido.medioDetectado &&
    extraido.medioDetectado !== 'OTRO'
  ) {
    if (extraido.medioDetectado !== contexto.medioEsperado) {
      motivosObservado.push(
        `Medio detectado (${extraido.medioDetectado}) distinto al elegido (${contexto.medioEsperado})`,
      );
    }
  }

  // - Confianza entre 0.5 y 0.8
  if (extraido.confianza >= 0.5 && extraido.confianza < 0.8) {
    motivosObservado.push(
      `Confianza media en la lectura (${Math.round(extraido.confianza * 100)}%)`,
    );
  }

  // Si hay motivos de RARO, el semáforo es RARO
  if (motivosRaro.length > 0) {
    return {
      semaforo: 'RARO',
      motivos: [...motivosRaro, ...motivosObservado],
    };
  }

  // Si hay motivos de OBSERVADO, el semáforo es OBSERVADO
  if (motivosObservado.length > 0) {
    return {
      semaforo: 'OBSERVADO',
      motivos: motivosObservado,
    };
  }

  // 5. CONFIABLE: Todo coincide y confianza >= 0.8
  return {
    semaforo: 'CONFIABLE',
    motivos: ['Datos conformes y verificados con el pedido'],
  };
}
