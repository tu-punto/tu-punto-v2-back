import * as EntryRepository from '../repositories/entry.repository'

export const getProductsEntryAmount = async (sellerId: number) => {
    const products = await EntryRepository.findBySellerId(sellerId)
    if(!products) throw new Error("Doesn't exist such products with that seller id as fk")
    return products
}