# ── Stage 1: Build React Frontend ──────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python Backend + Serve ────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY server.py config.py merchant_rules.json ./
COPY core/ ./core/
COPY integrations/ ./integrations/
COPY utils/ ./utils/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Cloud Run injects PORT env var (default 8080)
ENV PORT=8080

EXPOSE 8080

CMD ["python", "server.py"]
