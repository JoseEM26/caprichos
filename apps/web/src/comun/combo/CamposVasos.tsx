import type { ReactNode } from 'react';
import './campos-vasos.css';

export interface FilaVaso {
  /** Etiqueta del vaso: «Bebida 1». */
  etiqueta: string;
  /** Nombre de la bebida (texto pequeño bajo la etiqueta). */
  bebida: string;
  valor: string;
  invalido?: boolean;
  onChange: (valor: string) => void;
}

export interface CamposVasosProps {
  titulo: string;
  ayuda: string;
  filas: FilaVaso[];
  placeholder?: string;
  /** Aviso de lo que falta (role alert). */
  aviso?: string | null;
  /** Botón «Usar el nombre del cliente», si aplica. */
  accion?: ReactNode;
  max?: number;
}

const VASO = (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
    <path d="M5 4h14l-1.6 15.2a1.5 1.5 0 0 1-1.5 1.3H8.1a1.5 1.5 0 0 1-1.5-1.3L5 4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M5.6 9h12.8" stroke="currentColor" strokeWidth="2" />
  </svg>
);

/**
 * Nombres de los vasos: una fila por vaso (etiqueta con el icono y «Bebida N», el nombre de la bebida debajo, y el
 * campo con el contador dentro). En celular la etiqueta va arriba y el campo debajo. Lo usan la carta y el mozo.
 */
export function CamposVasos({ titulo, ayuda, filas, placeholder = 'Ej.: Lucía', aviso, accion, max = 14 }: CamposVasosProps) {
  return (
    <div className="cv">
      <div className="cv-cab">
        <span className="cv-titulo">{titulo}</span>
        <span className="cv-ayuda">{ayuda}</span>
      </div>
      {filas.map((f, i) => {
        const largo = f.valor.trim().length;
        return (
          <div key={i} className="cv-fila" data-invalido={f.invalido ? 'si' : undefined}>
            <div className="cv-etiqueta">
              <span className="cv-chip">
                {VASO}
                {f.etiqueta}
              </span>
              <span className="cv-bebida">{f.bebida}</span>
            </div>
            <label className="cv-campo">
              <input
                type="text"
                value={f.valor}
                onChange={(e) => f.onChange(e.target.value)}
                placeholder={placeholder}
                maxLength={30}
                id={`nombre-bebida-${i}`}
                required
                aria-invalid={f.invalido ? true : undefined}
                aria-label={`${f.bebida} · Nombre para el envase (obligatorio, máx. ${max} letras se ven completas)`}
              />
              <span className="cv-contador" data-pasado={largo > max ? 'si' : undefined} aria-hidden="true">{`${largo}/${max}`}</span>
            </label>
          </div>
        );
      })}
      {aviso && (
        <div role="alert" className="cv-aviso">
          {aviso}
        </div>
      )}
      {accion}
    </div>
  );
}
