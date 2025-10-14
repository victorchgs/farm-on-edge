import type { VercelRequest, VercelResponse } from "@vercel/node";
import "dotenv/config";
import { getMinioDirectUrl, getS3SignedUrl } from "../server/logic/images.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { key } = req.query;

  if (req.method !== "GET" || !key || typeof key !== "string") {
    return res
      .status(400)
      .json({ message: 'Requisição inválida. Parâmetro "key" faltando.' });
  }

  try {
    let imageUrl: string;

    if (process.env.VITE_APP_ENV === "local") {
      imageUrl = getMinioDirectUrl(key);
    } else {
      imageUrl = await getS3SignedUrl(key);
    }

    res.status(200).json({ url: imageUrl });
  } catch (error) {
    console.error("Falha ao obter a URL da imagem:", error);
    res.status(500).json({ message: "Erro ao buscar a imagem" });
  }
}
