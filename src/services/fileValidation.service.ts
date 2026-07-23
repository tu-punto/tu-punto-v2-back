type FileLike = Pick<Express.Multer.File, "buffer" | "mimetype" | "originalname" | "size">;

type ValidationResult = {
  ok: boolean;
  detectedType?: string;
  message?: string;
};

const PDF_SIGNATURE = Buffer.from([0x25, 0x50, 0x44, 0x46]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const WEBP_RIFF_SIGNATURE = Buffer.from([0x52, 0x49, 0x46, 0x46]);
const WEBP_WEBP_SIGNATURE = Buffer.from([0x57, 0x45, 0x42, 0x50]);
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const MP4_FTYP_SIGNATURE = Buffer.from([0x66, 0x74, 0x79, 0x70]);
const OGG_SIGNATURE = Buffer.from([0x4f, 0x67, 0x67, 0x53]);
const WEBM_SIGNATURE = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

const startsWith = (buffer: Buffer, signature: Buffer, offset = 0) => {
  if (buffer.length < offset + signature.length) return false;
  return buffer.subarray(offset, offset + signature.length).equals(signature);
};

const looksLikeUtf8Text = (buffer: Buffer) => {
  if (!buffer.length) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 512));
  let printable = 0;

  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)) {
      printable += 1;
    }
  }

  return printable / sample.length >= 0.9;
};

const detectFileType = (buffer: Buffer): string | null => {
  if (startsWith(buffer, PDF_SIGNATURE)) return "application/pdf";
  if (startsWith(buffer, PNG_SIGNATURE)) return "image/png";
  if (startsWith(buffer, JPEG_SIGNATURE)) return "image/jpeg";
  if (startsWith(buffer, WEBP_RIFF_SIGNATURE) && startsWith(buffer, WEBP_WEBP_SIGNATURE, 8)) return "image/webp";
  if (startsWith(buffer, ZIP_SIGNATURE)) return "application/zip";
  if (startsWith(buffer, OLE_SIGNATURE)) return "application/x-ole-storage";
  if (startsWith(buffer, OGG_SIGNATURE)) return "video/ogg";
  if (startsWith(buffer, WEBM_SIGNATURE)) return "video/webm";
  if (startsWith(buffer, MP4_FTYP_SIGNATURE, 4)) {
    const brand = buffer.subarray(8, 12).toString("ascii").trim().toLowerCase();
    if (brand === "qt") return "video/quicktime";
    return "video/mp4";
  }
  if (looksLikeUtf8Text(buffer)) return "text/plain";
  return null;
};

const officeMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const legacyOfficeMimeTypes = new Set([
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
]);

const textMimeTypes = new Set(["text/plain", "text/csv"]);

const imageMimeTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export const validateFileContent = (
  file: FileLike,
  allowedMimeTypes: Set<string>
): ValidationResult => {
  const detected = detectFileType(file.buffer);
  const mimetype = String(file.mimetype || "").toLowerCase();

  if (!allowedMimeTypes.has(mimetype)) {
    return {
      ok: false,
      message: "Tipo de archivo no permitido",
    };
  }

  if (imageMimeTypes.has(mimetype)) {
    const normalized = mimetype === "image/jpg" ? "image/jpeg" : mimetype;
    if (detected !== normalized) {
      return {
        ok: false,
        detectedType: detected || undefined,
        message: "El contenido del archivo no coincide con una imagen valida",
      };
    }
  }

  if (mimetype === "application/pdf" && detected !== "application/pdf") {
    return {
      ok: false,
      detectedType: detected || undefined,
      message: "El contenido del archivo no coincide con un PDF valido",
    };
  }

  if (officeMimeTypes.has(mimetype) && detected !== "application/zip") {
    return {
      ok: false,
      detectedType: detected || undefined,
      message: "El contenido del archivo no coincide con un documento Office valido",
    };
  }

  if (legacyOfficeMimeTypes.has(mimetype) && detected !== "application/x-ole-storage") {
    return {
      ok: false,
      detectedType: detected || undefined,
      message: "El contenido del archivo no coincide con un documento Office valido",
    };
  }

  if (textMimeTypes.has(mimetype) && detected !== "text/plain") {
    return {
      ok: false,
      detectedType: detected || undefined,
      message: "El contenido del archivo no coincide con un archivo de texto valido",
    };
  }

  if (mimetype === "video/mp4" && detected !== "video/mp4") {
    return {
      ok: false,
      detectedType: detected || undefined,
      message: "El contenido del archivo no coincide con un video MP4 valido",
    };
  }

  if (mimetype === "video/webm" && detected !== "video/webm") {
    return {
      ok: false,
      detectedType: detected || undefined,
      message: "El contenido del archivo no coincide con un video WebM valido",
    };
  }

  if (mimetype === "video/ogg" && detected !== "video/ogg") {
    return {
      ok: false,
      detectedType: detected || undefined,
      message: "El contenido del archivo no coincide con un video OGG valido",
    };
  }

  if (mimetype === "video/quicktime" && detected !== "video/quicktime") {
    return {
      ok: false,
      detectedType: detected || undefined,
      message: "El contenido del archivo no coincide con un video QuickTime valido",
    };
  }

  return {
    ok: true,
    detectedType: detected || undefined,
  };
};

export const createFileArrayValidator = (allowedMimeTypes: string[], typeLabel: string) => {
  const allowedSet = new Set(allowedMimeTypes.map((item) => item.toLowerCase()));

  return (files: FileLike[]) => {
    for (const file of files) {
      const result = validateFileContent(file, allowedSet);
      if (!result.ok) {
        console.warn("[file-validation] archivo rechazado", {
          originalname: file.originalname,
          mimetype: file.mimetype,
          detectedType: result.detectedType,
          size: file.size,
          typeLabel,
        });
        throw new Error(result.message || `Archivo ${typeLabel} invalido`);
      }
    }
  };
};
