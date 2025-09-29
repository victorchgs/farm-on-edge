FROM python:3.12-slim AS builder

WORKDIR /app

RUN pip install poetry
RUN poetry config virtualenvs.create false

COPY pyproject.toml poetry.lock* ./
RUN poetry install --no-root

FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages

COPY src/ ./src
COPY models/ ./models
COPY image_processing_pipeline.py .

CMD ["python", "image_processing_pipeline.py"]
