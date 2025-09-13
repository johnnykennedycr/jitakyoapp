# Use a imagem oficial do Python como base.
FROM python:3.11-slim

# Defina variáveis de ambiente para um melhor funcionamento do Python no contêiner.
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Defina o diretório de trabalho dentro do contêiner.
WORKDIR /app

# Copie o ficheiro de dependências e instale-as.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie o resto do código da sua aplicação.
COPY . .

# O comando para iniciar a sua aplicação.
# Ele usa a variável de ambiente $PORT fornecida pelo Cloud Run.
# Este é o mesmo comando Gunicorn que já corrigimos, agora num ambiente controlado.
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 --forwarded-allow-ips='*' main:app
