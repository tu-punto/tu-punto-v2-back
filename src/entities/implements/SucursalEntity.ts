import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { IPedido } from "../IPedido";
import { IProducto_Sucursal } from "../IProducto_Sucursal";
import { ISucursal } from "../ISucursal";
import { Producto_SucursalEntity } from './Producto_SucursalEntity';
import { PedidoEntity } from './PedidoEntity';

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

    @Column({nullable:false})
    id_trabajador!: number;

    @OneToMany(() => Producto_SucursalEntity, producto_SucursalEntity => producto_SucursalEntity.sucursal)
    producto_sucursal!: IProducto_Sucursal[];

    @ManyToOne(() => PedidoEntity, productoEntity => productoEntity.sucursal)
    @JoinColumn({ name: 'id_trabajador'})
    pedido!: IPedido;
}