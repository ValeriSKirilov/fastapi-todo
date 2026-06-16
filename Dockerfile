FROM python:3.11-slim AS builder

WORKDIR /fastapi-app

COPY requirements.txt .

RUN python -m venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim

WORKDIR /fastapi-app

ENV PORT=8000

COPY --from=builder /opt/venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH"

COPY . .

ENV ENVIRONMENT=production

CMD ["uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]

EXPOSE $PORT