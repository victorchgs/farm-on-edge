from minio import Minio
from minio.notificationconfig import NotificationConfig, WebhookConfig

client = Minio(
    "127.0.0.1:9000",
    access_key="farmonedge",
    secret_key="farmonedge",
    secure=False
)

config = NotificationConfig(
    webhook_config_list=[
        WebhookConfig(
            "arn:minio:sqs:us-east-1:1:webhook",
            ["s3:ObjectCreated:*"],
        ),
    ],
)

try:
    client.set_bucket_notification("insect-images", config)

    print("✅ Regra de notificação por Webhook configurada com sucesso para o bucket 'insect-images'!")
    print("O watcher agora receberá os eventos do MinIO.")
except Exception as e:
    print(f"❌ Ocorreu um erro ao configurar a notificação: {e}")
