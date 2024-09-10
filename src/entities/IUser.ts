import { ITrabajador } from "./ITrabajador";
import { IVendedor } from "./IVendedor";

export interface IUser {
  id_user: number;
  email: string;
  password: string;
  role: string;

  vendedor: IVendedor;
  trabajador: ITrabajador;
}
