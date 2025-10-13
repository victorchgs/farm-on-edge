import { MongoClient } from "mongodb";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import "dotenv/config";
import { Trap } from "@/src/lib/schemas";
import axios from "axios";

const fetchTrapsFromAtlas = async (farmId: string): Promise<Trap[]> => {
  if (!process.env.MONGODB_ATLAS_URI) {
    throw new Error("String de conexão do MongoDB não configurada.");
  }

  const client = new MongoClient(process.env.MONGODB_ATLAS_URI);

  try {
    await client.connect();
    const db = client.db("farmonedge_db");
    const collection = db.collection("readings");

    const pipeline = [
      { $match: { id: { $regex: `^urn:ngsi-ld:Reading:${farmId}:` } } },
      { $sort: { "processed_at.value": -1 } },
      {
        $group: {
          _id: "$refInsectTrap.value",
          lastReading: { $first: "$$ROOT" },
        },
      },
      {
        $project: {
          _id: "$_id",
          last_insect_count: "$lastReading.insect_count.value",
          last_reading_at: "$lastReading.processed_at.value",
        },
      },
    ];
    return await collection.aggregate(pipeline).toArray();
  } finally {
    await client.close();
  }
};

const fetchTrapsFromFiware = async (farmId: string): Promise<Trap[]> => {
  const FIWARE_API_URL =
    process.env.VITE_FIWARE_API_URL || "http://192.168.1.200:1026/v2";

  const { data: entities } = await axios.get(`${FIWARE_API_URL}/entities`, {
    params: {
      type: "InsectTrap",
      q: `id==urn:ngsi-ld:InsectTrap:${farmId}:*`,
      attrs: "last_insect_count,last_reading_at",
    },
  });

  return entities.map((entity: any) => ({
    _id: entity.id,
    last_insect_count: entity.last_insect_count?.value ?? 0,
    last_reading_at: entity.last_reading_at?.value,
  }));
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { farmId } = req.query;

  if (req.method !== "GET" || !farmId || typeof farmId !== "string") {
    return res.status(400).json({ message: "Requisição inválida" });
  }

  try {
    let traps: Trap[];
    if (process.env.VITE_APP_ENV === "local") {
      console.log(
        `Modo local: Buscando armadilhas para a fazenda ${farmId} do FIWARE...`
      );
      traps = await fetchTrapsFromFiware(farmId);
    } else {
      console.log(
        `Modo nuvem: Buscando armadilhas para a fazenda ${farmId} do Atlas...`
      );
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
