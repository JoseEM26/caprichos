import { useEffect, useRef, useState } from 'react';
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
import { MUESTRA_BEBIDA, MUESTRA_GENERAL } from '../mapa/VistaPiezaEjemplo';
import { impresionApi, type CambioConfigEquipo } from '../impresionApi';
import './tarjeta-equipo.css';
import { alternarArea, configDe, haceCuanto, mismaConfig } from './logicaEquipo';

export interface AreaSimple {
  id: string;
  nombre: string;
}

interface Props {
  equipo: EquipoEstadoImpresion;
  areas: AreaSimple[];
  /** Tamaño de los stickers del local: lo que hereda una PC sin tamaño propio. */
  tamanosLocal: { bebida: TamanoMm; general: TamanoMm };
  puedeEditar: boolean;
  /** Papeles esperando a esta PC. */
  pendientes?: number;
  alRecargar: () => void;
  alAviso: (tipo: 'ok' | 'error', texto: string) => void;
}

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
export function TarjetaEquipo({ equipo, areas, tamanosLocal, puedeEditar, pendientes = 0, alRecargar, alAviso }: Props) {
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
  const [confirmar, setConfirmar] = useState<'general' | 'desvincular' | null>(null);
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
      const cuerpo: CambioConfigEquipo = { ...cfg, nombre: nombre.trim() || equipo.nombre, ...extra };
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

  const probarRol = async (rol: RolImpresora) => {
    setPruebas((p) => ({ ...p, [rol]: 'Enviando…' }));
    try {
      await impresionApi.pruebaImpresion(rol, impresoras[rol] || undefined, equipo.deviceKeyId);
      setPruebas((p) => ({ ...p, [rol]: 'Prueba enviada. Mira si salió en la impresora.' }));
    } catch (err: any) {
      setPruebas((p) => ({ ...p, [rol]: err?.message || 'No se pudo enviar la prueba.' }));
    }
  };

  const probarTamano = async (tipo: 'general' | 'bebida', tamano: TamanoEtiquetaPc | null) => {
    setPruebas((p) => ({ ...p, [tipo]: 'Enviando…' }));
    try {
      await impresionApi.pruebaEtiquetaEquipo(equipo.deviceKeyId, tipo, tamano);
      setPruebas((p) => ({ ...p, [tipo]: 'Sticker de prueba enviado a esta PC.' }));
    } catch (err: any) {
      setPruebas((p) => ({ ...p, [tipo]: err?.message || 'No se pudo enviar la prueba.' }));
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
      <button type="button" className="if-sec" data-testid={`probar-${rol}`} disabled={bloqueado} onClick={() => void probarRol(rol)}>
        Imprimir prueba
      </button>
      {pruebas[rol] && (
        <span role="status" className="ie-prueba">
          {pruebas[rol]}
        </span>
      )}
    </div>
  );

  return (
    <article className={`if-pc ie-pc${nueva ? ' ie-pc--nueva' : ''}`} data-testid={`pc-${equipo.deviceKeyId}`} aria-label={equipo.nombre}>
      <header className="ie-cab">
        <label className="if-campo ie-nombre">
          <span>Nombre de la PC</span>
          <input type="text" value={nombre} maxLength={60} disabled={bloqueado} data-testid={`nombre-${equipo.deviceKeyId}`} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <div className="ie-insignias">
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
        </div>
      </header>

      {nueva && <p className="ie-aviso">Esta PC todavía no imprime nada. Elige qué hará y pulsa «Guardar», o usa «Usar lo general».</p>}
      {!equipo.conectado && <p className="ie-aviso ie-aviso--gris">Está sin conexión: lo que guardes queda listo y se aplica en cuanto se conecte.</p>}
      {pendientes > 0 && <p className="ie-aviso ie-aviso--gris">{pendientes} papeles esperan a esta PC.</p>}

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

      <section className="ie-que" aria-label="¿Qué hace esta PC?">
        <h4>¿Qué hace esta PC?</h4>

        <Interruptor id={`sw-ticketera-${equipo.deviceKeyId}`} texto="Ticketera" ayuda="Imprime tickets y comandas de papel" activo={borrador.ticketera} deshabilitado={bloqueado} alCambiar={() => cambiar({ ticketera: !borrador.ticketera })} />
        {borrador.ticketera && (
          <div className="ie-sub">
            <Interruptor id={`sw-pago-${equipo.deviceKeyId}`} texto="Ticket de pago" activo={borrador.ticketPago} deshabilitado={bloqueado} alCambiar={() => cambiar({ ticketPago: !borrador.ticketPago })} />
            <Interruptor id={`sw-salon-${equipo.deviceKeyId}`} texto="Comanda de salón" activo={borrador.comandaSalon} deshabilitado={bloqueado} alCambiar={() => cambiar({ comandaSalon: !borrador.comandaSalon })} />
            <Chips id={`chips-comanda-${equipo.deviceKeyId}`} titulo="Comandas de área: elige las áreas" areas={areas} marcadas={borrador.comandaAreas} deshabilitado={bloqueado} alAlternar={(id) => cambiar({ comandaAreas: alternarArea(borrador.comandaAreas, id) })} />
            {selector('TICKETERA')}
          </div>
        )}

        <Interruptor id={`sw-etiquetera-${equipo.deviceKeyId}`} texto="Etiquetera" ayuda="Imprime stickers" activo={borrador.etiquetera} deshabilitado={bloqueado} alCambiar={() => cambiar({ etiquetera: !borrador.etiquetera })} />
        {borrador.etiquetera && (
          <div className="ie-sub">
            <Chips id={`chips-sticker-area-${equipo.deviceKeyId}`} titulo="Sticker por área: elige las áreas" areas={areasSticker} marcadas={borrador.stickerAreas} deshabilitado={bloqueado} alAlternar={(id) => cambiar({ stickerAreas: alternarArea(borrador.stickerAreas, id) })} />
            <Chips id={`chips-sticker-bebida-${equipo.deviceKeyId}`} titulo="Sticker de bebida (un vaso, un sticker): elige las áreas" areas={areas} marcadas={borrador.stickerBebidaAreas} deshabilitado={bloqueado} alAlternar={(id) => cambiar({ stickerBebidaAreas: alternarArea(borrador.stickerBebidaAreas, id) })} />
            <Interruptor id={`sw-general-${equipo.deviceKeyId}`} texto="Sticker general" ayuda="Un resumen del pedido (para llevar, recoger y delivery)" activo={borrador.stickerGeneral} deshabilitado={bloqueado} alCambiar={() => cambiar({ stickerGeneral: !borrador.stickerGeneral })} />
            {selector('ETIQUETERA')}

            {borrador.stickerBebidaAreas.length > 0 && (
              <EditorTamano tipo="bebida" titulo="Tamaño del sticker de bebida" valor={borrador.tamanoBebida} local={tamanosLocal.bebida} deshabilitado={bloqueado} alCambiar={(v) => cambiar({ tamanoBebida: v })} alProbar={(v) => void probarTamano('bebida', v)} />
            )}
            {pruebas.bebida && <span role="status" className="ie-prueba">{pruebas.bebida}</span>}
            {borrador.stickerGeneral && (
              <EditorTamano tipo="general" titulo="Tamaño del sticker general" valor={borrador.tamanoGeneral} local={tamanosLocal.general} deshabilitado={bloqueado} alCambiar={(v) => cambiar({ tamanoGeneral: v })} alProbar={(v) => void probarTamano('general', v)} />
            )}
            {pruebas.general && <span role="status" className="ie-prueba">{pruebas.general}</span>}
          </div>
        )}
      </section>

      <footer className="ie-acciones">
        <button type="button" className="if-grande" data-testid={`guardar-${equipo.deviceKeyId}`} disabled={bloqueado || (!sucio && !nueva)} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="if-sec" data-testid={`general-${equipo.deviceKeyId}`} disabled={bloqueado} onClick={() => setConfirmar('general')}>
          Usar lo general
        </button>
        <button type="button" className="if-sec" data-testid={`pausar-${equipo.deviceKeyId}`} disabled={bloqueado} onClick={() => void pausar()}>
          {servidor.pausado ? 'Reanudar PC' : 'Pausar PC'}
        </button>
        <button type="button" className="if-sec ie-peligro" data-testid={`desvincular-${equipo.deviceKeyId}`} disabled={bloqueado} onClick={() => setConfirmar('desvincular')}>
          Desvincular
        </button>
      </footer>
      {!puedeEditar && <p className="if-sub">Solo quien tiene permiso de configuración puede cambiar esto.</p>}

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
    </article>
  );
}
