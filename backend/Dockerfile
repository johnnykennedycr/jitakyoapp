# Use uma imagem base oficial do Python. A versão 3.11 é moderna e estável.
FROM python:3.11-slim

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Define variáveis de ambiente para Python
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Copia apenas o arquivo de dependências primeiro para aproveitar o cache do Docker.
COPY requirements.txt .

# Instala dependências do sistema necessárias para compilar dlib (C++)
RUN apt-get update && apt-get install -y \
    cmake \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Instala as dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia TODO o resto do código da sua aplicação (do diretório 'backend')
# para o diretório de trabalho (/app) no contêiner.
# Isto é mais simples e robusto do que copiar ficheiros e pastas individualmente.
COPY . .

# Expõe a porta que o Gunicorn vai usar.
EXPOSE 8080

# Comando para iniciar a aplicação usando Gunicorn.
# Esta linha permanece a mesma e funcionará com a nova estrutura de ficheiros.
CMD exec gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 0 main:app
