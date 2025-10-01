from flask import Flask, jsonify
from flask_cors import CORS

# Criar a aplicação Flask diretamente, sem a função create_app
app = Flask(__name__)

# Configurar o CORS da forma mais simples possível
CORS(app)

@app.route('/')
def index():
    """Esta é a rota raiz que deve responder."""
    return "SUCCESS: O servidor Flask está no ar e a responder!"

@app.route('/api/test')
def api_test():
    """Uma rota de API para confirmar que o routing funciona."""
    return jsonify(status="ok")

# O Gunicorn usará esta variável 'app' para iniciar o servidor.
# O bloco if __name__ == '__main__' é apenas para testes locais.
if __name__ == '__main__':
    # Esta parte não é executada no Cloud Run
    app.run(host='0.0.0.0', port=8080, debug=True)

