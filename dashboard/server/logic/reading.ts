import axios from "axios";
import "dotenv/config";
import { MongoClient } from "mongodb";
import { Reading } from "../src/lib/schemas";

export const fetchReadingsFromAtlas = async (
  trapId: string
): Promise<Reading[]> => {
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

export const fetchReadingsFromFiware = async (
  trapId: string
): Promise<Reading[]> => {
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
