import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ICaracteristicas } from "../ICaracteristicas";
import { ICaracteristicas_Producto } from "../ICaracteristicas_Producto";
import { IProducto } from "../IProducto";
import { ProductoEntity } from './ProductoEntity';
import { CaracteristicasEntity } from './CaracteristicasEntity';

@Entity({name:'Caracteristicas_Producto'})
export class Caracteristicas_ProductoEntity implements ICaracteristicas_Producto{
    
    @PrimaryColumn({nullable:false})
    id_Caracteristica!: number;

    @PrimaryColumn({nullable:false})
    id_Producto!: number;

    @Column({nullable: false})
    value!: string;

    @OneToMany(() => CaracteristicasEntity, caracteristicas => caracteristicas.caracteristicas_Producto)
    @JoinColumn({ name: 'id_Caracteristica'})
    caracteristicas!: ICaracteristicas[];

    @OneToMany(() => ProductoEntity, producto => producto.caracteristicas_producto)
    @JoinColumn({ name: 'id_Producto'})
    producto!: IProducto[];
    
}