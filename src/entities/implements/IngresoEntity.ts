import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { IIngreso } from "../IIngreso";
import { IProducto } from '../IProducto';
import { ISucursal } from '../ISucursal';
import { IVendedor } from '../IVendedor';
import { ProductoEntity } from './ProductoEntity';
import { VendedorEntity } from './VendedorEntity';
import { SucursalEntity } from './SucursalEntity';

@Entity({name:'Ingreso'})
export class IngresoEntity implements IIngreso{
    
    @PrimaryGeneratedColumn()
    id_ingreso!: number;
    
    @Column({type: 'timestamptz',nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    fecha_ingreso!: Date;
    
    @Column({type: 'varchar'})
    estado!: string;
    
    @Column()
    cantidad_ingreso!: number;
    
    @Column()
    id_producto!: number;

    @Column()
    id_vendedor!: number;

    @Column()
    id_sucursal!: number;

    @ManyToOne(()=> ProductoEntity, productoEntity => productoEntity.ingreso)
    @JoinColumn({name:'id_producto'})
    producto!: IProducto;

    @ManyToOne(()=> VendedorEntity, vendedorEntity => vendedorEntity.ingreso)
    @JoinColumn({name:'id_vendedor'})
    vendedor!: IVendedor;

    @ManyToOne(()=> SucursalEntity, sucursalEntity => sucursalEntity.ingreso)
    @JoinColumn({name:'id_sucursal'})
    sucursal!: ISucursal;
}