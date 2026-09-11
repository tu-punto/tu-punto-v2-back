import { CategoryRepository } from "../repositories/category.repository";

const getAllCategories = async () => CategoryRepository.findAll();

const registerCategory = async (category: any) => CategoryRepository.registerCategory(category);

const getCategoryById = async (id: string) => {
  const category = await CategoryRepository.getCategoryById(id);
  if (!category) throw new Error("Categoria no encontrada");
  return category;
};

const updateCategory = async (id: string, updates: { categoria?: string; imagen_catalogo_url?: string }) => {
  const category = await CategoryRepository.updateCategory(id, updates);
  if (!category) throw new Error("Categoria no encontrada");
  return category;
};

export const CategoryService = { getAllCategories, registerCategory, getCategoryById, updateCategory };
