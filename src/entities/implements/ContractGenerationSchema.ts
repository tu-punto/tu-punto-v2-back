import { Document, Schema, Types, model } from "mongoose";

export interface IContractGeneration extends Document {
  seller: Types.ObjectId;
  generatedBy: Types.ObjectId;
  kind: "service_order" | "contract";
  fileName: string;
  s3Key?: string;
  inputs: Record<string, unknown>;
  documentVersions: { type: string; version: string; document?: Types.ObjectId }[];
  createdAt: Date;
  updatedAt: Date;
}

const ContractGenerationSchema = new Schema<IContractGeneration>(
  {
    seller: { type: Schema.Types.ObjectId, ref: "Vendedor", required: true, index: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["service_order", "contract"], required: true },
    fileName: { type: String, required: true },
    s3Key: { type: String },
    inputs: { type: Schema.Types.Mixed, default: {} },
    documentVersions: [{ type: { type: String, required: true }, version: { type: String, required: true }, document: { type: Schema.Types.ObjectId, ref: "ContractDocument" } }],
  },
  { collection: "ContractGeneration", timestamps: true }
);

export const ContractGenerationModel = model<IContractGeneration>("ContractGeneration", ContractGenerationSchema);
