/**
 * Lo que queda en un campo de celular al escribir o pegar: solo dígitos y máximo 9.
 * Si se pega con el código del Perú (+51 975 026 835, 0051…, 51975026835) se quita el 51
 * en vez de cortar los últimos dígitos. Los campos NO deben llevar maxLength={9}:
 * el navegador cortaría el texto pegado antes de llegar aquí.
 */
export function celularAlEscribir(texto: string): string {
  let d = texto.replace(/\D/g, '');
  if (d.length > 9 && d.startsWith('00')) d = d.slice(2);
  if (d.length > 9 && d.startsWith('51')) d = d.slice(2);
  return d.slice(0, 9);
}
