import os
from waitress import serve
from main import create_app

# Cria a instância da aplicação Flask usando a factory que já temos
app = create_app()

if __name__ == "__main__":
    # Pega a porta do ambiente, com 8080 como padrão
    port = int(os.environ.get("PORT", 8080))
    
    # Inicia o servidor waitress para servir a nossa aplicação
    # host='0.0.0.0' permite que ele seja acessível de fora do contêiner
    print(f"INFO: Iniciando servidor na porta {port}...")
    serve(app, host='0.0.0.0', port=port)
