import { FlujoFinancieroCategoriaModel } from "../entities/implements/FlujoFinancieroCategoriaSchema";
import { FLUX_CATEGORIES } from "../constants/fluxCategories";

export const seedFinanceFluxCategory = async () => {
  Object.values(FLUX_CATEGORIES).forEach(async (fluxCategory) => {
    const exists = await FlujoFinancieroCategoriaModel.findOne({
      nombre: fluxCategory,
    });
    if (exists) {
      console.log(
        "Categoria de Flujo Financiero ya existe, no se crea nuevamente"
      );
      return;
    }

    const newFluxCategory = new FlujoFinancieroCategoriaModel({
      nombre: fluxCategory,
    });

    await newFluxCategory.save();
  });
  console.log("Categorias de Flujo Financiero creadas ");
};
