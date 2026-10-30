// jsdom no trae PointerEvent: se simula con MouseEvent para probar pulsaciones.
export function instalarPointerEvent() {
  if (typeof window !== 'undefined' && !(window as any).PointerEvent) {
    (window as any).PointerEvent = class PointerEventSimulado extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? 'mouse';
      }
    };
  }
}
