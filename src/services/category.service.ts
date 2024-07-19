import { CategoryRepository } from "../repository/category.repository"

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