import os
import time
import yaml
import hashlib
import json
from flask import Flask, request, jsonify
from kubernetes import client, config

try:
    config.load_incluster_config()
    batch_v1 = client.BatchV1Api()

    print("Cliente Kubernetes configurado com sucesso (in-cluster).", flush=True)
except Exception as e:
    print(f"ERRO CRÍTICO ao configurar cliente Kubernetes: {e}", flush=True)

    batch_v1 = None

JOB_TEMPLATE_PATH = "/config/job-template.yaml"
K8S_NAMESPACE = "default"

app = Flask(__name__)

def create_k8s_job(k8s_api, image_filename):
    if not k8s_api:
        print("ERRO: Cliente Kubernetes não inicializado. Abortando criação de Job.", flush=True)

        return

    try:
        with open(JOB_TEMPLATE_PATH, 'r') as f:
            job_yaml_str = f.read()

        unique_id_hash = hashlib.md5(image_filename.encode()).hexdigest()[:8]
        job_name = f"proc-job-{unique_id_hash}"

        job_label_selector = f"farmonedge.io/job-id={job_name}"
        jobs = k8s_api.list_namespaced_job(namespace=K8S_NAMESPACE, label_selector=job_label_selector)

        if len(jobs.items) > 0:
            print(f"Job com o ID '{job_name}' já existe. Pulando.", flush=True)

            return

        job_yaml_str = job_yaml_str.replace("{UNIQUE_ID}", job_name)
        job_yaml_str = job_yaml_str.replace("{IMAGE_FILENAME}", image_filename)

        job_manifest = yaml.safe_load(job_yaml_str)

        if not job_manifest['metadata'].get('labels'):
            job_manifest['metadata']['labels'] = {}

        job_manifest['metadata']['labels']['farmonedge.io/job-id'] = job_name

        k8s_api.create_namespaced_job(body=job_manifest, namespace=K8S_NAMESPACE)

        print(f"Job '{job_name}' criado com sucesso para a imagem '{image_filename}'.", flush=True)

    except Exception as e:
        print(f"ERRO ao criar Job K8s: {e}", flush=True)

@app.route('/events', methods=['POST'])
def webhook_listener():
    try:
        event_data = request.json

        print(f"Webhook recebido.", flush=True)

        if "Records" in event_data:
            for record in event_data["Records"]:
                event_name = record.get("eventName", "")

                if "ObjectCreated" in event_name:
                    object_key = record["s3"]["object"]["key"]

                    print(f"Novo objeto detectado via evento: {object_key}", flush=True)

                    create_k8s_job(batch_v1, object_key)

        return jsonify({"status": "success"}), 200

    except Exception as e:
        print(f"ERRO ao processar webhook: {e}", flush=True)

        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    if batch_v1:
        print("--- Iniciando Serviço Watcher (modo Webhook) ---", flush=True)

        app.run(host='0.0.0.0', port=8080)
    else:
        print("--- Falha na inicialização do Watcher. Cliente K8s não disponível. ---", flush=True)
