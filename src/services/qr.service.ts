import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

export class QRService {
  private static QR_DIRECTORY = path.resolve(__dirname, '../../public/qr-codes');

  // Asegura que el directorio para QR existe
  private static async ensureQRDirectory(): Promise<void> {
    try {
      await fs.access(this.QR_DIRECTORY);
    } catch {
      await fs.mkdir(this.QR_DIRECTORY, { recursive: true });
    }
  }

  // Genera un código único para el producto
  static generateUniqueProductCode(productId: string): string {
    const uuid = uuidv4();
    return `PROD-${productId}-${uuid.substring(0, 8).toUpperCase()}`;
  }

  // Genera la URL del producto (puedes personalizarla según tu frontend)
  private static generateProductURL(productCode: string, productId: string): string {
    // Cambia esta URL por la de tu aplicación frontend
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

  // Genera y guarda el QR en el sistema de archivos
  static async generateAndSaveQR(productId: string, productCode?: string): Promise<{
    qrPath: string;
    productCode: string;
    productURL: string;
  }> {
    await this.ensureQRDirectory();

    const { qrBuffer, productCode: code, productURL } = await this.generateQRBuffer(productId, productCode);
    
    const fileName = `qr-${productId}-${Date.now()}.png`;
    const qrPath = path.join(this.QR_DIRECTORY, fileName);
    
    await fs.writeFile(qrPath, qrBuffer);

    return {
      qrPath: `/qr-codes/${fileName}`, // Ruta relativa para el frontend
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

  // Elimina un archivo QR del sistema
  static async deleteQRFile(qrPath: string): Promise<void> {
    try {
      const fullPath = path.join(__dirname, '../../public', qrPath);
      await fs.unlink(fullPath);
    } catch (error) {
      console.warn('No se pudo eliminar el archivo QR:', error);
    }
  }
}