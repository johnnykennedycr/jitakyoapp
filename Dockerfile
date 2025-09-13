# Forçando a atualização do cache do build - 13/09/2025
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
# Esta é a forma mais robusta: use o executável do python para rodar o módulo do gunicorn.
# Isto garante que o gunicorn será encontrado, independentemente de onde o pip o instalou.
CMD exec gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 0 main:app
