import { Types } from 'mongoose';
import { ITrabajador } from "./ITrabajador";
import { IVendedor } from "./IVendedor";
import { UserRole } from "../constants/roles";

export interface IUser {
  email: string;
  password: string;
  role: UserRole;
  sucursal: Types.ObjectId;
  vendedor: Types.ObjectId;
  trabajador: Types.ObjectId;
}
