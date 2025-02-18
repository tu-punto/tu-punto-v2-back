import {
  Entity,
  PrimaryColumn,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  OneToOne,
} from "typeorm";
import { IComprobanteEntrada } from "../IComprobanteEntrada";
import { IComprobantePago } from "../IComprobantePago";
import { IProducto } from "../IProducto";
import { ITrabajador } from "../ITrabajador";
import { IVendedor } from "../IVendedor";
import { ComprobanteEntradaEntity } from "./ComprobanteEntradaEntity";
import { ComprobantePago } from "../../models/ComprobantePago";
import { TrabajadorEntity } from "./TrabajadorEntity";
import { PedidoEntity } from "./PedidoEntity";
import { ComprobantePagoEntity } from "./ComprobantePagoEntity";
import { VentaEntity } from "./VentaEntity";
import { IVenta } from "../IVenta";
import { ProductoEntity } from "./ProductoEntity";
import { FlujoFinancieroEntity } from "./FlujoFinancieroEntity";
import { IFlujoFinanciero } from "../IFlujoFinanciero";
import { IIngreso } from "../IIngreso";
import { IngresoEntity } from "./IngresoEntity";
import { UserEntity } from "./UserEntity";
import { IUser } from "../IUser";

@Entity({ name: "Vendedor" })
export class VendedorEntity implements IVendedor {
  @PrimaryGeneratedColumn()
  id_vendedor!: number;

  @Column({ type: "varchar" })
  marca!: string;

  @Column({ type: "varchar" })
  nombre!: string;

  @Column({ type: "varchar" })
  apellido!: string;

  @Column()
  telefono!: number;

  @Column()
  carnet!: number;

  @Column()
  direccion!: string;

  @Column({ type: "varchar" })
  mail!: string;

  @Column({ default: 0 })
  alquiler!: number;

  @Column({ default: 0 })
  exhibicion!: number;

  @Column({ default: 0 })
  delivery!: number;

  @Column({ default: 0 })
  adelanto_servicio!: number;

  @Column({ default: 0 })
  comision_porcentual!: number;

  @Column({ default: 0 })
  comision_fija!: number;

  @Column({type: 'timestamptz', nullable: false, default: () => "CURRENT_TIMESTAMP(6)" })
  fecha!: Date;

  @Column({type: 'timestamptz', nullable: false, default: () => "CURRENT_TIMESTAMP(6)" })
  fecha_vigencia!: Date;

  @Column({nullable: true})
  almacen_caja!: number;

  @Column({ default: 0 })
  deuda!: number;

  @Column({ default: false })
  emite_factura!: boolean;

  @OneToMany(
    () => ComprobanteEntradaEntity,
    (comprobanteEntradaEntity) => comprobanteEntradaEntity.vendedor
  )
  comprobante_entrada!: IComprobanteEntrada[];

  @OneToMany(
    () => ComprobantePagoEntity,
    (comprobantePago) => comprobantePago.vendedor
  )
  comprobante_pago!: IComprobantePago[];

  @ManyToOne(
    () => TrabajadorEntity,
    (trabajadorEntity) => trabajadorEntity.vendedor
  )
  @JoinColumn({ name: "id_trabajador" })
  trabajador!: ITrabajador;

  @OneToMany(() => VentaEntity, (ventaEntity) => ventaEntity.vendedor)
  venta!: IVenta[];

  @OneToMany(() => ProductoEntity, (pedidoEntity) => pedidoEntity.vendedor)
  producto!: IProducto[];

  @OneToMany(
    () => FlujoFinancieroEntity,
    (flujoFinancieroEntity) => flujoFinancieroEntity.vendedor
  )
  flujoFinanciero!: IFlujoFinanciero[];

  @OneToMany(() => IngresoEntity, (ingresoEntity) => ingresoEntity.vendedor)
  ingreso!: IIngreso[];

  @OneToOne(() => UserEntity)
  @JoinColumn({ name: "id_user" })
  user!: IUser;
}
