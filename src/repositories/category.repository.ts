import AppDataSource from "../config/dataSource";
import { ICategoria } from "../entities/ICategoria";
import { CategoriaEntity } from "../entities/implements/CategoriaEntity";
import { Categoria } from "../models/Categoria";

const categoryRepository = AppDataSource.getRepository(CategoriaEntity);

const findAll = async (): Promise<Categoria[]> => {
    return await categoryRepository.find()
}

const registerCategory = async (category: ICategoria): Promise<Categoria> => {
    const newCategory = categoryRepository.create(category);
    const savedCategory = await categoryRepository.save(newCategory);
    return new Categoria(savedCategory);
}

const getCategoryById = async(id: number) => {
    return await categoryRepository.findOne({
        where: {
            id_categoria: id
        }
    })
}

export const CategoryRepository = {
    findAll,
    registerCategory,
    getCategoryById
};