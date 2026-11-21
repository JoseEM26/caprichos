import { useState } from 'react';
import type { ReactNode } from 'react';
import { ModalConPestanas } from '../../comun/ModalConPestanas';
import { Boton } from '../../comun/Boton';
import { subirImagenAlServidor } from '../../comun/subidaImagen';
import { COLORES_ANUNCIO, PLANTILLAS_ANUNCIO } from '../../anuncios/tipos';
import { ModalAnuncio, TarjetaAnuncio } from '../../anuncios/ModalAnuncio';
import '../../anuncios/anuncios.css';
import { atajoVigencia, DIAS, formAPublico, ROLES_PERSONAL } from './anunciosApi';
import type { AtajoVigencia, FormAnuncio } from './anunciosApi';

const campo = { display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 700, fontSize: 13, color: 'var(--cp-navy)' } as const;
const entrada = { minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: '0 10px', fontSize: 15, background: 'var(--cp-white)', color: 'var(--cp-navy)' } as const;
const fila = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' } as const;
const grupo = { display: 'flex', flexDirection: 'column', gap: 12 } as const;
const chip = (activo: boolean) => ({
  minHeight: 44, padding: '0 14px', borderRadius: 9999, cursor: 'pointer', fontWeight: 700, fontSize: 14,
  border: '1.5px solid var(--cp-navy)', background: activo ? 'var(--cp-navy)' : 'transparent', color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
}) as const;

function Campo({ etiqueta, children, ayuda }: { etiqueta: string; children: ReactNode; ayuda?: string }) {
  return (
    <label style={campo}>
      {etiqueta}
      {children}
      {ayuda && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--cp-soft)' }}>{ayuda}</span>}
    </label>
  );
}

export function EditorAnuncio({ valorInicial, titulo, alGuardar, alCerrar }: {
  valorInicial: FormAnuncio;
  titulo: string;
  alGuardar: (f: FormAnuncio) => Promise<void>;
  alCerrar: () => void;
}) {
  const [f, setF] = useState<FormAnuncio>(valorInicial);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [previa, setPrevia] = useState<'CELULAR' | 'PC'>('CELULAR');
  const [real, setReal] = useState(false);
  const [horasAtajo, setHorasAtajo] = useState(3);
  const [diasAtajo, setDiasAtajo] = useState(3);
  const cambiar = (p: Partial<FormAnuncio>) => setF((x) => ({ ...x, ...p }));
  const cambiarDetalle = (k: string, v: string) => setF((x) => ({ ...x, detalle: { ...x.detalle, [k]: v } }));
  const soloPersonal = f.publico === 'PERSONAL';
  const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  const subir = async (archivo?: File) => {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      const r = await subirImagenAlServidor(archivo);
      cambiar({ imagen_url: r.url });
    } catch (e: any) {
      setError(e?.message || 'No se pudo subir la imagen. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = async () => {
    if (!f.titulo.trim()) { setError('Escribe el título del anuncio'); return; }
    setGuardando(true);
    setError(null);
    try {
      await alGuardar(f);
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el anuncio');
      setGuardando(false);
    }
  };

  const aplicarAtajo = (t: AtajoVigencia, n?: number) => cambiar(atajoVigencia(t, n));

  const contenido = (
    <div className="anu-ed-dos">
      <div style={grupo}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 700, fontSize: 13, color: 'var(--cp-navy)', marginBottom: 6 }}>Plantilla</legend>
          <div style={fila} role="radiogroup" aria-label="Plantilla">
            {PLANTILLAS_ANUNCIO.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={f.plantilla === p.id} title={p.ayuda} style={chip(f.plantilla === p.id)}
                onClick={() => cambiar({ plantilla: p.id, ...(p.id === 'COMUNICADO_INTERNO' ? { publico: 'PERSONAL' as const, puede_cerrar: false, cierre_segundos: 0 } : {}) })}>
                {p.nombre}
              </button>
            ))}
          </div>
        </fieldset>
        <Campo etiqueta="Título"><input style={entrada} maxLength={120} value={f.titulo} onChange={(e) => cambiar({ titulo: e.target.value })} /></Campo>
        <Campo etiqueta="Texto"><textarea style={{ ...entrada, padding: 10, minHeight: 90 }} maxLength={1500} value={f.texto} onChange={(e) => cambiar({ texto: e.target.value })} /></Campo>
        {f.plantilla === 'PROMOCION' && (
          <div style={fila}>
            <Campo etiqueta="Precio o descuento"><input style={entrada} maxLength={80} value={f.detalle.precio ?? ''} onChange={(e) => cambiarDetalle('precio', e.target.value)} placeholder="S/ 19.90" /></Campo>
            <Campo etiqueta="Código de cupón"><input style={entrada} maxLength={80} value={f.detalle.cupon ?? ''} onChange={(e) => cambiarDetalle('cupon', e.target.value)} /></Campo>
          </div>
        )}
        {f.plantilla === 'EVENTO' && (
          <div style={fila}>
            <Campo etiqueta="Fecha y hora del evento"><input style={entrada} maxLength={80} value={f.detalle.fecha ?? ''} onChange={(e) => cambiarDetalle('fecha', e.target.value)} placeholder="Sábado 5, 6:00 p. m." /></Campo>
            <Campo etiqueta="Lugar"><input style={entrada} maxLength={80} value={f.detalle.lugar ?? ''} onChange={(e) => cambiarDetalle('lugar', e.target.value)} /></Campo>
          </div>
        )}
        <Campo etiqueta={f.plantilla === 'SOLO_IMAGEN' ? 'Imagen (obligatoria)' : 'Imagen (opcional)'}>
          <input type="file" accept="image/*" style={{ ...entrada, paddingTop: 8 }} disabled={subiendo} onChange={(e) => subir(e.target.files?.[0])} />
        </Campo>
        {subiendo && <span role="status">Subiendo imagen…</span>}
        {f.imagen_url && <Boton variante="texto" tamano="pequeno" onClick={() => cambiar({ imagen_url: '' })}>Quitar imagen</Boton>}
        <div style={fila}>
          <Campo etiqueta="Texto del botón (opcional)"><input style={entrada} maxLength={40} value={f.boton_texto} onChange={(e) => cambiar({ boton_texto: e.target.value })} /></Campo>
          <Campo etiqueta="Enlace del botón" ayuda="Interno: /carta o /admin/caja">
            <input style={entrada} maxLength={300} value={f.boton_enlace} onChange={(e) => cambiar({ boton_enlace: e.target.value })} placeholder="/carta" />
          </Campo>
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 700, fontSize: 13, color: 'var(--cp-navy)', marginBottom: 6 }}>Color</legend>
          <div style={fila} role="radiogroup" aria-label="Color">
            {Object.entries(COLORES_ANUNCIO).map(([id, c]) => (
              <button key={id} type="button" role="radio" aria-checked={f.color === id} aria-label={c.nombre} onClick={() => cambiar({ color: id })}
                style={{ width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', background: c.fondo, border: f.color === id ? '3px solid var(--cp-orange)' : '1.5px solid var(--cp-navy)' }} />
            ))}
          </div>
        </fieldset>
      </div>
      <div className="anu-ed-previa">
        <div style={fila} role="group" aria-label="Tamaño de la vista previa">
          <button type="button" aria-pressed={previa === 'CELULAR'} style={chip(previa === 'CELULAR')} onClick={() => setPrevia('CELULAR')}>Celular</button>
          <button type="button" aria-pressed={previa === 'PC'} style={chip(previa === 'PC')} onClick={() => setPrevia('PC')}>PC</button>
        </div>
        <div className="anu-ed-lienzo" style={{ width: previa === 'CELULAR' ? 'min(360px, 100%)' : 'min(440px, 100%)' }} data-testid="anuncio-previa-viva">
          <div style={{ borderRadius: 20, overflow: 'hidden' }}>
            <TarjetaAnuncio anuncio={formAPublico(f)} idTitulo="anu-titulo-previa" />
          </div>
        </div>
      </div>
    </div>
  );

  const publico = (
    <div style={grupo}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 700, fontSize: 13, color: 'var(--cp-navy)', marginBottom: 6 }}>¿Quién lo ve?</legend>
        <div style={fila} role="radiogroup" aria-label="Público">
          {([['CARTA', 'Clientes (carta)'], ['PERSONAL', 'Personal (panel)'], ['AMBOS', 'Ambos']] as const).map(([v, n]) => (
            <button key={v} type="button" role="radio" aria-checked={f.publico === v} style={chip(f.publico === v)}
              onClick={() => cambiar({ publico: v, ...(v !== 'PERSONAL' ? { puede_cerrar: true } : {}) })}>{n}</button>
          ))}
        </div>
      </fieldset>
      {f.publico !== 'CARTA' && (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 700, fontSize: 13, color: 'var(--cp-navy)', marginBottom: 6 }}>Roles del personal (ninguno = todos)</legend>
          <div style={fila}>
            {ROLES_PERSONAL.map((r) => (
              <button key={r} type="button" aria-pressed={f.roles.includes(r)} style={chip(f.roles.includes(r))} onClick={() => cambiar({ roles: alternar(f.roles, r) })}>{r}</button>
            ))}
          </div>
        </fieldset>
      )}
      <Campo etiqueta="Prioridad" ayuda="Si hay varios al aire, sale primero el número más alto. Máximo 3 por ingreso.">
        <input type="number" min={0} max={1000} style={{ ...entrada, width: 120 }} value={f.prioridad} onChange={(e) => cambiar({ prioridad: Number(e.target.value) || 0 })} />
      </Campo>
      <label style={{ ...fila, fontWeight: 700, color: 'var(--cp-navy)' }}>
        <input type="checkbox" checked={f.activo} onChange={(e) => cambiar({ activo: e.target.checked })} style={{ width: 22, height: 22 }} />
        Activo (encendido)
      </label>
    </div>
  );

  const cuando = (
    <div style={grupo}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 700, fontSize: 13, color: 'var(--cp-navy)', marginBottom: 6 }}>Vigencia (hora de Lima)</legend>
        <div style={fila}>
          <Campo etiqueta="Desde"><input type="datetime-local" style={entrada} value={f.desde} onChange={(e) => cambiar({ desde: e.target.value })} /></Campo>
          <Campo etiqueta="Hasta"><input type="datetime-local" style={entrada} value={f.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} /></Campo>
        </div>
        <div style={{ ...fila, marginTop: 8 }}>
          <button type="button" style={chip(false)} onClick={() => aplicarAtajo('HOY')}>Solo hoy</button>
          <button type="button" style={chip(false)} onClick={() => aplicarAtajo('SEMANA')}>Una semana</button>
          <button type="button" style={chip(false)} onClick={() => aplicarAtajo('SIEMPRE')}>Hasta que lo apague</button>
        </div>
        <div style={{ ...fila, marginTop: 8 }}>
          <input type="number" aria-label="Cantidad de horas" min={1} max={720} style={{ ...entrada, width: 80 }} value={horasAtajo} onChange={(e) => setHorasAtajo(Number(e.target.value) || 1)} />
          <button type="button" style={chip(false)} onClick={() => aplicarAtajo('HORAS', horasAtajo)}>Unas horas</button>
          <input type="number" aria-label="Cantidad de días" min={1} max={365} style={{ ...entrada, width: 80 }} value={diasAtajo} onChange={(e) => setDiasAtajo(Number(e.target.value) || 1)} />
          <button type="button" style={chip(false)} onClick={() => aplicarAtajo('DIAS', diasAtajo)}>Días</button>
        </div>
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 700, fontSize: 13, color: 'var(--cp-navy)', marginBottom: 6 }}>Franja horaria (opcional)</legend>
        <div style={fila}>
          <Campo etiqueta="De"><input type="time" style={entrada} value={f.franja_desde} onChange={(e) => cambiar({ franja_desde: e.target.value })} /></Campo>
          <Campo etiqueta="A"><input type="time" style={entrada} value={f.franja_hasta} onChange={(e) => cambiar({ franja_hasta: e.target.value })} /></Campo>
          {(f.franja_desde || f.franja_hasta) && <Boton variante="texto" tamano="pequeno" onClick={() => cambiar({ franja_desde: '', franja_hasta: '' })}>Quitar franja</Boton>}
        </div>
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 700, fontSize: 13, color: 'var(--cp-navy)', marginBottom: 6 }}>Días de la semana (ninguno = todos)</legend>
        <div style={fila}>
          {DIAS.map((d, i) => (
            <button key={d} type="button" aria-pressed={f.dias_semana.includes(i)} style={chip(f.dias_semana.includes(i))} onClick={() => cambiar({ dias_semana: alternar(f.dias_semana, i).sort() })}>{d}</button>
          ))}
        </div>
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 700, fontSize: 13, color: 'var(--cp-navy)', marginBottom: 6 }}>Frecuencia por persona</legend>
        <div style={fila} role="radiogroup" aria-label="Frecuencia">
          {([['UNA_VEZ', 'Una sola vez'], ['CADA_INGRESO', 'Cada ingreso'], ['VECES_POR_DIA', 'Veces por día'], ['CADA_N_HORAS', 'Cada N horas']] as const).map(([v, n]) => (
            <button key={v} type="button" role="radio" aria-checked={f.frecuencia === v} style={chip(f.frecuencia === v)} onClick={() => cambiar({ frecuencia: v })}>{n}</button>
          ))}
        </div>
        {f.frecuencia === 'VECES_POR_DIA' && (
          <Campo etiqueta="Veces por día"><input type="number" min={1} max={10} style={{ ...entrada, width: 100 }} value={f.veces_por_dia} onChange={(e) => cambiar({ veces_por_dia: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} /></Campo>
        )}
        {f.frecuencia === 'CADA_N_HORAS' && (
          <Campo etiqueta="Cada cuántas horas"><input type="number" min={1} max={720} style={{ ...entrada, width: 100 }} value={f.cada_horas} onChange={(e) => cambiar({ cada_horas: Math.min(720, Math.max(1, Number(e.target.value) || 1)) })} /></Campo>
        )}
      </fieldset>
    </div>
  );

  const cierre = (
    <div style={grupo}>
      <Campo etiqueta="Se cierra solo a los (segundos)" ayuda="0 = no se cierra solo. Se ve una barra con la cuenta regresiva.">
        <input type="number" min={0} max={120} style={{ ...entrada, width: 120 }} value={f.cierre_segundos} disabled={soloPersonal && !f.puede_cerrar}
          onChange={(e) => cambiar({ cierre_segundos: Math.min(120, Math.max(0, Number(e.target.value) || 0)) })} />
      </Campo>
      <div style={fila}>
        {[0, 5, 8, 15, 30].map((s) => (
          <button key={s} type="button" style={chip(f.cierre_segundos === s)} disabled={soloPersonal && !f.puede_cerrar} onClick={() => cambiar({ cierre_segundos: s })}>{s === 0 ? 'No' : `${s} s`}</button>
        ))}
      </div>
      {soloPersonal ? (
        <label style={{ ...fila, fontWeight: 700, color: 'var(--cp-navy)' }}>
          <input type="checkbox" checked={f.puede_cerrar} onChange={(e) => cambiar({ puede_cerrar: e.target.checked, ...(e.target.checked ? {} : { cierre_segundos: 0 }) })} style={{ width: 22, height: 22 }} />
          La persona puede cerrarlo antes (si no, debe pulsar «Entendido»)
        </label>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--cp-soft)' }}>Los clientes siempre pueden cerrarlo con la X o con Esc.</p>
      )}
    </div>
  );

  return (
    <>
      <ModalConPestanas
        titulo={titulo}
        ancho={1040}
        alCerrar={alCerrar}
        bloquearCierre={guardando}
        bajoPestanas={error ? <div role="alert" style={{ margin: '8px 16px 0', padding: '8px 12px', borderRadius: 10, background: '#fde8e8', color: '#8a1c1c', fontWeight: 700 }}>{error}</div> : undefined}
        pestanas={[
          { id: 'contenido', etiqueta: 'Contenido', contenido },
          { id: 'publico', etiqueta: 'Público', contenido: publico },
          { id: 'cuando', etiqueta: 'Cuándo sale', contenido: cuando },
          { id: 'cierre', etiqueta: 'Cierre', contenido: cierre },
        ]}
        pie={
          <>
            <Boton variante="secundario" onClick={alCerrar} disabled={guardando}>Cancelar</Boton>
            <Boton variante="secundario" onClick={() => setReal(true)}>Vista previa</Boton>
            <Boton onClick={guardar} cargando={guardando}>Guardar</Boton>
          </>
        }
      />
      {real && <ModalAnuncio anuncio={formAPublico(f)} alCerrar={() => setReal(false)} alClicBoton={() => setReal(false)} />}
    </>
  );
}
