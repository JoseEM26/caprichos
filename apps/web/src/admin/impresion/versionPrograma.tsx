import type { ReactNode } from 'react';

export interface VersionPublicada {
  version: string;
  commit?: string | null;
  fecha?: string | null;
}

/** N de «0.1.N» (también «0.1.57 (ab12cd3)»); 0 para la antigua 0.1.0 o una compilación de desarrollo. */
export function numeroVersion(v?: string | null): number {
  const m = /^0\.1\.(\d+)(?![\d-])/.exec((v || '').trim());
  return m ? Number(m[1]) : 0;
}

/** null = no se puede comparar (sin versión publicada). */
export function estadoVersion(instalada?: string | null, ultima?: VersionPublicada | null): 'actualizado' | 'nueva' | null {
  const u = numeroVersion(ultima?.version);
  if (!u) return null;
  return numeroVersion(instalada) >= u ? 'actualizado' : 'nueva';
}

export function textoFecha(f?: string | null): string {
  const d = f ? new Date(f) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

/** «Programa v0.1.N» + insignia Actualizado / Hay una versión nueva (v0.1.M): descargar. */
export function InsigniaVersion({ instalada, ultima, enlace = true }: { instalada?: string | null; ultima?: VersionPublicada | null; enlace?: boolean }): ReactNode {
  const est = estadoVersion(instalada, ultima);
  return (
    <>
      <span data-testid="programa-version">Programa {instalada ? `v${instalada}` : 'sin versión'}</span>
      {est === 'actualizado' && <span className="ic-chip ic-chip--ok" data-testid="version-actualizada">Actualizado</span>}
      {est === 'nueva' && !enlace && (
        <span className="ic-chip ic-chip--aviso" data-testid="version-nueva">Hay una versión nueva (v{ultima!.version})</span>
      )}
      {est === 'nueva' && enlace && (
        <a className="ic-chip ic-chip--aviso" data-testid="version-nueva" href="/api/agente-impresion/descargar/windows" download>
          Hay una versión nueva (v{ultima!.version}): descargar
        </a>
      )}
    </>
  );
}
