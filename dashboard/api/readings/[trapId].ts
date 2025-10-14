import type { VercelRequest, VercelResponse } from "@vercel/node";
import "dotenv/config";
import {
  fetchReadingsFromAtlas,
  fetchReadingsFromFiware,
} from "../../server/logic/reading.js";
import { Reading } from "../../src/lib/schemas";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { trapId } = req.query;

  if (req.method !== "GET" || !trapId || typeof trapId !== "string") {
    return res.status(400).json({ message: "Requisição inválida" });
  }

  try {
    let readings: Reading[];

    if (process.env.VITE_APP_ENV === "local") {
      readings = await fetchReadingsFromFiware(trapId);
    } else {
      readings = await fetchReadingsFromAtlas(trapId);
    }

    res.status(200).json(readings);
  } catch (error) {
    console.error(
      `Falha ao buscar leituras para a armadilha ${trapId}:`,
      error
    );
    res.status(500).json({ message: "Erro ao buscar dados" });
  }
}
