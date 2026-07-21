import multer from "multer";
import { NextFunction, Request, Response } from "express";
import { createFileArrayValidator } from "../services/fileValidation.service";

const storage = multer.memoryStorage();
export const imageMimeTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"] as const;
export const announcementAttachmentMimeTypes = [
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
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
] as const;

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

const announcementAttachmentMimeTypeSet = new Set<string>(announcementAttachmentMimeTypes);

export const uploadAnnouncementFiles = multer({
  storage,
  limits: {
    files: 6,
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!announcementAttachmentMimeTypeSet.has(file.mimetype)) {
      return cb(new Error("Solo se permiten PDF, documentos Office, texto, CSV, imagenes o videos"));
    }
    cb(null, true);
  }
});

export const uploadFinanceFluxAttachment = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!announcementAttachmentMimeTypeSet.has(file.mimetype)) {
      return cb(new Error("Solo se permiten PDF, documentos Office, texto, CSV o imagenes"));
    }
    cb(null, true);
  },
});

export const validateUploadedFiles = (options: {
  fieldLabel: string;
  allowedMimeTypes: readonly string[];
  allowMultiple?: boolean;
}) => {
  const validate = createFileArrayValidator([...options.allowedMimeTypes], options.fieldLabel);

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = Array.isArray(req.files)
        ? req.files
        : req.file
          ? [req.file]
          : [];

      if (!files.length) return next();
      validate(files);
      return next();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || `Archivo ${options.fieldLabel} invalido`,
      });
    }
  };
};
