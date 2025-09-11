import os
from dotenv import load_dotenv
from flask import Flask, render_template
import firebase_admin
from firebase_admin import firestore
from flask_mail import Mail
from flask_login import LoginManager
from werkzeug.middleware.proxy_fix import ProxyFix

# --- 1. IMPORTAÇÃO DOS MÓDULOS DA SUA APLICAÇÃO ---
from models.user import User
from routes.admin import admin_bp, init_admin_bp
from routes.student import student_bp, init_student_bp
from routes.teacher import teacher_bp, init_teacher_bp
from routes.auth import auth_bp, init_auth_bp
from services.user_service import UserService
from services.teacher_service import TeacherService
from services.training_class_service import TrainingClassService
from services.enrollment_service import EnrollmentService
from services.attendance_service import AttendanceService
from services.payment_service import PaymentService
from services.notification_service import NotificationService

# --- 2. INICIALIZAÇÃO DAS EXTENSÕES (sem o 'app') ---
# Estas serão conectadas ao 'app' dentro da função create_app
db = None
mail = Mail()
login_manager = LoginManager()
user_service = None # Variável global para ser acessada pelo user_loader

def create_app():
    """
    Cria e configura a instância da aplicação Flask (Application Factory Pattern).
    Esta é a abordagem recomendada para evitar problemas de inicialização.
    """
    global db, user_service

    # Carrega as variáveis de ambiente no início de tudo
    load_dotenv()

    app = Flask(__name__)

    # --- CONFIGURAÇÃO DO APP ---
    # Chave secreta e configuração para o proxy (Cloud Run + Firebase)
    app.secret_key = os.getenv('SECRET_KEY')
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    # Outras configurações
    app.config.update(
        SESSION_COOKIE_SECURE=True,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
        VAPID_PUBLIC_KEY=os.getenv('VAPID_PUBLIC_KEY'),
        VAPID_PRIVATE_KEY=os.getenv('VAPID_PRIVATE_KEY'),
        VAPID_ADMIN_EMAIL=os.getenv('VAPID_ADMIN_EMAIL'),
        MAIL_SERVER=os.getenv('MAIL_SERVER'),
        MAIL_PORT=int(os.getenv('MAIL_PORT', 587)),
        MAIL_USE_TLS=os.getenv('MAIL_USE_TLS', 'true').lower() in ('true', '1', 't'),
        MAIL_USERNAME=os.getenv('MAIL_USERNAME'),
        MAIL_PASSWORD=os.getenv('MAIL_PASSWORD'),
        MAIL_DEFAULT_SENDER=os.getenv('MAIL_DEFAULT_SENDER')
    )

    # --- INICIALIZAÇÃO DO FIREBASE E SERVIÇOS ---
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore.client()
    
    mail.init_app(app)
    
    # Inicializa os serviços
    user_service = UserService(db, mail)
    teacher_service = TeacherService(db)
    training_class_service = TrainingClassService(db)
    enrollment_service = EnrollmentService(db)
    attendance_service = AttendanceService(db)
    notification_service = NotificationService(db, user_service)
    payment_service = PaymentService(db, enrollment_service)

    # --- CONFIGURAÇÃO DO LOGIN MANAGER (dentro da factory) ---
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'

    @login_manager.user_loader
    def load_user(user_id):
        """Carrega o usuário da sessão a cada requisição."""
        # A variável 'user_service' global já foi inicializada
        return user_service.get_user_by_id(user_id) if user_service else None

    # --- REGISTRO DOS BLUEPRINTS ---
    with app.app_context():
        # Inicializa os blueprints passando as dependências
        init_admin_bp(db, user_service, teacher_service, training_class_service, enrollment_service, attendance_service, payment_service)
        init_auth_bp(user_service)
        init_student_bp(user_service, enrollment_service, training_class_service, teacher_service, payment_service)
        init_teacher_bp(user_service, teacher_service, training_class_service, enrollment_service, notification_service)
        
        # Registra os blueprints no app
        app.register_blueprint(admin_bp)
        app.register_blueprint(student_bp)
        app.register_blueprint(auth_bp)
        app.register_blueprint(teacher_bp)

    # --- PROCESSADOR DE CONTEXTO ---
    @app.context_processor
    def inject_branding_settings():
        settings_doc = db.collection('settings').document('branding').get()
        settings = settings_doc.to_dict() if settings_doc.exists else {}
        return {
            'academy_name': settings.get('academy_name', 'JitaKyoApp'),
            'academy_logo_path': settings.get('logo_path', 'logo-horizontal.png')
        }

    return app

# --- Cria a instância final do app para o Gunicorn usar ---
app = create_app()
