import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../comun/api';
import { tvFetch, llaveRevocada } from '../tv/tvApi';
import type { AccesoTv } from '../tv/PuertaTv';
import { formatearTranscurrido, registrarHoraServidor, useTiempoEnVivo } from '../admin/cocina/tiempoEnVivo';
import type { UmbralesCocina } from '../admin/cocina/cocinaTipos';
import {
  ETAPAS,
  ETIQUETA_ETAPA,
  PAGINA_SEG,
  POR_PAGINA,
  colorEspera,
  columnasPara,
  detalleTexto,
  estadoArea,
  ordenar,
  paginar,
  textoModalidad,
  textoPago,
  type PedidoPantalla,
  type RespuestaPantalla,
} from './logica';
import './pantalla-local.css';

const SONDEO_MS = 5000;
const CONTROLES_MS = 4000;
const UMBRALES: UmbralesCocina = { naranjaMin: 35, rojoMin: 50 };

const formatoHora = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false });

/** Tiempo transcurrido: corre en vivo mientras espera; al quedar listo o anulado se queda en lo que esperó. */
function Tiempo({ p, umbrales }: { p: PedidoPantalla; umbrales: UmbralesCocina }) {
  const vivo = useTiempoEnVivo(p.esperaDesde, p.minutos, umbrales);
  const detenido = p.fin ? Math.max(0, Math.floor((Date.parse(p.fin) - Date.parse(p.esperaDesde)) / 1000)) : null;
  const texto = detenido !== null ? formatearTranscurrido(detenido) : vivo.texto;
  const minutos = detenido !== null ? Math.floor(detenido / 60) : vivo.minutos;
  const color = colorEspera(p, minutos, umbrales);
  return (
    <div className="pl-tiempo" data-testid="tiempo" data-color={color}>
      <small>{p.etapa === 'LISTO' ? 'Esperó' : p.etapa === 'ANULADO' ? 'Duró' : 'Esperando'}</small>
      <b>{texto}</b>
    </div>
  );
}

export function Tarjeta({ p, umbrales = UMBRALES }: { p: PedidoPantalla; umbrales?: UmbralesCocina }) {
  const [pref, ...resto] = p.codigo.split('-');
  const actual = ETAPAS.indexOf(p.etapa);
  return (
    <article className="pl-tarjeta" data-etapa={p.etapa} data-testid={`pedido-${p.codigo}`}>
      {p.etapa === 'ANULADO' && <div className="pl-sello" data-testid="sello-anulado">ANULADO</div>}
      <header className="pl-cab">
        <div className="pl-cod" data-testid="codigo">
          {resto.length ? <small>{pref}-</small> : null}
          {resto.length ? resto.join('-') : p.codigo}
        </div>
        <Tiempo p={p} umbrales={umbrales} />
      </header>

      <div className="pl-quien">
        {p.avatarUrl ? <img className="pl-avatar" src={p.avatarUrl} alt="" width={48} height={48} /> : null}
        <span className="pl-nombre" data-testid="nombre">{p.nombre ?? 'Cliente'}</span>
        <span className="pl-modalidad" data-testid="modalidad" data-modalidad={p.modalidad}>{textoModalidad(p)}</span>
      </div>
      {p.extraDe ? <div className="pl-extra">Extra de {p.extraDe}</div> : null}

      <ol className="pl-pasos" aria-label="Avance del pedido" data-testid="pasos">
        {ETAPAS.map((e, i) => (
          <li key={e} data-hecho={p.etapa !== 'ANULADO' && i < actual} data-actual={p.etapa === e}>
            {ETIQUETA_ETAPA[e]}
          </li>
        ))}
      </ol>

      <div className="pl-areas" data-testid="areas" aria-label="Estado por área">
        {p.areas.map((a) => {
          const e = estadoArea(a, p.etapa);
          return (
            <span key={a.areaId} className="pl-area" data-listo={e.listo} data-testid={`area-${a.areaId}`}>
              {a.areaNombre} <b aria-hidden="true">{e.marca}</b> {e.texto}
            </span>
          );
        })}
      </div>

      <div className="pl-lineas" data-testid="lineas">
        {p.areas.map((a) =>
          a.lineas.map((l) => (
            <div key={`${a.areaId}-${l.id}`} className="pl-linea" data-testid="linea">
              <b className="pl-cant">{l.cantidad}×</b>
              <div>
                <span className="pl-prod">{l.nombre}</span>
                {l.paraLlevar ? <em className="pl-llevar">PARA LLEVAR</em> : null}
                {detalleTexto(l) ? <span className="pl-det">{detalleTexto(l)}</span> : null}
                {l.nota ? <span className="pl-nota-linea">Nota: {l.nota}</span> : null}
              </div>
            </div>
          )),
        )}
        {p.nota ? <div className="pl-nota" data-testid="nota">Nota: {p.nota}</div> : null}
      </div>

      <footer className="pl-pie" data-pago={p.pago.estado}>
        <span data-testid="pago" className="pl-pago">{textoPago(p.pago)}</span>
        <span className="pl-total">S/ {p.pago.total.toFixed(2)}</span>
      </footer>
    </article>
  );
}

/** Pantalla de TV del local (solo pedidos): ruta /pantalla-local, protegida con el código de vinculación o la sesión. */
export function PantallaLocal({ acceso }: { acceso?: AccesoTv }) {
  const llave = acceso?.llave ?? null;
  const revocada = useRef(acceso?.revocada);
  revocada.current = acceso?.revocada;

  const [datos, setDatos] = useState<RespuestaPantalla | null>(null);
  const [sinConexion, setSinConexion] = useState(false);
  const [reloj, setReloj] = useState(() => Date.now());
  const [pagina, setPagina] = useState(0);
  const [controles, setControles] = useState(true);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);

  const leer = useCallback(async () => {
    try {
      const r = llave ? await tvFetch<RespuestaPantalla>('/carta/tv/pedidos-local', llave) : await api.get<RespuestaPantalla>('/admin/pantalla-local/pedidos');
      registrarHoraServidor(r.ahora);
      setDatos(r);
      setSinConexion(false);
    } catch (e) {
      if (llave && llaveRevocada(e)) revocada.current?.();
      setSinConexion(true);
    }
  }, [llave]);

  useEffect(() => {
    void leer();
    const id = setInterval(() => void leer(), SONDEO_MS);
    return () => clearInterval(id);
  }, [leer]);

  useEffect(() => {
    const id = setInterval(() => setReloj(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const paginas = useMemo(() => paginar(ordenar(datos?.pedidos ?? []), POR_PAGINA), [datos]);
  const total = datos?.pedidos.length ?? 0;
  const actual = Math.min(pagina, paginas.length - 1);

  // Carrusel suave: con más pedidos de los que caben, pasa de página cada PAGINA_SEG segundos
  useEffect(() => {
    if (paginas.length <= 1) {
      setPagina(0);
      return;
    }
    const id = setInterval(() => setPagina((x) => (x + 1) % paginas.length), PAGINA_SEG * 1000);
    return () => clearInterval(id);
  }, [paginas.length]);

  // Controles que se esconden solos
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const mostrar = () => {
      setControles(true);
      clearTimeout(id);
      id = setTimeout(() => setControles(false), CONTROLES_MS);
    };
    mostrar();
    const eventos = ['mousemove', 'touchstart', 'keydown', 'click'] as const;
    eventos.forEach((e) => window.addEventListener(e, mostrar));
    return () => {
      clearTimeout(id);
      eventos.forEach((e) => window.removeEventListener(e, mostrar));
    };
  }, []);

  useEffect(() => {
    const cambio = () => setPantallaCompleta(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', cambio);
    return () => document.removeEventListener('fullscreenchange', cambio);
  }, []);

  useEffect(() => {
    document.title = 'Caprichos - Pedidos del local';
  }, []);

  const alternarPantallaCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.();
  };

  const visibles = paginas[actual];
  return (
    <div className={`pl-raiz ${controles ? '' : 'inactivo'}`} data-testid="pantalla-local">
      <header className="pl-barra">
        <div className="pl-marca">
          <span className="pl-logo">
            Caprichos<b>.</b>
          </span>
          <span className="pl-sub">Pedidos del local</span>
        </div>
        <div className="pl-estado">
          <span className="pl-cuenta">{total ? `${total} ${total === 1 ? 'pedido' : 'pedidos'}` : ''}</span>
          {sinConexion ? <span className="pl-sin">Sin conexión, reintentando</span> : <span className="pl-vivo"><i />En vivo</span>}
          <time aria-label="Hora de Lima">{formatoHora.format(reloj)}</time>
        </div>
      </header>

      <main className="pl-cuerpo">
        {total === 0 ? (
          <p className="pl-vacio" data-testid="sin-pedidos">{datos ? 'No hay pedidos en este momento' : 'Cargando pedidos...'}</p>
        ) : (
          <section className="pl-grilla" data-testid="grilla" style={{ gridTemplateColumns: `repeat(${columnasPara(visibles.length)}, minmax(0, 1fr))` }}>
            {visibles.map((p) => (
              <Tarjeta key={p.codigo} p={p} umbrales={datos?.umbrales ?? UMBRALES} />
            ))}
          </section>
        )}
      </main>

      {paginas.length > 1 ? (
        <footer className="pl-paginas" data-testid="paginas" aria-label={`Página ${actual + 1} de ${paginas.length}`}>
          {paginas.map((_, i) => (
            <i key={i} data-activa={i === actual} />
          ))}
          <span>Página {actual + 1} de {paginas.length}</span>
        </footer>
      ) : null}

      <div className={`pl-controles ${controles ? 'ver' : ''}`} role="toolbar" aria-label="Controles de la pantalla">
        <button type="button" onClick={alternarPantallaCompleta}>
          {pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
        </button>
      </div>
    </div>
  );
}

export default PantallaLocal;
