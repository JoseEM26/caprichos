import { useEffect, useRef, useState } from 'react';
import type { EstadoMaquinaImpresion, RolImpresora } from '@caprichos/compartido';
import { Confirmar } from '../../comun/Confirmar';
import { impresionApi } from './impresionApi';

const NOMBRE: Record<RolImpresora, string> = { ETIQUETERA: 'Etiquetera', TICKETERA: 'Ticketera' };
const BOTON: Record<RolImpresora, string> = {
  ETIQUETERA: 'Imprimir etiqueta de prueba',
  TICKETERA: 'Imprimir ticket de prueba',
};
const PREGUNTA: Record<RolImpresora, string> = {
  ETIQUETERA: '¿Imprimir una etiqueta de prueba?',
  TICKETERA: '¿Imprimir un ticket de prueba?',
};

/** Cuántas veces y cada cuánto se mira el estado de la prueba (unos 30 s). */
const INTENTOS = 20;
const CADA_MS = 1500;

type Resultado = { tipo: 'proceso' | 'ok' | 'error'; texto: string };

/**
 * Botón «Imprimir … de prueba» de una máquina: pide confirmación, encola la prueba y muestra
 * el resultado (en cola, impresa o error con el motivo del agente). Sin pedido real.
 */
export function PruebaImpresion({
  rol,
  maquina,
}: {
  rol: RolImpresora;
  maquina: EstadoMaquinaImpresion | null | undefined;
}) {
  const conectada = Boolean(maquina?.conectada);
  const [preguntando, setPreguntando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const seguir = async (trabajoId: string) => {
    for (let i = 0; i < INTENTOS; i++) {
      await new Promise((r) => setTimeout(r, CADA_MS));
      if (!vivo.current) return;
      try {
        const e = await impresionApi.estadoPrueba(trabajoId);
        if (!vivo.current) return;
        if (e.estado === 'IMPRESO') {
          setResultado({ tipo: 'ok', texto: 'Impresa: la prueba salió bien.' });
          return;
        }
        if (['FALLIDO', 'VENCIDO', 'DESCARTADO'].includes(e.estado)) {
          setResultado({ tipo: 'error', texto: `Error: ${e.error || 'no se pudo imprimir la prueba'}` });
          return;
        }
        setResultado({
          tipo: 'proceso',
          texto: e.estado === 'IMPRIMIENDO' ? 'Imprimiendo la prueba...' : 'Enviada a la cola: esperando a la máquina.',
        });
      } catch {
        // Un fallo puntual de red no corta la espera: se vuelve a intentar
      }
    }
    if (vivo.current) {
      setResultado({
        tipo: 'proceso',
        texto: 'Sigue en la cola. Si no sale, revísala con Gestionar cola.',
      });
    }
  };

  const ejecutar = async () => {
    setPreguntando(false);
    setEnviando(true);
    setResultado(null);
    try {
      const r = await impresionApi.pruebaImpresion(rol);
      if (!vivo.current) return;
      setEnviando(false);
      setResultado({ tipo: 'proceso', texto: 'Enviada a la cola.' });
      await seguir(r.trabajoId);
    } catch (err: any) {
      if (!vivo.current) return;
      setEnviando(false);
      setResultado({ tipo: 'error', texto: err?.message || 'No se pudo enviar la prueba' });
    }
  };

  const colores: Record<Resultado['tipo'], { fondo: string; color: string }> = {
    proceso: { fondo: 'var(--cp-sand, #EDE1D1)', color: 'var(--cp-navy, #0B2C3E)' },
    ok: { fondo: 'var(--cp-sand, #EDE1D1)', color: 'var(--cp-green, #2F7A45)' },
    error: { fondo: '#FBE9DF', color: 'var(--cp-rust, #B2500F)' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button
        type="button"
        disabled={!conectada || enviando}
        onClick={() => setPreguntando(true)}
        style={{
          minHeight: 44,
          padding: '0 12px',
          borderRadius: 8,
          border: '1.5px solid var(--cp-navy, #0B2C3E)',
          background: 'transparent',
          color: 'var(--cp-navy, #0B2C3E)',
          fontSize: 13,
          fontWeight: 800,
          cursor: !conectada || enviando ? 'not-allowed' : 'pointer',
          opacity: !conectada ? 0.6 : 1,
        }}
      >
        {enviando ? 'Enviando...' : BOTON[rol]}
      </button>
      {!conectada && (
        <small style={{ color: 'var(--cp-rust, #B2500F)', fontWeight: 700 }}>
          {NOMBRE[rol]} desconectada: abre el programa de impresión
        </small>
      )}
      {resultado && (
        <div
          role={resultado.tipo === 'error' ? 'alert' : 'status'}
          style={{
            background: colores[resultado.tipo].fondo,
            color: colores[resultado.tipo].color,
            padding: '8px 10px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {resultado.texto}
        </div>
      )}

      <Confirmar
        abierto={preguntando}
        titulo={PREGUNTA[rol]}
        mensaje="Sale una pieza de ejemplo marcada como PRUEBA. No es un pedido y no cambia nada del local."
        textoSi="Sí, imprimir"
        textoNo="No"
        alConfirmar={ejecutar}
        alCancelar={() => setPreguntando(false)}
      />
    </div>
  );
}
