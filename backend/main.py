import os
from dotenv import load_dotenv
from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix
import firebase_admin
from firebase_admin import credentials, firestore
from flask_mail import Mail
from flask_cors import CORS

# Importa os blueprints e as funções de inicialização
from app.routes.admin_routes import admin_bp, init_admin_bp
from app.routes.student_routes import student_bp, init_student_bp
from app.routes.teacher_routes import teacher_bp, init_teacher_bp
# A rota de autenticação agora será apenas para o frontend, então não precisamos mais dela aqui

# Importa os serviços
from app.services.user_service import UserService
# ... importe seus outros serviços aqui ...

def create_app():
    """Cria e configura a instância da aplicação Flask."""
    
    app = Flask(__name__)
    load_dotenv()

    # --- Configuração de Middlewares ---
    # Aplica o ProxyFix para o Flask entender que está atrás de um proxy (HTTPS)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    
    # Aplica o CORS para permitir que o frontend (em jitakyoapp.web.app) se comunique com a API
    CORS(app, origins=["https://jitakyoapp.web.app"], supports_credentials=True)

    # --- Carregamento de Configurações ---
    app.secret_key = os.environ.get("SECRET_KEY") # Útil para flash messages
    app.config.update(
        # Suas configurações de e-mail e outras
        MAIL_SERVER=os.getenv('MAIL_SERVER'),
        MAIL_PORT=int(os.getenv('MAIL_PORT', 587)),
        # ... etc ...
    )

    # --- Inicialização de Serviços Externos ---
    try:
        if not firebase_admin._apps:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {'projectId': 'jitakyoapp'})
            print("Firebase Admin SDK inicializado com as credenciais do ambiente.")
    except Exception as e:
        print(f"DEBUG: Falha ao inicializar com credenciais do ambiente, tentando arquivo local: {e}")
        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate("credentials.json")
                firebase_admin.initialize_app(cred)
                print("Firebase Admin SDK inicializado com credentials.json.")
        except Exception as file_error:
            print(f"ERRO: Não foi possível inicializar o Firebase Admin: {file_error}")

    db = firestore.client()
    mail = Mail(app)
    
    # --- Injeção de Dependências ---
    # Inicializa os serviços
    user_service = UserService(db, mail)
    # teacher_service = TeacherService(db)
    # ... inicialize seus outros serviços
    
    # --- Registro dos Blueprints (Rotas) ---
    with app.app_context():
        # Injeta os serviços necessários em cada blueprint
        # init_admin_bp(db, user_service, teacher_service, ...)
        # init_student_bp(user_service, ...)
        # init_teacher_bp(user_service, teacher_service, ...)

        app.register_blueprint(admin_bp)
        app.register_blueprint(student_bp)
        app.register_blueprint(teacher_bp)

    return app

# Cria a instância da aplicação que o Gunicorn irá usar
app = create_app()