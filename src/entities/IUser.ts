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
  must_change_password?: boolean;
  password_changed_at?: Date;
  failed_login_attempts?: number;
  login_locked_until?: Date | null;
}
