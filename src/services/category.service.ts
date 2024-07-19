import { CategoryRepository } from "../repositories/category.repository"

const getAllCategories = async () => {
    return await CategoryRepository.findAll();
};

const registerCategory = async (category: any) => {
    return await CategoryRepository.registerCategory(category);
};

export const CategoryService ={
    getAllCategories,
    registerCategory
}