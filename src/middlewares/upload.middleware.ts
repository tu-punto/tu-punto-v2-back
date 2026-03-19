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