import { MongoClient } from "mongodb";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import "dotenv/config";
import { Reading } from "@/src/lib/schemas";
import axios from "axios";

const fetchReadingsFromAtlas = async (trapId: string): Promise<Reading[]> => {
  if (!process.env.MONGODB_ATLAS_URI) {
    throw new Error("String de conexão do MongoDB não configurada.");
  }

  const client = new MongoClient(process.env.MONGODB_ATLAS_URI);

  try {
    await client.connect();
    const db = client.db("farmonedge_db");
    const collection = db.collection("readings");

    const readings = await collection
      .find({ "refInsectTrap.value": trapId })
      .sort({ "processed_at.value": 1 })
      .toArray();

    return readings.map((reading: any) => ({
      _id: reading.id,
      insect_count: reading.insect_count?.value ?? 0,
      processed_at: reading.processed_at?.value,
      sourceImage: reading.sourceImage?.value,
    }));
  } finally {
    await client.close();
  }
};

const fetchReadingsFromFiware = async (trapId: string): Promise<Reading[]> => {
  const FIWARE_API_URL =
    process.env.VITE_FIWARE_API_URL || "http://192.168.1.200:1026/v2";

  const { data: entities } = await axios.get(`${FIWARE_API_URL}/entities`, {
    params: {
      type: "InsectReading",
      q: `refInsectTrap=='${trapId}'`,
      orderBy: "processed_at",
    },
  });

  return entities.map((entity: any) => ({
    _id: entity.id,
    insect_count: entity.insect_count?.value ?? 0,
    processed_at: entity.processed_at?.value,
    sourceImage: entity.sourceImage?.value,
  }));
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { trapId } = req.query;

  if (req.method !== "GET" || !trapId || typeof trapId !== "string") {
    return res.status(400).json({ message: "Requisição inválida" });
  }

  try {
    let readings: Reading[];
    if (process.env.VITE_APP_ENV === "local") {
      console.log(
        `Modo local: Buscando leituras para a armadilha ${trapId} do FIWARE...`
      );
      readings = await fetchReadingsFromFiware(trapId);
    } else {
      console.log(
        `Modo nuvem: Buscando leituras para a armadilha ${trapId} do Atlas...`
      );
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
