import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ICaracteristicas_Producto } from "../ICaracteristicas_Producto";
import { ICategoria } from "../ICategoria";
import { IProducto } from "../IProducto";
import { IProducto_Sucursal } from "../IProducto_Sucursal";
import { IVendedor } from "../IVendedor";
import { IVenta } from "../IVenta";
import { VendedorEntity } from './VendedorEntity';
import { Caracteristicas_ProductoEntity } from './Caracteristicas_ProductoEntity';
import { CategoriaEntity } from './CategoriaEntity';
import { VentaEntity } from './VentaEntity';
import { Producto_SucursalEntity } from './Producto_SucursalEntity';

@Entity({name:'Producto'})
export class ProductoEntity implements IProducto{
    
    @PrimaryGeneratedColumn()
    id_Producto!: number;
    
    @Column({type: 'varchar'})
    nombre_producto!: string;
    
    @Column()
    precio!: number;
    
    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    fecha_De_Ingreso!: Date;
    
    @Column({type: 'varchar'})
    imagen!: string;
    
    @Column({nullable:false})
    id_Categoria!: number;
    
    @Column({nullable:false})
    id_Vendedor!: number;

    @ManyToOne(() => VendedorEntity, vendedorEntity => vendedorEntity.producto)
    @JoinColumn({ name: 'id_Vendedor'})
    vendedor!: IVendedor;

    @OneToMany(() => Caracteristicas_ProductoEntity, caracteristicaProducto => caracteristicaProducto.producto)
    caracteristicas_producto!: ICaracteristicas_Producto[];
    
    @ManyToOne(() => CategoriaEntity, categoriaEntity => categoriaEntity.producto)
    @JoinColumn({ name: 'id_Categoria'})
    categoria!: ICategoria;

    @OneToMany(() => VentaEntity, ventaEntity => ventaEntity.producto)
    venta!: IVenta[];

    @OneToMany(() => Producto_SucursalEntity, producto_SucursalEntity => producto_SucursalEntity.producto)
    producto_Sucursal!: IProducto_Sucursal[];

}