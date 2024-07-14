import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ICaracteristicas } from "../ICaracteristicas";
import { Caracteristicas_ProductoEntity } from './Caracteristicas_ProductoEntity';
import { ICaracteristicas_Producto } from '../ICaracteristicas_Producto';

@Entity({name:'Caracteristicas'})
export class CaracteristicasEntity implements ICaracteristicas{
    
    @PrimaryGeneratedColumn()
    id_Caracteristicas!: number;
    
    @Column({type: 'varchar'})
    nombre!: string;
    
    @Column({type: 'varchar'})
    valor!: string;
    
    @Column({nullable:false})    
    id_Producto!: number;
    
    @ManyToOne(() => Caracteristicas_ProductoEntity, caracteristicas_Producto => caracteristicas_Producto.caracteristicas)
    @JoinColumn({ name: 'id_Producto'})
    caracteristicas_Producto!: ICaracteristicas_Producto;

}