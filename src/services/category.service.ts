import { CategoryRepository } from "../repositories/category.repository";


const getAllCategories = async () => {
    return await CategoryRepository.findAll();
};

const registerCategory = async (category: any) => {
    return await CategoryRepository.registerCategory(category);
};

const getCategoryById = async (id: any) => {
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