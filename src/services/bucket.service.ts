import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3Client, { awsConfig, awsFolderNames } from "../config/bucketConfig";

export const uploadFileToAws = async (
  fileBuffer: Buffer,
  key: string,
  contentType: string = "application/pdf"
): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: awsConfig.bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    return `https://${awsConfig.bucketName}.s3.${awsConfig.region}.amazonaws.com/${key}`;
  } catch (error) {
    console.error("❌ Error uploading to AWS:", error);
    throw error;
  }
};

export const getFileUrlFromAws = async (
  key: string,
  expiresIn: number = 3600
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: awsConfig.bucketName,
    Key: key,
  });

  try {
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error("❌ Error getting file URL from AWS:", error);
    throw error;
  }
};

export const deleteFileFromAws = async (key: string): Promise<boolean> => {
  const command = new DeleteObjectCommand({
    Bucket: awsConfig.bucketName,
    Key: key,
  });

  try {
    await s3Client.send(command);
    console.log(`🗑️ File deleted from AWS: ${key}`);
    return true;
  } catch (error) {
    console.error("❌ Error deleting file from AWS:", error);
    return false;
  }
};

export const uploadPdfToAws = async (
  pdfBuffer: Buffer,
  fileName: string,
  folder: string = awsFolderNames.comprobantes
): Promise<{ url: string; key: string }> => {
  const key = `${folder}/${fileName}`;
  const url = await uploadFileToAws(pdfBuffer, key, "application/pdf");

  console.log(`📄 PDF uploaded to AWS: ${key}`);
  return { url, key };
};
