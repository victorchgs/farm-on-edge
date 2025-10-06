import os
import sys
import time
import json
import requests
import boto3
from botocore.client import Config
from src.main import RunModels
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

ORION_URL = os.getenv("ORION_URL", "http://192.168.1.200:1026/v2")
MONGO_ATLAS_URI = os.getenv("MONGO_ATLAS_URI")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio-service:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "farmonedge")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "farmonedge")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "insect-images")

MODEL_PATHS = {
    "model_clf": "./models/clf/model_mobilenet_mlp.keras",
    "model_seg": "./models/count/model_unet_aug_cp.keras",
    "model_reg": "./models/count/mlp_regression_aug.keras"
}

def download_from_minio(s3_client, object_name, temp_path):
    print(f"Baixando '{object_name}' do MinIO...")

    try:
        s3_client.download_file(MINIO_BUCKET, object_name, temp_path)

        print("Download concluído com sucesso.")

        return True
    except Exception as e:
        print(f"ERRO: Falha ao baixar do MinIO: {e}")

        return False

def create_fiware_reading(reading_entity):
    target_url = f"{ORION_URL}/entities"
    headers = {"Content-Type": "application/json"}

    try:
        print(f"Criando nova entidade de leitura no FIWARE: {reading_entity['id']}")

        response = requests.post(url=target_url, headers=headers, data=json.dumps(reading_entity))
        response.raise_for_status()

        print("Nova leitura criada com sucesso.")

        return True
    except requests.exceptions.RequestException as e:
        print(f"ERRO ao criar entidade de leitura: {e}")

        return False

def upsert_trap_entity(trap_id, latest_data):
    target_url = f"{ORION_URL}/op/update"
    headers = {"Content-Type": "application/json"}
    payload = { "actionType": "APPEND", "entities": [{"id": trap_id, "type": "InsectTrap", **latest_data}] }

    try:
        print(f"Atualizando entidade principal da armadilha '{trap_id}'...")

        response = requests.post(url=target_url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()

        print(f"Entidade da armadilha '{trap_id}' atualizada com sucesso.")

        return True
    except requests.exceptions.RequestException as e:
        print(f"ERRO ao atualizar entidade da armadilha: {e}")

        return False

def send_to_mongo_atlas(reading_entity):
    if not MONGO_ATLAS_URI:
        print("AVISO: String de conexão do MongoDB Atlas não configurada. Pulando envio para a nuvem.")

        return False

    try:
        print("Conectando ao MongoDB Atlas...")

        client = MongoClient(MONGO_ATLAS_URI)

        client.admin.command('ping') 

        db = client.farmonedge_db
        collection = db.readings

        print(f"Inserindo leitura '{reading_entity['id']}' no MongoDB Atlas...")

        collection.insert_one(reading_entity)

        print("Leitura inserida com sucesso no Atlas.")

        return True
    except ConnectionFailure as e:
        print(f"ERRO CRÍTICO: Falha ao conectar no MongoDB Atlas: {e}")

        return False
    except Exception as e:
        print(f"ERRO ao enviar dados para o MongoDB Atlas: {e}")

        return False
    finally:
        if 'client' in locals():
            client.close()

def main():
    print("--- Iniciando Pipeline de Processamento ---")

    if len(sys.argv) < 2:
        sys.exit("ERRO: Nome do objeto de imagem não fornecido.")

    full_object_name = sys.argv[1]

    file_name = os.path.basename(full_object_name)
    temp_image_path = os.path.join("/tmp", file_name)

    s3_client = boto3.client(
        's3',
        endpoint_url=f"http://{MINIO_ENDPOINT}",
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
        config=Config(signature_version='s3v4')
    )

    if not download_from_minio(s3_client, full_object_name, temp_image_path):
        sys.exit("Falha no download. Abortando pipeline.")

    try:
        capture_trap_id = file_name.split('_')[0]
    except IndexError:
        sys.exit(f"ERRO: Nome de arquivo inválido: '{file_name}'")

    processing_node = os.getenv("KUBE_NODE_NAME", "unknown_node")

    print(f"Executando modelos de ML para a imagem: '{temp_image_path}'...")

    start_time = time.time()
    model_runner = RunModels(MODEL_PATHS)
    ml_results = model_runner.execute(temp_image_path)
    end_time = time.time()

    print(f"Modelos executados. Resultados: {ml_results}")

    has_insects = True if ml_results.get("clf_prediction") == 1 else False
    timestamp_int = str(int(time.time()))
    timestamp_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

    farm_id = full_object_name.split('/')[0] if '/' in full_object_name else "default-farm"

    reading_id = f"urn:ngsi-ld:Reading:{farm_id}:{capture_trap_id}:{timestamp_int}"
    trap_urn = f"urn:ngsi-ld:InsectTrap:{farm_id}:{capture_trap_id}"

    reading_entity = {
        "id": reading_id,
        "type": "InsectReading",
        "sourceImage": {"type": "Text", "value": full_object_name},
        "refInsectTrap": {"type": "Relationship", "value": trap_urn},
        "processing_node": {"type": "Text", "value": processing_node},
        "has_insects": {"type": "Boolean", "value": has_insects},
        "processing_duration_sec": {"type": "Number", "value": round(end_time - start_time, 2)},
        "processed_at": {"type": "DateTime", "value": timestamp_iso}
    }

    if has_insects:
        insect_count = ml_results.get("counting_result", 0)
        reading_entity["insect_count"] = {"type": "Number", "value": round(insect_count, 2)}

    trap_latest_data = {
        "last_reading_at": {"type": "DateTime", "value": timestamp_iso},
        "last_insect_count": {"type": "Number", "value": reading_entity.get("insect_count", {}).get("value", 0)}
    }

    create_fiware_reading(reading_entity)
    upsert_trap_entity(trap_urn, trap_latest_data)
    send_to_mongo_atlas(reading_entity)

    os.remove(temp_image_path)
    print("--- Pipeline de Processamento Finalizado ---")

if __name__ == "__main__":
    main()
