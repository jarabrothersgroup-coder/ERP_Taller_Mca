/**
 * Barcode Scanner Service — Native BarcodeDetector API integration.
 *
 * Provides barcode/QR code scanning using the browser's native
 * BarcodeDetector API (Chrome, Edge, Opera) with fallback to
 * manual entry.
 *
 * RAM impact: ~2 KB (no persistent state).
 *
 * @module inventory/services/barcode-scanner.service
 */

// ─── Types ────────────────────────────────────

export interface ScanResult {
  format: string;
  value: string;
  confidence: number;
}

export interface ScannerCapability {
  supported: boolean;
  formats: string[];
}

// ─── Capability Detection ─────────────────────

/**
 * Checks if BarcodeDetector API is available in the browser.
 *
 * @returns Scanner capability info
 */
export async function getScannerCapability(): Promise<ScannerCapability> {
  if (typeof BarcodeDetector === "undefined") {
    return { supported: false, formats: [] };
  }

  try {
    const formats = await BarcodeDetector.getSupportedFormats();
    return { supported: true, formats };
  } catch {
    return { supported: false, formats: [] };
  }
}

// ─── Scanning ─────────────────────────────────

/**
 * Scans a video stream for barcodes/QR codes.
 *
 * @param videoElement - HTML video element with camera stream
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Scan result or null if no barcode detected
 */
export async function scanFromVideo(
  videoElement: HTMLVideoElement,
  timeoutMs = 5000,
): Promise<ScanResult | null> {
  if (typeof BarcodeDetector === "undefined") {
    throw new Error(
      "BarcodeDetector API no soportada. Use Chrome, Edge o Opera.",
    );
  }

  const detector = new BarcodeDetector({
    formats: ["ean_13", "ean_8", "code_128", "qr_code", "data_matrix"],
  });

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const barcodes = await detector.detect(videoElement);
      if (barcodes.length > 0) {
        const barcode = barcodes[0];
        return {
          format: barcode.format,
          value: barcode.rawValue,
          confidence: 1.0,
        };
      }
    } catch {
      // Detection might fail on some frames, continue
    }

    // Wait 100ms before next detection attempt
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

/**
 * Scans an image for barcodes/QR codes.
 *
 * @param imageData - Image data (URL, Blob, or ImageData)
 * @returns Array of scan results
 */
export async function scanFromImage(
  imageData: string | Blob | ImageData,
): Promise<ScanResult[]> {
  if (typeof BarcodeDetector === "undefined") {
    throw new Error(
      "BarcodeDetector API no soportada. Use Chrome, Edge o Opera.",
    );
  }

  const detector = new BarcodeDetector({
    formats: ["ean_13", "ean_8", "code_128", "qr_code", "data_matrix"],
  });

  try {
    const barcodes = await detector.detect(imageData as any);
    return barcodes.map((barcode) => ({
      format: barcode.format,
      value: barcode.rawValue,
      confidence: 1.0,
    }));
  } catch {
    return [];
  }
}

/**
 * Starts camera stream for continuous scanning.
 *
 * @param videoElement - HTML video element to stream to
 * @param onScan - Callback for each scan result
 * @returns Stop function to end the stream
 */
export function startContinuousScan(
  videoElement: HTMLVideoElement,
  onScan: (result: ScanResult) => void,
): () => void {
  let scanning = true;
  let stream: MediaStream | null = null;

  const scanLoop = async () => {
    while (scanning) {
      const result = await scanFromVideo(videoElement, 200);
      if (result) {
        onScan(result);
      }
    }
  };

  // Start camera
  navigator.mediaDevices
    .getUserMedia({
      video: { facingMode: "environment" },
    })
    .then((mediaStream) => {
      stream = mediaStream;
      videoElement.srcObject = mediaStream;
      videoElement.play();
      scanLoop();
    })
    .catch((err) => {
      console.error("[barcode-scanner] Error accediendo a la cámara:", err);
    });

  // Return stop function
  return () => {
    scanning = false;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };
}
