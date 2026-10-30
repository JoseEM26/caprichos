import { useState, useEffect } from 'react';
import type { AltaDemandaEstado } from './cocinaTipos';
import { configurarAltaDemanda } from './cocinaApi';
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
    estado.activa && estado.minutos > 0 ? estado.minutos : 10,
  );
  const [minutosInput, setMinutosInput] = useState<string>(
    String(estado.activa && estado.minutos > 0 ? estado.minutos : 10),
  );
  const [pausaPedidos, setPausaPedidos] = useState<boolean>(estado.pausa);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [, setGuardando] = useState(false);

  const [confirmandoAccion, setConfirmandoAccion] = useState<{
    activa: boolean;
    minutos: number;
    pausa: boolean;
  } | null>(null);

  useEffect(() => {
    if (estado.activa && estado.minutos > 0) {
      setMinutosSeleccionados(estado.minutos);
      setMinutosInput(String(estado.minutos));
    }
    setPausaPedidos(estado.pausa);
  }, [estado.activa, estado.minutos, estado.pausa]);

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
      setConfirmandoAccion({
        activa: false,
        minutos: 0,
        pausa: false,
      });
    } else {
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

  const quienActivo = estado.activado_por || estado.mensaje || '';

  const labelPrincipal = estado.activa
    ? `Alta demanda: ACTIVADA (+${estado.minutos} min${
        estado.pausa ? ', pedidos en pausa' : ''
      }${quienActivo ? ' · activó ' + quienActivo : ''})`
    : 'Alta demanda: apagada';

  return (
    <>
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
          padding: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
          fontFamily: 'Montserrat, system-ui, sans-serif',
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          onClick={clickBotonPrincipal}
          style={{
            minHeight: '44px',
            padding: '0 14px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            border: '1.5px solid var(--cp-rust)',
            background: estado.activa ? 'var(--cp-rust)' : 'transparent',
            color: estado.activa ? 'var(--cp-white)' : 'var(--cp-navy)',
          }}
        >
          {labelPrincipal}
        </button>

        {ATAJOS_MINUTOS.map((min) => {
          const seleccionado = minutosSeleccionados === min;
          return (
            <button
              key={min}
              type="button"
              onClick={() => seleccionarAtajo(min)}
              style={{
                minHeight: '44px',
                padding: '0 12px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                background: seleccionado ? 'var(--cp-navy)' : 'transparent',
                color: seleccionado ? 'var(--cp-cream)' : 'var(--cp-navy)',
                cursor: 'pointer',
              }}
            >
              +{min} min
            </button>
          );
        })}

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
          Otro (min)
          <input
            type="number"
            min={1}
            max={180}
            value={minutosInput}
            onChange={handleCambioInput}
            aria-label="Minutos extra de espera"
            style={{
              width: '76px',
              boxSizing: 'border-box',
              minHeight: '44px',
              borderRadius: '10px',
              border: '1.5px solid var(--cp-navy)',
              background: 'var(--cp-white)',
              padding: '0 8px',
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--cp-navy)',
            }}
          />
        </label>

        <button
          type="button"
          onClick={() => alternarPausa(false)}
          style={{
            minHeight: '44px',
            padding: '0 12px',
            borderRadius: '9999px',
            border: '1.5px solid var(--cp-navy)',
            fontWeight: 700,
            fontSize: '12px',
            background: !pausaPedidos ? 'var(--cp-navy)' : 'transparent',
            color: !pausaPedidos ? 'var(--cp-cream)' : 'var(--cp-navy)',
            cursor: 'pointer',
          }}
        >
          Seguir recibiendo pedidos
        </button>

        <button
          type="button"
          onClick={() => alternarPausa(true)}
          style={{
            minHeight: '44px',
            padding: '0 12px',
            borderRadius: '9999px',
            border: '1.5px solid var(--cp-navy)',
            fontWeight: 700,
            fontSize: '12px',
            background: pausaPedidos ? 'var(--cp-navy)' : 'transparent',
            color: pausaPedidos ? 'var(--cp-cream)' : 'var(--cp-navy)',
            cursor: 'pointer',
          }}
        >
          Pausar pedidos
        </button>

        {errorLocal && (
          <div
            role="alert"
            style={{
              flex: '1 1 100%',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--cp-rust)',
            }}
          >
            {errorLocal}
          </div>
        )}

        <div
          style={{
            flex: '1 1 100%',
            fontSize: '12px',
            color: 'var(--cp-soft)',
            lineHeight: '17px',
          }}
        >
          Alta demanda: la carta y el chatbot avisan que la entrega tarda más
          (tiempo normal + los minutos que elijas, hasta 3 horas). Pausar
          pedidos: además la carta y el chatbot dejan de recibir pedidos nuevos y
          el bot pasa a un asesor; sirve para una emergencia. Solo vale mientras
          la alta demanda está activada.
        </div>
      </div>

      <Confirmar
        abierto={!!confirmandoAccion}
        titulo={
          confirmandoAccion?.activa
            ? '¿Confirmar alta demanda? ¿Activar la alta demanda?'
            : '¿Confirmar alta demanda? ¿Apagar la alta demanda?'
        }
        mensaje={
          confirmandoAccion?.activa
            ? `La carta y el chatbot avisarán que la entrega tarda más (+${confirmandoAccion.minutos} min).${
                confirmandoAccion.pausa
                  ? ' Además, la carta y el chatbot dejarán de recibir pedidos nuevos.'
                  : ''
              }`
            : 'La carta y el chatbot vuelven a decir de 25 a 35 minutos y el bot vuelve a atender.'
        }
        textoConfirmar={
          confirmandoAccion?.activa ? 'Sí, activar' : 'Sí, apagar'
        }
        textoNo="No, cancelar"
        alConfirmar={ejecutarConfiguracion}
        alCancelar={() => setConfirmandoAccion(null)}
      />
    </>
  );
}
