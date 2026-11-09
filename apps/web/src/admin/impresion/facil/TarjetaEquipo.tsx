import { Fragment, useEffect, useRef, useState } from 'react';
import {
  PRESETS_TAMANO_ETIQUETA,
  esAreaBebidas,
  tamanoEfectivo,
  type ConfigEquipoImpresion,
  type EquipoEstadoImpresion,
  type RolImpresora,
  type TamanoEtiquetaPc,
  type TamanoMm,
} from '@caprichos/compartido';
import { Confirmar } from '../../../comun/Confirmar';
import { EtiquetaBebida, EtiquetaGeneral } from '../../pedidos/EtiquetaPrevia';
import { TITULO_PREVIA, VistaPreviaSticker, type TipoPrevia } from './VistaPreviaSticker';
import { MUESTRA_BEBIDA, MUESTRA_GENERAL } from '../mapa/VistaPiezaEjemplo';
import { impresionApi, type CambioConfigEquipo } from '../impresionApi';
import './tarjeta-equipo.css';
import { alternarArea, configDe, haceCuanto, mismaConfig } from './logicaEquipo';
import {
  alternarCategoria,
  alternarCategoriaTipo,
  categoriasSinPcPorTipo,
  categoriasVisibles,
  marcadasDeTipo,
  mismaReglaParaTodos,
  resumenTipo,
  resumenVasos,
  soloFrias,
  soloFriasTipo,
  todasTipo,
  TIPOS_VASO,
  type CategoriaSimple,
} from './logicaVasos';
import type { BebidaCategoriasPorModalidad } from '@caprichos/compartido';

export interface AreaSimple {
  id: string;
  nombre: string;
}

interface Props {
  equipo: EquipoEstadoImpresion;
  areas: AreaSimple[];
  /** Categorías de la carta para el filtro fino del vaso (sin ellas el bloque no aparece). */
  categorias?: CategoriaSimple[];
  /** Configuración guardada de las OTRAS PC (para avisar si una categoría no sale en ninguna). */
  configsOtras?: ConfigEquipoImpresion[];
  /** Tamaño de los stickers del local: lo que hereda una PC sin tamaño propio. */
  tamanosLocal: { bebida: TamanoMm; general: TamanoMm };
  puedeEditar: boolean;
  /** Papeles esperando a esta PC. */
  pendientes?: number;
  alRecargar: () => void;
  alAviso: (tipo: 'ok' | 'error', texto: string) => void;
  /** Si viene, la tarjeta se muestra como ventana (modal) y esto la cierra; sin ella se dibuja en línea. */
  alCancelar?: () => void;
  /** Otra PC con la que se confunde (para fusionar o decir que no lo es). */
  duplicadoDe?: { deviceKeyId: string; nombre: string } | null;
}

type Pestana = 'general' | 'ticketera' | 'etiquetera' | 'probar';
const PESTANAS: { id: Pestana; titulo: string }[] = [
  { id: 'general', titulo: 'General' },
  { id: 'ticketera', titulo: 'Ticketera' },
  { id: 'etiquetera', titulo: 'Etiquetera' },
  { id: 'probar', titulo: 'Probar' },
];

const nombreRol = (r: RolImpresora) => (r === 'TICKETERA' ? 'ticketera' : 'etiquetera');
const mm = (n: number) => String(n).replace('.', ',');

/** Interruptor grande (táctil, 44 px) con texto claro. */
function Interruptor({ texto, ayuda, activo, alCambiar, deshabilitado, id }: { texto: string; ayuda?: string; activo: boolean; alCambiar: () => void; deshabilitado?: boolean; id: string }) {
  return (
    <button type="button" role="switch" aria-checked={activo} data-testid={id} disabled={deshabilitado} className={`ie-switch${activo ? ' ie-switch--on' : ''}`} onClick={alCambiar}>
      <span className="ie-switch-pista" aria-hidden="true">
        <span className="ie-switch-bola" />
      </span>
      <span className="ie-switch-texto">
        <strong>{texto}</strong>
        {ayuda && <small>{ayuda}</small>}
      </span>
    </button>
  );
}

function Chips({ titulo, areas, marcadas, alAlternar, deshabilitado, id }: { titulo: string; areas: AreaSimple[]; marcadas: string[]; alAlternar: (id: string) => void; deshabilitado?: boolean; id: string }) {
  return (
    <div className="ie-chips" role="group" aria-label={titulo} data-testid={id}>
      <span className="ie-chips-t">{titulo}</span>
      <div className="ie-chips-lista">
        {areas.length === 0 && <span className="if-sub">No hay áreas creadas.</span>}
        {areas.map((a) => (
          <button key={a.id} type="button" className="ie-chip" aria-pressed={marcadas.includes(a.id)} disabled={deshabilitado} data-testid={`${id}-${a.id}`} onClick={() => alAlternar(a.id)}>
            {marcadas.includes(a.id) ? '✓ ' : ''}
            {a.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}

/** «¿De qué bebidas? (opcional)»: casillas por categoría para que el sticker de vaso no se gaste en lo que no lo necesita (ej. las calientes). */
function VasosCategorias({ id, cfg, categorias, configsOtras, deshabilitado, alCambiar, alCambiarPorTipo }: { id: string; cfg: ConfigEquipoImpresion; categorias: CategoriaSimple[]; configsOtras: ConfigEquipoImpresion[]; deshabilitado?: boolean; alCambiar: (v: string[] | null) => void; alCambiarPorTipo: (v: BebidaCategoriasPorModalidad | null) => void }) {
  // La matriz está abierta si hay reglas por tipo, o si la persona la abrió con el conmutador (aunque aún no difiera de la general)
  const [matriz, setMatriz] = useState(!mismaReglaParaTodos(cfg));
  const visibles = categoriasVisibles(categorias, cfg.stickerBebidaAreas);
  if (visibles.length === 0) return null;
  const { si, no } = resumenVasos(cfg, visibles);
  const sinPc = categoriasSinPcPorTipo(categorias, [...configsOtras, cfg]);
  const misma = !matriz;
  return (
    <details className="ie-vasos" data-testid={`vasos-${id}`} open={cfg.stickerBebidaCategorias != null || matriz}>
      <summary>¿De qué bebidas? (opcional)</summary>
      <p className="if-sub">Quita las que no necesitan sticker de vaso, por ejemplo las calientes, para no gastar etiquetas. La comanda y lo demás no cambian.</p>
      <div className="ie-chips-lista" role="group" aria-label="Categorías de bebida con sticker">
        {visibles.map((c) => {
          const on = si.includes(c.nombre);
          return (
            <button key={c.id} type="button" className="ie-chip" aria-pressed={on} disabled={deshabilitado} data-testid={`vaso-cat-${id}-${c.id}`} onClick={() => alCambiar(alternarCategoria(cfg, visibles, c.id))}>
              {on ? '✓ ' : ''}
              {c.nombre}
            </button>
          );
        })}
      </div>
      <div className="ie-chips-lista">
        <button type="button" className="ie-atajo" disabled={deshabilitado} data-testid={`vasos-frias-${id}`} onClick={() => alCambiar(soloFrias(visibles))}>Solo frías</button>
        <button type="button" className="ie-atajo" disabled={deshabilitado} data-testid={`vasos-todas-${id}`} onClick={() => alCambiar(null)}>Todas</button>
      </div>
      <label className="ie-vasos-misma">
        <input type="checkbox" checked={misma} disabled={deshabilitado} data-testid={`vasos-misma-${id}`} onChange={(e) => { setMatriz(!e.target.checked); if (e.target.checked) alCambiarPorTipo(null); }} />
        <span>Usar la misma regla para todos los tipos de pedido</span>
      </label>
      {!misma && (
        <div data-testid={`vasos-matriz-${id}`}>
          <p className="if-sub">Ej.: no imprimir calientes en el local, pero sí en delivery. Marca, en cada tipo de pedido, las bebidas que sí llevan sticker.</p>
          <div className="ie-matriz" role="group" aria-label="Bebidas con sticker según el tipo de pedido">
            <span />
            {TIPOS_VASO.map((t) => (
              <span key={t.id} className="ie-matriz-col">
                <span aria-hidden="true">{t.icono}</span> {t.corto}
              </span>
            ))}
            {visibles.map((c) => (
              <Fragment key={c.id}>
                <span className="ie-matriz-fila">{c.nombre}</span>
                {TIPOS_VASO.map((t) => {
                  const on = marcadasDeTipo(cfg, visibles, t.id).includes(c.id);
                  return (
                    <button key={t.id} type="button" className="ie-celda" aria-pressed={on} aria-label={`${c.nombre} ${t.frase}`} disabled={deshabilitado} data-testid={`vaso-mod-${id}-${t.id}-${c.id}`} onClick={() => alCambiarPorTipo(alternarCategoriaTipo(cfg, visibles, t.id, c.id))}>
                      {on ? '✓' : ''}
                    </button>
                  );
                })}
              </Fragment>
            ))}
            <span />
            {TIPOS_VASO.map((t) => (
              <span key={t.id} className="ie-matriz-atajos">
                <button type="button" className="ie-atajo" disabled={deshabilitado} data-testid={`vasos-mod-frias-${id}-${t.id}`} aria-label={`Solo frías ${t.frase}`} onClick={() => alCambiarPorTipo(soloFriasTipo(cfg, visibles, t.id))}>Solo frías</button>
                <button type="button" className="ie-atajo" disabled={deshabilitado} data-testid={`vasos-mod-todas-${id}-${t.id}`} aria-label={`Todas ${t.frase}`} onClick={() => alCambiarPorTipo(todasTipo(cfg, visibles, t.id))}>Todas</button>
              </span>
            ))}
          </div>
          <ul className="ie-vasos-res ie-vasos-lista" data-testid={`vasos-resumen-tipos-${id}`}>
            {TIPOS_VASO.map((t) => (
              <li key={t.id}>{resumenTipo(cfg, visibles, t.id)}</li>
            ))}
          </ul>
          {TIPOS_VASO.filter((t) => marcadasDeTipo(cfg, visibles, t.id).length === 0).map((t) => (
            <p key={t.id} role="alert" className="ie-vasos-aviso" data-testid={`vasos-aviso-${id}-${t.id}`}>Ojo: «{t.corto}» se quedó sin ninguna categoría marcada. No saldrá ningún sticker de vaso {t.frase}.</p>
          ))}
        </div>
      )}
      <p className="ie-vasos-res" data-testid={`vasos-resumen-${id}`}>
        Se imprimirán stickers de: {si.length ? si.join(', ') : 'ninguna'}
        {no.length > 0 && ` · No: ${no.join(', ')}`}
      </p>
      {si.length === 0 && <p role="alert" className="ie-vasos-aviso" data-testid={`vasos-aviso-${id}`}>Ojo: no marcaste ninguna. Esta PC no imprimirá ningún sticker de vaso.</p>}
      {sinPc.length > 0 && (
        <p className="ie-vasos-info" data-testid={`vasos-sinpc-${id}`}>
          {sinPc.map((x) => `${x.nombre}: ninguna PC imprime su sticker${x.tipos.length < TIPOS_VASO.length ? ` ${x.tipos.map((t) => TIPOS_VASO.find((y) => y.id === t)!.frase).join(' ni ')}` : ''}`).join('. ')} (es solo un aviso, no bloquea nada).
        </p>
      )}
    </details>
  );
}

/** Tamaño, orientación y margen de un sticker en ESTA PC, con vista previa a escala al instante. */
export function EditorTamano({
  tipo,
  titulo,
  valor,
  local,
  alCambiar,
  alProbar,
  deshabilitado,
}: {
  tipo: 'general' | 'bebida';
  titulo: string;
  valor: TamanoEtiquetaPc | null;
  local: TamanoMm;
  alCambiar: (v: TamanoEtiquetaPc | null) => void;
  alProbar: (v: TamanoEtiquetaPc | null) => void;
  deshabilitado?: boolean;
}) {
  const efectivo = tamanoEfectivo(valor, local);
  const presetActual = valor ? PRESETS_TAMANO_ETIQUETA.find((p) => p.anchoMm === valor.anchoMm && p.altoMm === valor.altoMm) : undefined;
  const [personalizado, setPersonalizado] = useState(!!valor && !presetActual);
  const enModoPropio = !!valor;
  const base: TamanoEtiquetaPc = valor ?? { anchoMm: local.anchoMm, altoMm: local.altoMm };
  const num = (v: string) => (v === '' ? NaN : Number(v.replace(',', '.')));
  const poner = (cambio: Partial<TamanoEtiquetaPc>) => alCambiar({ ...base, ...cambio });
  const datosOk = Number.isFinite(base.anchoMm) && Number.isFinite(base.altoMm);
  const medidaFueraDeRango = (n: number) => !(n >= 30 && n <= 200);
  const invalida = enModoPropio && (medidaFueraDeRango(base.anchoMm) || medidaFueraDeRango(base.altoMm));
  const tamanoPrevia = invalida || !datosOk ? local : { anchoMm: efectivo.anchoMm, altoMm: efectivo.altoMm, margenMm: (efectivo as TamanoEtiquetaPc).margenMm };
  return (
    <div className="ie-tamano" data-testid={`tamano-${tipo}`}>
      <h5>{titulo}</h5>
      <div className="ie-presets" role="group" aria-label={`Medida del ${titulo.toLowerCase()}`}>
        <button type="button" className="ie-chip" aria-pressed={!enModoPropio} disabled={deshabilitado} data-testid={`tamano-${tipo}-local`} onClick={() => { setPersonalizado(false); alCambiar(null); }}>
          Igual que el local ({mm(local.anchoMm)} × {mm(local.altoMm)})
        </button>
        {PRESETS_TAMANO_ETIQUETA.map((p) => (
          <button key={p.id} type="button" className="ie-chip" aria-pressed={!personalizado && !!presetActual && presetActual.id === p.id} disabled={deshabilitado} data-testid={`tamano-${tipo}-${p.id}`} onClick={() => { setPersonalizado(false); poner({ anchoMm: p.anchoMm, altoMm: p.altoMm }); }}>
            {p.nombre}
          </button>
        ))}
        <button type="button" className="ie-chip" aria-pressed={personalizado} disabled={deshabilitado} data-testid={`tamano-${tipo}-personalizado`} onClick={() => { setPersonalizado(true); poner({}); }}>
          Personalizado
        </button>
      </div>

      {enModoPropio && (
        <div className="ie-medidas">
          {personalizado && (
            <>
              <label className="if-campo">
                <span>Ancho (mm)</span>
                <input type="number" inputMode="decimal" min={30} max={200} step={0.1} value={Number.isFinite(base.anchoMm) ? base.anchoMm : ''} disabled={deshabilitado} data-testid={`tamano-${tipo}-ancho`} onChange={(e) => poner({ anchoMm: num(e.target.value) })} />
              </label>
              <label className="if-campo">
                <span>Alto (mm)</span>
                <input type="number" inputMode="decimal" min={30} max={200} step={0.1} value={Number.isFinite(base.altoMm) ? base.altoMm : ''} disabled={deshabilitado} data-testid={`tamano-${tipo}-alto`} onChange={(e) => poner({ altoMm: num(e.target.value) })} />
              </label>
            </>
          )}
          <div className="ie-orient" role="group" aria-label="Orientación">
            {(['apaisado', 'vertical'] as const).map((o) => (
              <button key={o} type="button" className="ie-chip" aria-pressed={base.orientacion === o} disabled={deshabilitado} data-testid={`tamano-${tipo}-${o}`} onClick={() => poner({ orientacion: base.orientacion === o ? undefined : o })}>
                {o === 'apaisado' ? 'Apaisado (ancha)' : 'Vertical (alta)'}
              </button>
            ))}
          </div>
          <label className="if-campo">
            <span>Margen (mm)</span>
            <input type="number" inputMode="decimal" min={0} max={10} step={0.5} value={base.margenMm ?? 0} disabled={deshabilitado} data-testid={`tamano-${tipo}-margen`} onChange={(e) => poner({ margenMm: Math.min(10, Math.max(0, num(e.target.value) || 0)) || undefined })} />
          </label>
          {invalida && (
            <p role="alert" className="ie-error">
              La medida debe estar entre 30 y 200 mm.
            </p>
          )}
        </div>
      )}

      <div className="ie-previa" data-testid={`previa-${tipo}`} data-medida={`${tamanoPrevia.anchoMm}x${tamanoPrevia.altoMm}`}>
        <p className="if-sub">
          Así se verá en esta PC: <strong data-testid={`previa-${tipo}-texto`}>{mm(tamanoPrevia.anchoMm)} × {mm(tamanoPrevia.altoMm)} mm</strong> (ejemplo, a escala)
        </p>
        <div className="ie-previa-caja">
          {tipo === 'bebida' ? <EtiquetaBebida datos={MUESTRA_BEBIDA} tamano={tamanoPrevia} /> : <EtiquetaGeneral datos={MUESTRA_GENERAL} tamano={tamanoPrevia} />}
        </div>
      </div>
      <button type="button" className="if-sec" data-testid={`tamano-${tipo}-probar`} disabled={deshabilitado || invalida || !datosOk} onClick={() => alProbar(valor)}>
        Imprimir prueba con este tamaño
      </button>
    </div>
  );
}

/**
 * Una PC con el programa de impresión: su estado, su red y, sobre todo, QUÉ HACE (cada PC manda).
 * Todo se gestiona desde aquí sin estar en el local; si la PC está sin conexión, lo guardado se aplica al reconectar.
 */
export function TarjetaEquipo({ equipo, areas, categorias = [], configsOtras = [], tamanosLocal, puedeEditar, pendientes = 0, alRecargar, alAviso, alCancelar, duplicadoDe = null }: Props) {
  const servidor = configDe(equipo);
  const nueva = !servidor.configurado;
  const seleccionServidor = {
    TICKETERA: equipo.seleccion?.TICKETERA ?? equipo.impresoras?.TICKETERA?.impresoraId ?? '',
    ETIQUETERA: equipo.seleccion?.ETIQUETERA ?? equipo.impresoras?.ETIQUETERA?.impresoraId ?? '',
  };
  const [borrador, setBorrador] = useState<ConfigEquipoImpresion>(servidor);
  const [impresoras, setImpresoras] = useState<Record<RolImpresora, string>>(seleccionServidor);
  const [nombre, setNombre] = useState(equipo.nombre);
  const [guardando, setGuardando] = useState(false);
  const [confirmar, setConfirmar] = useState<'general' | 'desvincular' | 'fusionar' | 'descartar' | null>(null);
  const [pestana, setPestana] = useState<Pestana>('general');
  const [previa, setPrevia] = useState<TipoPrevia | null>(null);
  const [pruebas, setPruebas] = useState<Record<string, string>>({});
  const previo = useRef({ cfg: JSON.stringify(servidor), sel: JSON.stringify(seleccionServidor), nombre: equipo.nombre });

  // Si el servidor cambió (otra persona, otra pantalla) y aquí no hay cambios sin guardar, se actualiza sola.
  useEffect(() => {
    const cfg = JSON.stringify(servidor);
    const sel = JSON.stringify(seleccionServidor);
    if (cfg !== previo.current.cfg) {
      if (JSON.stringify(borrador) === previo.current.cfg) setBorrador(servidor);
      previo.current.cfg = cfg;
    }
    if (sel !== previo.current.sel) {
      if (JSON.stringify(impresoras) === previo.current.sel) setImpresoras(seleccionServidor);
      previo.current.sel = sel;
    }
    if (equipo.nombre !== previo.current.nombre) {
      if (nombre === previo.current.nombre) setNombre(equipo.nombre);
      previo.current.nombre = equipo.nombre;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipo]);

  const sucio = !mismaConfig(borrador, servidor) || JSON.stringify(impresoras) !== JSON.stringify(seleccionServidor) || nombre.trim() !== equipo.nombre;
  const bloqueado = !puedeEditar || guardando;
  const areasSticker = areas.filter((a) => !esAreaBebidas(a.nombre));
  const cambiar = (c: Partial<ConfigEquipoImpresion>) => setBorrador((b) => ({ ...b, ...c }));

  const guardar = async (extra: CambioConfigEquipo = {}) => {
    setGuardando(true);
    try {
      const { configurado: _c, ...cfg } = borrador;
      const cuerpo: CambioConfigEquipo = { ...cfg, stickerBebidaCategoriasPorModalidad: cfg.stickerBebidaCategoriasPorModalidad ?? null, nombre: nombre.trim() || equipo.nombre, ...extra };
      if (JSON.stringify(impresoras) !== JSON.stringify(seleccionServidor)) {
        cuerpo.impresoras = {
          TICKETERA: impresoras.TICKETERA || null,
          ETIQUETERA: impresoras.ETIQUETERA || null,
        };
      }
      await impresionApi.guardarConfigEquipo(equipo.deviceKeyId, cuerpo);
      alAviso('ok', equipo.conectado ? `Guardado. ${nombre.trim() || equipo.nombre} ya usa lo nuevo.` : `Guardado. ${nombre.trim() || equipo.nombre} está sin conexión: lo nuevo se aplica cuando se conecte.`);
      alRecargar();
    } catch (err: any) {
      alAviso('error', `No se guardó. ${err?.message ?? ''}`.trim());
    } finally {
      setGuardando(false);
    }
  };

  const pausar = async () => {
    setGuardando(true);
    try {
      await impresionApi.guardarConfigEquipo(equipo.deviceKeyId, { pausado: !servidor.pausado });
      alAviso('ok', servidor.pausado ? `${equipo.nombre} vuelve a imprimir.` : `${equipo.nombre} en pausa: no recibe papeles nuevos.`);
      alRecargar();
    } catch (err: any) {
      alAviso('error', `No se pudo cambiar la pausa. ${err?.message ?? ''}`.trim());
    } finally {
      setGuardando(false);
    }
  };

  const usarGeneral = async () => {
    setConfirmar(null);
    try {
      const r = await impresionApi.usarGeneralEquipo(equipo.deviceKeyId);
      setBorrador(r.config);
      previo.current.cfg = JSON.stringify(r.config);
      alAviso('ok', `${equipo.nombre} ahora imprime lo que dicen las reglas del local.`);
      alRecargar();
    } catch (err: any) {
      alAviso('error', `No se pudo usar lo general. ${err?.message ?? ''}`.trim());
    }
  };

  const desvincular = async () => {
    setConfirmar(null);
    try {
      await impresionApi.desactivarLlave(equipo.deviceKeyId);
      alAviso('ok', `${equipo.nombre} se desvinculó. Lo que esperaba pasa a otra PC si alguna lo imprime.`);
      alRecargar();
    } catch (err: any) {
      alAviso('error', `No se pudo desvincular. ${err?.message ?? ''}`.trim());
    }
  };

  const fusionar = async () => {
    setConfirmar(null);
    if (!duplicadoDe) return;
    try {
      await impresionApi.fusionarEquipo(equipo.deviceKeyId, duplicadoDe.deviceKeyId);
      alAviso('ok', `${equipo.nombre} y ${duplicadoDe.nombre} ahora son una sola. Nada se borró.`);
      alRecargar();
    } catch (err: any) {
      alAviso('error', `No se pudo fusionar. ${err?.message ?? ''}`.trim());
    }
  };

  const noEsLaMisma = async () => {
    if (!duplicadoDe) return;
    try {
      await impresionApi.noEsLaMisma(equipo.deviceKeyId, duplicadoDe.deviceKeyId);
      alAviso('ok', `Listo: ${equipo.nombre} y ${duplicadoDe.nombre} son computadoras distintas.`);
      alRecargar();
    } catch (err: any) {
      alAviso('error', `No se pudo guardar. ${err?.message ?? ''}`.trim());
    }
  };

  const probarRol = async (rol: RolImpresora) => {
    setPruebas((p) => ({ ...p, [rol]: 'Enviando…' }));
    try {
      await impresionApi.pruebaImpresion(rol, impresoras[rol] || undefined, equipo.deviceKeyId);
      setPruebas((p) => ({ ...p, [rol]: `Prueba enviada a la impresora ${equipo.candidatas.find((c) => c.id === impresoras[rol])?.nombre ?? `de ${equipo.nombre}`}. Mira si salió.` }));
    } catch (err: any) {
      setPruebas((p) => ({ ...p, [rol]: err?.message || 'No se pudo enviar la prueba.' }));
    }
  };

  const probarTamano = async (tipo: 'general' | 'bebida', tamano: TamanoEtiquetaPc | null, clave: string = tipo) => {
    setPruebas((p) => ({ ...p, [clave]: 'Enviando…' }));
    try {
      await impresionApi.pruebaEtiquetaEquipo(equipo.deviceKeyId, tipo, tamano);
      setPruebas((p) => ({ ...p, [clave]: `Prueba enviada a la impresora ${equipo.candidatas.find((c) => c.id === impresoras.ETIQUETERA)?.nombre ?? `de ${equipo.nombre}`}. Mira si salió.` }));
    } catch (err: any) {
      setPruebas((p) => ({ ...p, [clave]: err?.message || 'No se pudo enviar la prueba.' }));
    }
  };

  const selector = (rol: RolImpresora) => (
    <div className="ie-impresora">
      <label className="if-campo">
        <span>Impresora de la {nombreRol(rol)}</span>
        <select data-testid={`impresora-${rol}`} value={impresoras[rol]} disabled={bloqueado || equipo.candidatas.length === 0} onChange={(e) => setImpresoras((s) => ({ ...s, [rol]: e.target.value }))}>
          <option value="">{equipo.candidatas.length === 0 ? 'La PC aún no informa sus impresoras' : 'Que el programa la busque solo (USB)'}</option>
          {equipo.candidatas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
              {c.puerto ? ` · ${c.puerto}` : ''}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  const pedirCerrar = () => {
    if (!alCancelar) return;
    if (sucio) setConfirmar('descartar');
    else alCancelar();
  };

  // Modo ventana: Esc cierra, el foco queda dentro y vuelve a la tarjeta al cerrar.
  const raiz = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef(pedirCerrar);
  cerrarRef.current = pedirCerrar;
  const hayConfirmar = useRef(false);
  hayConfirmar.current = confirmar !== null;
  useEffect(() => {
    if (!alCancelar) return;
    const previo = document.activeElement as HTMLElement | null;
    raiz.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (hayConfirmar.current) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        cerrarRef.current();
      } else if (e.key === 'Tab' && raiz.current) {
        const fuera = Array.from(raiz.current.querySelectorAll<HTMLElement>('button, input, select, summary, [href], [tabindex]:not([tabindex="-1"])')).filter((x) => !(x as HTMLButtonElement).disabled && !x.closest('.ie-panel--oculto'));
        if (fuera.length === 0) return;
        const a = fuera[0];
        const z = fuera[fuera.length - 1];
        if (e.shiftKey && (document.activeElement === a || !raiz.current.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && (document.activeElement === z || !raiz.current.contains(document.activeElement))) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      previo?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tamBebida = tamanoEfectivo(borrador.tamanoBebida, tamanosLocal.bebida);
  const tamGeneral = tamanoEfectivo(borrador.tamanoGeneral, tamanosLocal.general);
  const hayComanda = borrador.comandaSalon || borrador.comandaAreas.length > 0;
  const hayStickerArea = borrador.stickerAreas.length > 0;
  const hayBebida = borrador.stickerBebidaAreas.length > 0;
  const hayAlgoQueProbar = borrador.ticketera || borrador.etiquetera;
  const ver = (t: TipoPrevia) => (
    <button type="button" className="if-sec ie-ver" aria-expanded={previa === t} data-testid={`ver-previa-${t}`} onClick={() => setPrevia(previa === t ? null : t)}>
      👁 {previa === t ? 'Ocultar cómo se visualiza' : `Mostrar cómo se visualiza el ${TITULO_PREVIA[t]}`}
    </button>
  );
  const probarBtn = (id: string, texto: string, alClic: () => void) => (
    <button type="button" className="if-sec" data-testid={id} disabled={bloqueado} onClick={alClic}>
      {texto}
    </button>
  );
  const cuerpoPrueba = (clave: string) => pruebas[clave] && <span role="status" className="ie-prueba">{pruebas[clave]}</span>;
  const nombrePc = nombre.trim() || equipo.nombre;

  const articulo = (
    <article className={`if-pc ie-pc${nueva ? ' ie-pc--nueva' : ''}${alCancelar ? ' ie-pc--modal' : ''}`} data-testid={`pc-${equipo.deviceKeyId}`} aria-label={equipo.nombre}>
      <header className="ie-cab">
        <div className="ie-cab-t">
          <h4 id={`ie-t-${equipo.deviceKeyId}`}>{nombrePc}</h4>
          <span className={`ie-estado ie-estado--${equipo.conectado ? 'on' : 'off'}`} data-testid={`conexion-${equipo.deviceKeyId}`}>
            <span className="if-luz-punto" aria-hidden="true" />
            {equipo.conectado ? 'Conectada' : `Sin conexión · ${haceCuanto(equipo.ultimoLatido)}`}
          </span>
          {nueva && (
            <span className="ie-nueva" data-testid={`nueva-${equipo.deviceKeyId}`}>
              Nueva · falta configurar
            </span>
          )}
          {servidor.pausado && (
            <span className="ie-pausa" data-testid={`pausa-${equipo.deviceKeyId}`}>
              En pausa
            </span>
          )}
          {alCancelar && (
            <button type="button" className="ie-cerrar" aria-label="Cerrar" data-testid={`cerrar-${equipo.deviceKeyId}`} onClick={pedirCerrar}>
              ✕
            </button>
          )}
        </div>
        <div className="ie-tabs" role="tablist" aria-label="Configuración de la PC">
          {PESTANAS.map((p) => (
            <button key={p.id} type="button" role="tab" id={`ie-tab-${equipo.deviceKeyId}-${p.id}`} aria-selected={pestana === p.id} aria-controls={`ie-panel-${equipo.deviceKeyId}-${p.id}`} className="ie-tab" data-testid={`tab-${p.id}-${equipo.deviceKeyId}`} onClick={() => setPestana(p.id)}>
              {p.titulo}
            </button>
          ))}
        </div>
      </header>

      <div className="ie-cuerpo">
        <div role="tabpanel" id={`ie-panel-${equipo.deviceKeyId}-general`} aria-labelledby={`ie-tab-${equipo.deviceKeyId}-general`} className={`ie-panel${pestana !== 'general' ? ' ie-panel--oculto' : ''}`}>
          {nueva && <p className="ie-aviso">Esta PC todavía no imprime nada. Elige qué hará y pulsa «Guardar», o usa «Usar lo general».</p>}
          {!equipo.conectado && <p className="ie-aviso ie-aviso--gris">Está sin conexión: lo que guardes queda listo y se aplica en cuanto se conecte.</p>}
          {pendientes > 0 && <p className="ie-aviso ie-aviso--gris">{pendientes} papeles esperan a esta PC.</p>}
          {duplicadoDe && (
            <div className="ie-aviso" data-testid={`duplicado-${equipo.deviceKeyId}`}>
              <strong>Posible duplicado de «{duplicadoDe.nombre}».</strong> Si es la misma computadora, fusiónalas: esta hereda la configuración y la otra se archiva (nada se borra).
              <div className="ie-fila">
                <button type="button" className="if-sec" data-testid={`fusionar-${equipo.deviceKeyId}`} disabled={bloqueado} onClick={() => setConfirmar('fusionar')}>Fusionar</button>
                <button type="button" className="if-sec" data-testid={`no-misma-${equipo.deviceKeyId}`} disabled={bloqueado} onClick={() => void noEsLaMisma()}>No es la misma</button>
              </div>
            </div>
          )}
          <label className="if-campo ie-nombre">
            <span>Nombre de la PC</span>
            <input type="text" value={nombre} maxLength={60} disabled={bloqueado} data-testid={`nombre-${equipo.deviceKeyId}`} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <dl className="ie-datos" data-testid={`datos-${equipo.deviceKeyId}`}>
            <div><dt>IP en el local</dt><dd>{equipo.ipLocal?.length ? equipo.ipLocal.join(', ') : '—'}</dd></div>
            <div><dt>IP pública</dt><dd>{equipo.ipPublica ?? '—'}</dd></div>
            <div><dt>Programa</dt><dd>{equipo.version ? `versión ${equipo.version}` : '—'}</dd></div>
            <div><dt>Computadora</dt><dd>{[equipo.hostname, equipo.sistema].filter(Boolean).join(' · ') || '—'}</dd></div>
            <div className="ie-datos-ancho">
              <dt>Impresoras que ve</dt>
              <dd>
                {equipo.candidatas.length === 0
                  ? '—'
                  : equipo.candidatas.map((c) => [c.nombre, c.puerto, c.driver, c.estado].filter(Boolean).join(' · ')).join(' | ')}
              </dd>
            </div>
          </dl>
          <div className="ie-fila">
            <button type="button" className="if-sec" data-testid={`pausar-${equipo.deviceKeyId}`} disabled={bloqueado} onClick={() => void pausar()}>
              {servidor.pausado ? 'Reanudar PC' : 'Pausar PC'}
            </button>
            <button type="button" className="if-sec ie-peligro" data-testid={`desvincular-${equipo.deviceKeyId}`} disabled={bloqueado} onClick={() => setConfirmar('desvincular')}>
              Desvincular
            </button>
          </div>
        </div>

        <div role="tabpanel" id={`ie-panel-${equipo.deviceKeyId}-ticketera`} aria-labelledby={`ie-tab-${equipo.deviceKeyId}-ticketera`} className={`ie-panel${pestana !== 'ticketera' ? ' ie-panel--oculto' : ''}`}>
          <Interruptor id={`sw-ticketera-${equipo.deviceKeyId}`} texto="Ticketera" ayuda="Imprime tickets y comandas de papel" activo={borrador.ticketera} deshabilitado={bloqueado} alCambiar={() => cambiar({ ticketera: !borrador.ticketera })} />
          {borrador.ticketera && (
            <div className="ie-sub">
              <div className="ie-grid2">
                <Interruptor id={`sw-pago-${equipo.deviceKeyId}`} texto="Ticket de pago" activo={borrador.ticketPago} deshabilitado={bloqueado} alCambiar={() => cambiar({ ticketPago: !borrador.ticketPago })} />
                <Interruptor id={`sw-salon-${equipo.deviceKeyId}`} texto="Comanda de salón" activo={borrador.comandaSalon} deshabilitado={bloqueado} alCambiar={() => cambiar({ comandaSalon: !borrador.comandaSalon })} />
              </div>
              <Chips id={`chips-comanda-${equipo.deviceKeyId}`} titulo="Comandas de área: elige las áreas" areas={areas} marcadas={borrador.comandaAreas} deshabilitado={bloqueado} alAlternar={(id) => cambiar({ comandaAreas: alternarArea(borrador.comandaAreas, id) })} />
              {selector('TICKETERA')}
            </div>
          )}
        </div>

        <div role="tabpanel" id={`ie-panel-${equipo.deviceKeyId}-etiquetera`} aria-labelledby={`ie-tab-${equipo.deviceKeyId}-etiquetera`} className={`ie-panel${pestana !== 'etiquetera' ? ' ie-panel--oculto' : ''}`}>
          <Interruptor id={`sw-etiquetera-${equipo.deviceKeyId}`} texto="Etiquetera" ayuda="Imprime stickers" activo={borrador.etiquetera} deshabilitado={bloqueado} alCambiar={() => cambiar({ etiquetera: !borrador.etiquetera })} />
          {borrador.etiquetera && (
            <div className="ie-sub">
              <Chips id={`chips-sticker-area-${equipo.deviceKeyId}`} titulo="Sticker por área: elige las áreas" areas={areasSticker} marcadas={borrador.stickerAreas} deshabilitado={bloqueado} alAlternar={(id) => cambiar({ stickerAreas: alternarArea(borrador.stickerAreas, id) })} />
              <Chips id={`chips-sticker-bebida-${equipo.deviceKeyId}`} titulo="Sticker de bebida (un vaso, un sticker): elige las áreas" areas={areas} marcadas={borrador.stickerBebidaAreas} deshabilitado={bloqueado} alAlternar={(id) => cambiar({ stickerBebidaAreas: alternarArea(borrador.stickerBebidaAreas, id) })} />
              {borrador.stickerBebidaAreas.length > 0 && (
                <VasosCategorias id={equipo.deviceKeyId} cfg={borrador} categorias={categorias} configsOtras={configsOtras} deshabilitado={bloqueado} alCambiar={(v) => cambiar({ stickerBebidaCategorias: v })} alCambiarPorTipo={(v) => cambiar({ stickerBebidaCategoriasPorModalidad: v ?? undefined })} />
              )}
              <Interruptor id={`sw-general-${equipo.deviceKeyId}`} texto="Sticker general" ayuda="Un resumen del pedido (para llevar, recoger y delivery)" activo={borrador.stickerGeneral} deshabilitado={bloqueado} alCambiar={() => cambiar({ stickerGeneral: !borrador.stickerGeneral })} />
              {selector('ETIQUETERA')}
              <div className="ie-grid2">
                {borrador.stickerBebidaAreas.length > 0 && (
                  <EditorTamano tipo="bebida" titulo="Tamaño del sticker de bebida" valor={borrador.tamanoBebida} local={tamanosLocal.bebida} deshabilitado={bloqueado} alCambiar={(v) => cambiar({ tamanoBebida: v })} alProbar={(v) => void probarTamano('bebida', v, 'tam-bebida')} />
                )}
                {borrador.stickerGeneral && (
                  <EditorTamano tipo="general" titulo="Tamaño del sticker general" valor={borrador.tamanoGeneral} local={tamanosLocal.general} deshabilitado={bloqueado} alCambiar={(v) => cambiar({ tamanoGeneral: v })} alProbar={(v) => void probarTamano('general', v, 'tam-general')} />
                )}
              </div>
              {cuerpoPrueba('tam-bebida')}
              {cuerpoPrueba('tam-general')}
            </div>
          )}
        </div>

        <div role="tabpanel" id={`ie-panel-${equipo.deviceKeyId}-probar`} aria-labelledby={`ie-tab-${equipo.deviceKeyId}-probar`} className={`ie-panel${pestana !== 'probar' ? ' ie-panel--oculto' : ''}`} data-testid={`probar-${equipo.deviceKeyId}`}>
          <p className="if-sub">Cada prueba sale SOLO en esta PC y dice «PRUEBA — no es un pedido»: no cuenta como venta. Se prueba lo que tienes marcado (guarda antes si acabas de cambiarlo).</p>
          {!hayAlgoQueProbar && <p className="ie-aviso ie-aviso--gris">Esta PC no tiene nada activo que probar. Marca qué imprime en «Ticketera» o «Etiquetera».</p>}
          {borrador.ticketera && (
            <section className="ie-probar-grupo">
              <h5>Ticketera</h5>
              <div className="ie-fila">
                {probarBtn('probar-TICKETERA', borrador.ticketPago ? 'Probar ticket de pago' : hayComanda ? 'Probar comanda' : 'Probar ticketera', () => void probarRol('TICKETERA'))}
                {borrador.ticketPago && hayComanda && probarBtn('probar-comanda', 'Probar comanda', () => void probarRol('TICKETERA'))}
                {ver('ticket')}
              </div>
              {cuerpoPrueba('TICKETERA')}
              {previa === 'ticket' && <VistaPreviaSticker tipo="ticket" tamano={tamGeneral} />}
            </section>
          )}
          {borrador.etiquetera && (
            <section className="ie-probar-grupo">
              <h5>Etiquetera</h5>
              <div className="ie-fila">
                {(hayStickerArea || (!hayBebida && !borrador.stickerGeneral)) && probarBtn('probar-ETIQUETERA', hayStickerArea ? 'Probar sticker de área' : 'Probar etiquetera', () => void probarRol('ETIQUETERA'))}
                {hayBebida && probarBtn('probar-bebida', 'Probar sticker de bebida', () => void probarTamano('bebida', borrador.tamanoBebida))}
                {borrador.stickerGeneral && probarBtn('probar-general', 'Probar sticker general', () => void probarTamano('general', borrador.tamanoGeneral))}
              </div>
              {cuerpoPrueba('ETIQUETERA')}
              {cuerpoPrueba('bebida')}
              {cuerpoPrueba('general')}
              <div className="ie-fila">
                {hayStickerArea && ver('area')}
                {hayBebida && ver('bebida')}
                {borrador.stickerGeneral && ver('general')}
              </div>
              {previa && previa !== 'ticket' && <VistaPreviaSticker key={previa} tipo={previa} tamano={previa === 'bebida' ? tamBebida : tamGeneral} />}
            </section>
          )}
        </div>
      </div>

      <footer className="ie-acciones">
        <button type="button" className="if-grande" data-testid={`guardar-${equipo.deviceKeyId}`} disabled={bloqueado || (!sucio && !nueva)} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="if-sec" data-testid={`general-${equipo.deviceKeyId}`} disabled={bloqueado} onClick={() => setConfirmar('general')}>
          Usar lo general
        </button>
        {alCancelar && (
          <button type="button" className="if-sec" data-testid={`cancelar-${equipo.deviceKeyId}`} onClick={pedirCerrar}>
            Cancelar
          </button>
        )}
        {sucio && <span className="ie-sucio" role="status" data-testid={`sucio-${equipo.deviceKeyId}`}>Hay cambios sin guardar</span>}
        {!puedeEditar && <span className="if-sub">Solo quien tiene permiso de configuración puede cambiar esto.</span>}
      </footer>

      <Confirmar
        abierto={confirmar === 'general'}
        titulo="Usar lo general"
        mensaje="Esta PC pasará a imprimir lo que dicen las reglas del local (tickets, comandas y stickers de todas las áreas). Podrás ajustarla después."
        textoSi="Sí, usar lo general"
        textoNo="No"
        alConfirmar={() => void usarGeneral()}
        alCancelar={() => setConfirmar(null)}
      />
      <Confirmar
        abierto={confirmar === 'desvincular'}
        titulo="Desvincular esta PC"
        mensaje={`«${equipo.nombre}» dejará de imprimir y el programa de esa computadora ya no podrá conectarse. Para volver a usarla hay que agregarla de nuevo.`}
        textoSi="Sí, desvincular"
        textoNo="No"
        alConfirmar={() => void desvincular()}
        alCancelar={() => setConfirmar(null)}
      />
      <Confirmar
        abierto={confirmar === 'fusionar'}
        titulo="Fusionar con la otra PC"
        mensaje={`«${nombrePc}» hereda la configuración de «${duplicadoDe?.nombre ?? ''}» y esa queda archivada. Nada se borra.`}
        textoSi="Sí, fusionar"
        textoNo="No"
        alConfirmar={() => void fusionar()}
        alCancelar={() => setConfirmar(null)}
      />
      <Confirmar
        abierto={confirmar === 'descartar'}
        titulo="Hay cambios sin guardar"
        mensaje="Si cierras ahora, se pierden los cambios de esta computadora."
        textoSi="Sí, descartar"
        textoNo="Seguir editando"
        peligro
        alConfirmar={() => { setConfirmar(null); alCancelar?.(); }}
        alCancelar={() => setConfirmar(null)}
      />
    </article>
  );

  if (!alCancelar) return articulo;
  return (
    <div className="ie-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget) pedirCerrar(); }}>
      <div ref={raiz} tabIndex={-1} className="ie-modal" role="dialog" aria-modal="true" aria-labelledby={`ie-t-${equipo.deviceKeyId}`} data-testid={`modal-${equipo.deviceKeyId}`}>
        {articulo}
      </div>
    </div>
  );
}
