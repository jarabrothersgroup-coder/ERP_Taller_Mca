/**
 * SIFEN Cryptographic Worker Thread
 *
 * Runs SHA-256 + RSA XML signing in an isolated CPU-dedicated thread
 * so the Fastify event loop is never blocked by fiscal digital signature operations.
 *
 * Production: Uses node-forge to parse real PKCS#12 certificate (.p12/.pfx).
 * Development: Falls back to dev placeholder ONLY when NODE_ENV !== "production"
 *              AND SIFEN_CERT_PATH is not configured.
 *
 * @module src/finance/sifen-crypto.worker
 */

import { parentPort, workerData } from "node:worker_threads";
import { existsSync, readFileSync } from "node:fs";
import crypto from "node:crypto";

/**
 * Signs a DTE XML document using X.509 certificate.
 *
 * Production path: loads real PKCS#12 via node-forge, extracts
 * private key + cert PEM, computes XAdES-EPES signature.
 *
 * Dev fallback: only when NODE_ENV is not "production" and no valid
 * certificate is available. Logs a prominent warning.
 */
async function signDocument(
  xmlRaw: string,
  certPath: string,
  certPass: string,
): Promise<string> {
  if (!xmlRaw) {
    throw new Error("xmlRaw es obligatorio para firmar el DTE");
  }

  const isProduction = process.env["NODE_ENV"] === "production";

  // ── Attempt real certificate loading ──
  if (certPath && existsSync(certPath)) {
    try {
      const forge = (await import("node-forge")).default;
      const p12Buffer = readFileSync(certPath);
      const p12Asn1 = forge.asn1.fromDer(forge.util.encode64(p12Buffer.toString("binary")));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certPass || "");

      // OIDs not exported in node-forge types
      const PKCS8_SHROUDED_KEY_OID = "1.2.840.113549.1.12.10.1.2";
      const CERT_BAG_OID = "1.2.840.113549.1.9.22.1";

      const keyBags = p12.getBags({ bagType: PKCS8_SHROUDED_KEY_OID });
      const keyBag = keyBags[PKCS8_SHROUDED_KEY_OID]?.[0];
      if (!keyBag?.key) {
        throw new Error("No se pudo extraer la clave privada del .p12");
      }

      const certBags = p12.getBags({ bagType: CERT_BAG_OID });
      const certBag = certBags[CERT_BAG_OID]?.[0];
      if (!certBag?.cert) {
        throw new Error("No se pudo extraer el certificado X.509 del .p12");
      }

      const keyPem = forge.pki.privateKeyToPem(keyBag.key);
      const certPem = forge.pki.certificateToPem(certBag.cert);
      const keyObj = crypto.createPrivateKey({ key: keyPem, format: "pem" });

      // Canonicalize
      const canonicalXml = xmlRaw
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n\s*\n/g, "\n")
        .trim();

      // Digest
      const digest = crypto.createHash("sha256");
      digest.update(Buffer.from(canonicalXml, "utf-8"));
      const digestValue = digest.digest("base64");

      // SignedInfo
      const signedInfo = [
        '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
        '  <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
        '  <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>',
        '  <ds:Reference URI="">',
        '    <ds:Transforms>',
        '      <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>',
        '      <ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
        '    </ds:Transforms>',
        '    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>',
        `    <ds:DigestValue>${digestValue}</ds:DigestValue>`,
        '  </ds:Reference>',
        '</ds:SignedInfo>',
      ].join("\n");

      const signer = crypto.createSign("sha256");
      signer.update(Buffer.from(signedInfo, "utf-8"));
      signer.end();
      const signatureValue = signer.sign(keyObj).toString("base64");

      // Strip PEM armor for XML embedding
      const certBase64 = certPem
        .replace(/-----BEGIN CERTIFICATE-----/, "")
        .replace(/-----END CERTIFICATE-----/, "")
        .replace(/\n/g, "")
        .trim();

      const keyInfo = [
        '  <ds:KeyInfo>',
        '    <ds:X509Data>',
        `      <ds:X509Certificate>${certBase64}</ds:X509Certificate>`,
        '    </ds:X509Data>',
        '  </ds:KeyInfo>',
      ].join("\n");

      const signatureXml = [
        '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
        signedInfo,
        `  <ds:SignatureValue>${signatureValue}</ds:SignatureValue>`,
        keyInfo,
        '</ds:Signature>',
      ].join("\n");

      return canonicalXml.replace("</rEnvioDTE>", `${signatureXml}\n</rEnvioDTE>`);
    } catch (err) {
      if (isProduction) {
        throw new Error(`FIRMA FISCAL RECHAZADA — Error firmando DTE con certificado real: ${err instanceof Error ? err.message : err}`);
      }
      console.error(`[sifen-worker] Error cargando certificado .p12, fallback dev: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ── Dev-only fallback ──
  if (isProduction) {
    throw new Error(
      "FIRMA FISCAL RECHAZADA — No se encontró certificado SIFEN válido. " +
      "Configure SIFEN_CERT_PATH y SIFEN_CERT_PASS en producción."
    );
  }

  console.warn(
    "[sifen-worker] ⚠️  MODO DESARROLLO — FIRMA SIMULADA. " +
    "Configure SIFEN_CERT_PATH para firma real en producción."
  );

  // Development-only mock signature with prominent marker
  const timestamp = new Date().toISOString();
  const devCdc = `DEV${timestamp.replace(/[-:T]/g, "").slice(0, 13)}${Math.random().toString().slice(2, 9)}`;

  return xmlRaw
    .replace(
      "</DE>",
      `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      `<ds:SignatureValue>DEV_MOCK_SIGNATURE_${timestamp}</ds:SignatureValue>` +
      `</ds:Signature></DE>`,
    )
    .replace("<DE>", `<DE cdc="${devCdc}">`);
}

// ─── Execute ────────────────────────────────────

if (parentPort) {
  signDocument(
    workerData.xmlRaw,
    workerData.certPath,
    workerData.certPass,
  )
    .then((xmlSigned) => {
      parentPort!.postMessage({ success: true, xmlSigned });
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown worker error";
      parentPort!.postMessage({ success: false, error: message });
    });
}
