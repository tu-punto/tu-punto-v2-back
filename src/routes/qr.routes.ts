import express, { Router } from "express";
import https from "https";
import { createSign } from "crypto";

const qrRouter = Router();

const normalizePem = (value?: string) => {
  if (!value) return "";
  const unquoted = value.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  return unquoted.replace(/\\n/g, "\n").trim();
};

const decodePemBase64 = (value?: string) => {
  if (!value) return "";
  try {
    return normalizePem(Buffer.from(value.trim(), "base64").toString("utf8"));
  } catch {
    return "";
  }
};

const resolvePem = (...candidates: Array<string | undefined>) => {
  for (const candidate of candidates) {
    const normalized = normalizePem(candidate);
    if (!normalized) continue;

    if (normalized.includes("-----BEGIN")) {
      return normalized;
    }

    const decoded = decodePemBase64(normalized);
    if (decoded.includes("-----BEGIN")) {
      return decoded;
    }
  }

  return "";
};

const getQzCertificatePem = () =>
  resolvePem(process.env.QZ_CERT_PEM, process.env.QZ_CERT_PEM_BASE64);

const getQzPrivateKeyPem = () =>
  resolvePem(process.env.QZ_PRIVATE_KEY_PEM, process.env.QZ_PRIVATE_KEY_PEM_BASE64);

qrRouter.get("/download-qr", async (req, res) => {
  const { url, name } = req.query;
  if (!url) return res.status(400).send("Missing url");

  const rawUrl = Array.isArray(url) ? String(url[0]) : String(url);
  const decodedUrl = (() => {
    try {
      return decodeURIComponent(rawUrl);
    } catch {
      return rawUrl;
    }
  })();
  const finalUrl = decodedUrl.startsWith("http") ? decodedUrl : `https://${decodedUrl}`;

  https.get(finalUrl, (s3Res) => {
    res.status(s3Res.statusCode || 200);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${name || "qr"}.png"`
    );
    res.setHeader("Content-Type", "image/png");
    s3Res.pipe(res);
  }).on("error", (err) => {
    console.error("download-qr error:", err);
    res.status(500).send("Error downloading QR");
  });
});

qrRouter.get("/certificate", async (_req, res) => {
  const certPem = getQzCertificatePem();
  if (!certPem) {
    return res.status(503).send("QZ certificate not configured");
  }
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.send(certPem);
});

qrRouter.post("/sign", express.text({ type: "*/*" }), async (req, res) => {
  const privateKeyPem = getQzPrivateKeyPem();
  if (!privateKeyPem) {
    return res.status(503).send("QZ signing key not configured");
  }

  const payload = typeof req.body === "string" ? req.body : "";
  if (!payload) {
    return res.status(400).send("Missing payload");
  }

  try {
    const signer = createSign("SHA512");
    signer.update(payload, "utf8");
    signer.end();
    const signature = signer.sign(privateKeyPem, "base64");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send(signature);
  } catch (error) {
    console.error("qz-sign error:", error);
    return res.status(500).send("Failed to sign payload");
  }
});

export default qrRouter;
