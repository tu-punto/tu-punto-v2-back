import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { CierreCajaEntity } from "./CierreCajaEntity";

@Entity({ name: "Efectivo_Diario" })
export class EfectivoDiarioEntity {
  @PrimaryGeneratedColumn()
  id_efectivo_diario!: number;

  @Column({ type: "integer", default: 0 })
  corte_0_2!: number;

  @Column({ type: "integer", default: 0 })
  corte_0_5!: number;

  @Column({ type: "integer", default: 0 })
  corte_1!: number;

  @Column({ type: "integer", default: 0 })
  corte_2!: number;

  @Column({ type: "integer", default: 0 })
  corte_5!: number;

  @Column({ type: "integer", default: 0 })
  corte_10!: number;

  @Column({ type: "integer", default: 0 })
  corte_20!: number;

  @Column({ type: "integer", default: 0 })
  corte_50!: number;

  @Column({ type: "integer", default: 0 })
  corte_100!: number;

  @Column({ type: "integer", default: 0 })
  corte_200!: number;

  @Column({ type: "integer", default: 0 })
  total_coins!: number;

  @Column({ type: "integer", default: 0 })
  total_bills!: number;

  @Column({type: 'timestamptz', nullable: false, default: () => "CURRENT_TIMESTAMP(6)" })
  created_at!: Date;

  @Column({type: 'timestamptz', nullable: false, default: () => "CURRENT_TIMESTAMP(6)" })
  updated_at!: Date;

  @OneToOne(() => CierreCajaEntity)
  @JoinColumn({ name: "id_cierre_caja" })
  id_cierre_caja!: CierreCajaEntity;
}
