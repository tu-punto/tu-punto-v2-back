import { ICaracteristicas } from "../entities/ICaracteristicas";
import { IProducto } from "../entities/IProducto";

export class Caracteristicas{
    id_caracteristicas: number;
    feature: string;
    value: string;
    product: IProducto

    constructor(iCaracteristicas: ICaracteristicas){
        this.id_caracteristicas = iCaracteristicas.id_caracteristicas;
        this.feature = iCaracteristicas.feature
        this.value = iCaracteristicas.value
        this.product = iCaracteristicas.product
    }
}