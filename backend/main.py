import os
from dotenv import load_dotenv
from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix
import firebase_admin
from firebase_admin import credentials, firestore
from flask_mail import Mail
from flask_cors import CORS

# Importa os blueprints e as funções de inicialização
from app.routes.user_routes import user_bp 
from app.routes.admin_routes import admin_bp, init_admin_bp
from app.routes.student_routes import student_bp, init_student_bp
from app.routes.teacher_routes import teacher_bp, init_teacher_bp
# A rota de autenticação agora será apenas para o frontend, então não precisamos mais dela aqui

# Importa os serviços
from app.services.user_service import UserService
from app.services.teacher_service import TeacherService
from app.services.training_class_service import TrainingClassService
from app.services.enrollment_service import EnrollmentService
from app.services.attendance_service import AttendanceService
from app.services.payment_service import PaymentService
from app.routes.admin_routes import admin_bp, init_admin_bp
from app.routes.student_routes import student_bp, init_student_bp
from app.routes.teacher_routes import teacher_bp, init_teacher_bp
from app.utils.decorators import init_decorators
def create_app():
    """Cria e configura a instância da aplicação Flask."""
    
    app = Flask(__name__)
    load_dotenv()
    app.config['SESSION_COOKIE_NAME'] = 'jitakyo_session'
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
        MAIL_USE_TLS=os.getenv('MAIL_USE_TLS', 'true').lower() in ('true', '1', 't'),
        MAIL_USERNAME=os.getenv('MAIL_USERNAME'),
        MAIL_PASSWORD=os.getenv('MAIL_PASSWORD'),
        MAIL_DEFAULT_SENDER=os.getenv('MAIL_DEFAULT_SENDER')
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
    teacher_service = TeacherService(db)
    training_class_service = TrainingClassService(db)
    enrollment_service = EnrollmentService(db)
    attendance_service = AttendanceService(db)
    payment_service = PaymentService(db, enrollment_service)

    init_decorators(user_service)
    
    # --- Registro dos Blueprints (Rotas) ---
    with app.app_context():
        # Injeta os serviços necessários em cada blueprint
        init_admin_bp(db, user_service, teacher_service, training_class_service, enrollment_service, attendance_service, payment_service)
        init_student_bp(user_service, enrollment_service, training_class_service, teacher_service, payment_service)
        init_teacher_bp(user_service, teacher_service, training_class_service, enrollment_service)

        app.register_blueprint(user_bp) 
        app.register_blueprint(admin_bp)
        app.register_blueprint(student_bp)
        app.register_blueprint(teacher_bp)

    @app.route('/')
    def index():
        return "JitaKyoApp API is running!"

    return app



# Cria a instância da aplicação que o Gunicorn irá usar
app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port, debug=True)