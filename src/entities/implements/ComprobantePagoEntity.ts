import { Entity, PrimaryColumn,  Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { IComprobantePago } from "../IComprobantePago";
import { IVendedor } from "../IVendedor";
import { VendedorEntity } from './VendedorEntity';

@Entity({name:'Comprobante_Pago'})
export class ComprobantePagoEntity implements IComprobantePago{

    @PrimaryGeneratedColumn()
    id_comprobante_pago!: number;

    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    fecha_emision!: Date;

    @Column({nullable:false, default: () => 'CURRENT_TIMESTAMP(6)'})
    hora_emision!: Date;

    @Column({type: 'varchar'})
    comprobante_entrada_pdf!: string;

    @Column()
    total_ventas!: number;

    @Column()
    total_adelantos!: number;

    @Column({nullable:false})
    id_vendedor!: number;

    @ManyToOne(() => VendedorEntity, vendedorEntity => vendedorEntity.comprobante_pago)
    @JoinColumn({ name: 'id_Vendedor'})
    vendedor!: IVendedor;
}