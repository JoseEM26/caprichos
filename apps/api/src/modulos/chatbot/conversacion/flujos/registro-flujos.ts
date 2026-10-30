import { EntradaNormalizada, FlujoConversacion, ContextoConversacion, ResultadoTransicion } from '../tipos-conversacion';

/**
 * Interfaz que define un subflujo conversacional modular (Ola 2 Pedidos, Ola 2 Pagos, Ola 3 Reservas).
 * Permite mantener la máquina de estados principal limpia y desacoplada.
 */
export interface SubFlujoConversacion {
  readonly nombre: string;

  /**
   * Determina si este subflujo es responsable de manejar la entrada actual.
   */
  puedeManejar(
    flujo: FlujoConversacion,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): boolean;

  /**
   * Ejecuta la transición de estado pura del subflujo.
   */
  transicionar(
    flujo: FlujoConversacion,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion | null;
}

/**
 * Registro central de subflujos conversacionales.
 */
export class RegistroSubFlujos {
  private static readonly flujos: SubFlujoConversacion[] = [];

  static registrar(flujo: SubFlujoConversacion): void {
    if (!this.flujos.some((f) => f.nombre === flujo.nombre)) {
      this.flujos.push(flujo);
    }
  }

  static obtenerFlujos(): readonly SubFlujoConversacion[] {
    return this.flujos;
  }

  static limpiar(): void {
    this.flujos.length = 0;
  }
}
