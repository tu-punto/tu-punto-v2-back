import { Document } from "mongoose";
import { IBoxClosePendingOperation } from "../IBoxClosePendingOperation";

export interface IBoxClosePendingOperationDocument
  extends IBoxClosePendingOperation,
    Document {}
