import os
from dotenv import load_dotenv
from flask import Flask, render_template
from werkzeug.middleware.proxy_fix import ProxyFix
import firebase_admin
from firebase_admin import firestore
from flask_mail import Mail
from flask_login import LoginManager

# --- INICIALIZAÇÃO DAS EXTENSÕES (sem o app) ---
db = None
mail = Mail()
login_manager = LoginManager()
user_service = None # Variável global para ser acessada pelo user_loader

# --- IMPORTAÇÕES DE MÓDULOS DO PROJETO ---
from models.user import User
from services.user_service import UserService
from services.teacher_service import TeacherService
from services.training_class_service import TrainingClassService
from services.enrollment_service import EnrollmentService
from services.attendance_service import AttendanceService
from services.payment_service import PaymentService
from services.notification_service import NotificationService
from routes.admin import admin_bp, init_admin_bp
from routes.student import student_bp, init_student_bp
from routes.teacher import teacher_bp, init_teacher_bp
from routes.auth import auth_bp, init_auth_bp


def create_app():
    """Cria e configura a instância da aplicação Flask (Application Factory Pattern)."""
    global db, user_service

    load_dotenv()

    app = Flask(__name__)
    
    # --- CONFIGURAÇÃO ESSENCIAL ---
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    app.secret_key = os.getenv('SECRET_KEY')

    app.config.update(
        # --- A CORREÇÃO FINAL ESTÁ AQUI ---
        # Permite que o cookie funcione em um cenário de proxy entre domínios.
        SESSION_COOKIE_SAMESITE='None',
        SESSION_COOKIE_SECURE=True,
        SESSION_COOKIE_HTTPONLY=True,
        
        # Suas outras configurações
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

    # --- INICIALIZAÇÃO DE SERVIÇOS E EXTENSÕES ---
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

    # Configura o Flask-Login
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'

    @login_manager.user_loader
    def load_user(user_id):
        return user_service.get_user_by_id(user_id) if user_service else None

    # Registra o context processor dentro da factory
    @app.context_processor
    def inject_branding_settings():
        settings_doc = db.collection('settings').document('branding').get()
        settings = settings_doc.to_dict() if settings_doc.exists else {}
        return {
            'academy_name': settings.get('academy_name', 'JitaKyoApp'),
            'academy_logo_path': settings.get('logo_path', 'logo-horizontal.png')
        }

    # --- REGISTRO DOS BLUEPRINTS ---
    with app.app_context():
        init_admin_bp(db, user_service, teacher_service, training_class_service, enrollment_service, attendance_service, payment_service)
        init_auth_bp(user_service)
        init_student_bp(user_service, enrollment_service, training_class_service, teacher_service, payment_service)
        init_teacher_bp(user_service, teacher_service, training_class_service, enrollment_service, notification_service)

        app.register_blueprint(admin_bp)
        app.register_blueprint(student_bp)
        app.register_blueprint(auth_bp)
        app.register_blueprint(teacher_bp)

    return app

# Cria a instância da aplicação para o Gunicorn
app = create_app()

