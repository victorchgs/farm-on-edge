import { Farm, Reading, Trap, type LoginFormData } from "@/lib/schemas";
import axios from "axios";

const API_BASE_URL = "/api";
const FIWARE_API_URL = "http://192.168.1.200:1026/v2";
const MINIO_API_URL = "http://192.168.1.200:9000/insect-images";

const formatFarmName = (id: string): string =>
  id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

const fetchFarmsFromApi = async (): Promise<Farm[]> => {
  const { data } = await axios.get<Farm[]>(`${API_BASE_URL}/farms`);

  return data;
};

const fetchTrapsByFarmFromApi = async (farmId: string): Promise<Trap[]> => {
  const { data } = await axios.get<Trap[]>(`${API_BASE_URL}/traps/${farmId}`);

  return data;
};

const fetchReadingsByTrapFromApi = async (
  trapId: string
): Promise<Reading[]> => {
  const encodedTrapId = encodeURIComponent(trapId);
  const { data } = await axios.get<Reading[]>(
    `${API_BASE_URL}/readings/${encodedTrapId}`
  );

  return data;
};

const fetchImageUrlFromApi = async (imageKey: string): Promise<string> => {
  const { data } = await axios.get<{ url: string }>("/api/images", {
    params: { key: imageKey },
  });

  return data.url;
};

export const loginUser = async (
  credentials: LoginFormData
): Promise<{ token: string }> => {
  const { data } = await axios.post<{ token: string }>(
    "/api/login",
    credentials
  );

  return data;
};

const fetchFarmsFromFiware = async (): Promise<Farm[]> => {
  const { data: entities } = await axios.get(`${FIWARE_API_URL}/entities`, {
    params: { type: "InsectTrap", attrs: "id" },
  });

  const farmIds = new Set<string>();

  entities.forEach((entity: any) => {
    const parts = entity.id.split(":");

    if (parts.length > 3) farmIds.add(parts[3]);
  });

  return Array.from(farmIds).map((id) => ({ id, name: formatFarmName(id) }));
};

const fetchTrapsByFarmFromFiware = async (farmId: string): Promise<Trap[]> => {
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

const fetchReadingsByTrapFromFiware = async (
  trapId: string
): Promise<Reading[]> => {
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

const fetchImageUrlFromMinio = (imageKey: string): string => {
  return `${MINIO_API_URL}/${imageKey}`;
};

const isLocal = import.meta.env.VITE_APP_ENV === "local";

export const fetchFarms = (): Promise<Farm[]> => {
  return isLocal ? fetchFarmsFromFiware() : fetchFarmsFromApi();
};

export const fetchTrapsByFarm = (farmId: string): Promise<Trap[]> => {
  if (!farmId) return Promise.resolve([]);
  return isLocal
    ? fetchTrapsByFarmFromFiware(farmId)
    : fetchTrapsByFarmFromApi(farmId);
};

export const fetchReadingsByTrap = (trapId: string): Promise<Reading[]> => {
  if (!trapId) return Promise.resolve([]);
  return isLocal
    ? fetchReadingsByTrapFromFiware(trapId)
    : fetchReadingsByTrapFromApi(trapId);
};

export const fetchImageUrl = (imageKey: string): Promise<string> => {
  if (!imageKey) return Promise.resolve("");
  return isLocal
    ? Promise.resolve(fetchImageUrlFromMinio(imageKey))
    : fetchImageUrlFromApi(imageKey);
};
