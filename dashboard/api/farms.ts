import { Farm } from "@/src/lib/schemas";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import "dotenv/config";
import { MongoClient } from "mongodb";

const fetchFarmsFromAtlas = async (): Promise<Farm[]> => {
  if (!process.env.MONGODB_ATLAS_URI) {
    throw new Error("String de conexão do MongoDB não configurada.");
  }

  const client = new MongoClient(process.env.MONGODB_ATLAS_URI);

  try {
    await client.connect();
    const db = client.db("farmonedge_db");
    const collection = db.collection("readings");

    const pipeline = [
      { $project: { farmIdParts: { $split: ["$id", ":"] } } },
      { $project: { farmId: { $arrayElemAt: ["$farmIdParts", 3] } } },
      { $group: { _id: "$farmId" } },
    ];

    const result = await collection.aggregate(pipeline).toArray();

    const formatFarmName = (id: string): string =>
      id
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");

    return result.map((doc) => ({
      id: doc._id as string,
      name: formatFarmName(doc._id as string),
    }));
  } finally {
    await client.close();
  }
};

const fetchFarmsFromFiware = async (): Promise<Farm[]> => {
  const FIWARE_API_URL =
    process.env.VITE_FIWARE_API_URL || "http://192.168.1.200:1026/v2";

  const { data: entities } = await axios.get(`${FIWARE_API_URL}/entities`, {
    params: { type: "InsectTrap", attrs: "id" },
  });

  const farmIds = new Set<string>();
  entities.forEach((entity: any) => {
    const parts = entity.id.split(":");
    if (parts.length > 3) {
      farmIds.add(parts[3]);
    }
  });

  const formatFarmName = (id: string): string =>
    id
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  return Array.from(farmIds).map((id) => ({ id, name: formatFarmName(id) }));
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    let farms: Farm[];
    if (process.env.VITE_APP_ENV === "local") {
      console.log("Modo local: Buscando fazendas do FIWARE...");
      farms = await fetchFarmsFromFiware();
    } else {
      console.log("Modo nuvem: Buscando fazendas do Atlas...");
      farms = await fetchFarmsFromAtlas();
    }
    res.status(200).json(farms);
  } catch (error) {
    console.error("Falha ao buscar fazendas:", error);
    res.status(500).json({ message: "Erro ao buscar dados" });
  }
}
