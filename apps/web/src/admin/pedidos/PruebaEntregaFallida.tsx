import { FotoAmpliable } from '../vouchers/FotoAmpliable';

/** Prueba que subió el repartidor cuando el cliente no salió. Solo admin/caja/supervisor; nunca en el seguimiento del cliente. */
export interface PruebaEntregaFallida {
  llego_en: string;
  minutos_espera: number | null;
  repartidor: string | null;
  reportado_en: string;
  fotos: string[];
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });

export function PruebaEntregaFallida({ prueba }: { prueba?: PruebaEntregaFallida | null }) {
  if (!prueba) return null;
  return (
    <section aria-label="Prueba de entrega fallida" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
      <div style={{ fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }}>Prueba de entrega fallida</div>
      <div>Llegada: {hora(prueba.llego_en)}</div>
      <div>Espera exigida: {prueba.minutos_espera ?? '—'} min</div>
      <div>Repartidor: {prueba.repartidor || 'Sin nombre'}</div>
      <div>Reporte: {hora(prueba.reportado_en)}</div>
      {prueba.fotos.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {prueba.fotos.map((id, i) => (
            <div key={id} style={{ width: 120 }}>
              <FotoAmpliable archivoId={id} alt={`Foto ${i + 1} del lugar de entrega fallida`} alturaMaxima={120} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: 'var(--cp-soft)' }}>Sin fotos</div>
      )}
    </section>
  );
}
