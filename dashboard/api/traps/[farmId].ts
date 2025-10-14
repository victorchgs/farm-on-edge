import type { VercelRequest, VercelResponse } from "@vercel/node";
import "dotenv/config";
import {
  fetchTrapsFromAtlas,
  fetchTrapsFromFiware,
} from "../../server/logic/traps.js";
import { Trap } from "../../src/lib/schemas";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { farmId } = req.query;

  if (req.method !== "GET" || !farmId || typeof farmId !== "string") {
    return res.status(400).json({ message: "Requisição inválida" });
  }

  try {
    let traps: Trap[];

    if (process.env.VITE_APP_ENV === "local") {
      traps = await fetchTrapsFromFiware(farmId);
    } else {
      traps = await fetchTrapsFromAtlas(farmId);
    }

    res.status(200).json(traps);
  } catch (error) {
    console.error(
      `Falha ao buscar armadilhas para a fazenda ${farmId}:`,
      error
    );
    res.status(500).json({ message: "Erro ao buscar dados" });
  }
}
