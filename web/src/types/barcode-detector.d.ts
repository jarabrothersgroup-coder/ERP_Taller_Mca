/**
 * Native BarcodeDetector API — no incluida en lib.dom estándar de TypeScript.
 * Chrome, Edge y Opera la exponen en window. Referencia:
 * https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector
 */
interface BarcodeFormat {
  format: string;
  rawValue: string;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetector;
  getSupportedFormats(): Promise<string[]>;
}

interface BarcodeDetector {
  detect(input: HTMLVideoElement | string | Blob | ImageData): Promise<BarcodeFormat[]>;
}

declare const BarcodeDetector: BarcodeDetectorConstructor | undefined;
