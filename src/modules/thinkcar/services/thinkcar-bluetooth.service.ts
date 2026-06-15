import { execSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { processBuffer } from "./thinkcar-pipeline.service.js";
import { withRetry } from "../../../shared/utils/retry.js";
import { recordSuccess, recordError } from "./thinkcar-health.service.js";

const SDP_RECORD = `
<?xml version="1.0" encoding="UTF-8"?>
<record>
  <attribute id="0x0001">
    <uuid value="0x1101"/>
  </attribute>
  <attribute id="0x0004">
    <sequence>
      <uuid value="0x1101"/>
    </sequence>
  </attribute>
  <attribute id="0x0100">
    <text value="Thinkcar Diagnostic Service"/>
  </attribute>
  <attribute id="0x0101">
    <text value="Thinkcar ThinkTool Mini"/>
  </attribute>
  <attribute id="0x0102">
    <text value="/home/pi/thinkcar-service"/>
  </attribute>
</record>
`;

let _btProcess: ReturnType<typeof spawn> | null = null;
let _btPollTimer: ReturnType<typeof setInterval> | null = null;
let _consecutiveBtFailures = 0;

interface BluetoothDevice {
  mac: string;
  name: string;
}

function scanWithBluetoothctl(timeout = 8): BluetoothDevice[] {
  try {
    const out = execSync(
      `timeout ${timeout} bluetoothctl -- scan on 2>/dev/null | grep -i "Device" || true`,
      { encoding: "utf-8", timeout: (timeout + 2) * 1000 },
    );
    const devices: BluetoothDevice[] = [];
    for (const line of out.split("\n")) {
      const m = line.match(/Device\s+([0-9A-F:]{17})\s+(.+)/i);
      if (m) {
        devices.push({ mac: m[1]!.toUpperCase(), name: m[2]!.trim() });
      }
    }
    return devices;
  } catch {
    return [];
  }
}

function isThinkcarDevice(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("thinkcar") ||
    lower.includes("thinktool") ||
    lower.includes("thinkdiag") ||
    lower.includes("think")
  );
}

function ensureSdpRecord(): void {
  const sdpPath = "/tmp/thinkcar-sdp.xml";
  if (!existsSync(sdpPath)) {
    try {
      execSync(`cat > "${sdpPath}" << 'RECORD_EOF'\n${SDP_RECORD}\nRECORD_EOF`, {
        encoding: "utf-8",
      });
    } catch {
      // Best-effort
    }
  }
}

function connectToDevice(mac: string): void {
  try {
    execSync(`bluetoothctl -- pair ${mac} 2>/dev/null`, { timeout: 15000 });
  } catch {
    // Pairing may already exist — continue
  }

  try {
    execSync(`bluetoothctl -- trust ${mac} 2>/dev/null`, { timeout: 5000 });
  } catch {
    // Best-effort
  }

  try {
    execSync(`bluetoothctl -- connect ${mac} 2>/dev/null`, { timeout: 15000 });
  } catch {
    // Connection may fail — will be caught by RFCOMM
  }
}

function disconnectDevice(mac: string): void {
  try {
    execSync(`bluetoothctl -- disconnect ${mac} 2>/dev/null`, { timeout: 5000 });
  } catch {
    // Best-effort
  }
}

async function receiveFileOverRfcomm(
  channel: number,
  timeoutMs = 60000,
): Promise<{ buffer: Buffer; fileName: string } | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (catProcess && !catProcess.killed) catProcess.kill();
      resolve(null);
    }, timeoutMs);

    const catProcess = spawn("timeout", [
      String(Math.ceil(timeoutMs / 1000)),
      "rfcomm",
      "receive",
      `/dev/rfcomm${channel}`,
    ]);

    const chunks: Buffer[] = [];
    catProcess.stdout?.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    catProcess.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && chunks.length > 0) {
        const buffer = Buffer.concat(chunks);
        const hash = createHash("md5").update(buffer).digest("hex").slice(0, 8);
        resolve({
          buffer,
          fileName: `bluetooth_thinkcar_${Date.now()}_${hash}.pdf`,
        });
      } else {
        resolve(null);
      }
    });

    catProcess.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

export async function scanAndIngest(): Promise<number> {
  const devices = scanWithBluetoothctl();
  const thinkcarDevices = devices.filter((d) => isThinkcarDevice(d.name));

  if (thinkcarDevices.length === 0) {
    recordSuccess("bluetooth");
    return 0;
  }

  let count = 0;
  for (const device of thinkcarDevices) {
    try {
      connectToDevice(device.mac);

      const result = await withRetry(
        () => receiveFileOverRfcomm(0, 60000),
        {
          maxRetries: 1,
          baseDelayMs: 5000,
          onRetry: (_attempt, err) => {
            console.warn(`[Thinkcar Bluetooth] Reintento RFCOMM para ${device.name}: ${err.message}`);
          },
        },
      );

      if (result) {
        try {
          const pipelineResult = await processBuffer(
            result.buffer,
            result.fileName,
            "bluetooth",
          );
          if (!pipelineResult.duplicate) {
            count++;
            recordSuccess("bluetooth");
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Error desconocido";
          console.error(`[Thinkcar Bluetooth] Error en pipeline: ${msg}`);
          recordError("bluetooth", msg);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      console.error(`[Thinkcar Bluetooth] Error con dispositivo ${device.name}: ${msg}`);
      recordError("bluetooth", msg);
    } finally {
      disconnectDevice(device.mac);
    }
  }

  return count;
}

export function startBluetoothListener(
  onIngest?: (count: number) => void,
): void {
  ensureSdpRecord();

  if (_btPollTimer) return;

  _btPollTimer = setInterval(async () => {
    try {
      const count = await scanAndIngest();
      _consecutiveBtFailures = 0;
      if (count > 0 && onIngest) {
        onIngest(count);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      _consecutiveBtFailures++;
      console.error(`[Thinkcar Bluetooth] Error (${_consecutiveBtFailures}x):`, msg);
    }
  }, 120000);

  _btPollTimer.unref();
}

export function stopBluetoothListener(): void {
  if (_btPollTimer) {
    clearInterval(_btPollTimer);
    _btPollTimer = null;
  }
  if (_btProcess && !_btProcess.killed) {
    _btProcess.kill();
    _btProcess = null;
  }
  _consecutiveBtFailures = 0;
}
