import os
import time
import yaml
import hashlib
from minio import Minio
from kubernetes import client, config

try:
    config.load_incluster_config()
    batch_v1 = client.BatchV1Api()

    print("Cliente Kubernetes configurado com sucesso (in-cluster).", flush=True)
except Exception as e:
    print(f"ERRO CRÍTICO ao configurar cliente Kubernetes: {e}", flush=True)

    batch_v1 = None

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio-service:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "farmonedge")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "farmonedge")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "insect-images")
JOB_TEMPLATE_PATH = "/config/job-template.yaml"
K8S_NAMESPACE = "default"
POLL_INTERVAL_SECONDS = 30
PROCESSED_METADATA_KEY = "x-amz-meta-status"

def set_processed_metadata(minio_client, object_name):
    try:
        result = minio_client.copy_object(
            MINIO_BUCKET,
            object_name,
            f"/{MINIO_BUCKET}/{object_name}",
            metadata={"status": "processed"}
        )

        print(f"Metadado 'processed' adicionado com sucesso ao objeto: {object_name}", flush=True)

        return True
    except Exception as e:
        print(f"ERRO ao adicionar metadado ao objeto {object_name}: {e}", flush=True)

        return False

def create_k8s_job(k8s_api, image_filename):
    if not k8s_api:
        print("ERRO: Cliente Kubernetes não inicializado. Abortando criação de Job.", flush=True)

        return False

    try:
        with open(JOB_TEMPLATE_PATH, 'r') as f:
            job_yaml_str = f.read()

        unique_id_hash = hashlib.md5(image_filename.encode()).hexdigest()[:8]
        job_name = f"proc-job-{unique_id_hash}"

        job_label_selector = f"farmonedge.io/job-id={job_name}"
        jobs = k8s_api.list_namespaced_job(namespace=K8S_NAMESPACE, label_selector=job_label_selector)

        if len(jobs.items) > 0:
            print(f"Job com o ID '{job_name}' já existe. Pulando.", flush=True)

            return False

        job_yaml_str = job_yaml_str.replace("{UNIQUE_ID}", job_name)
        job_yaml_str = job_yaml_str.replace("{IMAGE_FILENAME}", image_filename)

        job_manifest = yaml.safe_load(job_yaml_str)

        if 'labels' not in job_manifest['metadata']:
            job_manifest['metadata']['labels'] = {}

        job_manifest['metadata']['labels']['farmonedge.io/job-id'] = job_name

        k8s_api.create_namespaced_job(body=job_manifest, namespace=K8S_NAMESPACE)

        print(f"Job '{job_name}' criado com sucesso para a imagem '{image_filename}'.", flush=True)

        return True
    except Exception as e:
        print(f"ERRO ao criar Job K8s: {e}", flush=True)

        return False

def main():
    if not batch_v1:
        print("--- Falha na inicialização do Watcher. Cliente K8s não disponível. ---", flush=True)

        return

    print("--- Iniciando Serviço MinIO Watcher (modo Polling Inteligente) ---", flush=True)

    minio_client = Minio(MINIO_ENDPOINT, access_key=MINIO_ACCESS_KEY, secret_key=MINIO_SECRET_KEY, secure=False)

    print(f"Conectado ao MinIO. Monitorando bucket: '{MINIO_BUCKET}'", flush=True)

    while True:
        try:
            objects = minio_client.list_objects(MINIO_BUCKET, recursive=True)

            for obj in objects:
                is_processed = False

                try:
                    stats = minio_client.stat_object(MINIO_BUCKET, obj.object_name)

                    if stats.metadata and stats.metadata.get(PROCESSED_METADATA_KEY.lower()) == "processed":
                        is_processed = True
                except Exception as e:
                    print(f"ERRO ao verificar metadados de {obj.object_name}: {e}", flush=True)

                if not is_processed:
                    print(f"Novo objeto (não processado) detectado: {obj.object_name}", flush=True)

                    if create_k8s_job(batch_v1, obj.object_name):
                        set_processed_metadata(minio_client, obj.object_name)
            
            time.sleep(POLL_INTERVAL_SECONDS)
        
        except Exception as e:
            print(f"ERRO no loop principal: {e}", flush=True)

            time.sleep(POLL_INTERVAL_SECONDS * 2)

if __name__ == "__main__":
    main()
