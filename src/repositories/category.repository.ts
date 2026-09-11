import { ICategoria } from "../entities/ICategoria";
import { CategoriaModel } from "../entities/implements/CategoriaSchema";

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
  const updateCategory = async (id: string, updates: Partial<ICategoria>): Promise<ICategoriaDocument | null> => {
    return CategoriaModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  };
  
  export const CategoryRepository = {
    findAll,
    registerCategory,
    getCategoryById,
    updateCategory,
  };
