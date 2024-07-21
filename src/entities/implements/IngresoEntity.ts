import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { IIngreso } from "../IIngreso";
import { IProducto_Sucursal } from "../IProducto_Sucursal";
import { Producto_SucursalEntity } from './Producto_SucursalEntity';

@Entity({name:'Ingreso'})
export class IngresoEntity implements IIngreso{

    @PrimaryGeneratedColumn()
    id_ingreso!: number;

    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    fecha_ingreso!: Date;
    
    @Column({type: 'varchar'})
    estado!: string;

    @ManyToMany(() => Producto_SucursalEntity)
    @JoinTable()
    producto_sucursal!: IProducto_Sucursal[];
}