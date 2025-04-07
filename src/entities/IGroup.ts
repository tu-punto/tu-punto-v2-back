import { Types } from 'mongoose';

export interface IGroup {
  id: number;
  name: string;
  products: Types.ObjectId[];
}
