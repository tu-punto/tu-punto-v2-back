import { S3Client } from "@aws-sdk/client-s3";

const awsRegion = process.env.AWS_REGION || "";
const awsAccessKeyId =
  process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESSKEYID || "";
const awsSecretAccessKey =
  process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRETACCESSKEY || "";
const awsBucketName =
  process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || "";

const s3Client = new S3Client({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  },
});

export const awsFolderNames = {
  comprobantes: "comprobantes",
  sucursalesHeader: "sucursales/header",
};

export const awsConfig = {
  bucketName: awsBucketName,
  region: awsRegion,
};

export default s3Client;
