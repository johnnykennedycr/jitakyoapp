# Usa uma imagem base oficial do Python
FROM python:3.11-slim

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia o arquivo de dependências e as instala
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copia todo o resto do seu código para o contêiner
COPY . .

# Comando para iniciar a aplicação quando o contêiner rodar
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "main:api"]