import { LandingLeadModel } from "../entities/implements/LandingLeadSchema";

const normalizeText = (value: unknown) => String(value || "").trim();

const normalizeBranchList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item))
    .filter(Boolean);
};

const validateEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export const LandingLeadService = {
  async registerLead(payload: any) {
    const nombre = normalizeText(payload?.nombre ?? payload?.name);
    const telefono = normalizeText(payload?.telefono ?? payload?.phone);
    const ciudad = normalizeText(payload?.ciudad ?? payload?.city);
    const email = normalizeText(payload?.email);
    const productos = normalizeText(payload?.productos ?? payload?.products);
    const sucursalesInteres = normalizeBranchList(
      payload?.sucursales_interes ?? payload?.branches
    );
    const paginaOrigen = normalizeText(payload?.pagina_origen ?? payload?.sourcePage) === "vendedores"
      ? "vendedores"
      : "inicio";

    if (!nombre || !telefono || !ciudad || !email || !productos || sucursalesInteres.length === 0) {
      throw new Error("Debe completar todos los campos requeridos");
    }

    if (!validateEmail(email)) {
      throw new Error("Debe ingresar un correo valido");
    }

    const lead = await LandingLeadModel.create({
      nombre,
      telefono,
      ciudad,
      email,
      productos,
      sucursales_interes: sucursalesInteres,
      pagina_origen: paginaOrigen,
      contactado: false,
    });

    return lead;
  },

  async listLeads() {
    return LandingLeadModel.find({})
      .sort({ contactado: 1, createdAt: -1 })
      .lean();
  },

  async updateContactStatus(id: string, contactado: boolean) {
    const lead = await LandingLeadModel.findByIdAndUpdate(
      id,
      {
        $set: {
          contactado,
          contactado_at: contactado ? new Date() : null,
        },
      },
      { new: true }
    ).lean();

    if (!lead) {
      throw new Error("Lead no encontrado");
    }

    return lead;
  },
};
