// Agente local para PC de caja (ESC/POS y mini servidor de contingencia)
// Fase futura (DT-29, DT-52)

export function iniciarAgenteLocal() {
  return {
    estado: 'listo',
    modulo: 'agente-local',
    descripcion: 'Agente local de impresión y modo de contingencia sin internet',
  };
}
