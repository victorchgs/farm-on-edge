import { Farm } from "../../src/lib/schemas";
import axios from "axios";
import "dotenv/config";
import { MongoClient } from "mongodb";

const formatFarmName = (id: string): string => {
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

export const fetchFarmsFromAtlas = async (): Promise<Farm[]> => {
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

    return result.map((doc) => ({
      id: doc._id as string,
      name: formatFarmName(doc._id as string),
    }));
  } finally {
    await client.close();
  }
};

export const fetchFarmsFromFiware = async (): Promise<Farm[]> => {
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

  return Array.from(farmIds).map((id) => ({ id, name: formatFarmName(id) }));
};
