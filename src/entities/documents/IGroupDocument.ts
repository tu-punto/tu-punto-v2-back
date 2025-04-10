import { Document, Types } from 'mongoose';
import { IGroup } from '../IGroup';

export interface IGroupDocument extends IGroup, Document {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
