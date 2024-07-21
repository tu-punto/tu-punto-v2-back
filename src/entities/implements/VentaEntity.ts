import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { IPedido } from "../IPedido";
import { IProducto } from "../IProducto";
import { IVenta } from "../IVenta";
import { ProductoEntity } from './ProductoEntity';
import { PedidoEntity } from './PedidoEntity';

@Entity({name:'Venta'})
export class VentaEntity implements IVenta{
    
    @PrimaryGeneratedColumn()
    id_venta!: number

    @Column()
    cantidad!: number;

    @Column()
    precio_unitario!: number;

    @Column()
    utilidad!: number;

    @Column()
    utilidad_extra!: number;

    @ManyToOne( () => ProductoEntity, (product) => product.venta)
    @JoinColumn({
        name: "id_producto",
        referencedColumnName: "id_producto",
        foreignKeyConstraintName: "fk_prod_id"
    })
    producto!: ProductoEntity

    @ManyToOne( () => PedidoEntity, (pedido) => pedido.venta)
    @JoinColumn({
        name: "id_pedido",
        referencedColumnName: "id_pedido",
        foreignKeyConstraintName: "fk_ped_id"
    })
    pedido!: PedidoEntity

}