import { useEffect, useState } from 'react';
import { vouchersApi, EstadoIaVouchers } from './vouchersApi';

export const TEXTO_VOUCHERS_IA_PAUSA =
  'Lectura automática de vouchers en pausa: revisa los vouchers a ojo';
export const INTERVALO_ESTADO_IA_MS = 60_000;

/** La franja aparece solo si la lectura está en pausa (saldo, clave o errores) o el tope mensual se superó. */
export function hayPausaVouchersIa(estado: EstadoIaVouchers | null): boolean {
  if (!estado) return false;
  return Boolean(estado.enPausa || estado.topeMensual?.superado);
}

/** Estado de la lectura con IA; se vuelve a pedir cada 60 s. Si la consulta falla, no muestra nada. */
export function useEstadoIaVouchers(): EstadoIaVouchers | null {
  const [estado, setEstado] = useState<EstadoIaVouchers | null>(null);

  useEffect(() => {
    let vigente = true;
    const cargar = async () => {
      try {
        const r = await vouchersApi.obtenerEstadoIa();
        if (vigente) setEstado(r ?? null);
      } catch {
        if (vigente) setEstado(null);
      }
    };
    cargar();
    const intervalo = setInterval(cargar, INTERVALO_ESTADO_IA_MS);
    return () => {
      vigente = false;
      clearInterval(intervalo);
    };
  }, []);

  return estado;
}

/** Franja discreta, no bloqueante: solo avisa que la revisión de vouchers es a ojo. */
export function BannerVouchersIaPausa() {
  const estado = useEstadoIaVouchers();
  if (!hayPausaVouchersIa(estado)) return null;

  return (
    <div
      role="status"
      data-testid="banner-vouchers-ia-pausa"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: '#FFF6DB',
        border: '1px solid #E8C872',
        borderRadius: 10,
        color: '#6B4A00',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'Montserrat, sans-serif',
      }}
    >
      <span>{TEXTO_VOUCHERS_IA_PAUSA}</span>
      {estado?.topeMensual?.superado && (
        <span style={{ fontWeight: 500 }}>(tope mensual de IA alcanzado)</span>
      )}
    </div>
  );
}
