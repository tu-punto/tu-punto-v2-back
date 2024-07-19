import { CategoryRepository } from "../repository/category.repository"
import categoryRouter from "../routes/category,routes";

const getAllCategories = async () => {
    return await CategoryRepository.findAll();
};

const registerCategory = async (category: any) => {
    return await CategoryRepository.registerCategory(category);
};

const getCategoryById = async (id: number) => {
    const category = await CategoryRepository.getCategoryById(id)
    if(!category)
        throw new Error("Doesn't exist a category with such id")
    return category
}

export const CategoryService ={
    getAllCategories,
    registerCategory,
    getCategoryById
}