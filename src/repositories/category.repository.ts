import { ICategoria } from "../entities/ICategoria";
import { CategoriaModel } from "../entities/implements/CategoriaSchema";
import { Categoria } from "../models/Categoria";
import { ICategoriaDocument } from "../entities/documents/ICategoriaDocument";
const findAll = async (): Promise<ICategoriaDocument[]> => {
    const categories = await CategoriaModel.find();
    return categories;
  };
  
  const registerCategory = async (category: ICategoria): Promise<ICategoriaDocument> => {
    const newCategory = new CategoriaModel(category);
    const savedCategory = await newCategory.save();
    return savedCategory; 
  };
  
  const getCategoryById = async (id: string): Promise<ICategoriaDocument | null> => {
    const category = await CategoriaModel.findById(id);
    return category; 
  };
  
  export const CategoryRepository = {
    findAll,
    registerCategory,
    getCategoryById,
  };
