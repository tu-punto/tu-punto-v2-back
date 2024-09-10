import {
  Entity,
  PrimaryColumn,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
} from "typeorm";
import { IUser } from "../IUser";
import { VendedorEntity } from "./VendedorEntity";
import { IVendedor } from "../IVendedor";
import { TrabajadorEntity } from "./TrabajadorEntity";
import { ITrabajador } from "../ITrabajador";

@Entity({ name: "User" })
export class UserEntity implements IUser {
  @PrimaryGeneratedColumn()
  id_user!: number;

  @Column()
  email!: string;

  @Column()
  password!: string;

  @Column()
  role!: string;

  @OneToOne(() => VendedorEntity, (vendedor) => vendedor.user)
  vendedor!: IVendedor;

  @OneToOne(() => TrabajadorEntity, (trabajador) => trabajador.user)
  trabajador!: ITrabajador;
}
