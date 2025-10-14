import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import "dotenv/config";

export const getS3SignedUrl = async (key: string): Promise<string> => {
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

export const getMinioDirectUrl = (key: string): string => {
  const endpoint = process.env.VITE_MINIO_ENDPOINT || "192.168.1.200:9000";
  const bucket = process.env.VITE_MINIO_BUCKET || "insect-images";

  return `http://${endpoint}/${bucket}/${key}`;
};
