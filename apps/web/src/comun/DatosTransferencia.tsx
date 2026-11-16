import { useState } from 'react';

export interface InfoTransferencia {
  banco?: string;
  titular?: string;
  cuenta?: string;
  cci?: string;
}

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false; // sin portapapeles el dato queda visible para copiarlo a mano
  }
}

const botonCopiar = {
  minHeight: 36,
  minWidth: 64,
  padding: '0 10px',
  borderRadius: 8,
  border: '1.5px solid var(--cp-navy, #0B2C3E)',
  background: 'var(--cp-white, #FFFFFF)',
  color: 'var(--cp-navy, #0B2C3E)',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
} as const;

/** Un dato con su botón «Copiar». */
export function FilaCopiable({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [listo, setListo] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)' }}>{etiqueta}</div>
        <strong style={{ fontSize: 15, wordBreak: 'break-all' }}>{valor}</strong>
      </div>
      <button
        type="button"
        aria-label={`Copiar ${etiqueta}`}
        onClick={() => void copiar(valor).then((ok) => ok && setListo(true))}
        style={botonCopiar}
      >
        {listo ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

/** Texto de todos los datos, cada uno en su línea (para pegar en el chat o en la app del banco). */
export function textoTransferencia(i: InfoTransferencia): string {
  return [
    i.banco && `Banco: ${i.banco}`,
    i.titular && `Titular: ${i.titular}`,
    i.cuenta && `N.º de cuenta: ${i.cuenta}`,
    i.cci && `CCI: ${i.cci}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Banco, titular, cuenta y CCI de la transferencia, cada uno con «Copiar», y «Copiar todo». */
export function DatosTransferencia({ info }: { info?: InfoTransferencia | null }) {
  const [todo, setTodo] = useState(false);
  if (!info || !(info.cuenta || info.cci)) return null;
  return (
    <div data-testid="datos-transferencia" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {info.banco && <FilaCopiable etiqueta="Banco" valor={info.banco} />}
      {info.titular && <FilaCopiable etiqueta="Titular" valor={info.titular} />}
      {info.cuenta && <FilaCopiable etiqueta="N.º de cuenta" valor={info.cuenta} />}
      {info.cci && <FilaCopiable etiqueta="CCI" valor={info.cci} />}
      <button
        type="button"
        onClick={() => void copiar(textoTransferencia(info)).then((ok) => ok && setTodo(true))}
        style={{ ...botonCopiar, minHeight: 44, fontSize: 13 }}
      >
        {todo ? 'Copiado todo' : 'Copiar todo'}
      </button>
    </div>
  );
}
