import { CargoConsultado, CargoHecho, PasarelaPago, PedirCargo, PedirDevolucion } from './pasarela.puerto';

export const TOKEN_OK_TARJETA = 'tkn_simulado_ok';
export const TOKEN_OK_YAPE = 'ype_simulado_ok';
export const TOKEN_3DS = 'tkn_simulado_3ds';
export const TOKEN_RECHAZO = 'tkn_simulado_rechazo';

/** Sin credenciales: decide por el texto del token y no hace llamadas de red. */
export class SimuladoAdaptador implements PasarelaPago {
  readonly modo = 'SIMULADO' as const;
  readonly publicKey = null;
  private n = 0;
  /** Cargos "hechos" en memoria: la consulta del webhook no sale a internet */
  private readonly cargos = new Map<string, CargoConsultado>();

  /** Para pruebas y demo: deja un cargo como si Culqi lo tuviera. */
  sembrarCargo(c: CargoConsultado): void {
    this.cargos.set(c.cargoId, c);
  }

  async consultarCargo(cargoId: string): Promise<CargoConsultado | null> {
    return this.cargos.get(cargoId) ?? null;
  }

  async cargar(p: PedirCargo): Promise<CargoHecho> {
    if (p.token === TOKEN_3DS && !p.autenticacion3ds) {
      return { estado: 'REQUIERE_3DS', cargoId: null, marca: null, ultimos4: null, mensaje: 'Tu banco necesita confirmar que eres tú.' };
    }
    if (p.token === TOKEN_OK_TARJETA || p.token === TOKEN_3DS || p.token === TOKEN_OK_YAPE) {
      this.n += 1;
      const cargoId = `chr_simulado_${Date.now()}_${this.n}`;
      this.cargos.set(cargoId, { cargoId, estado: 'APROBADO', montoCentimos: p.montoCentimos, moneda: p.moneda, metadata: p.metadata, devueltoCentimos: 0 });
      return {
        estado: 'APROBADO',
        cargoId,
        marca: p.medio === 'TARJETA' ? 'Visa' : 'Yape',
        ultimos4: p.medio === 'TARJETA' ? '1111' : null,
        mensaje: 'Pago aprobado.',
      };
    }
    return {
      estado: 'RECHAZADO',
      cargoId: null,
      marca: null,
      ultimos4: null,
      codigo: p.token === TOKEN_RECHAZO ? 'card_declined' : undefined,
      mensaje:
        p.token === TOKEN_RECHAZO
          ? 'Tu tarjeta fue rechazada. Prueba con otra tarjeta o con Yape.'
          : 'No pudimos procesar tu pago. Revisa los datos o prueba con otro medio.',
    };
  }

  async devolver(p: PedirDevolucion): Promise<{ devolucionId: string }> {
    this.n += 1;
    const c = this.cargos.get(p.cargoId);
    if (c) c.devueltoCentimos += p.montoCentimos;
    return { devolucionId: `ref_simulado_${Date.now()}_${this.n}` };
  }
}
