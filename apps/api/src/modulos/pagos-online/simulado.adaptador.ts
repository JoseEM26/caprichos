import { CargoHecho, PasarelaPago, PedirCargo, PedirDevolucion } from './pasarela.puerto';

export const TOKEN_OK_TARJETA = 'tkn_simulado_ok';
export const TOKEN_OK_YAPE = 'ype_simulado_ok';
export const TOKEN_RECHAZO = 'tkn_simulado_rechazo';

/** Sin credenciales: decide por el texto del token y no hace llamadas de red. */
export class SimuladoAdaptador implements PasarelaPago {
  readonly modo = 'SIMULADO' as const;
  readonly publicKey = null;
  private n = 0;

  async cargar(p: PedirCargo): Promise<CargoHecho> {
    if (p.token === TOKEN_OK_TARJETA || p.token === TOKEN_OK_YAPE) {
      this.n += 1;
      return {
        estado: 'APROBADO',
        cargoId: `chr_simulado_${Date.now()}_${this.n}`,
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
      mensaje:
        p.token === TOKEN_RECHAZO
          ? 'Tu tarjeta fue rechazada. Prueba con otra tarjeta o con Yape.'
          : 'No pudimos procesar tu pago. Revisa los datos o prueba con otro medio.',
    };
  }

  async devolver(_p: PedirDevolucion): Promise<{ devolucionId: string }> {
    this.n += 1;
    return { devolucionId: `ref_simulado_${Date.now()}_${this.n}` };
  }
}
