import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
// import { File as MulterFile } from "multer"; // Use this if you want Multer types

let s3Client: S3Client | null = null;
export const s3 = (): S3Client => {
    if (!s3Client) {
        s3Client = new S3Client({
            region: process.env.S3_REGION!,
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY!,
                secretAccessKey: process.env.S3_SECRET_KEY!,
            }
        });
    }
    return s3Client;
};

type UploadInput = { buffer: Buffer; mimetype: string }; // Use MulterFile if you want stricter typing

export const uploadToS3 = (
    file: UploadInput,
    tenantId: string,
    folder: string = "company-logos"
): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        try {
            const fileExtension = file.mimetype === 'image/svg+xml' ? 'svg' : file.mimetype.split("/")[1];
            const filename = `${uuidv4()}.${fileExtension}`;
            // Key structure: tenantId/folder/filename
            const key = `${tenantId}/${folder}/${filename}`;

            const command = new PutObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME!,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
            });

            await s3().send(command);

            // If you want to use your own domain as a proxy/CDN, replace the URL below with your domain logic
            const url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
            resolve(url);
        } catch (error) {
            reject(error);
        }
    });
};

export const deleteFromS3 = (fileUrl: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        try {
            const url = new URL(fileUrl);
            const key = url.pathname.slice(1);

            const command = new DeleteObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME!,
                Key: key,
            });

            await s3().send(command);
            resolve();
        } catch (error) {
            reject(error);
        }
    });
};