import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ICaracteristicas } from "../ICaracteristicas";
import { ProductoEntity } from './ProductoEntity';
import { IProducto } from '../IProducto';

@Entity({name:'Caracteristicas'})
export class CaracteristicasEntity implements ICaracteristicas{
    
    @PrimaryGeneratedColumn()
    id_caracteristicas!: number;
    
    @Column({type: 'varchar'})
    feature!: string;
    
    @Column({type: 'varchar'})
    value!: string

    @ManyToOne( () => ProductoEntity, (product) => product.features)
    product!: IProducto


}