import { useState } from 'react';
import { MOTIVOS_MERMA, notaOtroValida, type MotivoMermaProducto } from './almacenApi';
import { Boton } from '../../comun/Boton';
import './apertura-dia.css';

export interface MotivoElegido {
  motivo: MotivoMermaProducto | '';
  nota: string;
}

export interface LineaMerma {
  clave: string;
  nombre: string;
  cantidad: number;
}

/** Una línea está lista si tiene motivo y, siendo «Otro», una nota de al menos 5 letras. */
export const motivoCompleto = (m?: MotivoElegido) => !!m && m.motivo !== '' && (m.motivo !== 'OTRO' || notaOtroValida(m.nota));

interface Props {
  lineas: LineaMerma[];
  motivos: Record<string, MotivoElegido>;
  alCambiar: (motivos: Record<string, MotivoElegido>) => void;
  alConfirmar: () => void;
  alCancelar: () => void;
  guardando?: boolean;
}

/**
 * Confirmación Sí/No antes de guardar la apertura cuando se BAJÓ algún conteo: lista cada merma con su
 * motivo (obligatorio; «Otro» pide nota) y permite aplicar el mismo motivo a todas.
 */
export function ConfirmarMermasApertura({ lineas, motivos, alCambiar, alConfirmar, alCancelar, guardando = false }: Props) {
  const [intento, setIntento] = useState(false);
  const [comun, setComun] = useState<MotivoMermaProducto | ''>('');
  const completas = lineas.every((l) => motivoCompleto(motivos[l.clave]));
  const total = lineas.reduce((s, l) => s + l.cantidad, 0);

  const poner = (clave: string, cambio: Partial<MotivoElegido>) =>
    alCambiar({ ...motivos, [clave]: { ...(motivos[clave] ?? { motivo: '' as const, nota: '' }), ...cambio } });

  const aplicarComun = (valor: MotivoMermaProducto | '') => {
    setComun(valor);
    if (!valor) return;
    alCambiar(Object.fromEntries(lineas.map((l) => [l.clave, { motivo: valor, nota: motivos[l.clave]?.nota ?? '' }])));
  };

  return (
    <>
      <div className="ap-modal-fondo" aria-hidden="true" onClick={alCancelar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar mermas de la apertura"
        className="ap-modal ap-modal--ancho"
        onKeyDown={(e) => e.key === 'Escape' && alCancelar()}
      >
        <h2 className="ap-modal-titulo">
          ¿Registrar {total} {total === 1 ? 'unidad' : 'unidades'} como merma?
        </h2>
        <p className="ap-modal-texto">
          Bajaste el conteo de {lineas.length} {lineas.length === 1 ? 'producto' : 'productos'}. Lo que falta se registra como merma: elige por qué.
        </p>
        <label className="ap-modal-comun">
          Mismo motivo para todos
          <select aria-label="Mismo motivo para todos" value={comun} onChange={(e) => aplicarComun(e.target.value as MotivoMermaProducto | '')}>
            <option value="">Elegir…</option>
            {MOTIVOS_MERMA.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <ul className="ap-modal-lista">
          {lineas.map((l) => {
            const m = motivos[l.clave] ?? { motivo: '', nota: '' };
            const falta = intento && !motivoCompleto(m);
            return (
              <li key={l.clave} className="ap-modal-item" data-testid="merma-confirmar-fila">
                <div className="ap-modal-item-cab">
                  <span>{l.nombre}</span>
                  <span className="ap-merma-chip">Merma: −{l.cantidad}</span>
                </div>
                <select
                  aria-label={`Motivo de la merma de ${l.nombre}`}
                  aria-invalid={falta || undefined}
                  value={m.motivo}
                  onChange={(e) => poner(l.clave, { motivo: e.target.value as MotivoMermaProducto | '' })}
                >
                  <option value="">Elegir motivo…</option>
                  {MOTIVOS_MERMA.map((x) => (
                    <option key={x.valor} value={x.valor}>
                      {x.etiqueta}
                    </option>
                  ))}
                </select>
                {m.motivo === 'OTRO' && (
                  <input
                    type="text"
                    maxLength={200}
                    placeholder="Nota obligatoria (mín. 5 letras)"
                    aria-label={`Nota de la merma de ${l.nombre}`}
                    value={m.nota}
                    onChange={(e) => poner(l.clave, { nota: e.target.value })}
                  />
                )}
                {falta && (
                  <span role="alert" className="ap-error-campo">
                    {m.motivo === 'OTRO' ? 'Escribe una nota de al menos 5 letras.' : 'Elige el motivo.'}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="ap-modal-botones">
          <Boton
            tamano="normal"
            cargando={guardando}
            deshabilitado={guardando}
            onClick={() => {
              if (!completas) return setIntento(true);
              alConfirmar();
            }}
          >
            Sí, registrar merma y guardar
          </Boton>
          <button type="button" className="ap-modal-no" onClick={alCancelar}>
            No, revisar
          </button>
        </div>
      </div>
    </>
  );
}
