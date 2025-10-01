import os
from dotenv import load_dotenv
from flask import Flask, jsonify # Adicionado jsonify
from werkzeug.middleware.proxy_fix import ProxyFix
# import firebase_admin # Comentado para depuração
# from firebase_admin import credentials, firestore # Comentado para depuração
from flask_cors import CORS
# from flask_mail import Mail # Comentado para depuração

def create_app():
    """Cria e configura a instância da aplicação Flask."""
    
    app = Flask(__name__)
    load_dotenv()
    
    # --- Configuração de Middlewares e Mail ---
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    # --- TESTE DE CORS ---
    # Mantendo a configuração de CORS aberta para o teste.
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
    
    # --- SEÇÃO DE CONFIGURAÇÃO DE EMAIL COMENTADA PARA DEPURAÇÃO ---
    # app.config.update(
    #     MAIL_SERVER=os.getenv('MAIL_SERVER'),
    #     MAIL_PORT=int(os.getenv('MAIL_PORT', 587)),
    #     MAIL_USE_TLS=os.getenv('MAIL_USE_TLS', 'true').lower() in ('true', '1', 't'),
    #     MAIL_USERNAME=os.getenv('MAIL_USERNAME'),
    #     MAIL_PASSWORD=os.getenv('MAIL_PASSWORD'),
    #     MAIL_DEFAULT_SENDER=os.getenv('MAIL_DEFAULT_SENDER')
    # )
    # mail = Mail(app)

    # --- SEÇÃO DO FIREBASE COMENTADA PARA DEPURAÇÃO ---
    # try:
    #     if not firebase_admin._apps:
    #         cred = credentials.ApplicationDefault()
    #         firebase_admin.initialize_app(cred)
    #         print("Firebase Admin SDK inicializado.")
    # except Exception as e:
    #     print(f"ERRO FATAL ao inicializar o Firebase Admin SDK: {e}")
    # db = firestore.client()
    
    # --- SEÇÃO DE SERVIÇOS COMENTADA PARA DEPURAÇÃO ---
    # from app.services.enrollment_service import EnrollmentService
    # ... (todas as importações de serviço)
    # user_service = UserService(db, mail=mail)
    # ... (todas as inicializações de serviço)

    # --- SEÇÃO DE ROTAS COMENTADA PARA DEPURAÇÃO ---
    # from app.routes.user_routes import user_api_bp, init_user_bp
    # ... (todas as importações de rotas)
    # init_decorators(user_service)
    # ... (todas as inicializações de blueprints)
    # app.register_blueprint(user_api_bp)
    # ... (todos os registros de blueprints)

    # --- ROTAS DE TESTE ---
    @app.route('/')
    def index():
        return "JitaKyoApp API (Modo de Depuração) está running!"

    @app.route('/api/test-cors')
    def test_cors():
        return jsonify(message="Se você vê isso, o servidor está no ar e o CORS está funcionando!")

    return app

# Cria a instância do app para que o Gunicorn possa encontrá-la.
app = create_app()

# As linhas abaixo são para execução local e não afetam o Cloud Run.
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port, debug=True)

