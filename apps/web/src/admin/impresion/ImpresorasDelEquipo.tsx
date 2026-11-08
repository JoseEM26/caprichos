import { useEffect, useRef, useState } from 'react';
import type { EquipoEstadoImpresion, EstadoMaquinaImpresion, ImpresoraCandidata, RolImpresora } from '@caprichos/compartido';
import { Confirmar } from '../../comun/Confirmar';
import { impresionApi } from './impresionApi';

const NOMBRE: Record<RolImpresora, string> = { ETIQUETERA: 'etiquetera', TICKETERA: 'ticketera' };

/** Comandos del programa (se copian y se pegan en la ventana negra de la computadora de ese equipo). */
export const COMANDOS_PROGRAMA: Array<{ comando: string; para: string }> = [
  { comando: 'impresoras', para: 'Lista numerada de las impresoras de esa computadora' },
  { comando: 'probar-todas', para: 'Cada impresora imprime "Impresora N de M" para ver cuál es cuál' },
  { comando: 'probar 3', para: 'Imprime una hoja solo en la impresora número 3 (o por nombre)' },
  { comando: 'usar etiquetera 3', para: 'Deja la impresora 3 como etiquetera (stickers), guardada para siempre' },
  { comando: 'usar ticketera 5', para: 'Deja la impresora 5 como ticketera (voucher), guardada para siempre' },
  { comando: 'estado', para: 'Muestra qué impresora tiene guardada cada rol y si aparece' },
  { comando: '--estado', para: 'Dice si el programa está corriendo en segundo plano y cuándo se conectó por última vez' },
  { comando: '--detener', para: 'Detiene el programa (para volver a prenderlo, ábrelo de nuevo)' },
  { comando: '--reiniciar', para: 'Lo detiene y lo vuelve a prender en segundo plano' },
  { comando: '--ver-logs', para: 'Muestra el registro del programa, para diagnosticar sin ventana' },
  { comando: '--instalar-inicio', para: 'Que el programa arranque solo al prender la PC (se instala solo la primera vez)' },
  { comando: '--quitar-inicio', para: 'Que ya no arranque solo' },
  { comando: 'menu', para: 'Menú con números, sin recordar comandos' },
];

/** Qué le pasa a una máquina, en una frase que el dueño entiende (por rol de un equipo). */
export function textoEstadoMaquina(m: EstadoMaquinaImpresion | undefined): { texto: string; tipo: 'ok' | 'aviso' | 'error' } {
  if (!m) return { texto: 'Sin información', tipo: 'aviso' };
  if (m.estado === 'sin_programa') {
    return { texto: 'El programa no está corriendo en esa computadora: ábrelo (o activa el arranque automático).', tipo: 'error' };
  }
  if (m.estado === 'no_configurada') {
    return { texto: 'Aún no elegiste la impresora para este rol: elige una de la lista de abajo.', tipo: 'aviso' };
  }
  if (m.conectada) return { texto: `Lista${m.impresoraNombre ? `: ${m.impresoraNombre}` : ''}`, tipo: 'ok' };
  if (m.estado === 'desconectada') {
    const nombre = m.impresoraNombre || m.impresoraId;
    return {
      texto: `La impresora elegida no aparece${nombre ? ` (${nombre})` : ''}. Enciéndela o conéctala; el programa la busca solo.`,
      tipo: 'error',
    };
  }
  return { texto: m.motivo || 'La impresora tiene un problema', tipo: 'error' };
}

type Resultado = { tipo: 'proceso' | 'ok' | 'error'; texto: string };
const COLOR: Record<Resultado['tipo'], string> = { proceso: 'var(--cp-navy, #0B2C3E)', ok: 'var(--cp-green, #2F7A45)', error: 'var(--cp-rust, #B2500F)' };

/** «hace 5 min» / «hace 2 d» a partir del último latido. */
export function haceCuanto(iso: string | null | undefined, ahora = Date.now()): string {
  if (!iso) return 'nunca';
  const s = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000));
  if (s < 90) return 'hace unos segundos';
  if (s < 5400) return `hace ${Math.round(s / 60)} min`;
  if (s < 129600) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

const boton = {
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 8,
  border: '1.5px solid var(--cp-navy, #0B2C3E)',
  background: 'transparent',
  color: 'var(--cp-navy, #0B2C3E)',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
} as const;

/**
 * Impresoras que ve cada computadora con el programa: estado por rol, «Probar TODAS», prueba de una sola
 * y «Usar esta impresora». Todo es POR computadora (Caja, Bebidas...).
 */
export function ImpresorasDelEquipo({ equipo, alCambiar }: { equipo: EquipoEstadoImpresion; alCambiar?: () => void }) {
  const [resultados, setResultados] = useState<Record<string, Resultado>>({});
  const [general, setGeneral] = useState<Resultado | null>(null);
  const [confirmarTodas, setConfirmarTodas] = useState(false);
  const [elegir, setElegir] = useState<{ rol: RolImpresora; c: ImpresoraCandidata } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [fusionando, setFusionando] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState<string | null>(null);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const marcar = (id: string, r: Resultado) => vivo.current && setResultados((prev) => ({ ...prev, [id]: r }));

  /** Mira la prueba hasta que sale o falla (unos 30 s). */
  const seguir = async (clave: string, trabajoId: string) => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      if (!vivo.current) return;
      try {
        const e = await impresionApi.estadoPrueba(trabajoId);
        if (e.estado === 'IMPRESO') return marcar(clave, { tipo: 'ok', texto: 'Impresa: mira si salió en la impresora que esperabas.' });
        if (['FALLIDO', 'VENCIDO', 'DESCARTADO'].includes(e.estado)) {
          return marcar(clave, { tipo: 'error', texto: `Error: ${e.error || 'no se pudo imprimir la prueba'}` });
        }
        marcar(clave, { tipo: 'proceso', texto: e.estado === 'IMPRIMIENDO' ? 'Imprimiendo...' : 'Enviada: esperando al programa.' });
      } catch {
        // un fallo de red puntual no corta la espera
      }
    }
    marcar(clave, { tipo: 'proceso', texto: 'Sigue en la cola. Si no sale, revisa que el programa esté abierto.' });
  };

  const probar = async (c: ImpresoraCandidata, rol: RolImpresora) => {
    marcar(c.id, { tipo: 'proceso', texto: 'Enviando...' });
    try {
      const r = await impresionApi.pruebaImpresion(rol, c.id, equipo.deviceKeyId);
      marcar(c.id, { tipo: 'proceso', texto: 'Enviada a la cola.' });
      await seguir(c.id, r.trabajoId);
    } catch (err: any) {
      marcar(c.id, { tipo: 'error', texto: err?.message || 'No se pudo enviar la prueba' });
    }
  };

  const probarTodas = async () => {
    setConfirmarTodas(false);
    setGeneral({ tipo: 'proceso', texto: 'Enviando una hoja a cada impresora...' });
    try {
      const r = await impresionApi.pruebaTodas(equipo.deviceKeyId);
      setGeneral({ tipo: 'ok', texto: `${r.mensaje}. Mira cuál imprime «Impresora N de ${r.total}» y elige con «Usar como...».` });
      for (const t of r.trabajos) void seguir(t.impresoraId, t.trabajoId);
    } catch (err: any) {
      setGeneral({ tipo: 'error', texto: err?.message || 'No se pudo enviar las pruebas' });
    }
  };

  const usar = async () => {
    if (!elegir) return;
    const { rol, c } = elegir;
    setElegir(null);
    try {
      const r = await impresionApi.elegirImpresora(rol, c.id, equipo.deviceKeyId);
      setGeneral({ tipo: 'ok', texto: r.mensaje });
      alCambiar?.();
    } catch (err: any) {
      setGeneral({ tipo: 'error', texto: err?.message || 'No se pudo guardar la elección' });
    }
  };

  const eliminar = async () => {
    try {
      const r = await impresionApi.eliminarEquipo(equipo.deviceKeyId, motivo.trim());
      setEliminando(false);
      setGeneral({ tipo: 'ok', texto: `PC eliminada.${r.descartados ? ` Se descartaron ${r.descartados} trabajos pendientes.` : ''}` });
      alCambiar?.();
    } catch (err: any) {
      setEliminando(false);
      setGeneral({ tipo: 'error', texto: err?.message || 'No se pudo eliminar la PC' });
    }
  };

  const decidirRepetida = async (esLaMisma: boolean) => {
    if (!equipo.repetidaDe) return;
    setFusionando(false);
    try {
      if (esLaMisma) await impresionApi.fusionarEquipo(equipo.deviceKeyId, equipo.repetidaDe.deviceKeyId);
      else await impresionApi.noEsLaMisma(equipo.deviceKeyId, equipo.repetidaDe.deviceKeyId);
      alCambiar?.();
    } catch (err: any) {
      setGeneral({ tipo: 'error', texto: err?.message || 'No se pudo guardar tu respuesta' });
    }
  };

  const guardarNombre = async () => {
    const n = (editandoNombre ?? '').trim();
    setEditandoNombre(null);
    if (!n || n === equipo.nombre) return;
    try {
      await impresionApi.guardarConfigEquipo(equipo.deviceKeyId, { nombre: n } as any);
      alCambiar?.();
    } catch (err: any) {
      setGeneral({ tipo: 'error', texto: err?.message || 'No se pudo guardar el nombre' });
    }
  };

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(texto);
    } catch {
      // sin portapapeles: el comando se puede seleccionar a mano
    }
  };

  const candidatas = equipo.candidatas;
  const enUso = (id: string): RolImpresora[] =>
    (['ETIQUETERA', 'TICKETERA'] as RolImpresora[]).filter((r) => equipo.impresoras[r]?.impresoraId === id);

  return (
    <section
      data-cfg-id="impresion-impresoras-equipo"
      tabIndex={-1}
      data-testid={`equipo-${equipo.deviceKeyId}`}
      aria-label={`Impresoras de ${equipo.nombre}`}
      style={{ border: '1px solid var(--cp-line, #E3D6C6)', borderRadius: 12, padding: 12, background: 'var(--cp-cream, #FBF4EC)', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }}>
          {equipo.nombre} <small style={{ fontWeight: 600 }}>({equipo.areaNombre ?? 'Caja'})</small>
        </h4>
        <span style={{ fontSize: 12, fontWeight: 800, color: equipo.conectado ? COLOR.ok : COLOR.error }}>
          {equipo.conectado ? 'Programa conectado' : 'Programa sin conexión'}
        </span>
      </div>

      <div data-testid={`datos-${equipo.deviceKeyId}`} style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {editandoNombre === null ? (
          <button type="button" aria-label={`Cambiar el nombre de ${equipo.nombre}`} style={{ ...boton, minHeight: 44, fontSize: 12 }} onClick={() => setEditandoNombre(equipo.nombre)}>
            Poner nombre (Caja, Cocina...)
          </button>
        ) : (
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <input aria-label="Nombre de la PC" value={editandoNombre} maxLength={60} onChange={(e) => setEditandoNombre(e.target.value)} style={{ minHeight: 44, padding: '0 10px', borderRadius: 8, border: '1px solid var(--cp-line, #E3D6C6)' }} />
            <button type="button" style={boton} onClick={() => void guardarNombre()}>
              Guardar nombre
            </button>
          </span>
        )}
        <span>PC: <strong>{equipo.hostname ?? 'sin nombre'}</strong></span>
        <span>{equipo.sistema ?? 'sistema desconocido'}</span>
        <span>IP: {equipo.ipLocal?.length ? equipo.ipLocal.join(', ') : 'sin dato'}</span>
        <span>Último latido: {haceCuanto(equipo.ultimoLatido)}</span>
        <strong style={{ color: equipo.config?.configurado ? COLOR.ok : COLOR.error }}>
          {equipo.config?.configurado ? 'Configurada' : 'Nueva: falta configurar'}
        </strong>
      </div>

      {equipo.repetidaDe && (
        <div role="alert" data-testid={`repetida-${equipo.deviceKeyId}`} style={{ border: '1.5px solid var(--cp-orange, #E67929)', borderRadius: 10, padding: 10, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <strong>Esta PC parece repetida: ¿es la misma que {equipo.repetidaDe.nombre}?</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={{ ...boton, background: 'var(--cp-navy, #0B2C3E)', color: 'var(--cp-cream, #FBF4EC)' }} onClick={() => setFusionando(true)}>
              Sí, es la misma
            </button>
            <button type="button" style={boton} onClick={() => void decidirRepetida(false)}>
              No, es otra PC
            </button>
          </div>
        </div>
      )}

      {!equipo.conectado && (
        <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: COLOR.error }}>
          Esta computadora no está conectada.{equipo.pendientes > 0 ? ` Sus ${equipo.pendientes} trabajos esperan en cola y saldrán al abrir el programa.` : ' Los trabajos que le tocan esperan en cola y no se pierden.'}
        </div>
      )}

      {(['ETIQUETERA', 'TICKETERA'] as RolImpresora[]).map((rol) => {
        const e = textoEstadoMaquina(equipo.impresoras[rol]);
        const pedida = equipo.seleccion[rol];
        const usada = equipo.impresoras[rol]?.impresoraId;
        return (
          <div key={rol} data-testid={`estado-${equipo.deviceKeyId}-${rol.toLowerCase()}`} style={{ fontSize: 13 }}>
            <strong style={{ textTransform: 'capitalize' }}>{NOMBRE[rol]}:</strong>{' '}
            <span style={{ color: COLOR[e.tipo === 'aviso' ? 'proceso' : e.tipo], fontWeight: 700 }}>{e.texto}</span>
            {pedida && usada !== pedida && equipo.conectado && (
              <small style={{ display: 'block' }}>Elegiste otra impresora: el programa la toma en unos segundos.</small>
            )}
          </div>
        );
      })}

      {equipo.conectado && candidatas.length === 0 && (
        <div style={{ fontSize: 13 }}>
          Este programa no informa sus impresoras (versión vieja o ninguna instalada). Descarga la versión nueva con «Instalar o vincular programa».
        </div>
      )}

      {candidatas.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" style={boton} onClick={() => setConfirmarTodas(true)}>
              Probar TODAS ({candidatas.length})
            </button>
            <small>Cada impresora imprime su número: así sabes cuál es cuál.</small>
          </div>
          <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {candidatas.map((c, i) => {
              const r = resultados[c.id];
              const roles = enUso(c.id);
              return (
                <li key={c.id} data-testid={`impresora-${i + 1}`} style={{ fontSize: 13 }}>
                  <strong>{c.nombre}</strong>
                  {c.detalle ? ` — ${c.detalle}` : ''}
                  {c.sugerido ? <small> (parece {NOMBRE[c.sugerido]})</small> : null}
                  {roles.length > 0 && <strong style={{ color: COLOR.ok }}> · ES LA {roles.map((x) => NOMBRE[x].toUpperCase()).join(' Y LA ')}</strong>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <button type="button" style={boton} onClick={() => void probar(c, c.sugerido ?? 'ETIQUETERA')}>
                      Imprimir prueba
                    </button>
                    {!c.sugerido && (
                      <button type="button" style={boton} onClick={() => void probar(c, 'TICKETERA')}>
                        Imprimir prueba de ticket
                      </button>
                    )}
                    <button type="button" style={boton} onClick={() => setElegir({ rol: 'ETIQUETERA', c })}>
                      Usar como etiquetera
                    </button>
                    <button type="button" style={boton} onClick={() => setElegir({ rol: 'TICKETERA', c })}>
                      Usar como ticketera
                    </button>
                  </div>
                  {r && (
                    <div role={r.tipo === 'error' ? 'alert' : 'status'} style={{ color: COLOR[r.tipo], fontWeight: 700, marginTop: 4 }}>
                      {r.texto}
                      {r.tipo === 'error' && (
                        <button type="button" style={{ ...boton, marginLeft: 8, minHeight: 36 }} onClick={() => void probar(c, c.sugerido ?? 'ETIQUETERA')}>
                          Reintentar
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}

      {general && (
        <div role={general.tipo === 'error' ? 'alert' : 'status'} style={{ color: COLOR[general.tipo], fontWeight: 700, fontSize: 13 }}>
          {general.texto}
        </div>
      )}

      <details>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 800 }}>Comandos del programa (para esa computadora)</summary>
        <p style={{ fontSize: 12, margin: '6px 0' }}>
          Abre una ventana de comandos en la carpeta del programa y escribe, por ejemplo: <code>agente-impresion-windows.exe impresoras</code>
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {COMANDOS_PROGRAMA.map((c) => (
            <li key={c.comando}>
              <code>{c.comando}</code> — {c.para}{' '}
              <button type="button" aria-label={`Copiar ${c.comando}`} style={{ ...boton, minHeight: 32, fontSize: 11 }} onClick={() => void copiar(c.comando)}>
                {copiado === c.comando ? 'Copiado' : 'Copiar'}
              </button>
            </li>
          ))}
        </ul>
        <small>Guía completa: docs/operacion/GUIA-elegir-impresora-y-autoarranque.md</small>
      </details>

      <div>
        <button
          type="button"
          aria-label={`Eliminar PC ${equipo.nombre}`}
          style={{ ...boton, borderColor: 'var(--cp-rust, #B2500F)', color: 'var(--cp-rust, #B2500F)' }}
          onClick={() => setEliminando(true)}
        >
          Eliminar PC
        </button>
      </div>

      <Confirmar
        abierto={fusionando}
        titulo={`¿${equipo.nombre} es la misma PC que ${equipo.repetidaDe?.nombre ?? ''}?`}
        mensaje="Esta PC hereda la configuración de la otra y la otra queda archivada. Nada se borra."
        textoSi="Sí, es la misma"
        textoNo="No"
        alConfirmar={() => decidirRepetida(true)}
        alCancelar={() => setFusionando(false)}
      />
      <Confirmar
        abierto={eliminando}
        titulo={`¿Eliminar la PC «${equipo.nombre}»?`}
        mensaje={`PC: ${equipo.hostname ?? 'sin nombre'} · IP: ${equipo.ipLocal?.join(', ') || 'sin dato'} · Último latido: ${haceCuanto(equipo.ultimoLatido)}. Esta PC dejará de imprimir y su vinculación se desactiva. Sus trabajos pendientes se descartan.`}
        textoSi="Sí, eliminar"
        textoNo="No"
        peligro
        alConfirmar={eliminar}
        alCancelar={() => setEliminando(false)}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          Motivo (opcional)
          <input aria-label="Motivo para eliminar la PC" value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} style={{ minHeight: 44, padding: '0 10px', borderRadius: 8, border: '1px solid var(--cp-line, #E3D6C6)' }} />
        </label>
      </Confirmar>
      <Confirmar
        abierto={confirmarTodas}
        titulo={`¿Probar las ${candidatas.length} impresoras?`}
        mensaje="Sale una hoja en cada impresora de esa computadora, con su número. Gasta un poco de papel y etiqueta en cada una."
        textoSi="Sí, probar todas"
        textoNo="No"
        alConfirmar={probarTodas}
        alCancelar={() => setConfirmarTodas(false)}
      />
      <Confirmar
        abierto={!!elegir}
        titulo={elegir ? `¿Usar «${elegir.c.nombre}» como ${NOMBRE[elegir.rol]} de ${equipo.nombre}?` : ''}
        mensaje="Queda guardada en esa computadora: al encenderla se conecta sola a esa impresora, hasta que la cambies aquí."
        textoSi="Sí, usar esta"
        textoNo="No"
        alConfirmar={usar}
        alCancelar={() => setElegir(null)}
      />
    </section>
  );
}
