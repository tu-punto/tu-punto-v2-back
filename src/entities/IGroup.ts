import { Types } from 'mongoose';

export interface IGroup {
  _id?: Types.ObjectId;
  name: string;
  products: Types.ObjectId[];
}
