import type { ResumenMesero } from './escena3d/director';
import { TEMAS } from './escena3d/temas';
import { areaDeEtiqueta } from './escena3d/planoAEscena';
import type { MesaVivo, PedidoVivo, PisoVivo, SalonVivo } from './salonVivoApi';
import type { Movimiento } from './useSalonVivo';

/** Panel de la derecha (fondo hueso, tarjetas blancas) con los datos reales del salón. */
export type PestanaPanel = 'pedidos' | 'mesas' | 'tema';

const ETIQUETA_ESTADO: Record<MesaVivo['estado'], string> = {
  LIBRE: 'Libre', ESPERANDO: 'Esperando pedido', COMIENDO: 'Comiendo', POR_COBRAR: 'Pide la cuenta', RESERVADA: 'Reservada',
};
const CLASE_ESTADO: Record<MesaVivo['estado'], string> = {
  LIBRE: 'libre', ESPERANDO: 'esperando', COMIENDO: 'comiendo', POR_COBRAR: 'cuenta', RESERVADA: 'reservada',
};

const Demora = ({ min }: { min: number }) => <span className={`sv-demora ${min >= 15 ? 'alerta' : ''}`}>⏱ {min} min</span>;
const Etiqueta = ({ p }: { p: PedidoVivo }) =>
  p.modalidad === 'MESA' ? <span className="sv-tag mesa">{p.mesas[0] || 'Mesa'}</span> : p.modalidad === 'DELIVERY' ? <span className="sv-tag delivery">Delivery</span> : <span className="sv-tag llevar">Para llevar</span>;
const Codigo = ({ c }: { c: string }) => <span className="sv-cod"><small>{c.slice(0, 3)}</small>{c.slice(3)}</span>;
const Items = ({ p }: { p: PedidoVivo }) => <div className="sv-items">{p.items.join(' · ')}{p.productos > p.items.length ? ' · …' : ''}</div>;

function Seccion({ titulo, n, punto, interno, children }: { titulo: string; n?: number | string; punto?: string; interno?: boolean; children: React.ReactNode }) {
  return (
    <section className="sv-seccion" {...(interno ? { 'data-interno': true } : {})}>
      <h2><span>{punto && <span className="sv-punto" style={{ background: punto }} />}{titulo}</span>{n !== undefined && <em>{n}</em>}</h2>
      {children}
    </section>
  );
}

export interface PropsPanel {
  datos: SalonVivo;
  piso: PisoVivo | undefined;
  bitacora: Movimiento[];
  meseros: ResumenMesero[];
  reloj: string;
  interna: boolean;
  onVista: (interna: boolean) => void;
  pestana: PestanaPanel;
  onPestana: (p: PestanaPanel) => void;
  tema: string;
  onTema: (clave: string) => void;
  hora: 'auto' | 'dia' | 'tarde' | 'noche';
  horaTxt: string;
  onHora: (h: 'auto' | 'dia' | 'tarde' | 'noche') => void;
  /** Sin 3D (equipo sin WebGL): no hay temática ni meseros que mostrar */
  sin3d?: boolean;
}

export function PanelVivo(p: PropsPanel) {
  const { datos: d } = p;
  const mesasPiso = p.piso ? d.mesas.filter((m) => m.pisoId === p.piso!.id) : d.mesas;
  // Áreas de cocina del plano (sin Despacho ni Lavadero); si el plano no trae, las que reporta la cocina
  const areasPlano = (p.piso?.elementos ?? [])
    .filter((e) => e.tipo === 'COCINA' && e.activo)
    .map((e) => ({ nombre: (e.nombre ?? '').trim(), ...areaDeEtiqueta(e.nombre ?? '') }))
    .filter((a) => a.nombre && a.area !== 'LAVADERO' && a.area !== 'DESPACHO');
  const carga = new Map(d.cargaCocina.map((c) => [areaDeEtiqueta(c.area).clave, c.pendientes]));
  const filasCarga = areasPlano.length
    ? areasPlano.map((a) => ({ nombre: a.nombre.charAt(0) + a.nombre.slice(1).toLowerCase(), n: carga.get(a.clave) ?? 0 }))
    : d.cargaCocina.map((c) => ({ nombre: c.area, n: c.pendientes }));
  const max = Math.max(0, ...filasCarga.map((f) => f.n));

  return (
    <aside className={`sv-panel ${p.interna ? '' : 'publica'}`} aria-label="Pedidos y mesas">
      <div className="sv-panel-cab">
        <h1>Salón en vivo</h1>
        <div className="sv-vistas" role="group" aria-label="Tipo de vista">
          <button type="button" className="sv-vista" aria-pressed={p.interna} onClick={() => p.onVista(true)}>Interna</button>
          <button type="button" className="sv-vista" aria-pressed={!p.interna} onClick={() => p.onVista(false)}>Pública</button>
        </div>
        <time className="sv-reloj">{p.reloj}</time>
      </div>
      <div className="sv-kpis">
        <div className="sv-kpi"><b>{d.conteos.mesasOcupadas}/{d.conteos.mesasTotal}</b><span>Mesas</span></div>
        <div className="sv-kpi"><b>{d.conteos.personas}</b><span>Personas</span></div>
        <div className="sv-kpi"><b>{d.cocina.length}</b><span>En cocina</span></div>
        <div className="sv-kpi"><b>{d.despacho.length}</b><span>Listos</span></div>
      </div>
      <div className="sv-pestanas" role="tablist">
        {([['pedidos', 'Pedidos'], ['mesas', 'Mesas'], ...(p.sin3d ? [] : [['tema', 'Temática']])] as Array<[PestanaPanel, string]>).map(([k, t]) => (
          <button key={k} type="button" role="tab" id={`sv-p-${k}`} aria-controls={`sv-t-${k}`} aria-selected={p.pestana === k} className="sv-pestana" onClick={() => p.onPestana(k)}>{t}</button>
        ))}
      </div>
      <div className="sv-cuerpo">
        {p.pestana === 'pedidos' && (
          <div id="sv-t-pedidos" role="tabpanel" aria-labelledby="sv-p-pedidos">
            {p.meseros.length > 0 && (
              <Seccion titulo="Meseros" punto="var(--sv-naranja)" n={`${p.meseros.filter((m) => m.ocupado).length}/${p.meseros.length} ocupados`}>
                <div className="sv-meseros">
                  {p.meseros.map((m) => (
                    <div key={m.nombre} className={`sv-mesero ${m.ocupado ? 'ocupado' : ''}`}>
                      <i className={m.esCapri ? 'capri' : ''}>{m.esCapri ? 'C' : m.nombre.split(' ')[1]?.[0] ?? m.nombre[0]}</i><b>{m.nombre}</b><span>{m.texto}</span>
                    </div>
                  ))}
                </div>
              </Seccion>
            )}
            <Seccion titulo="Carga de cocina" punto="var(--sv-oro)">
              <div className="sv-cargas">
                {filasCarga.length === 0 && <p className="sv-vacio">Cocina libre</p>}
                {filasCarga.map((f) => (
                  <div key={f.nombre} className={`sv-carga ${f.n && f.n === max ? 'top' : ''}`}>
                    <b>{f.nombre}</b><div className="sv-barra"><i style={{ width: `${Math.min(100, f.n * 25)}%` }} /></div>
                    <span>{f.n ? `${f.n} en prep.${f.n === max ? ' · más cargada' : ''}` : 'Libre'}</span>
                  </div>
                ))}
              </div>
            </Seccion>
            <Seccion titulo="En caja" n={d.caja.length} punto="var(--sv-crema-2)">
              <div className="sv-lista" aria-label="Pedidos por cobrar">
                {d.caja.length === 0 && <p className="sv-vacio">Nadie esperando en caja</p>}
                {d.caja.map((x) => (
                  <div key={x.id} className="sv-ped"><Codigo c={x.codigo} /><span className="sv-quien">{x.cliente ?? '—'}</span><Etiqueta p={x} />
                    <div className="sv-items">Por cobrar · {x.productos} {x.productos === 1 ? 'producto' : 'productos'} <Demora min={x.minutos} /></div></div>
                ))}
              </div>
            </Seccion>
            <Seccion titulo="En cocina" n={d.cocina.length} punto="var(--sv-naranja)">
              <div className="sv-lista" aria-label="Pedidos en cocina">
                {d.cocina.length === 0 && <p className="sv-vacio">Cocina libre</p>}
                {d.cocina.map((x) => (
                  <div key={x.id} className="sv-ped"><Codigo c={x.codigo} /><span className="sv-quien">{x.cliente ?? '—'}</span><Etiqueta p={x} />
                    <div className="sv-areas">{x.areas.map((a) => <span key={a.nombre} className={`sv-area ${a.estado === 'LISTA' ? 'ok' : 'prep'}`}>{a.nombre}</span>)}<Demora min={x.minutos} /></div>
                    <Items p={x} /></div>
                ))}
              </div>
            </Seccion>
            <Seccion titulo="Despacho · todo listo" n={d.despacho.length} punto="var(--sv-verde)">
              <div className="sv-lista" aria-label="Pedidos listos en despacho">
                {d.despacho.length === 0 && <p className="sv-vacio">Nada en despacho</p>}
                {d.despacho.map((x) => (
                  <div key={x.id} className="sv-ped listo"><Codigo c={x.codigo} /><span className="sv-quien">{x.cliente ?? '—'}</span><Etiqueta p={x} />
                    <div className="sv-items">Todo listo · esperando mesero <Demora min={x.minutos} /></div></div>
                ))}
              </div>
            </Seccion>
            <Seccion titulo="Del día" n="Vista interna" interno>
              <div className="sv-datos">
                <div className="sv-dato"><b>{d.conteos.pedidosHoy}</b><span>Pedidos del día</span></div>
                <div className="sv-dato"><b>{d.conteos.entregadosHoy}</b><span>Entregados</span></div>
                <div className="sv-dato"><b>{d.conteos.deliveryEntregadosHoy}</b><span>Delivery entregados</span></div>
                <div className="sv-dato"><b>{d.conteos.minutosCocinaPromedio ?? '—'}{d.conteos.minutosCocinaPromedio ? ' min' : ''}</b><span>Cocina, en promedio</span></div>
                <div className="sv-dato"><b>{d.cajaAbierta ? 'Abierta' : 'Cerrada'}</b><span>Caja del día</span></div>
              </div>
            </Seccion>
            <Seccion titulo="En reparto 🛵" n={d.enReparto.length} punto="var(--sv-crema)">
              <div className="sv-lista" aria-label="Pedidos en reparto">
                {d.enReparto.length === 0 && <p className="sv-vacio">Ningún delivery en camino</p>}
                {d.enReparto.map((x) => (
                  <div key={x.id} className="sv-ped"><Codigo c={x.codigo} /><span className="sv-quien">{x.cliente ?? '—'}</span><Etiqueta p={x} />
                    <div className="sv-items">En camino · <Demora min={x.minutos} /></div></div>
                ))}
              </div>
            </Seccion>
            <Seccion titulo="Últimos movimientos">
              <div className="sv-bitacora">
                {p.bitacora.length === 0 && <p className="sv-vacio">Aquí irán apareciendo los cambios</p>}
                {p.bitacora.map((b, i) => <div key={`${b.hora}-${i}`}><time>{b.hora}</time>{b.texto}</div>)}
              </div>
            </Seccion>
          </div>
        )}
        {p.pestana === 'mesas' && (
          <div id="sv-t-mesas" role="tabpanel" aria-labelledby="sv-p-mesas">
            <Seccion titulo="Reservas" n={d.reservas.length} punto="#6B4E9B">
              <div className="sv-lista" aria-label="Reservas próximas">
                {d.reservas.length === 0 && <p className="sv-vacio">Sin reservas próximas</p>}
                {d.reservas.map((r, i) => (
                  <div key={`${r.hora}-${i}`} className="sv-ped"><span className="sv-cod" style={{ fontSize: 14 }}>{r.hora}</span><span className="sv-quien">{r.nombre}</span><span className="sv-tag reserva">{r.mesas.join(', ') || 'Sin mesa'}</span>
                    <div className="sv-items">{r.personas} pers.</div></div>
                ))}
              </div>
            </Seccion>
            <Seccion titulo={p.piso ? `Mesas del ${p.piso.nombre}` : 'Mesas'} n={`${mesasPiso.filter((m) => m.pedido).length}/${mesasPiso.length} ocupadas`}>
              <div className="sv-mesas">
                {[...mesasPiso].sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0)).map((m) => (
                  <div key={m.id} className={`sv-mesa ${CLASE_ESTADO[m.estado]}`}>
                    <b>{m.nombre}</b>
                    <p>{m.pedido ? `${m.pedido.personas ?? '?'}/${m.asientos} pers. · ${m.pedido.codigo}` : `${m.asientos} pers.`}</p>
                    <p>{m.estado === 'RESERVADA' && m.reserva ? `Reservada ${m.reserva.hora}` : ETIQUETA_ESTADO[m.estado]}{m.pedido && m.estado === 'ESPERANDO' && m.pedido.areasPendientes.length ? ` · falta ${m.pedido.areasPendientes.join(', ')}` : ''}</p>
                    <div className="sv-ocup">{Array.from({ length: m.asientos }, (_, i) => <i key={i} className={m.pedido && i < (m.pedido.personas ?? Math.min(2, m.asientos)) ? 'si' : ''} />)}</div>
                  </div>
                ))}
              </div>
              <div className="sv-leyenda">
                {([['libre', 'Libre'], ['esperando', 'Esperando pedido'], ['comiendo', 'Comiendo'], ['cuenta', 'Pide la cuenta'], ['reservada', 'Reservada']] as const).map(([c, t]) => <span key={c}><span className={`sv-punto ${c}`} />{t}</span>)}
              </div>
            </Seccion>
          </div>
        )}
        {p.pestana === 'tema' && !p.sin3d && (
          <div id="sv-t-tema" role="tabpanel" aria-labelledby="sv-p-tema">
            <Seccion titulo="Hora del día" n={p.horaTxt}>
              <div className="sv-horas">
                {([['auto', 'Automática'], ['dia', 'Día'], ['tarde', 'Atardecer'], ['noche', 'Noche']] as const).map(([k, t]) => (
                  <button key={k} type="button" className="sv-tema-hora" aria-pressed={p.hora === k} onClick={() => p.onHora(k)}>{t}</button>
                ))}
              </div>
              <p className="sv-nota">Automática usa la hora de Lima: de noche se encienden las luces del local y el letrero.</p>
            </Seccion>
            <Seccion titulo="Temática del local">
              <div className="sv-temas">
                {Object.entries(TEMAS).map(([k, t]) => (
                  <button key={k} type="button" className="sv-tema" aria-pressed={p.tema === k} onClick={() => p.onTema(k)}>
                    <div className="mues">{t.mues.map((c, i) => <i key={i} style={{ background: c }} />)}</div><b>{t.nombre}</b><span>{t.desc}</span>
                  </button>
                ))}
              </div>
              <p className="sv-nota">La temática cambia la decoración del salón, el gorro y el accesorio de Capri, las luces y lo que cae del techo. Solo se ve en esta pantalla; los colores de Caprichos no cambian.</p>
            </Seccion>
          </div>
        )}
      </div>
    </aside>
  );
}
