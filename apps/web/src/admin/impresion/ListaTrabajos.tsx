import { useMemo, useState } from 'react';
import { rolDeTrabajo } from '@caprichos/compartido';
import { Confirmar } from '../../comun/Confirmar';
import { NOMBRE_PIEZA_TRABAJO, estadoDeTrabajo, motivoDeTrabajo } from './facil/logicaFacil';
import type { RespuestaReimpresion, TrabajoImpresionAdmin } from './impresionApi';
import './lista-trabajos.css';

export type PestanaMaquina = 'TODO' | 'ETIQUETERA' | 'TICKETERA';
export type CuerpoReimpresion = { ids?: string[]; grupo?: 'STICKERS_FALLIDOS' | 'TICKETS_FALLIDOS' };

const PESTANAS: Array<[PestanaMaquina, string]> = [
  ['TODO', 'Todo'],
  ['ETIQUETERA', 'Stickers (etiquetera)'],
  ['TICKETERA', 'Tickets (térmica)'],
];

export const maquinaDe = (t: Pick<TrabajoImpresionAdmin, 'tipo' | 'maquina'>) => t.maquina ?? rolDeTrabajo(t.tipo);

/** Etiqueta de TEXTO de la fila: «STICKER · Bebida», «TICKET · Comanda salón», «PRUEBA · Sticker». */
export function etiquetaDeTrabajo(t: Pick<TrabajoImpresionAdmin, 'tipo' | 'pedidoId' | 'payload' | 'maquina'>): string {
  const sticker = maquinaDe(t) === 'ETIQUETERA';
  if (!t.pedidoId) return `PRUEBA · ${sticker ? 'Sticker' : 'Ticket'}`;
  const area = String(t.payload?.areaNombre ?? '').trim();
  const queda: Record<string, string> = {
    ETIQUETA_BEBIDA: 'Bebida',
    ETIQUETA_AREA: area ? `Área ${area}` : 'Área',
    ETIQUETA_GENERAL: 'General',
    TICKET_PAGO: 'Pago',
    TICKET_COMANDA_SALON: 'Comanda salón',
    TICKET_COMANDA_AREA: area ? `Comanda ${area}` : 'Comanda área',
  };
  return `${sticker ? 'STICKER' : 'TICKET'} · ${queda[t.tipo] ?? 'Papel'}`;
}

/** Hora; con fecha si no es de hoy. */
export function horaDeTrabajo(iso: string, ahora = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === ahora.toDateString() ? hora : `${d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })} ${hora}`;
}

const REIMPRIMIBLES = ['IMPRESO', 'FALLIDO', 'VENCIDO', 'DESCARTADO'];
const FALLIDOS = ['FALLIDO', 'VENCIDO'];

interface Accion {
  titulo: string;
  mensaje: string;
  cuerpo: CuerpoReimpresion;
}

interface Props {
  trabajos: TrabajoImpresionAdmin[];
  pestana: PestanaMaquina;
  alCambiarPestana: (p: PestanaMaquina) => void;
  /** Contadores de las pestañas; si falta se cuentan los trabajos recibidos. */
  conteo?: { stickers: number; tickets: number };
  /** true si la lista ya viene filtrada por pestaña (el servidor); si no, se filtra aquí. */
  filtradaPorServidor?: boolean;
  puedeReimprimir: boolean;
  puedeReintentar?: boolean;
  alReimprimir: (cuerpo: CuerpoReimpresion) => Promise<RespuestaReimpresion>;
  alReintentar?: (t: TrabajoImpresionAdmin) => void;
  /** Si la PC del trabajo tiene el programa abierto (motivo de lo que espera). */
  pcConectada?: (t: TrabajoImpresionAdmin) => boolean | null;
  testIdLista?: string;
  vacio?: string;
}

/**
 * Trabajos de impresión separados por máquina (stickers / tickets), con Reimprimir por fila, por selección
 * y por grupo de fallidos. «Reintentar» = el mismo papel que no salió; «Reimprimir» = copia de uno ya hecho.
 */
export function ListaTrabajos(p: Props) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [accion, setAccion] = useState<Accion | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  const visibles = useMemo(
    () => (p.filtradaPorServidor || p.pestana === 'TODO' ? p.trabajos : p.trabajos.filter((t) => maquinaDe(t) === p.pestana)),
    [p.trabajos, p.pestana, p.filtradaPorServidor],
  );
  const stickers = p.conteo?.stickers ?? p.trabajos.filter((t) => maquinaDe(t) === 'ETIQUETERA').length;
  const tickets = p.conteo?.tickets ?? p.trabajos.filter((t) => maquinaDe(t) === 'TICKETERA').length;
  const cuenta: Record<PestanaMaquina, number> = { TODO: stickers + tickets, ETIQUETERA: stickers, TICKETERA: tickets };
  const fallidos = (m: 'ETIQUETERA' | 'TICKETERA') => p.trabajos.filter((t) => maquinaDe(t) === m && FALLIDOS.includes(t.estado)).length;
  const selec = visibles.filter((t) => marcados.has(t.id) && REIMPRIMIBLES.includes(t.estado));

  const alternar = (id: string) =>
    setMarcados((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const frase = (t: TrabajoImpresionAdmin) =>
    `${(NOMBRE_PIEZA_TRABAJO[t.tipo] ?? 'papel').toLowerCase()}${t.pedidoCodigo ? ` del pedido ${t.pedidoCodigo}` : ''} en ${t.equipoNombre ?? 'su computadora'}`;

  const porFila = (t: TrabajoImpresionAdmin) =>
    setAccion({ titulo: '¿Reimprimir este papel?', mensaje: `Se imprimirá otra copia del ${frase(t)}.`, cuerpo: { ids: [t.id] } });

  const porGrupo = (m: 'ETIQUETERA' | 'TICKETERA') => {
    const que = m === 'ETIQUETERA' ? 'stickers' : 'tickets';
    setAccion({
      titulo: `¿Reimprimir los ${que} fallidos?`,
      mensaje: `Se imprimirá otra copia de ${fallidos(m)} ${que} que fallaron o vencieron (hasta 30 a la vez), cada uno en su máquina.`,
      cuerpo: { grupo: m === 'ETIQUETERA' ? 'STICKERS_FALLIDOS' : 'TICKETS_FALLIDOS' },
    });
  };

  const confirmar = async () => {
    if (!accion || ocupado) return;
    setOcupado(true);
    try {
      const r = await p.alReimprimir(accion.cuerpo);
      setResultado({ ok: r.ok, texto: r.mensaje });
      if (r.ok) setMarcados(new Set());
    } catch (e: any) {
      setResultado({ ok: false, texto: e?.message || 'No se pudo reimprimir.' });
    } finally {
      setOcupado(false);
      setAccion(null);
    }
  };

  return (
    <div className="lt-raiz">
      <div role="tablist" aria-label="Máquina" className="lt-pestanas">
        {PESTANAS.map(([id, texto]) => (
          <button key={id} type="button" role="tab" aria-selected={p.pestana === id} className="lt-pestana" onClick={() => p.alCambiarPestana(id)}>
            {texto} <span className="lt-cuenta" data-testid={`cuenta-${id}`}>{cuenta[id]}</span>
          </button>
        ))}
      </div>
      <p className="lt-ayuda">
        <b>Reintentar</b> vuelve a mandar el mismo papel que no salió. <b>Reimprimir</b> saca una copia nueva de uno que ya salió (o falló), sin tocar el original.
      </p>

      {p.puedeReimprimir && (
        <div className="lt-barra">
          {(['ETIQUETERA', 'TICKETERA'] as const).map((m) =>
            fallidos(m) > 0 ? (
              <button key={m} type="button" className="lt-btn" disabled={ocupado} onClick={() => porGrupo(m)}>
                Reimprimir todos los {m === 'ETIQUETERA' ? 'stickers' : 'tickets'} fallidos ({fallidos(m)})
              </button>
            ) : null,
          )}
          {selec.length > 0 && (
            <button
              type="button"
              className="lt-btn lt-btn--fuerte"
              disabled={ocupado}
              onClick={() =>
                setAccion({
                  titulo: '¿Reimprimir lo seleccionado?',
                  mensaje: `Se imprimirá otra copia de ${selec.length} papel(es), cada uno en su máquina.`,
                  cuerpo: { ids: selec.map((t) => t.id) },
                })
              }
            >
              Reimprimir seleccionados ({selec.length})
            </button>
          )}
        </div>
      )}
      {resultado && (
        <div role={resultado.ok ? 'status' : 'alert'} className={`lt-aviso ${resultado.ok ? 'lt-aviso--ok' : 'lt-aviso--mal'}`}>
          {resultado.texto}
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="lt-vacio" data-testid={p.testIdLista}>{p.vacio ?? 'No hay papeles aquí.'}</p>
      ) : (
        <ul className="lt-lista" data-testid={p.testIdLista}>
          {visibles.map((t) => {
            const est = estadoDeTrabajo(t.estado);
            const motivo = motivoDeTrabajo(t, p.pcConectada ? p.pcConectada(t) : null);
            const sticker = maquinaDe(t) === 'ETIQUETERA';
            const reimprimible = p.puedeReimprimir && REIMPRIMIBLES.includes(t.estado);
            return (
              <li key={t.id} className="lt-fila" data-testid={`trabajo-${t.id}`}>
                <div className="lt-fila-cab">
                  {reimprimible && (
                    <label className="lt-check">
                      <input type="checkbox" checked={marcados.has(t.id)} onChange={() => alternar(t.id)} aria-label={`Seleccionar ${etiquetaDeTrabajo(t)} ${t.pedidoCodigo}`} />
                    </label>
                  )}
                  <strong className={`lt-tag ${sticker ? 'lt-tag--sticker' : 'lt-tag--ticket'}`}>{etiquetaDeTrabajo(t)}</strong>
                  {t.copia && <span className="lt-copia">COPIA</span>}
                  <span className={`lt-estado lt-estado--${est.id}`}>{est.texto}</span>
                </div>
                <div className="lt-datos">
                  <span>{t.pedidoCodigo ? `Pedido ${t.pedidoCodigo}` : 'Sin pedido'}</span>
                  <span>{horaDeTrabajo(t.impresoEn ?? t.en)}</span>
                  <span>en {t.equipoNombre ?? 'su computadora'}</span>
                </div>
                {motivo && <div className="lt-motivo">{motivo}</div>}
                <div className="lt-acc">
                  {p.puedeReintentar && FALLIDOS.includes(t.estado) && p.alReintentar && (
                    <button type="button" className="lt-btn" onClick={() => p.alReintentar!(t)}>Reintentar</button>
                  )}
                  {reimprimible && (
                    <button type="button" className="lt-btn" disabled={ocupado} onClick={() => porFila(t)}>Reimprimir</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Confirmar
        abierto={!!accion}
        titulo={accion?.titulo}
        mensaje={accion?.mensaje}
        textoSi="Sí, reimprimir"
        textoNo="No"
        cargando={ocupado}
        alCancelar={() => setAccion(null)}
        alConfirmar={() => void confirmar()}
      />
    </div>
  );
}
