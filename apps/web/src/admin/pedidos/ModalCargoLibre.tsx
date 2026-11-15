import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import './corregir-cliente.css';

export const CARGO_LIBRE_MAX = 500;
export const CARGO_LIBRE_DESC_MAX = 120;

export interface CargoLibreDatos {
  descripcion: string;
  monto: number;
  /** Id (o posición) del producto al que acompaña; vacío = suelto. */
  paraId: string;
}

export interface OpcionProductoCargo {
  id: string;
  nombre: string;
}

/** Mensaje en vivo del monto («2,50» o «2.5»), o '' si está bien. */
export function errorMontoCargo(texto: string): string {
  const t = texto.trim().replace(',', '.');
  if (t === '') return 'Escribe el monto.';
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return 'El monto debe ser un número con hasta 2 decimales.';
  const n = Number(t);
  if (!(n > 0)) return 'El monto debe ser mayor a 0.';
  if (n > CARGO_LIBRE_MAX) return `El monto máximo es S/ ${CARGO_LIBRE_MAX}.`;
  return '';
}

export interface ModalCargoLibreProps {
  /** Productos del pedido a los que puede acompañar (opcional). */
  productos?: OpcionProductoCargo[];
  /** Texto de ayuda bajo el título (p. ej. «Se cobra con el pedido»). */
  ayuda?: string;
  enviando?: boolean;
  error?: string;
  alCerrar: () => void;
  alConfirmar: (datos: CargoLibreDatos) => void;
}

/**
 * «Servicio o producto»: una línea libre con descripción y monto que escribe Caja o el mozo (topping, bola de helado,
 * texto en el brownie…). Se suma al total del pedido. Descripción y monto se validan otra vez en el servidor.
 */
export function ModalCargoLibre({ productos = [], ayuda, enviando, error, alCerrar, alConfirmar }: ModalCargoLibreProps) {
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [paraId, setParaId] = useState('');
  const [tocado, setTocado] = useState(false);

  const errDesc = descripcion.trim().length === 0 ? 'Escribe qué es (por ejemplo: topping de fresa).' : '';
  const errMonto = errorMontoCargo(monto);
  const invalido = !!errDesc || !!errMonto;

  const confirmar = () => {
    setTocado(true);
    if (invalido) return;
    alConfirmar({ descripcion: descripcion.trim().replace(/\s+/g, ' '), monto: Math.round(Number(monto.trim().replace(',', '.')) * 100) / 100, paraId });
  };

  return (
    <>
      <div onClick={alCerrar} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(11, 44, 62, 0.55)' }} />
      <div role="dialog" aria-modal="true" aria-label="Servicio o producto" className="cc-hoja" style={{ zIndex: 81, width: 'min(480px, calc(100% - 24px))' }}>
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--cp-navy, #0B2C3E)' }}>Servicio o producto</div>
          <div style={{ fontSize: 14, color: 'var(--cp-soft, #2C4C5D)', marginTop: 4 }}>
            {ayuda ?? 'Para lo que no está en la carta. Se suma al total del pedido.'}
          </div>
        </div>

        <div className="cc-grid">
          <label className="cc-campo">
            Descripción
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={CARGO_LIBRE_DESC_MAX}
              placeholder="Topping de fresa, texto en el brownie…"
              aria-invalid={tocado && !!errDesc}
              autoComplete="off"
              autoFocus
            />
            {tocado && errDesc && <span className="cc-error" role="alert">{errDesc}</span>}
          </label>

          <label className="cc-campo">
            Monto (S/)
            <input
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              aria-invalid={tocado && !!errMonto}
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmar();
              }}
            />
            {tocado && errMonto && <span className="cc-error" role="alert">{errMonto}</span>}
          </label>

          {productos.length > 0 && (
            <label className="cc-campo">
              ¿Para qué producto? (opcional)
              <select value={paraId} onChange={(e) => setParaId(e.target.value)} style={{ minHeight: 52, borderRadius: 12, border: '1.5px solid var(--cp-line, #E3D6C6)', padding: '0 12px', fontSize: 16 }}>
                <option value="">Suelto, sin producto</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              <span className="cc-ayuda">Con producto, el texto sale en su comanda y en su sticker.</span>
            </label>
          )}
        </div>

        {error && <div role="alert" className="cc-error">{error}</div>}

        <div className="cc-acciones">
          <Boton variante="secundario" tamano="grande" onClick={alCerrar}>Cancelar</Boton>
          <Boton tamano="grande" onClick={confirmar} deshabilitado={enviando}>
            {enviando ? 'Agregando…' : 'Agregar'}
          </Boton>
        </div>
      </div>
    </>
  );
}

/** Etiqueta destacada de la línea libre: «Servicio/producto libre · agregado por Rosa a las 15:42». */
export function etiquetaCargoLibre(l: { agregadoPor?: string | null; agregadoEn?: string | Date | null }): string {
  const hora = l.agregadoEn
    ? new Date(l.agregadoEn).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' })
    : '';
  return ['Servicio/producto libre', l.agregadoPor || hora ? `agregado${l.agregadoPor ? ` por ${l.agregadoPor}` : ''}${hora ? ` a las ${hora}` : ''}` : ''].filter(Boolean).join(' · ');
}

export const esCargoLibre = (l: { cargoLibre?: boolean; cargo_libre?: boolean }) => !!(l.cargoLibre || l.cargo_libre);

/** ¿El pedido ya está cobrado (en Caja o por el mozo)? Entonces el cargo va en un pedido extra. */
export const estaPagadoCargo = (p: { pago_estado?: string | null; cobroMozo?: unknown }) => String(p.pago_estado || '').toUpperCase() === 'PAGADO' || !!p.cobroMozo;
