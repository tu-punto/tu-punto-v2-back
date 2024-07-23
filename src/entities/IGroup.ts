import { ProductoEntity } from "./implements/ProductoEntity"


export interface IGroup{
    id: number
    name: string
    products: ProductoEntity[]
}