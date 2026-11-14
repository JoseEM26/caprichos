import { useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { repartosApi } from '../repartos/repartosApi';
import type { DevolucionRegistrada, NoEntregado, PreguntaNoEntregado, RegistroDevolucion, RespuestaNoEntregados } from './pedidosApi';
import { ModalDevolucion } from './ModalDevolucion';
import { PruebaEntregaFallida } from './PruebaEntregaFallida';

export interface PanelNoEntregadosProps {
  datos: RespuestaNoEntregados | null;
  cargando: boolean;
  error: string;
  /** Mismo permiso que la tarjeta de Repartos (repartos/liquidar): sin él no hay botón de reenvío. */
  puedeLiquidar: boolean;
  /** Permiso de cambiar pedidos (pedidos/cambiar_estado): sin él no hay botón de devolución. */
  puedeDevolver?: boolean;
  alActualizar: () => void;
}

const MEDIO_TEXTO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
};

function cuandoDevolvio(iso: string) {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '';
  return f.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** «Devuelto S/ 25.00 · Yape · Marta · 04/11 15:00» (y quién autorizó, si fue otra persona). */
function textoDevuelto(d: DevolucionRegistrada) {
  const quien = d.porNombre ?? 'Sin nombre';
  const autorizo = d.autorizadoPorNombre && d.autorizadoPorNombre !== d.porNombre ? `, autorizó ${d.autorizadoPorNombre}` : '';
  return `Devuelto S/ ${d.montoDevuelto.toFixed(2)} · ${MEDIO_TEXTO[d.medio] ?? d.medio} · ${quien}${autorizo} · ${cuandoDevolvio(d.creadoEn)}`;
}

const TEXTO_PREGUNTA: Record<PreguntaNoEntregado, string> = {
  ESPERANDO: 'Esperando respuesta del cliente',
  SI: 'Dijo que sí quiere reprogramar',
  NO: 'Dijo que no quiere reprogramar',
  SIN_RESPUESTA: 'Sin respuesta del cliente',
  TOPE: 'Límite de reprogramaciones alcanzado',
  SIN_PREGUNTA: 'Sin pregunta registrada',
};

const COLOR_PREGUNTA: Record<PreguntaNoEntregado, { bg: string; fg: string }> = {
  ESPERANDO: { bg: 'var(--cp-sand, #EDE1D1)', fg: 'var(--cp-navy, #0B2C3E)' },
  SI: { bg: 'var(--cp-greenbg, #DFF3E3)', fg: '#1F5C33' },
  NO: { bg: '#FBE3E3', fg: 'var(--cp-rust, #B2500F)' },
  SIN_RESPUESTA: { bg: '#FBE3E3', fg: 'var(--cp-rust, #B2500F)' },
  TOPE: { bg: 'var(--cp-sand, #EDE1D1)', fg: 'var(--cp-navy, #0B2C3E)' },
  SIN_PREGUNTA: { bg: 'var(--cp-sand, #EDE1D1)', fg: 'var(--cp-soft, #2C4C5D)' },
};

function horaRetiro(iso: string | null) {
  if (!iso) return 'Sin hora de retiro';
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return 'Sin hora de retiro';
  return `Retiro ${f.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
}

const estiloBoton = {
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 12,
  border: 0,
  background: 'var(--cp-navy, #0B2C3E)',
  color: 'var(--cp-white, #FFFFFF)',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
  alignSelf: 'flex-start' as const,
};

export function PanelNoEntregados({ datos, cargando, error, puedeLiquidar, puedeDevolver = false, alActualizar }: PanelNoEntregadosProps) {
  const [confirmar, setConfirmar] = useState<NoEntregado | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [devolviendo, setDevolviendo] = useState<NoEntregado | null>(null);
  const [avisoDevolucion, setAvisoDevolucion] = useState<string | null>(null);

  const alDevolver = (resultado: RegistroDevolucion) => {
    setDevolviendo(null);
    setAvisoDevolucion(resultado.avisoComprobante);
    alActualizar();
  };

  const reenviar = async () => {
    if (!confirmar) return;
    setProcesando(true);
    setErrorAccion(null);
    try {
      await repartosApi.reprogramarPedido(confirmar.id);
      setConfirmar(null);
      alActualizar();
    } catch (err: any) {
      setConfirmar(null);
      setErrorAccion(err?.message || 'No se pudo reenviar el pedido a reparto');
    } finally {
      setProcesando(false);
    }
  };

  const fila = (p: NoEntregado, grupo: 'reprogramar' | 'cancelados') => {
    const color = COLOR_PREGUNTA[p.pregunta];
    const puedeReenviar = grupo === 'reprogramar' && p.pregunta === 'SI' && puedeLiquidar;
    return (
      <li
        key={p.id}
        data-testid={`no-entregado-${p.codigo}`}
        style={{
          listStyle: 'none',
          background: 'var(--cp-white, #FFFFFF)',
          border: '1px solid var(--cp-line, #E3D6C6)',
          borderRadius: 14,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--cp-navy, #0B2C3E)' }}>
            {p.codigo}
          </span>
          <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--cp-rust, #B2500F)' }}>S/ {p.total.toFixed(2)}</span>
        </div>

        <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--cp-navy, #0B2C3E)' }}>
          <div style={{ fontWeight: 700 }}>{p.cliente_nombre || 'Cliente'}</div>
          <div>
            {p.cliente_telefono ? (
              <a href={`tel:${p.cliente_telefono}`} style={{ color: 'var(--cp-teal, #2C6E7F)', fontWeight: 700 }}>
                {p.cliente_telefono}
              </a>
            ) : (
              'Sin teléfono'
            )}
          </div>
        </div>

        <div style={{ fontSize: 13, lineHeight: '18px', color: 'var(--cp-soft, #2C4C5D)' }}>
          <div>{p.motivo}</div>
          <div>{horaRetiro(p.retirado_en)}</div>
          {p.de_dias_anteriores && <div style={{ fontWeight: 700, color: '#8A4B00' }}>De días anteriores · falta registrar la devolución</div>}
        </div>

        <PruebaEntregaFallida prueba={p.prueba_entrega} />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span
            data-testid={`pregunta-${p.codigo}`}
            style={{
              fontSize: 12,
              fontWeight: 800,
              borderRadius: 9999,
              padding: '4px 12px',
              background: color.bg,
              color: color.fg,
            }}
          >
            {TEXTO_PREGUNTA[p.pregunta]}
          </span>
          {p.devolucion && (
            <span
              data-testid={`devuelto-${p.codigo}`}
              style={{
                fontSize: 12,
                fontWeight: 800,
                borderRadius: 9999,
                padding: '4px 12px',
                background: 'var(--cp-greenbg, #DFF3E3)',
                color: '#1F5C33',
              }}
            >
              {textoDevuelto(p.devolucion)}
            </span>
          )}
          {p.revisar_devolucion && !p.devolucion && (
            <span
              data-testid={`revisar-devolucion-${p.codigo}`}
              style={{
                fontSize: 12,
                fontWeight: 800,
                borderRadius: 9999,
                padding: '4px 12px',
                border: '1.5px solid var(--cp-rust, #B2500F)',
                color: 'var(--cp-rust, #B2500F)',
              }}
            >
              Revisar devolución
            </span>
          )}
        </div>

        {grupo === 'reprogramar' && p.pregunta === 'ESPERANDO' && (
          <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
            Aún no responde. Si dice que sí, aparece aquí el botón para reenviarlo.
          </div>
        )}

        {grupo === 'cancelados' && p.revisar_devolucion && !p.devolucion && puedeDevolver && (
          <button
            type="button"
            data-testid={`devolver-${p.codigo}`}
            style={estiloBoton}
            onClick={() => setDevolviendo(p)}
          >
            Gestionar devolución
          </button>
        )}

        {puedeReenviar && (
          <button
            type="button"
            style={estiloBoton}
            onClick={() => setConfirmar(p)}
          >
            Reprogramar / Reenviar a reparto
          </button>
        )}
      </li>
    );
  };

  const grupo = (titulo: string, subtitulo: string, lista: NoEntregado[], clave: 'reprogramar' | 'cancelados', vacio: string) => (
    <section
      data-testid={`grupo-${clave}`}
      aria-labelledby={`titulo-${clave}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}
    >
      <div>
        <h3
          id={`titulo-${clave}`}
          style={{ margin: 0, fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--cp-navy, #0B2C3E)' }}
        >
          {titulo} · {lista.length}
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: '18px', color: 'var(--cp-soft, #2C4C5D)' }}>{subtitulo}</p>
      </div>
      {lista.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--cp-soft, #2C4C5D)', fontSize: 14 }}>{vacio}</div>
      ) : (
        <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lista.map((p) => fila(p, clave))}
        </ul>
      )}
    </section>
  );

  if (cargando && !datos) {
    return <div style={{ padding: 24, color: 'var(--cp-soft, #2C4C5D)', fontSize: 14 }}>Cargando pedidos no entregados...</div>;
  }

  if (error) {
    return (
      <div role="alert" style={{ padding: 24, color: 'var(--cp-rust, #B2500F)', fontWeight: 700, fontSize: 14 }}>
        {error}
      </div>
    );
  }

  return (
    <div data-testid="panel-no-entregados" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}>
      {errorAccion && (
        <div role="alert" style={{ fontSize: 14, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
          {errorAccion}
        </div>
      )}
      {avisoDevolucion && (
        <div role="status" data-testid="aviso-devolucion" style={{ fontSize: 14, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
          Devolución registrada. {avisoDevolucion}.
        </div>
      )}
      <div className="cj-ne-grupos">
        {grupo(
          'Por reprogramar',
          'Delivery que el repartidor no pudo entregar (retiro por espera agotada). Confirma con el cliente y reenvíalo a reparto.',
          datos?.reprogramar ?? [],
          'reprogramar',
          'No hay pedidos por reprogramar.',
        )}
        {grupo(
          'Cancelados por no recibir',
          'Pedidos anulados porque el cliente no quiso reprogramar o no respondió. Si ya estaban pagados, revisa la devolución.',
          datos?.cancelados ?? [],
          'cancelados',
          'No hay cancelados por no recibir.',
        )}
      </div>

      {devolviendo && (
        <ModalDevolucion pedido={devolviendo} alCerrar={() => setDevolviendo(null)} alRegistrar={alDevolver} />
      )}

      <Confirmar
        abierto={confirmar !== null}
        titulo="¿Reenviar este pedido a reparto?"
        mensaje={
          confirmar
            ? `El pedido ${confirmar.codigo} vuelve a Para elegir con marca Reprogramado y se avisa al cliente por WhatsApp. Se suma el recargo configurado.`
            : ''
        }
        textoSi="Sí, confirmar"
        textoNo="No, cancelar"
        cargando={procesando}
        alConfirmar={reenviar}
        alCancelar={() => setConfirmar(null)}
      />
    </div>
  );
}
