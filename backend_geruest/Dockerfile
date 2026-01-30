FROM python:3.11-bookworm

# Not very good practice, a dedicated /app directory in the frontend would be better. Use now as Proof of Concept.
WORKDIR /
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# For matplotlib to work without X server
ENV MPLBACKEND=Agg
# This ensures setuptools uses the modern standard library approach
ENV SETUPTOOLS_USE_DISTUTILS=stdlib
# Optional: make absolute imports from project root always work
#ENV PYTHONPATH=/app

# For wheels that need compile tools (remove if unnecessary for your deps)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install system-level CA certificates
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8003
# Might use guvicorn - optimized for google cloud
# Use shell form to allow variable expansion for $PORT
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 2
