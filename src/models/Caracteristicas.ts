import { ICaracteristicas } from "../entities/ICaracteristicas";
import { ICaracteristicas_Producto } from "../entities/ICaracteristicas_Producto";

export class Caracteristicas{
    id_caracteristicas: number;
    nombre: string;

    caracteristicas_producto: ICaracteristicas_Producto[];

    constructor(iCaracteristicas: ICaracteristicas){
        this.id_caracteristicas = iCaracteristicas.id_caracteristicas;
        this.nombre = iCaracteristicas.nombre;
        this.caracteristicas_producto= iCaracteristicas.caracteristicas_producto;
    }
}