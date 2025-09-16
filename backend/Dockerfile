# Use uma imagem base oficial do Python. A versão 3.11 é moderna e estável.
FROM python:3.11-slim
# Define o diretório de trabalho dentro do contêiner
WORKDIR /app
# Define variáveis de ambiente para Python
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
# Copia apenas o arquivo de dependências primeiro para aproveitar o cache do Docker.
# Se o requirements.txt não mudar, o Docker reutiliza esta camada, acelerando o build.
COPY requirements.txt .
# Instala as dependências Python
RUN pip install --no-cache-dir -r requirements.txt
# Agora, copia o resto do código da sua aplicação
# Copiamos a pasta 'app' para dentro de /app no contêiner
COPY ./app /app/app
# Copiamos o ponto de entrada principal
COPY main.py .
# Se você tiver um credentials.json para desenvolvimento local, copie-o também
COPY credentials.json .
# Expõe a porta que o Gunicorn vai usar. O Cloud Run vai mapear para esta porta.
EXPOSE 8080
# Comando para iniciar a aplicação usando Gunicorn (servidor de produção).
# Ele usa a variável de ambiente $PORT fornecida pelo Cloud Run.
# As flags --workers, --threads e --timeout são recomendações do Google para performance.
CMD exec gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 0 main:app