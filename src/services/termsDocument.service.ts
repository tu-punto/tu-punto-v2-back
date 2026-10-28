import { awsConfig } from "../config/bucketConfig";
import { uploadFileToAws } from "./bucket.service";

export const TERMS_DOCUMENT_KEY = "public/terminos-paqueteria.pdf";

export const getTermsDocumentUrl = () => {
  const configured = String(process.env.W_TERMS_DOCUMENT_URL || "").trim();
  if (configured) return configured;
  if (!awsConfig.bucketName || !awsConfig.region) return "";
  return `https://${awsConfig.bucketName}.s3.${awsConfig.region}.amazonaws.com/${TERMS_DOCUMENT_KEY}`;
};

export const TermsDocumentService = {
  get: () => ({ url: getTermsDocumentUrl() }),
  async replace(file: Express.Multer.File) {
    await uploadFileToAws(file.buffer, TERMS_DOCUMENT_KEY, "application/pdf");
    return { url: getTermsDocumentUrl() };
  },
};
