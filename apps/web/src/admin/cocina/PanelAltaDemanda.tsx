import { useState } from 'react';
import type { AltaDemandaEstado } from './cocinaTipos';
import { configurarAltaDemanda } from './cocinaApi';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';

export interface PanelAltaDemandaProps {
  estado: AltaDemandaEstado;
  alCambiarEstado: (nuevo: AltaDemandaEstado) => void;
}

const ATAJOS_MINUTOS = [5, 10, 15, 20, 30, 45, 60] as const;

export function PanelAltaDemanda({
  estado,
  alCambiarEstado,
}: PanelAltaDemandaProps) {
  const [minutosSeleccionados, setMinutosSeleccionados] = useState<number>(
    estado.activa && estado.minutos > 0 ? estado.minutos : 15,
  );
  const [minutosInput, setMinutosInput] = useState<string>(
    String(estado.activa && estado.minutos > 0 ? estado.minutos : 15),
  );
  const [pausaPedidos, setPausaPedidos] = useState<boolean>(estado.pausa);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Modal de confirmación para activar/apagar o modificar
  const [confirmandoAccion, setConfirmandoAccion] = useState<{
    activa: boolean;
    minutos: number;
    pausa: boolean;
  } | null>(null);

  // Manejar cambio en input libre de minutos
  const handleCambioInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setMinutosInput(valStr);

    const num = parseInt(valStr, 10);
    if (isNaN(num)) {
      setErrorLocal('Ingresa un número entero de minutos.');
      return;
    }

    if (num < 5 || num > 180) {
      setErrorLocal('Los minutos deben estar entre 5 y 180.');
    } else {
      setErrorLocal(null);
      setMinutosSeleccionados(num);
    }
  };

  const seleccionarAtajo = (min: number) => {
    setMinutosSeleccionados(min);
    setMinutosInput(String(min));
    setErrorLocal(null);

    // Si ya está activa, solicitar confirmación para actualizar el tiempo
    if (estado.activa && min !== estado.minutos) {
      setConfirmandoAccion({
        activa: true,
        minutos: min,
        pausa: pausaPedidos,
      });
    }
  };

  const alternarPausa = (nuevaPausa: boolean) => {
    if (!estado.activa) {
      setErrorLocal('La pausa de pedidos solo se puede activar con alta demanda activa.');
      return;
    }
    setPausaPedidos(nuevaPausa);
    setConfirmandoAccion({
      activa: true,
      minutos: minutosSeleccionados,
      pausa: nuevaPausa,
    });
  };

  const clickBotonPrincipal = () => {
    if (estado.activa) {
      // Confirmar apagar
      setConfirmandoAccion({
        activa: false,
        minutos: 0,
        pausa: false,
      });
    } else {
      // Validar minutos
      const num = parseInt(minutosInput, 10);
      if (isNaN(num) || num < 5 || num > 180) {
        setErrorLocal('Los minutos deben estar entre 5 y 180.');
        return;
      }
      setErrorLocal(null);
      setConfirmandoAccion({
        activa: true,
        minutos: num,
        pausa: pausaPedidos,
      });
    }
  };

  const ejecutarConfiguracion = async () => {
    if (!confirmandoAccion) return;
    try {
      setGuardando(true);
      setErrorLocal(null);
      const res = await configurarAltaDemanda(confirmandoAccion);
      alCambiarEstado(res);
      setConfirmandoAccion(null);
    } catch (err: any) {
      setErrorLocal(err?.message || 'Error al configurar alta demanda');
      setConfirmandoAccion(null);
    } finally {
      setGuardando(false);
    }
  };

  const textoQuienActivo = estado.activa
    ? estado.mensaje || (estado.activado_por ? `activó ${estado.activado_por}` : null)
    : null;

  return (
    <section
      aria-label="Control de alta demanda"
      style={{
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: '14px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        {/* Interruptor principal de alta demanda */}
        <Boton
          variante={estado.activa ? 'peligro' : 'secundario'}
          onClick={clickBotonPrincipal}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '13px',
            border: '1.5px solid var(--cp-rust)',
            background: estado.activa ? 'var(--cp-rust)' : 'transparent',
            color: estado.activa ? 'var(--cp-white)' : 'var(--cp-rust)',
          }}
        >
          {estado.activa
            ? `Alta demanda: ACTIVADA (+${estado.minutos} min${
                estado.pausa ? ', pedidos en pausa' : ''
              }${textoQuienActivo ? ` · ${textoQuienActivo}` : ''})`
            : 'Alta demanda: apagada'}
        </Boton>

        {/* Atajos de minutos */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {ATAJOS_MINUTOS.map((m) => {
            const estaActivo = minutosSeleccionados === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => seleccionarAtajo(m)}
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  background: estaActivo ? 'var(--cp-navy)' : 'transparent',
                  color: estaActivo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  cursor: 'pointer',
                }}
              >
                +{m} min
              </button>
            );
          })}
        </div>

        {/* Input libre de minutos con validación de 5 a 180 */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--cp-navy)',
          }}
        >
          Otro (min):
          <input
            type="number"
            min={5}
            max={180}
            value={minutosInput}
            onChange={handleCambioInput}
            aria-label="Minutos extra de espera"
            style={{
              width: '76px',
              minHeight: '44px',
              boxSizing: 'border-box',
              borderRadius: '10px',
              border: `1.5px solid ${
                errorLocal && (parseInt(minutosInput, 10) < 5 || parseInt(minutosInput, 10) > 180)
                  ? 'var(--cp-rust)'
                  : 'var(--cp-navy)'
              }`,
              background: 'var(--cp-white)',
              padding: '0 8px',
              fontSize: '14px',
              fontWeight: 700,
              textAlign: 'center',
            }}
          />
        </label>

        {/* Chips de pausa de pedidos (solo válidos con alta demanda activa) */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={!estado.activa}
            onClick={() => alternarPausa(false)}
            style={{
              minHeight: '44px',
              padding: '0 12px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-navy)',
              fontWeight: 700,
              fontSize: '12px',
              background: !estado.pausa ? 'var(--cp-navy)' : 'transparent',
              color: !estado.pausa ? 'var(--cp-cream)' : 'var(--cp-navy)',
              opacity: !estado.activa ? 0.5 : 1,
              cursor: !estado.activa ? 'not-allowed' : 'pointer',
            }}
          >
            Seguir recibiendo pedidos
          </button>

          <button
            type="button"
            disabled={!estado.activa}
            onClick={() => alternarPausa(true)}
            style={{
              minHeight: '44px',
              padding: '0 12px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-rust)',
              fontWeight: 700,
              fontSize: '12px',
              background: estado.pausa ? 'var(--cp-rust)' : 'transparent',
              color: estado.pausa ? 'var(--cp-white)' : 'var(--cp-rust)',
              opacity: !estado.activa ? 0.5 : 1,
              cursor: !estado.activa ? 'not-allowed' : 'pointer',
            }}
          >
            Pausar pedidos
          </button>
        </div>
      </div>

      {/* Error de validación local */}
      {errorLocal && (
        <div
          role="alert"
          style={{
            fontSize: '13px',
            color: 'var(--cp-rust)',
            fontWeight: 700,
          }}
        >
          {errorLocal}
        </div>
      )}

      {/* Mensaje descriptivo del mockup */}
      <div style={{ fontSize: '12px', color: 'var(--cp-soft)', lineHeight: '18px' }}>
        Alta demanda: la carta y el chatbot avisan que la entrega tarda más (tiempo
        normal + los minutos que elijas, hasta 3 horas). Pausar pedidos: además la
        carta y el chatbot dejan de recibir pedidos nuevos y el bot pasa a un asesor;
        sirve para una emergencia. Solo vale mientras la alta demanda está activada.
      </div>

      {/* Confirmación Sí/No obligatoria */}
      <Confirmar
        abierto={Boolean(confirmandoAccion)}
        titulo={
          confirmandoAccion?.activa
            ? '¿Confirmar alta demanda?'
            : '¿Apagar la alta demanda?'
        }
        mensaje={
          confirmandoAccion?.activa
            ? `Se aplicarán +${confirmandoAccion.minutos} minutos de espera a la entrega en la carta y el chatbot.${
                confirmandoAccion.pausa
                  ? ' Además, la carta y el chatbot dejarán de recibir pedidos nuevos.'
                  : ''
              } Lo verán al instante todas las áreas de cocina.`
            : 'La carta y el chatbot volverán al tiempo de entrega normal (de 25 a 35 minutos) y el bot volverá a atender.'
        }
        textoSi={confirmandoAccion?.activa ? 'Sí, aplicar' : 'Sí, apagar'}
        textoNo="No, cancelar"
        peligro={!confirmandoAccion?.activa || confirmandoAccion?.pausa}
        cargando={guardando}
        alConfirmar={ejecutarConfiguracion}
        alCancelar={() => setConfirmandoAccion(null)}
      />
    </section>
  );
}
