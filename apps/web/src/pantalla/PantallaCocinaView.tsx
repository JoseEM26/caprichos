import { useCallback, useEffect, useState } from 'react';
import type { AreaCocina, Comanda } from '../admin/cocina/cocinaTipos';
import {
  listarAreasCocina,
  listarComandasArea,
} from '../admin/cocina/cocinaApi';
import { conectarSocket, useEventos } from '../comun/socket';
import { textoSabores } from '../admin/cocina/cocinaTipos';
import type { UmbralesCocina } from '../admin/cocina/cocinaTipos';
import { colorPorMinutos, useTiempoEnVivo } from '../admin/cocina/tiempoEnVivo';
import { COLOR_TV, NumeroDia, TiempoEspera } from '../admin/cocina/TiempoEspera';
import { textoMesa } from '../admin/cocina/InsigniaMesa';

export type ModoTV = 'orders' | 'pair' | 'off' | 'out';

/** Datos de una tarjeta de la TV (ya filtrados por área). */
interface DatosTarjetaTV {
  code: string;
  modal: string;
  who: string;
  mins: number;
  creado?: string;
  umbrales?: UmbralesCocina;
  numero?: number | null;
  items: Array<{ a: string; t: string; d: string; combo: boolean; comboNombre: string }>;
  hasNote: boolean;
  note: string;
}


const CARDH = (c: {
  items: Array<{ t: string; d: string; combo?: boolean }>;
  hasNote?: boolean;
}) =>
  20 +
  30 +
  18 +
  10 +
  c.items.reduce(
    (h, it) =>
      h +
      21 * Math.ceil((it.t.length + it.d.length + 3) / 36) +
      (it.combo ? 16 : 0),
    0,
  ) +
  (c.hasNote ? 28 : 0);

function obtenerHoraLima(): string {
  try {
    return new Date().toLocaleTimeString('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    const ahora = new Date();
    const h = String(ahora.getHours()).padStart(2, '0');
    const m = String(ahora.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

function normalizarArea(raw: string | null | undefined): string {
  if (!raw) return 'todas';
  const l = raw.toLowerCase().trim();
  if (l.includes('bebid') || l.includes('barr')) return 'bebidas';
  if (l.includes('postre')) return 'postres';
  if (l.includes('salad') || l.includes('cocin')) return 'salados';
  if (l === 'todas') return 'todas';
  return 'todas';
}

const NOMBRE_AREA_MAP: Record<string, string> = {
  todas: 'Todas',
  bebidas: 'Bebidas',
  postres: 'Postres',
  salados: 'Salados',
};

/** Tarjeta de un pedido en la TV: el tiempo y el color se actualizan solos con el temporizador compartido. */
function TarjetaCocinaTV({ k }: { k: DatosTarjetaTV }) {
  const t = useTiempoEnVivo(k.creado, k.mins, k.umbrales);
  const tc = COLOR_TV[t.color];
  return (
          <div
            style={{
              background: '#FBF4EC',
              color: '#0B2C3E',
              borderRadius: '14px',
              borderLeft: `10px solid ${tc}`,
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 800, fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <NumeroDia numero={k.numero} />
                {k.code}{' '}
                <span
                  style={{
                    fontSize: /^(MESA|EN ESPERA)/.test(k.modal) ? '22px' : '13px',
                    fontWeight: /^(MESA|EN ESPERA)/.test(k.modal) ? 800 : 700,
                    borderRadius: '9999px',
                    padding: '2px 10px',
                    background: '#0B2C3E',
                    color: '#FBF4EC',
                    verticalAlign: 'middle',
                  }}
                >
                  {k.modal}
                </span>
              </span>
              <TiempoEspera
                variante="tv"
                desde={k.creado}
                minutosRespaldo={k.mins}
                umbrales={k.umbrales}
              />
            </div>

            <div
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: '#2C4C5D',
              }}
            >
              {k.who}
            </div>

            {k.items.map((it, idx) => (
              <div
                key={idx}
                style={{ fontSize: '17px', lineHeight: '21px' }}
              >
                <b>{it.t}</b>
                {it.d && <span>{it.d}</span>}
                {it.combo && (
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#B2500F',
                      lineHeight: '16px',
                    }}
                  >
                    parte del combo {it.comboNombre}
                  </div>
                )}
              </div>
            ))}

            {k.hasNote && (
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: '#0B2C3E',
                  background: '#FFF3C4',
                  border: '2px solid #D99E39',
                  borderRadius: '8px',
                  padding: '2px 8px',
                }}
              >
                NOTA: {k.note}
              </div>
            )}
          </div>
  );
}

export function PantallaCocinaView() {
  const searchParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  // 1) Área por URL o vinculación (por defecto 'todas')
  const areaParam = searchParams.get('area');
  const vinculacionArea =
    typeof window !== 'undefined'
      ? window.localStorage?.getItem('caprichos_pantalla_area') ||
        window.localStorage?.getItem('pantalla_area') ||
        ''
      : '';
  const areaKey = normalizarArea(areaParam || vinculacionArea);
  const nombreArea = NOMBRE_AREA_MAP[areaKey] || 'Todas';
  const tituloHeader =
    areaKey === 'todas'
      ? 'COCINA · TODAS LAS ÁREAS'
      : `ÁREA: ${nombreArea.toUpperCase()}`;

  // Estados reales de conectividad y vinculación
  const [conectado, setConectado] = useState(true);
  const [desvinculada, setDesvinculada] = useState(false);
  const [necesitaVincular, setNecesitaVincular] = useState(false);
  const [codigoVinculacion] = useState('K7M-4QX');

  // Datos de la API
  const [comandasApi, setComandasApi] = useState<Comanda[]>([]);
  const [areasApi, setAreasApi] = useState<AreaCocina[]>([]);
  const [horaActual, setHoraActual] = useState<string>(obtenerHoraLima);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string>(obtenerHoraLima);

  // Reloj digital para TV en hora real de Lima
  useEffect(() => {
    const tick = () => {
      setHoraActual(obtenerHoraLima());
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cargar áreas
  const cargarAreas = useCallback(async () => {
    try {
      const res = await listarAreasCocina();
      setAreasApi(res);
      return res;
    } catch {
      return [];
    }
  }, []);

  // Cargar comandas de la API
  const cargarComandas = useCallback(
    async (areaNorm: string, areasDisponibles: AreaCocina[]) => {
      try {
        let apiAreaParam = '';
        if (areaNorm !== 'todas') {
          const match = areasDisponibles.find((a) => {
            const nom = a.nombre.toLowerCase();
            if (areaNorm === 'bebidas') return nom.includes('bebid') || nom.includes('barr');
            if (areaNorm === 'postres') return nom.includes('postre');
            if (areaNorm === 'salados') return nom.includes('salad') || nom.includes('cocin');
            return false;
          });
          if (match) {
            apiAreaParam = match.id;
          }
        }

        const res = await listarComandasArea(apiAreaParam);
        // Solo pendientes: las ya despejadas (seguimiento) no se muestran en la pantalla
        setComandasApi(res.filter((c) => !c.despejada));
        setUltimaActualizacion(obtenerHoraLima());
        setConectado(true);
      } catch (err: any) {
        if (
          err?.codigo === 'PANTALLA_DESACTIVADA' ||
          /desactivada|desvinculada/i.test(err?.message || '')
        ) {
          setDesvinculada(true);
        } else if (
          err?.codigo === 'PANTALLA_NO_VINCULADA' ||
          /no_vinculada|vincular/i.test(err?.message || '')
        ) {
          setNecesitaVincular(true);
        } else if (/failed to fetch|networkerror|conexi/i.test(err?.message || '')) {
          setConectado(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    cargarAreas().then((areas) => {
      cargarComandas(areaKey, areas);
    });
  }, [areaKey, cargarAreas, cargarComandas]);

  // Manejo de eventos de socket y red
  useEffect(() => {
    const socket = conectarSocket();

    const onConnect = () => {
      setConectado(true);
      cargarComandas(areaKey, areasApi);
    };
    const onDisconnect = () => {
      setConectado(false);
    };
    const onConnectError = () => {
      setConectado(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    const onOnline = () => {
      setConectado(true);
      cargarComandas(areaKey, areasApi);
    };
    const onOffline = () => {
      setConectado(false);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [areaKey, areasApi, cargarComandas]);

  // Actualizaciones reactivas
  useEventos('pedido:nuevo', () => {
    cargarComandas(areaKey, areasApi);
  });
  useEventos('cocina:comanda', () => {
    cargarComandas(areaKey, areasApi);
  });
  useEventos('pedido:estado', () => {
    cargarComandas(areaKey, areasApi);
  });

  // Modo de visualización: automático según estado real, o forzado por parámetro URL para capturas de prueba
  const paramModo = (searchParams.get('modo') || searchParams.get('estado') || '').toLowerCase().trim();
  const modoActual: ModoTV =
    paramModo === 'pair' || paramModo === 'vincular'
      ? 'pair'
      : paramModo === 'off' || paramModo === 'sin-conexion' || paramModo === 'desconectada'
      ? 'off'
      : paramModo === 'out' || paramModo === 'desvinculada'
      ? 'out'
      : paramModo === 'orders' || paramModo === 'pedidos'
      ? 'orders'
      : desvinculada
      ? 'out'
      : !conectado
      ? 'off'
      : necesitaVincular
      ? 'pair'
      : 'orders';

  // Procesar comandas reales
  const ticketsTotales = comandasApi.map((c) => {
    const mod = (c.modalidad || '').toUpperCase();
    const modalText =
      mod === 'MESA' || mod === 'LOCAL'
        ? (textoMesa(c) ?? 'MESA').toUpperCase()
        : mod === 'DELIVERY'
        ? 'DELIVERY'
        : 'LLEVAR';
    const whoText = c.mesa
      ? c.mozo
        ? `Mozo: ${c.mozo}`
        : (textoMesa(c) ?? c.mesa)
      : c.mozo
      ? `Mozo: ${c.mozo}`
      : c.canal
      ? `Canal: ${c.canal}`
      : 'Canal: Web';

    const areaComandaLower = (c.areaNombre || '').toLowerCase();
    const areaDefaultItem =
      areaComandaLower.includes('bebida') || areaComandaLower.includes('barra')
        ? 'bebidas'
        : areaComandaLower.includes('postre')
        ? 'postres'
        : 'salados';

    const estadoPedido = (c as any).estado || '';
    const stNum =
      estadoPedido === 'PREPARANDO' || (c as any).comandaEstado === 'PREPARANDO'
        ? 1
        : estadoPedido === 'LISTO'
        ? 2
        : 0;

    return {
      st: stNum,
      code: c.ticket || c.codigo,
      modal: modalText,
      who: whoText,
      mins: c.minutos ?? c.minutosEspera ?? 0,
      creado: c.creado_en,
      umbrales: c.umbrales,
      numero: c.numeroDia ?? null,
      items: (c.lineas || []).map((l) => {
        const itemAreaLower = (l.area || '').toLowerCase();
        const itemArea = itemAreaLower.includes('bebida') || itemAreaLower.includes('barra')
          ? 'bebidas'
          : itemAreaLower.includes('postre')
          ? 'postres'
          : itemAreaLower.includes('salado') || itemAreaLower.includes('cocina')
          ? 'salados'
          : areaDefaultItem;

        const detalles = [
          l.tamano,
          textoSabores(l),
          ...(l.opciones || []).map((o: any) =>
            typeof o === 'string' ? o : o?.nombre || o?.texto || '',
          ),
        ]
          .filter(Boolean)
          .join(' · ');

        return {
          a: itemArea,
          t: `${l.cantidad} x ${l.nombre.toUpperCase()}`,
          d: detalles ? ` · ${detalles}` : '',
          combo: Boolean(l.combo || l.combo_nombre),
          comboNombre: l.combo_nombre || l.combo || 'DÚO PARA COMPARTIR',
        };
      }),
      hasNote: Boolean(c.nota),
      note: c.nota || '',
    };
  });

  // Filtrar pedidos según el área activa
  const vis = ticketsTotales
    .map((o) => ({
      ...o,
      items: o.items.filter((it) => areaKey === 'todas' || it.a === areaKey),
    }))
    .filter((o) => o.items.length > 0);

  // Columnas: Por preparar (0), En preparación (1), Listos (2)
  const COLS_CONFIG = [
    { t: 'POR PREPARAR', bg: '#E67929', fg: '#0B2C3E', st: 0 },
    { t: 'EN PREPARACIÓN', bg: '#D99E39', fg: '#0B2C3E', st: 1 },
    { t: 'LISTOS', bg: '#5DD38A', fg: '#0B2C3E', st: 2 },
  ];

  const cols = COLS_CONFIG.map((colDef) => {
    const all = vis
      .filter((o) => o.st === colDef.st)
      .sort((a, b) => b.mins - a.mins);

    const fit = (budget: number) => {
      let used = 0;
      const r = [];
      for (const k of all) {
        const h = CARDH(k) + 10;
        if (used + h > budget) break;
        used += h;
        r.push(k);
      }
      return r;
    };

    let cards = fit(490);
    if (cards.length < all.length) cards = fit(466);

    return {
      title: colDef.t,
      count: all.length,
      bg: colDef.bg,
      fg: colDef.fg,
      cards,
      empty: all.length === 0,
      hasMore: cards.length < all.length,
      more: all.length - cards.length,
    };
  });

  const porPrepararCount = cols[0].count;
  const enPrepCount = cols[1].count;
  const atrasadosCount = vis.filter((o) => colorPorMinutos(o.mins, o.umbrales) === 'ROJO' && o.st < 2).length;

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        height: '100vh',
        background: '#0B2C3E',
        color: '#FBF4EC',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Montserrat, system-ui, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @keyframes tv-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>

      {modoActual === 'orders' && (
        <>
          {/* Header TV */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              padding: '14px 28px',
              borderBottom: '2px solid #2C4C5D',
            }}
          >
            <img
              src="/logo.webp"
              alt="Caprichos"
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '26px',
                objectFit: 'cover',
              }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '28px', lineHeight: '32px' }}>
                {tituloHeader}
              </div>
              <div style={{ fontSize: '15px', color: '#C9D6DD' }}>
                Estación: {nombreArea} · Meta de entrega: 13 min
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div
                style={{
                  minWidth: '120px',
                  textAlign: 'center',
                  padding: '6px 14px',
                  borderRadius: '12px',
                  background: '#123F56',
                }}
              >
                <div
                  style={{
                    fontSize: '30px',
                    fontWeight: 800,
                    lineHeight: '34px',
                    color: '#E67929',
                  }}
                >
                  {porPrepararCount}
                </div>
                <div style={{ fontSize: '13px', color: '#C9D6DD' }}>
                  Por preparar
                </div>
              </div>

              <div
                style={{
                  minWidth: '120px',
                  textAlign: 'center',
                  padding: '6px 14px',
                  borderRadius: '12px',
                  background: '#123F56',
                }}
              >
                <div
                  style={{
                    fontSize: '30px',
                    fontWeight: 800,
                    lineHeight: '34px',
                    color: '#D99E39',
                  }}
                >
                  {enPrepCount}
                </div>
                <div style={{ fontSize: '13px', color: '#C9D6DD' }}>
                  En preparación
                </div>
              </div>

              <div
                style={{
                  minWidth: '120px',
                  textAlign: 'center',
                  padding: '6px 14px',
                  borderRadius: '12px',
                  background: '#123F56',
                }}
              >
                <div
                  style={{
                    fontSize: '30px',
                    fontWeight: 800,
                    lineHeight: '34px',
                    color: '#FF7A66',
                  }}
                >
                  {atrasadosCount}
                </div>
                <div style={{ fontSize: '13px', color: '#C9D6DD' }}>
                  Atrasados
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '40px',
                  lineHeight: '42px',
                }}
              >
                {horaActual}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: '#C9D6DD',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '6px',
                }}
              >
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '5px',
                    background: '#5DD38A',
                    animation: 'tv-pulse 2s ease-in-out infinite',
                  }}
                />
                En línea
              </div>
            </div>
          </div>

          {/* 3 Columnas de Comandas */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              gap: '16px',
              padding: '16px 28px 12px 28px',
            }}
          >
            {cols.map((c) => (
              <div
                key={c.title}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 14px',
                    borderRadius: '12px',
                    background: c.bg,
                    color: c.fg,
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: '20px' }}>
                    {c.title}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: '22px' }}>
                    {c.count}
                  </span>
                </div>

                {c.empty && (
                  <div
                    style={{
                      fontSize: '15px',
                      color: '#C9D6DD',
                      padding: '6px 4px',
                    }}
                  >
                    Sin pedidos
                  </div>
                )}

                {c.cards.map((k) => (
                  <TarjetaCocinaTV key={k.code} k={k} />
                ))}

                {c.hasMore && (
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 800,
                      color: '#C9D6DD',
                      textAlign: 'center',
                      padding: '2px 0',
                    }}
                  >
                    +{c.more} más
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer TV */}
          <div
            style={{
              padding: '8px 28px',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              color: '#C9D6DD',
              borderTop: '1px solid #2C4C5D',
            }}
          >
            <span>
              Azul: a tiempo · Naranja: desde 10 min · Rojo: desde 13 min
            </span>
            <span>Pantalla fija: no se toca · Se actualiza sola</span>
          </div>
        </>
      )}

      {modoActual === 'pair' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '18px',
            textAlign: 'center',
            padding: '20px',
          }}
        >
          <img
            src="/logo.webp"
            alt="Caprichos"
            style={{
              width: '96px',
              height: '96px',
              borderRadius: '48px',
              objectFit: 'cover',
            }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div style={{ fontWeight: 800, fontSize: '34px' }}>
            Vincula esta pantalla
          </div>
          <div
            style={{
              fontSize: '20px',
              color: '#C9D6DD',
              maxWidth: '760px',
              lineHeight: '28px',
            }}
          >
            En el administrativo entra a Pantallas, pulsa Vincular pantalla y
            escribe este código:
          </div>
          <div
            style={{
              fontWeight: 800,
              fontSize: '96px',
              lineHeight: '1.1',
              letterSpacing: '0.18em',
              padding: '12px 40px',
              borderRadius: '20px',
              background: '#FBF4EC',
              color: '#0B2C3E',
              display: 'inline-block',
            }}
          >
            {codigoVinculacion}
          </div>
          <div style={{ fontSize: '18px', color: '#C9D6DD' }}>
            El código vence en 10 minutos. Esta pantalla solo mostrará pedidos
            de cocina.
          </div>
        </div>
      )}

      {modoActual === 'off' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            textAlign: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '14px',
              background: '#E5533D',
              animation: 'tv-pulse 1.4s ease-in-out infinite',
            }}
          />
          <div style={{ fontWeight: 800, fontSize: '44px' }}>Sin conexión</div>
          <div
            style={{
              fontSize: '22px',
              color: '#C9D6DD',
              maxWidth: '780px',
              lineHeight: '30px',
            }}
          >
            No se pueden mostrar pedidos nuevos. Estamos reintentando solos.
            Mientras tanto, avisa a caja y revisa los tickets impresos.
          </div>
          <div style={{ fontSize: '16px', color: '#C9D6DD' }}>
            Última actualización: {ultimaActualizacion}
          </div>
        </div>
      )}

      {modoActual === 'out' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            textAlign: 'center',
            padding: '20px',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '44px' }}>
            Pantalla desvinculada
          </div>
          <div
            style={{
              fontSize: '22px',
              color: '#C9D6DD',
              maxWidth: '780px',
              lineHeight: '30px',
            }}
          >
            El administrador desactivó esta pantalla. Pide que la vuelva a
            vincular.
          </div>
        </div>
      )}
    </div>
  );
}
