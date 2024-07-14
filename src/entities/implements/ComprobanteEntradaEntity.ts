import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { IComprobanteEntrada } from "../IComprobanteEntrada";
import { IVendedor } from "../IVendedor";
import { VendedorEntity } from './VendedorEntity';

@Entity({name:'Comprobante_Entrada'})
export class ComprobanteEntradaEntity implements IComprobanteEntrada{
    
    @PrimaryGeneratedColumn()
    id_Comprobante_Entrada!: number;

    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    fecha_emision!: Date;
    
    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    hora_emision!: Date;

    @Column({type: 'varchar'})
    comprobante_pdf!: string;

    @Column({nullable:false})   
    id_Vendedor!: number;

    @ManyToOne(() => VendedorEntity, vendedorEntity => vendedorEntity.comprobante_Entrada)
    @JoinColumn({ name: 'id_Vendedor'})
    vendedor!: IVendedor;

}