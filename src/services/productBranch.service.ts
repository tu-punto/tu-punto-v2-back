import { ProductBranchRepository } from "../repositories/productBranch.repository"

const getAllProductBranches = async () => {
    return await ProductBranchRepository.findAll()
}

const registerProductBranch = async (productBranch: any) => {
    return await ProductBranchRepository.registerProductBranch(productBranch)
}

export const ProductBranchService = {
    getAllProductBranches, registerProductBranch
}