import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import "dotenv/config";

const getS3SignedUrl = async (key: string): Promise<string> => {
  const s3Client = new S3Client({
    region: process.env.AWS_S3_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY!,
    },
  });

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
};

const getMinioDirectUrl = (key: string): string => {
  const endpoint = process.env.VITE_MINIO_ENDPOINT || "192.168.1.200:9000";
  const bucket = process.env.VITE_MINIO_BUCKET || "insect-images";
  return `http://${endpoint}/${bucket}/${key}`;
};

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
      console.log(
        `Modo local: Gerando URL direta do MinIO para a imagem ${key}...`
      );
      imageUrl = getMinioDirectUrl(key);
    } else {
      console.log(
        `Modo nuvem: Gerando URL pré-assinada do S3 para a imagem ${key}...`
      );
      imageUrl = await getS3SignedUrl(key);
    }

    res.status(200).json({ url: imageUrl });
  } catch (error) {
    console.error("Falha ao obter a URL da imagem:", error);
    res.status(500).json({ message: "Erro ao buscar a imagem" });
  }
}
