import { useEffect, useState } from 'react';
import { api } from '../comun/api';
import type { EstadoLocalCarta } from './tipos';

/** Días y horas que el cliente puede elegir para programar su pedido con el local cerrado (GET /carta/programar-horas). */
export interface ProgramarCarta {
  diasMax: number;
  /** Día de hoy en Lima (YYYY-MM-DD), para decir «hoy» y «mañana». */
  hoy?: string;
  dias: { fecha: string; abre?: string; horas: { hora: string; iso: string }[] }[];
}

const CINCO_MIN = 5 * 60_000;

/**
 * Con el local cerrado por horario y «Pedidos programados fuera de horario» encendido en Configuración, trae los días y
 * horas disponibles. null = no se puede programar (parámetro apagado, local abierto o en pausa, sin horas, o sin red):
 * la carta queda como siempre.
 */
export function useProgramarFueraHorario(estadoLocal: EstadoLocalCarta | null): ProgramarCarta | null {
  const [datos, setDatos] = useState<ProgramarCarta | null>(null);
  const cerradoPorHorario = Boolean(estadoLocal && !estadoLocal.abierta && !estadoLocal.pausaAltaDemanda);
  useEffect(() => {
    if (!cerradoPorHorario) {
      setDatos(null);
      return;
    }
    let vivo = true;
    const traer = () =>
      Promise.resolve(api.get<{ habilitado?: boolean } & ProgramarCarta>('/carta/programar-horas'))
        .then((r) => {
          if (vivo) setDatos(r?.habilitado && Array.isArray(r.dias) && r.dias.length > 0 ? { diasMax: r.diasMax, hoy: r.hoy, dias: r.dias } : null);
        })
        .catch(() => {
          if (vivo) setDatos(null);
        });
    void traer();
    // las horas de hoy van pasando: se renuevan cada pocos minutos
    const id = setInterval(() => void traer(), CINCO_MIN);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [cerradoPorHorario]);
  return datos;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** «lunes 1 de marzo» (día de calendario de Lima, sin la coma que pone Intl). */
export function diaLargo(fechaIso: string): string {
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(`${fechaIso}T12:00:00.000-05:00`))
    .replace(',', '');
}

/** «hoy» / «mañana» / «lunes 1 de marzo» para una fecha YYYY-MM-DD, según el «hoy» de Lima que manda el servidor. */
export function cuando(fechaIso: string, hoy?: string): string {
  if (hoy && fechaIso === hoy) return 'hoy';
  if (hoy) {
    const m = new Date(`${hoy}T12:00:00.000-05:00`);
    m.setUTCDate(m.getUTCDate() + 1);
    if (fechaIso === m.toISOString().slice(0, 10)) return 'mañana';
  }
  return diaLargo(fechaIso);
}

/** «Abrimos hoy a las 15:00» (próximo día con horas disponibles); vacío si no se sabe. */
export function textoApertura(programar?: ProgramarCarta | null): string {
  const d = programar?.dias[0];
  return d?.abre ? ` Abrimos ${cuando(d.fecha, programar?.hoy)} a las ${d.abre}.` : '';
}

/** «lunes 1 de marzo a las 10:30» desde el instante ISO pactado (hora de Lima). */
export function textoDiaHora(iso: string): string {
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'long', day: 'numeric', month: 'long' }).format(d).replace(',', '');
  const hora = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${dia} a las ${hora}`;
}

export const TEXTO_CERRADO_PROGRAMAR =
  'Estamos cerrados ahora, pero puedes programar tu pedido para llevar o delivery y lo atendemos en nuestro horario.';

/** Aviso amable (no es un error): cuando se puede programar, el cierre deja de ser un bloqueo. */
export function AvisoProgramar({ compacto = false, programar = null }: { compacto?: boolean; programar?: ProgramarCarta | null }) {
  return (
    <div
      role="status"
      data-testid="aviso-programar"
      style={{
        backgroundColor: 'var(--cp-sand)',
        color: 'var(--cp-navy)',
        border: '1.5px solid var(--cp-orange)',
        borderRadius: compacto ? '10px' : '14px',
        padding: compacto ? '8px 12px' : '12px 14px',
        fontSize: compacto ? '12px' : '13px',
        fontWeight: 700,
        lineHeight: compacto ? '16px' : '18px',
      }}
    >
      <span aria-hidden="true">🕒 </span>
      {TEXTO_CERRADO_PROGRAMAR}
      {textoApertura(programar)}
    </div>
  );
}

/** «¿Para cuándo lo quieres?»: día (lista) y hora (botones) solo dentro del horario de atención. */
export function SelectorCuando({ programar, valor, alCambiar }: { programar: ProgramarCarta; valor: string; alCambiar: (iso: string) => void }) {
  const diaDeValor = programar.dias.find((d) => d.horas.some((h) => h.iso === valor))?.fecha ?? '';
  const [fecha, setFecha] = useState(diaDeValor || programar.dias[0]?.fecha || '');
  // si las horas se renuevan y el día elegido ya no existe, se vuelve al primero
  const dia = programar.dias.find((d) => d.fecha === fecha) ?? programar.dias[0];
  return (
    <div
      data-testid="bloque-cuando"
      style={{ backgroundColor: 'var(--cp-white)', padding: '14px', borderRadius: '14px', border: '1px solid var(--cp-line)', display: 'flex', flexDirection: 'column', gap: '12px' }}
    >
      <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 700, fontSize: '14px', color: 'var(--cp-navy)' }}>¿Para cuándo lo quieres?</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
        Día
        <select
          data-testid="select-dia-programado"
          value={dia?.fecha ?? ''}
          onChange={(e) => {
            setFecha(e.target.value);
            alCambiar('');
          }}
          style={{ minHeight: '44px', borderRadius: '10px', border: '1.5px solid var(--cp-line)', padding: '0 10px', fontSize: '15px', backgroundColor: 'var(--cp-white)', color: 'var(--cp-navy)' }}
        >
          {programar.dias.map((d) => (
            <option key={d.fecha} value={d.fecha}>
              {['hoy', 'mañana'].includes(cuando(d.fecha, programar.hoy)) ? `${cap(cuando(d.fecha, programar.hoy))} · ${diaLargo(d.fecha)}` : cap(diaLargo(d.fecha))}
            </option>
          ))}
        </select>
      </label>
      <div role="group" aria-label="Hora" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>Hora</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: '8px' }}>
          {(dia?.horas ?? []).map((h) => {
            const activa = valor === h.iso;
            return (
              <button
                key={h.iso}
                type="button"
                data-testid={`hora-programada-${h.hora}`}
                aria-pressed={activa}
                onClick={() => alCambiar(h.iso)}
                style={{
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: activa ? '2px solid var(--cp-orange)' : '1.5px solid var(--cp-line)',
                  backgroundColor: activa ? 'var(--cp-sand)' : 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                {h.hora}
              </button>
            );
          })}
        </div>
      </div>
      <div role="status" data-testid="resumen-cuando" style={{ fontSize: '13px', color: valor ? 'var(--cp-navy)' : 'var(--cp-soft)', fontWeight: valor ? 700 : 400 }}>
        {valor ? `Tu pedido será el ${textoDiaHora(valor)}.` : 'Elige una hora para continuar. Solo mostramos horas dentro de nuestro horario de atención.'}
      </div>
    </div>
  );
}

/** Los dos caminos de pago de un pedido programado. */
export type CaminoPago = 'RECIBIR' | 'PAGADO';

/** Yape, Plin y transferencia: los únicos medios con los que se deja el pedido pagado (con captura). */
export const MEDIOS_DEJAR_PAGADO = ['YAPE', 'PLIN', 'TRANSFERENCIA'] as const;

const CAMINOS: { id: CaminoPago; titulo: string; texto: string }[] = [
  { id: 'RECIBIR', titulo: 'Pagar al recoger o recibir', texto: 'Pagas cuando te lo entreguemos o lo recojas. Queda pendiente de pago, no se cobra nada ahora.' },
  { id: 'PAGADO', titulo: 'Pagar ahora con Yape o Plin', texto: 'Envía tu voucher (captura de tu pago) y tu pedido queda pagado. También puedes usar transferencia.' },
];

/** «¿Cómo prefieres pagar?» para un pedido programado: pagar al recibir o dejarlo pagado con captura. */
export function SelectorCaminoPago({ valor, alCambiar }: { valor: CaminoPago | null; alCambiar: (c: CaminoPago) => void }) {
  return (
    <div
      data-testid="bloque-camino-pago"
      style={{ backgroundColor: 'var(--cp-white)', padding: '14px', borderRadius: '14px', border: '1px solid var(--cp-line)', display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '16px', color: 'var(--cp-navy)' }}>¿Cómo prefieres pagar?</div>
      <div role="radiogroup" aria-label="Cómo prefieres pagar" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {CAMINOS.map((c) => {
          const activo = valor === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={activo}
              data-testid={`camino-pago-${c.id.toLowerCase()}`}
              onClick={() => alCambiar(c.id)}
              style={{
                textAlign: 'left',
                minHeight: '64px',
                padding: '10px 12px',
                borderRadius: '12px',
                border: activo ? '2px solid var(--cp-orange)' : '1.5px solid var(--cp-line)',
                backgroundColor: activo ? 'var(--cp-sand)' : 'var(--cp-white)',
                color: 'var(--cp-navy)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <span style={{ fontWeight: 800, fontSize: '15px' }}>{c.titulo}</span>
              <span style={{ fontSize: '13px', color: 'var(--cp-soft)', lineHeight: '17px' }}>{c.texto}</span>
            </button>
          );
        })}
      </div>
      <div data-testid="aviso-pago-en-linea-horario" role="note" style={{ fontSize: '12px', color: 'var(--cp-soft)', lineHeight: '16px' }}>
        El pago en línea con tarjeta está disponible dentro del horario; puedes pagar al recibir o dejar tu Yape con captura.
      </div>
    </div>
  );
}

/** Confirmación final de un pedido programado. */
export function ConfirmacionProgramado({ iso }: { iso: string }) {
  return (
    <div
      role="status"
      data-testid="confirmacion-programado"
      style={{ backgroundColor: 'var(--cp-sand)', border: '1.5px solid var(--cp-orange)', borderRadius: '14px', padding: '12px 14px', color: 'var(--cp-navy)', fontWeight: 700, fontSize: '14px', lineHeight: '20px' }}
    >
      <span aria-hidden="true">📅 </span>
      Tu pedido quedó programado para el {textoDiaHora(iso)}. Te avisaremos por WhatsApp.
    </div>
  );
}
