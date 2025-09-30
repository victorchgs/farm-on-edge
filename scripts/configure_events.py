from minio import Minio
from minio.notificationconfig import NotificationConfig, QueueConfig

client = Minio(
    "minio-service:9000",
    access_key="farmonedge",
    secret_key="farmonedge",
    secure=False
)

config = NotificationConfig(
    queue_config_list=[
        QueueConfig(
            "arn:minio:sqs::1:webhook",
            ["s3:ObjectCreated:*"],
        ),
    ],
)

try:
    client.set_bucket_notification("insect-images", config)

    print("✅ Regra de notificação configurada com sucesso para o bucket 'insect-images'!")
    print("O watcher agora receberá os eventos do MinIO.")
except Exception as e:
    print(f"❌ Ocorreu um erro ao configurar a notificação: {e}")
