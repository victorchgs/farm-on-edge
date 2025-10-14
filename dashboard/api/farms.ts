import type { VercelRequest, VercelResponse } from "@vercel/node";
import "dotenv/config";
import {
  fetchFarmsFromAtlas,
  fetchFarmsFromFiware,
} from "../server/logic/farms";
import { Farm } from "../src/lib/schemas";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    let farms: Farm[];

    if (process.env.VITE_APP_ENV === "local") {
      farms = await fetchFarmsFromFiware();
    } else {
      farms = await fetchFarmsFromAtlas();
    }

    res.status(200).json(farms);
  } catch (error) {
    console.error("Falha ao buscar fazendas:", error);
    res.status(500).json({ message: "Erro ao buscar dados" });
  }
}
