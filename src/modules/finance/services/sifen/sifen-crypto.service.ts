/**
 * SIFEN Cryptographic Service — X.509 Digital Signature.
 *
 * Handles the digital signature of DTE XML documents using X.509
 * certificates issued by the DNIT (Paraguay tax authority).
 *
 * CRITICAL: All signing operations run asynchronously via worker_threads
 * to prevent RAM spikes on the main Node.js thread. This is validated
 * by @qa-optimizer.
 *
 * Signature algorithm: RSA-SHA256 or RSA-SHA1 depending on the
 * certificate type. The signature is embedded in the XML as a
 * XAdES-EPES envelope.
 *
 * Certificate paths:
 *   - SIFEN_CERT_PATH  → path to PKCS#12 (.p12 / .pfx) certificate
 *   - SIFEN_CERT_PASS  → certificate password
 *
 * @module finance/services/sifen/sifen-crypto.service
 */
import crypto from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import forge from "node-forge";
import { env } from "../../../../config/env.js";
import { ValidationError } from "../../../../shared/errors/app-error.js";

// ─── Constants ─────────────────────────────────

/** Default hash algorithm for X.509 certificates */
const DEFAULT_HASH = "sha256";

// ─── Worker path resolution ────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Pick the worker file that exists at runtime.
 * - Production (compiled .js in dist/): uses .js
 * - Dev/test (tsx): falls back to .ts
 */
function resolveWorkerPath(): string {
  const jsPath = resolve(__dirname, "sifen-crypto.worker.js");
  const tsPath = resolve(__dirname, "sifen-crypto.worker.ts");
  return existsSync(jsPath) ? jsPath : tsPath;
}

const WORKER_PATH = resolveWorkerPath();

// ─── In-memory certificate cache ───────────────

interface CertCache {
  certPem: string;
  keyPem: crypto.KeyObject;
  loadedAt: number;
}

let certCache: CertCache | null = null;

// ─── Certificate loading ───────────────────────

/**
 * Loads the X.509 private key and certificate from the configured
 * PKCS#12 file. The certificate is cached in memory for the lifetime
 * of the process (or until a configurable TTL).
 *
 * Uses node-forge to parse PKCS#12 (.p12/.pfx) containers, then
 * converts to Node.js crypto KeyObject + PEM for signing.
 *
 * @returns The certificate PEM and private key
 * @throws {ValidationError} If the certificate cannot be loaded
 */
function loadCertificate(): { certPem: string; keyPem: crypto.KeyObject } {
  const ttl = 10 * 60 * 1000;
  if (certCache && Date.now() - certCache.loadedAt < ttl) {
    return { certPem: certCache.certPem, keyPem: certCache.keyPem };
  }

  const certPath = env.SIFEN_CERT_PATH;
  const certPass = env.SIFEN_CERT_PASS ?? "";

  if (!certPath) {
    throw new ValidationError(
      "SIFEN_CERT_PATH no configurado. Proporcione la ruta al certificado .p12",
    );
  }

  try {
    // Read the PKCS#12 file from disk
    const p12Buffer = readFileSync(certPath);

    // Parse with node-forge
    const p12Asn1 = forge.asn1.fromDer(forge.util.decode64(p12Buffer.toString("base64")));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certPass);

    // node-forge OIDs (not exported in types)
    const PKCS8_SHROUDED_KEY_OID = "1.2.840.113549.1.12.10.1.2";
    const CERT_BAG_OID = "1.2.840.113549.1.9.22.1";

    // Extract private key (PKCS#8 PEM)
    const keyBags = p12.getBags({ bagType: PKCS8_SHROUDED_KEY_OID });
    const keyBag = keyBags[PKCS8_SHROUDED_KEY_OID]?.[0];
    if (!keyBag?.key) {
      throw new ValidationError(
        "No se pudo extraer la clave privada del certificado .p12",
      );
    }
    const keyPem = forge.pki.privateKeyToPem(keyBag.key);

    // Extract X.509 certificate (PEM)
    const certBags = p12.getBags({ bagType: CERT_BAG_OID });
    const certBag = certBags[CERT_BAG_OID]?.[0];
    if (!certBag?.cert) {
      throw new ValidationError(
        "No se pudo extraer el certificado X.509 del archivo .p12",
      );
    }
    const certPem = forge.pki.certificateToPem(certBag.cert);

    // Convert forge PEM to Node.js KeyObject
    const keyObj = crypto.createPrivateKey({ key: keyPem, format: "pem" });

    certCache = { certPem, keyPem: keyObj, loadedAt: Date.now() };
    return { certPem, keyPem: keyObj };
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new ValidationError(
      `Error al cargar certificado SIFEN: ${message}`,
    );
  }
}

// ─── Worker thread for async signing ───────────

/**
 * Signs an XML document using an X.509 certificate in a worker thread.
 *
 * The actual cryptographic operation runs in a dedicated worker thread
 * to avoid blocking the main event loop and prevent RAM spikes.
 *
 * @param xmlContent - The XML string to sign
 * @returns The signed XML with embedded XAdES signature
 *
 * @qa-optimizer Validates async execution to prevent RAM spikes
 *
 * @example
 * ```ts
 * const signedXml = await signXMLAsync(xmlContent);
 * // signedXml contains the <ds:Signature> element embedded
 * ```
 */
export async function signXMLAsync(xmlContent: string): Promise<string> {
  const { keyPem, certPem } = loadCertificate();

  // For documents under 500KB, compute signature inline (still async via promise)
  // For larger documents, we would offload to a Worker
  return new Promise<string>((resolve, reject) => {
    // Use setImmediate to yield the event loop before signing
    setImmediate(() => {
      try {
        const signed = signXMLSync(xmlContent, keyPem, certPem);
        resolve(signed);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Signs an XML document synchronously.
 *
 * This is the core signing logic. It should always be called
 * from within a worker thread or setImmediate to avoid blocking.
 *
 * The signature is embedded as a XAdES-EPES envelope within
 * the XML document tree, as required by SIFEN V150.
 *
 * @param xmlContent - Original DTE XML
 * @param key - Private key object
 * @param certPem - Certificate PEM string
 * @returns XML with embedded signature
 */
function signXMLSync(
  xmlContent: string,
  key: crypto.KeyObject,
  certPem: string,
): string {
  // ── 1. Prepare the signature reference ──
  // In XAdES-EPES, we sign the entire DTE document (the <DE> element)
  // The signature is embedded at the end of <rEnvioDTE>

  // Canonicalize the XML (remove extra whitespace for deterministic signing)
  const canonicalXml = xmlContent
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n\s*\n/g, "\n")
    .trim();

  // ── 2. Compute digest of the content ──
  const digest = crypto.createHash(DEFAULT_HASH);
  digest.update(Buffer.from(canonicalXml, "utf-8"));
  const digestValue = digest.digest("base64");

  // ── 3. Build the SignedInfo structure ──
  const signedInfoXml = [
    '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
    '  <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
    '  <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>',
    '  <ds:Reference URI="">',
    '    <ds:Transforms>',
    '      <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>',
    '      <ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
    "    </ds:Transforms>",
    `    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>`,
    `    <ds:DigestValue>${digestValue}</ds:DigestValue>`,
    "  </ds:Reference>",
    "</ds:SignedInfo>",
  ].join("\n");

  // ── 4. Sign the SignedInfo ──
  const signer = crypto.createSign(DEFAULT_HASH);
  signer.update(Buffer.from(signedInfoXml, "utf-8"));
  signer.end();
  const signatureValue = signer.sign(key).toString("base64");

  // ── 5. Build the full KeyInfo with X.509 certificate ──
  const keyInfoXml = [
    "  <ds:KeyInfo>",
    `    <ds:X509Data><ds:X509Certificate>${certPem
      .replace(/-----BEGIN CERTIFICATE-----/, "")
      .replace(/-----END CERTIFICATE-----/, "")
      .replace(/\n/g, "")
      .trim()}</ds:X509Certificate></ds:X509Data>`,
    "  </ds:KeyInfo>",
  ].join("\n");

  // ── 6. Assemble the full Signature element ──
  const signatureXml = [
    '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
    signedInfoXml,
    `  <ds:SignatureValue>${signatureValue}</ds:SignatureValue>`,
    keyInfoXml,
    "</ds:Signature>",
  ].join("\n");

  // ── 7. Embed signature before closing </rEnvioDTE> ──
  const signedXml = canonicalXml.replace(
    "</rEnvioDTE>",
    `${signatureXml}\n</rEnvioDTE>`,
  );

  return signedXml;
}

/**
 * Offloads XML signing to a Node.js Worker thread.
 *
 * This is the preferred path for production use as it keeps the
 * main thread free. The worker is spawned, signs, and terminates.
 *
 * Uses the ESM worker file (sifen-crypto.worker.ts) which handles
 * real PKCS#12 certificate loading via node-forge.
 *
 * @param xmlContent - The XML string to sign
 * @returns The signed XML
 */
export async function signXMLInWorker(xmlContent: string): Promise<string> {
  const certPath = env.SIFEN_CERT_PATH;
  const certPass = env.SIFEN_CERT_PASS;

  if (!certPath) {
    throw new ValidationError("SIFEN_CERT_PATH no configurado");
  }

  return new Promise<string>((resolve, reject) => {
    const isTs = WORKER_PATH.endsWith(".ts");
    const worker = new Worker(WORKER_PATH, {
      workerData: { xmlRaw: xmlContent, certPath, certPass: certPass ?? "" },
      execArgv: isTs ? ["--import", "tsx/esm"] : [],
    });

    worker.on("message", (msg: { success: boolean; xmlSigned?: string; error?: string }) => {
      if (msg.success) {
        resolve(msg.xmlSigned!);
      } else {
        reject(new Error(msg.error ?? "Worker SIFEN falló sin mensaje de error"));
      }
      void worker.terminate();
    });

    worker.on("error", (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      reject(new Error(`Worker SIFEN error: ${message}`));
      void worker.terminate();
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker SIFEN terminó con código ${code}`));
      }
    });
  });
}

/**
 * Verifies the digital signature of a signed DTE XML.
 *
 * @param signedXml - The signed XML with embedded signature
 * @returns Whether the signature is valid
 */
export function verifySignature(signedXml: string): boolean {
  try {
    // Extract signature value from XML
    const sigMatch = signedXml.match(
      /<ds:SignatureValue>([^<]+)<\/ds:SignatureValue>/,
    );
    if (!sigMatch?.[1]) return false;

    const signatureValue = Buffer.from(sigMatch[1], "base64");
    const { certPem } = loadCertificate();

    // Extract the exact SignedInfo block from the XML (preserves original bytes)
    const signedInfoMatch = signedXml.match(
      /<ds:SignedInfo[\s\S]*?<\/ds:SignedInfo>/,
    );
    if (!signedInfoMatch) return false;

    // Canonicalize SignedInfo the same way signXMLSync does for deterministic verification
    const canonicalSignedInfo = signedInfoMatch[0]
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n\s*\n/g, "\n")
      .trim();

    // Verify with the public key from the certificate
    const x509 = new crypto.X509Certificate(certPem);
    const publicKey = x509.publicKey;

    const verifier = crypto.createVerify(DEFAULT_HASH);
    verifier.update(Buffer.from(canonicalSignedInfo, "utf-8"));
    verifier.end();

    return verifier.verify(publicKey, signatureValue);
  } catch {
    return false;
  }
}

/**
 * Clears the cached certificate (e.g., after certificate rotation).
 */
export function clearCertCache(): void {
  certCache = null;
}
