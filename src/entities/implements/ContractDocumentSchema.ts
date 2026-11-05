import { Document, Schema, Types, model } from "mongoose";

export const CONTRACT_DOCUMENT_TYPES = [
  "contract_template",
  "service_order_template",
  "annex_4",
  "policies",
  "tariff",
  "prohibited_products",
] as const;

export type ContractDocumentType = (typeof CONTRACT_DOCUMENT_TYPES)[number];

export interface IContractDocument extends Document {
  type: ContractDocumentType;
  name: string;
  version: string;
  source: "file" | "link";
  url: string;
  s3Key?: string;
  fileName?: string;
  contentType?: string;
  active: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ContractDocumentSchema = new Schema<IContractDocument>(
  {
    type: { type: String, enum: CONTRACT_DOCUMENT_TYPES, required: true, index: true },
    name: { type: String, required: true, trim: true },
    version: { type: String, required: true, trim: true },
    source: { type: String, enum: ["file", "link"], required: true },
    url: { type: String, required: true, trim: true },
    s3Key: { type: String, trim: true },
    fileName: { type: String, trim: true },
    contentType: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { collection: "ContractDocument", timestamps: true }
);

ContractDocumentSchema.index({ type: 1, active: 1 });

export const ContractDocumentModel = model<IContractDocument>("ContractDocument", ContractDocumentSchema);
