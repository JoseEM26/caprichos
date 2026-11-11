/**
 * Selector de comprobante (simple por defecto, boleta o factura) con sus datos. El simple es un ticket interno: sin datos ni SUNAT.
 * Lo usan Nuevo pedido (mozo y Caja), la precuenta del mozo y «Cambiar comprobante» al cobrar.
 * La nota de venta ya no es comprobante elegible. La API valida otra vez (validarDocumentoComprobante);
 * aquí solo se evita enviar datos que ya se sabe que no sirven.
 */

import { useEffect, useRef } from 'react';
import { mensajeConsulta, tipoPorLongitud, useConsultaDocumento } from './consultaDocumento';
import { rucValido } from '../comprobantes/utilidades';

export type TipoComprobanteSel = 'SIMPLE' | 'BOLETA' | 'FACTURA';

export interface ValorComprobante {
  /** null = sin elegir (pedidos antiguos con nota de venta): hay que elegir antes de enviar o cobrar */
  tipo: TipoComprobanteSel | null;
  doc: string;
  razon: string;
  direccion: string;
}

export const VALOR_COMPROBANTE_VACIO: ValorComprobante = { tipo: 'SIMPLE', doc: '', razon: '', direccion: '' };

/** Sobre el que la boleta sin DNI deja de poder emitirse (SUNAT). */
export const LIMITE_BOLETA_SIN_DNI = 700;

const ETIQUETA: Record<TipoComprobanteSel, string> = { SIMPLE: 'Comprobante simple', BOLETA: 'Boleta', FACTURA: 'Factura' };
/** Nombre para mostrar. Los pedidos antiguos con nota de venta se muestran como tal (solo lectura). */
export const etiquetaComprobante = (t: string) => (t === 'SIMPLE' || t === 'BOLETA' || t === 'FACTURA' ? ETIQUETA[t] : 'Nota de venta');

/**
 * Mensaje del primer dato con formato malo, o null. `campo` dice qué campo enfocar.
 * La boleta sin DNI por más de S/ 700 NO es error aquí: nunca se bloquea la venta; la exige el cobro (avisoValorComprobante).
 */
export function errorValorComprobante(v: ValorComprobante): { campo: 'tipo' | 'doc' | 'razon'; mensaje: string } | null {
  if (v.tipo === null) return { campo: 'tipo', mensaje: 'Elige comprobante simple, boleta o factura' };
  if (v.tipo === 'SIMPLE') return null;
  const doc = v.doc.trim();
  if (v.tipo === 'BOLETA') {
    if (doc !== '' && !/^\d{8}$/.test(doc)) return { campo: 'doc', mensaje: 'El DNI debe tener 8 dígitos (o déjalo vacío); un RUC de 11 dígitos es para factura' };
    return null;
  }
  if (!/^(10|15|17|20)\d{9}$/.test(doc))
    return { campo: 'doc', mensaje: 'El RUC debe tener 11 dígitos y empezar con 10, 15, 17 o 20' };
  if (v.razon.trim() === '') return { campo: 'razon', mensaje: 'Escribe la razón social' };
  return null;
}

/** Cuerpo del comprobante para la API (sin campos vacíos). Sin tipo elegido, no se manda nada. */
export function aPayloadComprobante(v: ValorComprobante) {
  if (v.tipo === null) return undefined;
  if (v.tipo === 'SIMPLE') return { tipo: v.tipo };
  const doc = v.doc.trim();
  return {
    tipo: v.tipo,
    ...(doc ? { doc } : {}),
    ...(v.tipo === 'FACTURA' ? { razon: v.razon.trim() } : {}),
    ...(v.tipo === 'FACTURA' && v.direccion.trim() ? { direccion: v.direccion.trim() } : {}),
  };
}

/** Cuerpo del comprobante para crear el pedido (POST pedidos: dni, ruc, razonSocial). Sin tipo, no se manda nada. */
export function aComprobanteAlta(v: ValorComprobante) {
  if (v.tipo === null) return undefined;
  if (v.tipo === 'SIMPLE') return { tipo: 'SIMPLE' as const };
  const doc = v.doc.trim();
  if (v.tipo === 'BOLETA') return { tipo: 'BOLETA' as const, ...(doc ? { dni: doc } : {}) };
  return {
    tipo: 'FACTURA' as const,
    ruc: doc,
    razonSocial: v.razon.trim(),
    ...(v.direccion.trim() ? { direccion: v.direccion.trim() } : {}),
  };
}

/** Aviso (no error) de la boleta mayor a S/ 700 sin DNI: se registra, pero Caja no cobra hasta tener el DNI o cambiar el comprobante. */
export function avisoValorComprobante(v: ValorComprobante, total?: number): string | null {
  if (v.tipo !== 'BOLETA' || v.doc.trim() !== '' || (total ?? 0) <= LIMITE_BOLETA_SIN_DNI) return null;
  return `Una boleta mayor a S/ ${LIMITE_BOLETA_SIN_DNI} pide el DNI. Puedes registrarla sin DNI, pero Caja no cobrará hasta tener el DNI o cambiar el comprobante.`;
}

const botonTipo = (activo: boolean) => ({
  minHeight: '44px',
  padding: '0 12px',
  borderRadius: '10px',
  border: activo ? '2px solid var(--cp-navy)' : '1.5px solid var(--cp-line)',
  background: activo ? 'var(--cp-navy)' : 'var(--cp-white)',
  color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
  fontWeight: 700,
  fontSize: '13px',
  cursor: 'pointer',
});

const campo = {
  minHeight: '44px',
  borderRadius: '10px',
  border: '1.5px solid var(--cp-line)',
  background: 'var(--cp-white)',
  padding: '0 12px',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box' as const,
  marginTop: 4,
  fontWeight: 400,
};

const etiqueta = { fontWeight: 700, fontSize: 13 };
const error = { color: 'var(--cp-rust, #b00020)', fontSize: 12, fontWeight: 700, marginTop: 4 };
const aviso_ = { color: 'var(--cp-navy, #0B2C3E)', background: 'var(--cp-sand, #F3E9DA)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, marginTop: 4 };

export interface SelectorComprobanteProps {
  valor: ValorComprobante;
  onChange: (v: ValorComprobante) => void;
  /** Total del pedido: arriba de S/ 700 la boleta exige DNI */
  total?: number;
  /** Prefijo de los id de los campos (para enfocarlos desde fuera): `${idPrefijo}-doc`, `${idPrefijo}-razon` */
  idPrefijo: string;
  /** RUC guardado en la cuenta del cliente (ya identificado por su celular en el paso anterior). Rellena la factura, editable. */
  guardada?: { ruc: string; razonSocial: string | null; direccion: string | null } | null;
}

export function SelectorComprobante({ valor, onChange, total, idPrefijo, guardada }: SelectorComprobanteProps) {
  const err = errorValorComprobante(valor);
  const aviso = avisoValorComprobante(valor, total);
  const set = (cambio: Partial<ValorComprobante>) => onChange({ ...valor, ...cambio });
  const sinDocObligatorio = valor.tipo === 'BOLETA' && (total ?? 0) > LIMITE_BOLETA_SIN_DNI;
  const tipos: TipoComprobanteSel[] = ['SIMPLE', 'BOLETA', 'FACTURA'];

  // «DNI o RUC»: boleta consulta un DNI (8), factura un RUC (11). Solo ayuda a rellenar; si falla, se escribe a mano.
  // Se consulta solo con el largo que corresponde al comprobante: un RUC pasa por 8 dígitos al escribirse y no debe gastar una consulta de DNI.
  // Con razón social ya guardada para este RUC no se consulta otra vez
  const rucGuardadoCompleto = !!guardada && guardada.ruc === valor.doc && !!guardada.razonSocial && valor.razon === guardada.razonSocial;
  const consultable = (valor.tipo === 'BOLETA' && tipoPorLongitud(valor.doc) === 'DNI') || (valor.tipo === 'FACTURA' && tipoPorLongitud(valor.doc) === 'RUC' && !rucGuardadoCompleto);
  const consulta = useConsultaDocumento(consultable ? valor.doc : '', consultable);
  const actual = useRef({ valor, onChange });
  actual.current = { valor, onChange };
  // RUC guardado en la cuenta: al elegir factura con el RUC vacío se rellena una sola vez (celular primero, RUC después)
  const rellenado = useRef<string | null>(null);
  useEffect(() => {
    if (valor.tipo !== 'FACTURA' || !guardada || rellenado.current === guardada.ruc || valor.doc !== '') return;
    rellenado.current = guardada.ruc;
    onChange({ ...valor, doc: guardada.ruc, razon: guardada.razonSocial ?? '', direccion: guardada.direccion ?? '' });
  }, [valor, guardada, onChange]);
  useEffect(() => {
    if (consulta.estado !== 'ok' || consulta.tipo !== 'RUC') return;
    const { valor: v, onChange: cambiar } = actual.current;
    if (v.tipo !== 'FACTURA') return;
    cambiar({ ...v, razon: consulta.razon, direccion: v.direccion || consulta.direccion || '' });
  }, [consulta]);
  // Escribir 11 dígitos de un RUC válido estando en boleta pasa a factura (con el mismo número)
  const escribirDoc = (texto: string) => {
    const doc = texto.replace(/\D/g, '');
    set(valor.tipo === 'BOLETA' && rucValido(doc) ? { doc, tipo: 'FACTURA' } : { doc });
  };
  const estadoConsulta = mensajeConsulta(consulta);

  return (
    <div id={`${idPrefijo}-tipo`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>Comprobante</div>
      <div role="group" aria-label="Comprobante" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tipos.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={valor.tipo === t}
            data-testid={`comprobante-${t}`}
            onClick={() => set({ tipo: t })}
            style={botonTipo(valor.tipo === t)}
          >
            {ETIQUETA[t]}
          </button>
        ))}
      </div>
      {valor.tipo === null && (
        <div role="status" style={{ fontSize: 12, fontWeight: 600 }}>
          Elige comprobante simple, boleta o factura para continuar.
        </div>
      )}

      {valor.tipo === 'BOLETA' && (
        <>
          <label style={etiqueta}>
            {sinDocObligatorio ? 'DNI o RUC (obligatorio)' : 'DNI o RUC (opcional)'}
            <input
              id={`${idPrefijo}-doc`}
              type="text"
              inputMode="numeric"
              maxLength={11}
              value={valor.doc}
              aria-invalid={!!err && err.campo === 'doc'}
              onChange={(e) => escribirDoc(e.target.value)}
              style={campo}
            />
          </label>
          {err?.campo === 'doc' && <div role="alert" style={error}>{err.mensaje}</div>}
          {estadoConsulta && <div role="status" style={aviso_}>{estadoConsulta}</div>}
          {consulta.estado === 'ok' && consulta.tipo === 'DNI' && <div role="status" style={aviso_}>Nombre del DNI: {consulta.nombre}</div>}
          {aviso && <div role="status" style={aviso_}>{aviso}</div>}
        </>
      )}

      {valor.tipo === 'FACTURA' && (
        <>
          {guardada && valor.doc === guardada.ruc && (
            <div role="status" style={aviso_}>RUC guardado en la cuenta del cliente. Puedes corregirlo para este pedido.</div>
          )}
          <label style={etiqueta}>
            DNI o RUC
            <input
              id={`${idPrefijo}-doc`}
              type="text"
              inputMode="numeric"
              maxLength={11}
              value={valor.doc}
              aria-invalid={!!err && err.campo === 'doc'}
              onChange={(e) => escribirDoc(e.target.value)}
              style={campo}
            />
          </label>
          {err?.campo === 'doc' && <div role="alert" style={error}>{err.mensaje}</div>}
          {estadoConsulta && <div role="status" style={aviso_}>{estadoConsulta}</div>}
          {tipoPorLongitud(valor.doc) === 'DNI' && (
            <button type="button" onClick={() => set({ tipo: 'BOLETA' })} style={{ ...botonTipo(false), minHeight: 36 }}>
              Es un DNI: pasar a boleta
            </button>
          )}
          <label style={etiqueta}>
            Razón social
            <input
              id={`${idPrefijo}-razon`}
              type="text"
              value={valor.razon}
              aria-invalid={!!err && err.campo === 'razon'}
              onChange={(e) => set({ razon: e.target.value })}
              style={campo}
            />
          </label>
          {err?.campo === 'razon' && <div role="alert" style={error}>{err.mensaje}</div>}
          <label style={etiqueta}>
            Dirección fiscal (opcional)
            <input type="text" value={valor.direccion} onChange={(e) => set({ direccion: e.target.value })} style={campo} />
          </label>
        </>
      )}
    </div>
  );
}
