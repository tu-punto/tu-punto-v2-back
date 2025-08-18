import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!
});

export const s3 = new AWS.S3();

export class QRService {
  // Genera un código único para el producto
  static generateUniqueProductCode(productId: string): string {
    const uuid = uuidv4();
    return `PROD-${productId}-${uuid.substring(0, 8).toUpperCase()}`;
  }

  // Genera la URL del producto (puedes personalizarla según tu frontend)
  private static generateProductURL(productCode: string, productId: string): string {
    const baseURL = process.env.FRONTEND_URL || 'https://tuapp.com';
    return `${baseURL}/product/${productId}?qr=${productCode}`;
  }

  // Genera el QR como buffer
  static async generateQRBuffer(productId: string, productCode?: string): Promise<{
    qrBuffer: Buffer;
    productCode: string;
    productURL: string;
  }> {
    const code = productCode || this.generateUniqueProductCode(productId);
    const productURL = this.generateProductURL(code, productId);

    const qrBuffer = await QRCode.toBuffer(productURL, {
      type: 'png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return {
      qrBuffer,
      productCode: code,
      productURL
    };
  }

  // Genera y guarda el QR en S3
  static async generateAndSaveQR(productId: string, productCode?: string): Promise<{
    qrPath: string;
    productCode: string;
    productURL: string;
  }> {
    const { qrBuffer, productCode: code, productURL } = await this.generateQRBuffer(productId, productCode);

    const fileName = `qr-${productId}-${Date.now()}.png`;
    const bucketName = process.env.AWS_S3_BUCKET_NAME!;
    const s3Key = `qr-codes/${fileName}`;

    // Subir a S3
    await s3
      .putObject({
        Bucket: bucketName,
        Key: s3Key,
        Body: qrBuffer,
        ContentType: 'image/png' 
      })
      .promise();


    // URL pública del archivo en S3
    const qrPath = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    console.log(`QR code uploaded to S3: ${qrPath}`);
    return {
      qrPath,
      productCode: code,
      productURL
    };
  }

  // Genera QR como base64 para incluir directamente en respuestas
  static async generateQRBase64(productId: string, productCode?: string): Promise<{
    qrBase64: string;
    productCode: string;
    productURL: string;
  }> {
    const { qrBuffer, productCode: code, productURL } = await this.generateQRBuffer(productId, productCode);

    const qrBase64 = `data:image/png;base64,${qrBuffer.toString('base64')}`;

    return {
      qrBase64,
      productCode: code,
      productURL
    };
  }
}