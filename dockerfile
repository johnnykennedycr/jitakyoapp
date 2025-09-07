# Usa uma imagem base oficial do Python 3.11
FROM python:3.11-slim

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia o arquivo de dependências primeiro
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copia todo o código do projeto para o diretório de trabalho
COPY . .

# Expõe a porta que o Cloud Run usará
EXPOSE 8080

# Comando para iniciar a aplicação
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "main:app"]