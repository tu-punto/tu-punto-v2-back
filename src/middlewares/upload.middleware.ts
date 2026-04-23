import multer from "multer";

const storage = multer.memoryStorage();

export const uploadVariantImages = multer({
  storage,
  limits: {
    files: 4,
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Solo se permiten imágenes"));
    }
    cb(null, true);
  }
});

const announcementAttachmentMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export const uploadAnnouncementFiles = multer({
  storage,
  limits: {
    files: 6,
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!announcementAttachmentMimeTypes.has(file.mimetype)) {
      return cb(new Error("Solo se permiten PDF, documentos Office, texto, CSV o imagenes"));
    }
    cb(null, true);
  }
});
