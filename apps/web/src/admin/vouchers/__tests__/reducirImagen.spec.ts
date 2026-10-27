import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reducirImagenVoucher } from '../reducirImagenVoucher';

describe('reducirImagenVoucher', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('devuelve el archivo si no hay soporte de DOM o canvas', async () => {
    const fakeBlob = new Blob(['sample-bytes'], { type: 'image/jpeg' });
    const res = await reducirImagenVoucher(fakeBlob);
    expect(res).toBeTruthy();
  });

  it('procesa y redimensiona en entornos con canvas y toBlob', async () => {
    // Simular Image y Canvas en jsdom
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn().mockReturnValue({
            drawImage: vi.fn(),
          }),
          toBlob: vi.fn((callback: (b: Blob) => void) => {
            callback(new Blob(['compressed-jpeg'], { type: 'image/jpeg' }));
          }),
        } as unknown as HTMLCanvasElement;
      }
      return origCreateElement(tagName);
    });

    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url');
    globalThis.URL.revokeObjectURL = vi.fn();

    // Mock Image
    const mockImage: any = {
      width: 3200,
      height: 2400,
      onload: null as any,
      src: '',
    };

    vi.stubGlobal(
      'Image',
      vi.fn().mockImplementation(() => {
        setTimeout(() => {
          if (mockImage.onload) mockImage.onload();
        }, 10);
        return mockImage;
      }),
    );

    const inputBlob = new Blob(['raw-bytes'], { type: 'image/png' });
    const resultado = await reducirImagenVoucher(inputBlob, 1600, 0.85);

    expect(resultado).toBeInstanceOf(Blob);
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
  });
});
