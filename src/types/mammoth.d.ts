declare module "mammoth" {
  export interface ConversionResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  export function convertToHtml(input: { buffer: Buffer }): Promise<ConversionResult>;
  const mammoth: { convertToHtml: typeof convertToHtml };
  export default mammoth;
}
