import multer from 'multer';

const storage = multer.memoryStorage();

const imageFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype) {
        return cb(null, true);
    }
    cb(new Error('Tipo de archivo no permitido'));
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter
});

export const uploadGuideImage = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: imageFileFilter
});

export default upload;
