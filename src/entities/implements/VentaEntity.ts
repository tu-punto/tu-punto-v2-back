import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { IPedido } from "../IPedido";
import { IProducto } from "../IProducto";
import { IVenta } from "../IVenta";
import { ProductoEntity } from './ProductoEntity';
import { PedidoEntity } from './PedidoEntity';
import { IVendedor } from '../IVendedor';
import { VendedorEntity } from './VendedorEntity';

@Entity({name:'Venta'})
export class VentaEntity implements IVenta{
    
    @PrimaryGeneratedColumn()
    id_venta!: number

    @Column()
    cantidad!: number;

    @Column()
    precio_unitario!: number;

    @Column({default: 0})
    utilidad!: number;

    @Column({default: false})
    deposito_realizado!: boolean;

    @ManyToOne( () => ProductoEntity, (product) => product.venta)
    @JoinColumn({
        name: "id_producto",
        referencedColumnName: "id_producto",
        foreignKeyConstraintName: "fk_prod_id"
    })
    producto!: IProducto

    @ManyToOne( () => PedidoEntity, (pedido) => pedido.venta)
    @JoinColumn({
        name: "id_pedido",
        referencedColumnName: "id_pedido",
        foreignKeyConstraintName: "fk_ped_id"
    })
    pedido!: IPedido

    @ManyToOne( () => VendedorEntity, (vendedor) => vendedor.venta)
    @JoinColumn({
        name: "id_vendedor",
        referencedColumnName: "id_vendedor",
        foreignKeyConstraintName: "fk_vend_id"
    })
    vendedor!: IVendedor;

}