import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { IPedido } from "../IPedido";
import { IProducto } from "../IProducto";
import { IVenta } from "../IVenta";
import { ProductoEntity } from './ProductoEntity';
import { PedidoEntity } from './PedidoEntity';

@Entity({name:'Venta'})
export class VentaEntity implements IVenta{
    
    @PrimaryColumn({nullable:false})
    id_Producto!: number;

    @PrimaryColumn({nullable:false})
    id_Pedido!: number;

    @Column()
    cantidad!: number;

    @Column()
    precio_Unitario!: number;

    @Column()
    utilidad!: number;

    @Column()
    utilidad_Extra!: number;

    @OneToMany(() => ProductoEntity, productoEntity => productoEntity.venta)
    @JoinColumn({ name: 'id_Producto'})
    producto!: IProducto[];

    @OneToMany(() => PedidoEntity, pedidoEntity => pedidoEntity.venta)
    @JoinColumn({ name: 'id_Pedido'})
    pedido!: IPedido[];

}