import multer from "multer";

const storage = multer.memoryStorage();
export const imageMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;

const imageFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (imageMimeTypes.includes(file.mimetype.toLowerCase() as (typeof imageMimeTypes)[number])) {
    return cb(null, true);
  }
  cb(new Error("Tipo de archivo no permitido"));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter
});

export const uploadGuideImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFileFilter
});

export default upload;
