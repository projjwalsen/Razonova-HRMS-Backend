import multer from "multer";

interface UploadOptions {
    maxSize?: number; // in MB
    allowedTypes?: string[]; // MIME types
}

const defaultOptions: UploadOptions = {
    maxSize: 10, // Default to 10MB
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], // Common file types
};

const storage = multer.memoryStorage();

export const createFileUpload = (options: UploadOptions = {}) => {
    const { maxSize, allowedTypes } = { ...defaultOptions, ...options };
    return multer({
        storage,
        limits: {
            fileSize: (maxSize || 5) * 1024 * 1024, // Convert MB to bytes
        },
        fileFilter: (req, file, cb) => {
            if (!allowedTypes!.includes(file.mimetype)) {
                return cb(new Error(`Only ${allowedTypes!.join(', ')} files are allowed`));
            }
            cb(null, true);
        }
    });
};