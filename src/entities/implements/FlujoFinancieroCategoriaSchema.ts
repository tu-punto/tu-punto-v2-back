import { model, Schema } from "mongoose";
import { IFlujofinancieroCategoriaDocument } from "../documents/IFlujoFinancieroCategoriaDocument";

const FlujoFinancieroCategoriaSchema =
  new Schema<IFlujofinancieroCategoriaDocument>(
    {
      nombre: {
        type: String,
        required: true,
      },
      activo: {
        type: Boolean,
        default: true,
      },
    },
    { collection: "Flujo_Financiero_Categoria", timestamps: true }
  );

export const FlujoFinancieroCategoriaModel =
  model<IFlujofinancieroCategoriaDocument>(
    "FlujoFinancieroCategoria",
    FlujoFinancieroCategoriaSchema
  );
