import { useCallback, useEffect, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { useEventos } from '../../comun/socket';
import { EstadoAdminImpresion } from '@caprichos/compartido';
import { FiltroCola, GrupoCola, RespuestaCola, impresionApi } from './impresionApi';
import { FiltroCombo } from '../../comun/FiltroCombo';
import './cola-impresion.css';

const FILTROS: Array<[FiltroCola, string]> = [
  ['pendientes', 'Pendientes'],
  ['en_curso', 'En curso'],
  ['fallidos', 'Fallidos'],
  ['vencidos', 'Vencidos'],
  ['descartados', 'Descartados'],
  ['impresos', 'Impresos'],
];

const NOMBRE_ESTADO: Record<string, string> = {
  PENDIENTE: 'pendiente',
  IMPRIMIENDO: 'en curso',
  IMPRESO: 'impreso',
  FALLIDO: 'fallido',
  VENCIDO: 'vencido',
  DESCARTADO: 'descartado',
};

export function haceCuanto(iso: string, ahora = Date.now()): string {
  const min = Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'hace menos de 1 min';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
}

const textoEstados = (g: GrupoCola) =>
  Object.entries(g.estados).map(([e, n]) => `${n} ${NOMBRE_ESTADO[e] || e.toLowerCase()}`).join(', ');

export function ColaImpresion({ alCerrar }: { alCerrar: () => void }) {
  const [filtro, setFiltro] = useState<FiltroCola>('pendientes');
  const [cola, setCola] = useState<RespuestaCola | null>(null);
  const [agente, setAgente] = useState<EstadoAdminImpresion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);

  const [vaciando, setVaciando] = useState(false);
  const [alcance, setAlcance] = useState<'ANTIGUAS' | 'TODAS'>('ANTIGUAS');
  const [motivo, setMotivo] = useState('');
  const [confirmaVaciar, setConfirmaVaciar] = useState(false);
  const [grupoDescartar, setGrupoDescartar] = useState<GrupoCola | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [c, a] = await Promise.all([impresionApi.listarCola(filtro, pagina), impresionApi.obtenerEstado()]);
      setCola(c);
      setAgente(a);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la cola de impresión');
    }
  }, [filtro, pagina]);

  useEffect(() => {
    void cargar();
  }, [cargar]);
  useEventos('impresion:cola', cargar);
  useEventos('impresion:sin_conexion', cargar);

  const r = cola?.resumen;
  const aDescartar = r ? (alcance === 'ANTIGUAS' ? r.pendientesAntiguas : r.pendientes) : 0;
  const motivoOk = motivo.trim().length >= 5;

  const ejecutar = async (accion: () => Promise<{ mensaje: string }>, alTerminar: () => void) => {
    setTrabajando(true);
    try {
      const res = await accion();
      setAviso(res.mensaje);
      setError(null);
      alTerminar();
      await cargar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo completar la acción');
      alTerminar();
    } finally {
      setTrabajando(false);
    }
  };

  const reimprimir = (g: GrupoCola) =>
    ejecutar(() => impresionApi.reimprimirTodas(g.pedidoId), () => undefined);

  return (
    <div className="cola-fondo" onClick={alCerrar}>
      <div className="cola-panel" role="dialog" aria-modal="true" aria-label="Cola de impresión" onClick={(e) => e.stopPropagation()}>
        <div className="cola-cab">
          <h2>Cola de impresión</h2>
          <button type="button" className="cola-btn" onClick={alCerrar}>Cerrar</button>
        </div>
        <p className="cola-ayuda">Las etiquetas descartadas no se imprimen aunque la impresora vuelva; si las necesitas, usa Reimprimir.</p>

        {r && (
          <div className="cola-resumen" data-testid="cola-resumen">
            <div className="cola-dato"><b>{r.pendientes}</b><span>Pendientes</span></div>
            <div className="cola-dato"><b>{r.fallidos}</b><span>Fallidos</span></div>
            <div className="cola-dato"><b>{r.vencidos}</b><span>Vencidos</span></div>
            <div className="cola-dato">
              <b style={{ fontSize: 14 }}>{agente?.agente === 'conectado' ? 'Programa conectado' : 'Programa sin conexión'}</b>
              <span>
                Impresora: {agente?.impresora || 'desconectada'}
                {agente?.ultimoLatido ? ` · último latido ${haceCuanto(agente.ultimoLatido)}` : ' · sin latidos'}
              </span>
            </div>
          </div>
        )}

        {aviso && <div role="status" className="cola-ayuda" style={{ fontWeight: 700 }}>{aviso}</div>}

        {r && r.pendientes > 0 && !vaciando && (
          <button type="button" className="cola-btn peligro" onClick={() => setVaciando(true)}>
            Vaciar cola
          </button>
        )}

        {vaciando && r && (
          <div className="cola-vaciar" data-testid="cola-vaciar">
            <strong>Vaciar cola</strong>
            <label>
              <input type="radio" name="alcance" checked={alcance === 'ANTIGUAS'} onChange={() => setAlcance('ANTIGUAS')} />
              Solo las de hace más de {r.minutosAntiguas} minutos (recomendado)
            </label>
            <label>
              <input type="radio" name="alcance" checked={alcance === 'TODAS'} onChange={() => setAlcance('TODAS')} />
              Todas las pendientes
            </label>
            <label htmlFor="cola-motivo" style={{ minHeight: 0 }}>Motivo (obligatorio, mínimo 5 letras)</label>
            <textarea id="cola-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <div className="cola-acciones">
              <button type="button" className="cola-btn peligro" disabled={!motivoOk || aDescartar === 0} onClick={() => setConfirmaVaciar(true)}>
                Continuar
              </button>
              <button type="button" className="cola-btn" onClick={() => setVaciando(false)}>Cancelar</button>
            </div>
            {aDescartar === 0 && <small>No hay etiquetas que cumplan esa opción.</small>}
          </div>
        )}

        <div className="cola-filtros">
          <FiltroCombo
            etiqueta="Ver"
            valor={filtro}
            valorPorDefecto="pendientes"
            opciones={FILTROS.map(([id, texto]) => ({ valor: id, etiqueta: texto }))}
            alCambiar={(v) => {
              setFiltro(v as FiltroCola);
              setPagina(1);
            }}
          />
        </div>

        {error && <EstadoError mensaje={error} alReintentar={() => void cargar()} />}
        {!cola && !error && <Cargando mensaje="Cargando la cola de impresión" />}
        {cola && cola.items.length === 0 && !error && (
          <EstadoVacio titulo="No hay etiquetas aquí" descripcion="No hay etiquetas con este filtro." />
        )}

        {cola?.items.map((g) => {
          const descartable = (g.estados.PENDIENTE || 0) + (g.estados.FALLIDO || 0) > 0;
          return (
            <div key={g.pedidoId} className="cola-grupo" data-testid="cola-grupo">
              <div className="cola-grupo-cab">
                <strong>{g.pedidoCodigo} · {g.clienteNombre || 'Sin nombre'}</strong>
                <span>{g.cantidad} etiqueta(s) · {haceCuanto(g.masAntiguaEn)}</span>
              </div>
              <small>{textoEstados(g)}{g.error ? ` · ${g.error}` : ''}</small>
              <div className="cola-acciones">
                {descartable && (
                  <button type="button" className="cola-btn" disabled={trabajando} onClick={() => setGrupoDescartar(g)}>
                    Descartar
                  </button>
                )}
                <button type="button" className="cola-btn" disabled={trabajando} onClick={() => void reimprimir(g)}>
                  Reimprimir
                </button>
              </div>
            </div>
          );
        })}

        {cola && cola.paginas > 1 && (
          <div className="cola-acciones">
            <button type="button" className="cola-btn" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
            <span className="cola-ayuda" style={{ alignSelf: 'center' }}>Página {cola.pagina} de {cola.paginas}</span>
            <button type="button" className="cola-btn" disabled={pagina >= cola.paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
          </div>
        )}
      </div>

      <Confirmar
        abierto={confirmaVaciar}
        titulo="Vaciar cola de impresión"
        mensaje={`Se descartarán ${aDescartar} etiqueta(s) y NO se imprimirán. Quedan registradas con tu motivo. ¿Continuar?`}
        textoSi="Sí, vaciar"
        textoNo="No"
        peligro
        cargando={trabajando}
        alCancelar={() => setConfirmaVaciar(false)}
        alConfirmar={() =>
          ejecutar(
            () => impresionApi.vaciarCola({ alcance, minutos: r?.minutosAntiguas, motivo: motivo.trim() }),
            () => { setConfirmaVaciar(false); setVaciando(false); setMotivo(''); },
          )
        }
      />
      <Confirmar
        abierto={!!grupoDescartar}
        titulo="Descartar etiquetas del pedido"
        mensaje={`Se descartarán las etiquetas pendientes o fallidas de ${grupoDescartar?.pedidoCodigo}; NO se imprimirán. ¿Continuar?`}
        textoSi="Sí, descartar"
        textoNo="No"
        peligro
        cargando={trabajando}
        alCancelar={() => setGrupoDescartar(null)}
        alConfirmar={() =>
          ejecutar(
            () => impresionApi.descartarPedido(grupoDescartar!.pedidoId),
            () => setGrupoDescartar(null),
          )
        }
      />
    </div>
  );
}
