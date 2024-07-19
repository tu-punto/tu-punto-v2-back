import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { IPedido } from "../IPedido";
import { IProducto } from "../IProducto";
import { IVenta } from "../IVenta";
import { ProductoEntity } from './ProductoEntity';
import { PedidoEntity } from './PedidoEntity';

@Entity({name:'Venta'})
export class VentaEntity implements IVenta{
    
    @PrimaryGeneratedColumn()
    idVenta!: number

    @Column()
    cantidad!: number;

    @Column()
    precio_Unitario!: number;

    @Column()
    utilidad!: number;

    @Column()
    utilidad_Extra!: number;

    @ManyToOne( () => ProductoEntity, (product) => product.venta)
    @JoinColumn({
        name: "id_Producto",
        referencedColumnName: "id_Producto",
        foreignKeyConstraintName: "fk_prod_id"
    })
    producto!: ProductoEntity

    @ManyToOne( () => PedidoEntity, (pedido) => pedido.venta)
    @JoinColumn({
        name: "id_Pedido",
        referencedColumnName: "id_Pedido",
        foreignKeyConstraintName: "fk_ped_id"
    })
    pedido!: PedidoEntity

}