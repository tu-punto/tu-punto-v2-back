import { Types } from 'mongoose';
import { ITrabajador } from "./ITrabajador";
import { IVendedor } from "./IVendedor";

export interface IUser {
  email: string;
  password: string;
  role: string;
  sucursal: Types.ObjectId;
  vendedor: Types.ObjectId;
  trabajador: Types.ObjectId;
}
