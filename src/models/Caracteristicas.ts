import { ICaracteristicas } from "../entities/ICaracteristicas";
import { ICaracteristicas_Producto } from "../entities/ICaracteristicas_Producto";

export class Caracteristicas{
    id_Caracteristicas: number;
    nombre: string;

    caracteristicas_Producto: ICaracteristicas_Producto[];

    constructor(iCaracteristicas: ICaracteristicas){
        this.id_Caracteristicas = iCaracteristicas.id_Caracteristicas;
        this.nombre = iCaracteristicas.nombre;
        this.caracteristicas_Producto= iCaracteristicas.caracteristicas_Producto;
    }
}