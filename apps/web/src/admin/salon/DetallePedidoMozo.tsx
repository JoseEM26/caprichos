import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ModalConPestanas } from '../../comun/ModalConPestanas';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { useSesion } from '../../comun/sesion';
import { api } from '../../comun/api';
import type { ResultadoReimpresionPedido } from '../impresion/impresionApi';
import { BotonCambiarPago } from '../pedidos/CambiarPago';
import { errorCelular } from '../pedidos/ModalCorregirCliente';
import { pedidosApi, type Pedido } from '../pedidos/pedidosApi';
import type { AreaProgreso, MiPedido } from './tipos';
import './detalle-pedido-mozo.css';

const soles = (n: number) => `S/ ${n.toFixed(2)}`;
const hora = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'America/Lima' });

const ESTADO_TXT: Record<string, string> = {
  COLA: 'En cola', PREPARANDO: 'Preparando', LISTO: 'Listo', EN_CAMINO: 'En camino', ENTREGADO: 'Entregado', ANULADO: 'Anulado', RECHAZADO: 'Rechazado',
};
const AREA_TXT: Record<AreaProgreso['estado'], string> = { LISTA: 'Lista', PREPARANDO: 'Preparando', PENDIENTE: 'Pendiente' };
const PAGO: Record<string, string> = { PAGADO: 'Pagado', PENDIENTE: 'Pago pendiente', COORDINADO: 'Pago coordinado' };
const PASOS = [
  { id: 'pedido', etiqueta: '1 · Pedido' },
  { id: 'cliente', etiqueta: '2 · Cliente y pago' },
  { id: 'estado', etiqueta: '3 · Estado y acciones' },
];

/** Productos con opciones y estado por área de cocina de UN pedido (el original o un extra). */
function SeccionPedido({ p, extra }: { p: MiPedido; extra: boolean }) {
  const pr = p.progreso;
  const pct = Math.max(0, Math.min(100, Math.round(pr?.porcentaje ?? 0)));
  return (
    <section className="dpm-sec" aria-label={`${extra ? 'Pedido extra' : 'Pedido'} ${p.codigo}`} data-testid={extra ? 'dpm-extra' : 'dpm-original'}>
      <div className="dpm-sec-cab">
        <strong>{p.codigo}</strong>
        {extra && <span className="dpm-chip dpm-chip--extra">EXTRA</span>}
        <span className="dpm-chip">{ESTADO_TXT[p.estado] ?? p.estado}</span>
        <strong className="dpm-der">{soles(p.total)}</strong>
      </div>
      {pr && (
        <>
          <div className="dpm-barra" role="progressbar" aria-label={`Avance en cocina de ${p.codigo}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </div>
          {(pr.areas ?? []).length > 0 && (
            <ul className="dpm-chips" aria-label="Estado por área de cocina">
              {pr.areas.map((a) => (
                <li key={a.nombre} className={`dpm-chip dpm-area--${a.estado.toLowerCase()}`}>{a.nombre}: {AREA_TXT[a.estado]}</li>
              ))}
            </ul>
          )}
        </>
      )}
      <ul className="dpm-lineas" aria-label={`Productos de ${p.codigo}`}>
        {p.lineas.map((l, i) => {
          const det = [l.tamano, l.opciones?.join(', ')].filter(Boolean).join(' · ');
          return (
            <li key={l.id ?? i} className="dpm-linea">
              <span className="dpm-cant">{l.cantidad}×</span>
              <span className="dpm-linea-txt">
                <span>{l.nombre}{l.lista ? ' · ✓ Listo' : ''}</span>
                {det && <span className="dpm-det">{det}</span>}
                {l.nota && <span className="dpm-det">Nota: {l.nota}</span>}
              </span>
              {l.subtotal != null && <span>{soles(l.subtotal)}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export interface DetallePedidoMozoProps {
  pedido: MiPedido;
  /** Pedidos extra de la cuenta (pedidoOrigenId = este pedido) */
  extras?: MiPedido[];
  /** Bloque de voucher de la tarjeta; sus botones ya cierran este modal antes de abrir el suyo */
  vouchers?: ReactNode;
  alCerrar: () => void;
  /** Hubo un cambio guardado: la lista se vuelve a cargar */
  alCambio: () => void;
  /** Acciones que abren otro modal: el padre cierra este y abre el suyo */
  alExtra: () => void;
  alAnular: () => void;
}

/** «Ver detalle» en 3 pasos: Pedido · Cliente y pago · Estado y acciones. */
export function DetallePedidoMozo({ pedido, extras = [], vouchers, alCerrar, alCambio, alExtra, alAnular }: DetallePedidoMozoProps) {
  const { tiene } = useSesion();
  const [paso, setPaso] = useState('pedido');
  const [completo, setCompleto] = useState<Pedido | null>(null);
  const [sinFicha, setSinFicha] = useState(false);

  const cargarCompleto = useCallback(() => {
    pedidosApi.obtenerPorId(pedido.id).then((r) => { setCompleto(r); setSinFicha(false); }).catch(() => setSinFicha(true));
  }, [pedido.id]);
  useEffect(() => { cargarCompleto(); }, [cargarCompleto]);

  const vigente = !['ANULADO', 'RECHAZADO'].includes(pedido.estado);
  const indice = PASOS.findIndex((x) => x.id === paso);

  const pestanas = [
    { id: 'pedido', etiqueta: PASOS[0].etiqueta, contenido: (
      <>
        <SeccionPedido p={pedido} extra={false} />
        {extras.map((e) => <SeccionPedido key={e.id} p={e} extra />)}
        <p className="dpm-ayuda">Los productos que ya se enviaron a cocina solo los edita Caja o Admin.</p>
      </>
    ) },
    { id: 'cliente', etiqueta: PASOS[1].etiqueta, contenido: (
      <>
        <FormCliente pedido={pedido} completo={completo} sinFicha={sinFicha} editable={vigente && tiene('pedidos/corregir_cliente')} alGuardado={() => { cargarCompleto(); alCambio(); }} />
        <section className="dpm-sec" aria-label="Forma de pago">
          <h3 className="dpm-h">Forma de pago</h3>
          <PagoDe p={pedido} completo={completo} permitido={tiene('pedidos/ajustar_pago')} alExito={() => { cargarCompleto(); alCambio(); }} />
          {vouchers}
        </section>
        {/* Cada extra tiene su propio plan de pago: también se cambia desde aquí */}
        {extras.filter((e) => !['ANULADO', 'RECHAZADO'].includes(e.estado)).map((e) => (
          <section key={e.id} className="dpm-sec" aria-label={`Forma de pago del extra ${e.codigo}`} data-testid="dpm-pago-extra">
            <h3 className="dpm-h">Pago del extra {e.codigo}</h3>
            <PagoExtra p={e} permitido={tiene('pedidos/ajustar_pago')} alCambio={alCambio} />
          </section>
        ))}
      </>
    ) },
    { id: 'estado', etiqueta: PASOS[2].etiqueta, contenido: (
      <>
        <PasoEstado pedido={pedido} completo={completo} />
        <Acciones pedido={pedido} vigente={vigente} alExtra={alExtra} alAnular={alAnular} />
      </>
    ) },
  ];

  return (
    <ModalConPestanas
      titulo={`Pedido ${pedido.codigo}`}
      subtitulo={`${pedido.mesaNombre ?? pedido.modalidad} · ${ESTADO_TXT[pedido.estado] ?? pedido.estado}`}
      pestanas={pestanas}
      pestanaActiva={paso}
      alCambiarPestana={setPaso}
      alCerrar={alCerrar}
      ancho={720}
      pie={
        <>
          <Boton variante="secundario" disabled={indice === 0} onClick={() => setPaso(PASOS[indice - 1].id)}>Anterior</Boton>
          {indice < PASOS.length - 1
            ? <Boton onClick={() => setPaso(PASOS[indice + 1].id)}>Siguiente</Boton>
            : <Boton onClick={alCerrar}>Cerrar</Boton>}
        </>
      }
    />
  );
}

/** Plan de pago de un pedido y su botón «Cambiar método de pago» (el servidor valida que el pedido sea del mozo). */
function PagoDe({ p, completo, permitido, alExito }: { p: MiPedido; completo: Pedido | null; permitido: boolean; alExito: () => void }) {
  return (
    <>
      <p className="dpm-ayuda">
        {p.plan && p.plan.length > 0
          ? p.plan.map((f) => `${f.medio} ${soles(f.monto)}`).join(' · ')
          : p.pagoMetodo ?? 'Sin dato'} · Total {soles(p.total)} · {PAGO[p.pagoEstado ?? ''] ?? (p.pagoEstado || 'Sin dato')}
      </p>
      {completo && <BotonCambiarPago pedido={completo} permitido={permitido} alExito={alExito} />}
    </>
  );
}

function PagoExtra({ p, permitido, alCambio }: { p: MiPedido; permitido: boolean; alCambio: () => void }) {
  const [completo, setCompleto] = useState<Pedido | null>(null);
  const cargar = useCallback(() => { pedidosApi.obtenerPorId(p.id).then(setCompleto).catch(() => setCompleto(null)); }, [p.id]);
  useEffect(() => { cargar(); }, [cargar]);
  return <PagoDe p={p} completo={completo} permitido={permitido} alExito={() => { cargar(); alCambio(); }} />;
}

function FormCliente({ pedido, completo, sinFicha, editable, alGuardado }: {
  pedido: MiPedido; completo: Pedido | null; sinFicha: boolean; editable: boolean; alGuardado: () => void;
}) {
  const esDelivery = pedido.modalidad.toUpperCase() === 'DELIVERY';
  const [nombre, setNombre] = useState(pedido.clienteNombre ?? '');
  const [celular, setCelular] = useState('');
  const [direccion, setDireccion] = useState('');
  const [referencia, setReferencia] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  // Al llegar la ficha completa se prellenan los campos que la lista no trae
  useEffect(() => {
    if (!completo) return;
    setNombre(completo.cliente_nombre ?? pedido.clienteNombre ?? '');
    const tel = completo.cliente_telefono ?? '';
    setCelular(/^9\d{8}$/.test(tel) && tel !== '999999999' ? tel : '');
    setDireccion(completo.entrega_direccion ?? '');
    setReferencia(completo.entrega_referencia ?? '');
  }, [completo, pedido.clienteNombre]);

  const errNombre = nombre.trim().length < 2 ? 'El nombre debe tener al menos 2 letras.' : '';
  const errCel = errorCelular(celular);
  const guardar = async () => {
    setEnviando(true);
    setMsg(null);
    try {
      await pedidosApi.corregirCliente(pedido.id, {
        nombre: nombre.trim(), telefono: celular,
        ...(esDelivery ? { direccion: direccion.trim(), referencia: referencia.trim() } : {}),
      });
      setMsg({ ok: true, t: 'Datos del cliente guardados.' });
      alGuardado();
    } catch (e) {
      setMsg({ ok: false, t: e instanceof Error ? e.message : 'No se pudieron guardar los datos.' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="dpm-sec" aria-label="Datos del cliente">
      <h3 className="dpm-h">Cliente</h3>
      {sinFicha && <p className="dpm-ayuda" role="status">No se pudo traer la ficha completa; escribe el celular para poder guardar.</p>}
      <label className="dpm-campo">Nombre
        <input value={nombre} disabled={!editable} maxLength={120} autoComplete="off" aria-invalid={!!errNombre} onChange={(e) => setNombre(e.target.value)} />
      </label>
      <label className="dpm-campo">Celular / WhatsApp
        <input value={celular} disabled={!editable} inputMode="numeric" maxLength={12} placeholder="9XXXXXXXX" autoComplete="off" aria-invalid={!!errCel}
          onChange={(e) => setCelular(e.target.value.replace(/[\s-]/g, ''))} />
      </label>
      {esDelivery && (
        <>
          <label className="dpm-campo">Dirección
            <input value={direccion} disabled={!editable} maxLength={200} onChange={(e) => setDireccion(e.target.value)} />
          </label>
          <label className="dpm-campo">Referencia
            <input value={referencia} disabled={!editable} maxLength={200} onChange={(e) => setReferencia(e.target.value)} />
          </label>
        </>
      )}
      {editable && (errNombre || errCel) && <p className="dpm-error" role="alert">{errNombre || errCel}</p>}
      {msg && <p className={msg.ok ? 'dpm-ok' : 'dpm-error'} role={msg.ok ? 'status' : 'alert'}>{msg.t}</p>}
      {editable
        ? <Boton disabled={!!errNombre || !!errCel || enviando} cargando={enviando} onClick={guardar}>Guardar datos del cliente</Boton>
        : <p className="dpm-ayuda">No puedes editar los datos de este pedido.</p>}
    </section>
  );
}

function PasoEstado({ pedido, completo }: { pedido: MiPedido; completo: Pedido | null }) {
  const eventos = completo?.eventos ?? [];
  return (
    <>
      <section className="dpm-sec" aria-label="Estado actual">
        <h3 className="dpm-h">Estado actual</h3>
        <p><span className="dpm-chip">{ESTADO_TXT[pedido.estado] ?? pedido.estado}</span> {pedido.progreso?.etiqueta ?? ''}</p>
        {pedido.mozoNombre && <p className="dpm-ayuda">Tomado por {pedido.mozoNombre}</p>}
      </section>
      <section className="dpm-sec" aria-label="Historial">
        <h3 className="dpm-h">Historial</h3>
        {eventos.length === 0 ? (
          <p className="dpm-ayuda">{completo ? 'Sin movimientos registrados.' : 'Historial no disponible.'}</p>
        ) : (
          <ol className="dpm-tiempo">
            {eventos.map((ev) => (
              <li key={ev.id}>
                <strong>{ev.titulo}</strong> <span className="dpm-det">{hora(ev.en)}{ev.por ? ` · ${ev.por}` : ''}</span>
                {ev.detalle && <span className="dpm-det">{ev.detalle}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function Acciones({ pedido, vigente, alExtra, alAnular }: { pedido: MiPedido; vigente: boolean; alExtra: () => void; alAnular: () => void }) {
  const { tiene } = useSesion();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; t: string } | null>(null);
  // Copia del ticket de pago: Caja/Admin/Supervisor cualquier pedido, el mozo solo los suyos (lo valida el servidor)
  const puedeReimprimir = tiene('pedidos/reimprimir_ticket') || tiene('pedidos/cambiar_estado');

  const reimprimir = async () => {
    setEnviando(true);
    try {
      const r = await api.post<ResultadoReimpresionPedido>(`/admin/pedidos/${pedido.id}/ticket/reimprimir`, {});
      setAviso(r.cantidad > 0
        ? { ok: true, t: 'Comprobante enviado a la ticketera.' }
        : { ok: false, t: `No se envió${r.omitidos?.length ? `: ${r.omitidos.map((o) => o.etiqueta).join(', ')}` : '.'}` });
    } catch (e) {
      setAviso({ ok: false, t: e instanceof Error ? e.message : 'No se pudo reimprimir' });
    } finally {
      setEnviando(false);
      setConfirmando(false);
    }
  };

  return (
    <section className="dpm-sec" aria-label="Acciones">
      <h3 className="dpm-h">Acciones</h3>
      <div className="dpm-acciones">
        {puedeReimprimir && <Boton variante="secundario" onClick={() => setConfirmando(true)}>Reimprimir comprobante de pago</Boton>}
        {vigente && tiene('pedidos/extra') && <Boton variante="secundario" onClick={alExtra}>+ Pedido extra</Boton>}
        {vigente && pedido.estado !== 'ENTREGADO' && tiene('pedidos/anular') && <Boton variante="peligro" onClick={alAnular}>Anular pedido</Boton>}
      </div>
      {aviso && <p className={aviso.ok ? 'dpm-ok' : 'dpm-error'} role={aviso.ok ? 'status' : 'alert'}>{aviso.t}</p>}
      <Confirmar
        abierto={confirmando}
        titulo="Reimprimir comprobante de pago"
        mensaje={`Se reimprimirá el ticket de pago del pedido ${pedido.codigo}.`}
        textoSi="Sí, reimprimir"
        textoNo="No"
        cargando={enviando}
        alConfirmar={reimprimir}
        alCancelar={() => setConfirmando(false)}
      />
    </section>
  );
}
