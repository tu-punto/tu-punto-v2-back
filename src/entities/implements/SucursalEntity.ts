import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { IPedido } from "../IPedido";
import { IProducto_Sucursal } from "../IProducto_Sucursal";
import { ISucursal } from "../ISucursal";
import { Producto_SucursalEntity } from './Producto_SucursalEntity';
import { PedidoEntity } from './PedidoEntity';
import { TrabajadorEntity } from './TrabajadorEntity';
import { ITrabajador } from '../ITrabajador';
import { IIngreso } from '../IIngreso';
import { IngresoEntity } from './IngresoEntity';

@Entity({name:'Sucursal'})
export class SucursalEntity implements ISucursal{

    @PrimaryGeneratedColumn()
    id_sucursal!: number;

    @Column({type: 'varchar'})
    nombre!: string;

    @Column({type: 'varchar'})
    direccion!: string;

    @Column({type: 'varchar'})
    ciudad!: string;

    @Column()
    telefono!: number;

    @OneToMany(() => Producto_SucursalEntity, producto_SucursalEntity => producto_SucursalEntity.sucursal)
    producto_sucursal!: IProducto_Sucursal[];

    @OneToMany(() => PedidoEntity, pedidoEntity => pedidoEntity.sucursal)
    pedido!: IPedido;

    @OneToMany(() => TrabajadorEntity, trabajadorEntity => trabajadorEntity.sucursal)
    trabajador!: ITrabajador[];

    @OneToMany(()=> IngresoEntity, ingresoEntity => ingresoEntity.sucursal)
    ingreso?: IIngreso[];
}