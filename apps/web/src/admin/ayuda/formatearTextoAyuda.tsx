import React from 'react';

/**
 * Parsea formato en línea: reemplaza etiquetas <b>...</b> o **...** por <strong>,
 * y saltos de línea por <br />. No usa dangerouslySetInnerHTML.
 */
function formatearEnLinea(texto: string): React.ReactNode[] {
  // Primero dividimos por saltos de línea
  const lineas = texto.split(/(?:\r\n|\r|\n|<br\s*\/?>)/gi);

  return lineas.flatMap((linea, idxLinea) => {
    // Dividir por negritas: <b>...</b> o **...**
    const partes = linea.split(/(?:<b>(.*?)<\/b>|\*\*(.*?)\*\*)/gi);
    const nodosLinea: React.ReactNode[] = [];

    for (let i = 0; i < partes.length; i++) {
      const parte = partes[i];
      if (parte === undefined || parte === '') continue;

      // Cada 3 partes capturadas por el regex (match completo, grupo 1 <b>, grupo 2 **)
      // Los índices impares o con contenido capturado son las negritas
      if (i % 3 === 1 || i % 3 === 2) {
        nodosLinea.push(<strong key={`b-${idxLinea}-${i}`}>{parte}</strong>);
      } else {
        nodosLinea.push(parte);
      }
    }

    if (idxLinea < lineas.length - 1) {
      nodosLinea.push(<br key={`br-${idxLinea}`} />);
    }

    return nodosLinea;
  });
}

/**
 * Formatea texto de ayuda soportando listas <ol><li>...</li></ol> y negritas <b>
 * de forma completamente segura y accesible en React.
 */
export function formatearTextoAyuda(textoOriginal: string): React.ReactNode {
  if (!textoOriginal) return null;

  // Si no contiene etiquetas <ol>, formatear directamente en línea
  if (!/<ol>/i.test(textoOriginal)) {
    return <>{formatearEnLinea(textoOriginal)}</>;
  }

  // Si contiene listas ordenadas, dividimos en segmentos fuera y dentro de <ol>
  const partesOl = textoOriginal.split(/<ol>(.*?)<\/ol>/gis);
  const elementos: React.ReactNode[] = [];

  for (let i = 0; i < partesOl.length; i++) {
    const segmento = partesOl[i];
    if (!segmento) continue;

    if (i % 2 === 1) {
      // Es el interior de un <ol>...</ol>
      const itemsLi = segmento
        .split(/<li>(.*?)<\/li>/gis)
        .filter((_, idx) => idx % 2 === 1);

      elementos.push(
        <ol key={`ol-${i}`}>
          {itemsLi.map((liTexto, liIdx) => (
            <li key={`li-${i}-${liIdx}`}>{formatearEnLinea(liTexto.trim())}</li>
          ))}
        </ol>
      );
    } else {
      // Texto antes o después de la lista
      elementos.push(
        <React.Fragment key={`p-${i}`}>
          {formatearEnLinea(segmento.trim())}
        </React.Fragment>
      );
    }
  }

  return <>{elementos}</>;
}
