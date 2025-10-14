import { Trap } from "../../src/lib/schemas";
import axios from "axios";
import "dotenv/config";
import { MongoClient } from "mongodb";

export const fetchTrapsFromAtlas = async (farmId: string): Promise<Trap[]> => {
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

    const result = await collection.aggregate<Trap>(pipeline).toArray();

    return result;
  } finally {
    await client.close();
  }
};

export const fetchTrapsFromFiware = async (farmId: string): Promise<Trap[]> => {
  const FIWARE_API_URL =
    process.env.VITE_FIWARE_API_URL || "http://192.1168.1.200:1026/v2";

  const { data: entities } = await axios.get(`${FIWARE_API_URL}/entities`, {
    params: {
      type: "InsectTrap",
      idPattern: `^urn:ngsi-ld:InsectTrap:${farmId}:.*`,
      attrs: "last_insect_count,last_reading_at",
    },
  });

  return entities.map((entity: any) => ({
    _id: entity.id,
    last_insect_count: entity.last_insect_count?.value ?? 0,
    last_reading_at: entity.last_reading_at?.value,
  }));
};
