FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install build tools only for dependency installation, then remove them to keep the final image small
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --upgrade pip

# Copy requirements first for better layer caching
COPY services/backend/requirements.txt .
# Install packages - use pip cache if available, but Docker layer caching is the main optimization
RUN pip install -r requirements.txt \
    && apt-get purge -y build-essential \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY services/backend/app ./app

# Copy production model and required artifacts
COPY experiments/new_lstm/deployment_2025 /app/experiments/new_lstm/deployment_2025
# Copy production model: pro_level_final model (trained ≤Nov 2023, validated Dec 2023, tested 2024-2025)
# This model achieved 69.1% accuracy on 2024 test set and profitable backtesting on Pinnacle odds
RUN mkdir -p /app/experiments/models/pro_level
COPY experiments/models/pro_level/pro_level_model_v1.0_20260218_075007.pt /app/experiments/models/pro_level/pro_level_model_v1.0_20260218_075007.pt
COPY experiments/new_lstm/split_pro_level_2024_2025/scalers /app/experiments/new_lstm/split_pro_level_2024_2025/scalers
# Backend expects experiments/models/production/ (pro_level_production_model.pt + scalers/)
# Create production layout from pro_level model and split scalers (same architecture and preprocessing)
RUN mkdir -p /app/experiments/models/production/scalers && \
    cp /app/experiments/models/pro_level/pro_level_model_v1.0_20260218_075007.pt /app/experiments/models/production/pro_level_production_model.pt && \
    cp -r /app/experiments/new_lstm/split_pro_level_2024_2025/scalers/* /app/experiments/models/production/scalers/
# Copy results directory including tournament predictions cache for 2025 test set
# This includes tournament_predictions_2025.json with all pre-computed predictions
COPY experiments/results /app/experiments/results
COPY src /app/src
# Copy preprocessed data file needed for player search and match data
# Create directory first, then copy the file
RUN mkdir -p /app/data/processed
COPY data/processed/preprocessed_data.csv /app/data/processed/preprocessed_data.csv

EXPOSE 8000

# Single process for single-CPU droplet (4 GB RAM); avoid adding workers/gunicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
