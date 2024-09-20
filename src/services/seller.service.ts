import { SellerRepository } from "../repositories/seller.repository"


const getAllSellers = async () => {
    const sellers = await SellerRepository.findAll()
    return sellers
}

const getSeller = async (sellerId:string) => {
    try{
        const seller = await SellerRepository.findById(parseInt(sellerId))
        return seller;
    }catch(error){
        console.log("Error getting sellerService", error)
        throw new Error("Seller service error");
    }
}

const registerSeller = async (seller: any) => {
    const newSeller = await SellerRepository.registerSeller(seller)
    return newSeller;
}

const updateSeller = async (sellerId: number, newData: any) => {
    const seller = await SellerRepository.findById(sellerId)
    if (!seller) throw new Error(`Seller with id ${sellerId} doesn't exist`)
    return await SellerRepository.updateSeller(seller, newData)
}

export const SellerService = {
    getAllSellers,
    registerSeller,
    updateSeller,
    getSeller
}