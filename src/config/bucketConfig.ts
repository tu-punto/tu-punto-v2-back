import { S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESSKEYID!,
    secretAccessKey: process.env.AWS_SECRETACCESSKEY!,
  },
});

export const awsFolderNames = {
  comprobantes: "comprobantes",
};

export const awsConfig = {
  bucketName: process.env.AWS_BUCKET_NAME!,
  region: process.env.AWS_REGION!,
};

export default s3Client;
