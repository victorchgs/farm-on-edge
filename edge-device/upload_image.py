import argparse
import boto3
from botocore.client import Config
import datetime
import os

MINIO_ENDPOINT = "192.168.1.200:30000"
MINIO_ACCESS_KEY = "farmonedge"
MINIO_SECRET_KEY = "farmonedge"
MINIO_BUCKET = "insect-images"

def upload_to_minio(file_path, farm_id, trap_id):
    if not os.path.exists(file_path):
        print(f"ERRO: O arquivo de imagem não foi encontrado em '{file_path}'")

        return

    try:
        s3_client = boto3.client(
            's3',
            endpoint_url=f"http://{MINIO_ENDPOINT}",
            aws_access_key_id=MINIO_ACCESS_KEY,
            aws_secret_access_key=MINIO_SECRET_KEY,
            config=Config(signature_version='s3v4')
        )

        timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        file_extension = os.path.splitext(file_path)[1]

        object_name = f"{farm_id}/{trap_id}_{timestamp}{file_extension}"

        print(f"Fazendo upload de '{file_path}' para o MinIO como '{object_name}'...")

        s3_client.upload_file(file_path, MINIO_BUCKET, object_name)

        print("Upload concluído com sucesso!")
    except Exception as e:
        print(f"ERRO: Falha no upload para o MinIO: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Envia uma imagem de armadilha para o servidor MinIO.")
    parser.add_argument("file", type=str, help="O caminho para o arquivo de imagem a ser enviado.")
    parser.add_argument("--farm-id", type=str, required=True, help="O ID da fazenda (ex: FAZENDA-BOA-VISTA).")
    parser.add_argument("--trap-id", type=str, required=True, help="O ID da armadilha (ex: TRAP-01).")

    args = parser.parse_args()

    upload_to_minio(args.file, args.farm_id, args.trap_id)