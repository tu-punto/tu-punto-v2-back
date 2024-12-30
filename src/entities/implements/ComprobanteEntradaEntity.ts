import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { IComprobanteEntrada } from "../IComprobanteEntrada";
import { IVendedor } from "../IVendedor";
import { VendedorEntity } from './VendedorEntity';

@Entity({name:'Comprobante_Entrada'})
export class ComprobanteEntradaEntity implements IComprobanteEntrada{
    
    @PrimaryGeneratedColumn()
    id_comprobante_entrada!: number;

    @Column({type: 'timestamptz',nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    fecha_emision!: Date;
    
    @Column({type: 'timestamptz',nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    hora_emision!: Date;

    @Column({type: 'varchar'})
    comprobante_pdf!: string;

    @Column({nullable:false})   
    id_vendedor!: number;

    @ManyToOne(() => VendedorEntity, vendedorEntity => vendedorEntity.comprobante_entrada)
    @JoinColumn({ name: 'id_vendedor'})
    vendedor!: IVendedor;

}