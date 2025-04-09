import { Document, Types } from 'mongoose';
import { IUser } from '../IUser';

export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId; 
  createdAt?: Date; 
  updatedAt?: Date; 
}
