# main.py VERSÃO FINAL

import os
from dotenv import load_dotenv
from flask import Flask, render_template
from werkzeug.middleware.proxy_fix import ProxyFix
import firebase_admin
from firebase_admin import credentials, firestore
from flask_mail import Mail
from flask_cors import CORS

# --- IMPORTAÇÕES DE MÓDULOS DO PROJETO ---
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
from routes.auth import auth_bp
from utils.decorators import init_decorators

def create_app():
    """Cria e configura a instância da aplicação Flask."""
    
    app = Flask(__name__)
    
    # --- CONFIGURAÇÃO DA APLICAÇÃO ---
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    CORS(app, supports_credentials=True, origins=["https://jitakyoapp.web.app"])
    
    load_dotenv()
    app.secret_key = os.environ.get("SECRET_KEY") # Mantido para flash messages
    app.config.update(
        # AS CONFIGURAÇÕES DE SESSION_COOKIE_* FORAM REMOVIDAS.
        # O Firebase Admin SDK gerencia o cookie de forma independente.
        
        # Suas configurações de e-mail e outras permanecem aqui
        MAIL_SERVER=os.getenv('MAIL_SERVER'),
        MAIL_PORT=int(os.getenv('MAIL_PORT', 587)),
        MAIL_USE_TLS=os.getenv('MAIL_USE_TLS', 'true').lower() in ('true', '1', 't'),
        MAIL_USERNAME=os.getenv('MAIL_USERNAME'),
        MAIL_PASSWORD=os.getenv('MAIL_PASSWORD'),
        MAIL_DEFAULT_SENDER=os.getenv('MAIL_DEFAULT_SENDER')
    )

    # --- INICIALIZAÇÃO DE SERVIÇOS E EXTENSÕES ---
    try:
        if not firebase_admin._apps:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {
                'projectId': 'jitakyoapp',
            })
            print("Firebase Admin SDK inicializado com as credenciais do ambiente.")
    except Exception as e:
        print(f"Falha ao inicializar com credenciais do ambiente, tentando arquivo local: {e}")
        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate("credentials.json")
                firebase_admin.initialize_app(cred)
                print("Firebase Admin SDK inicializado com credentials.json.")
        except Exception as file_error:
            print(f"Não foi possível inicializar o Firebase Admin: {file_error}")

    db = firestore.client()
    mail = Mail(app)
    
    # Inicializa os serviços
    user_service = UserService(db, mail)
    teacher_service = TeacherService(db)
    training_class_service = TrainingClassService(db)
    enrollment_service = EnrollmentService(db)
    attendance_service = AttendanceService(db)
    notification_service = NotificationService(db, user_service)
    payment_service = PaymentService(db, enrollment_service)

    # Injeta o user_service no módulo de decoradores
    init_decorators(user_service)

    # (Opcional) Hook para previnir cache
    @app.after_request
    def add_cache_headers(response):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response

    @app.context_processor
    def inject_branding_settings():
        try:
            settings_doc = db.collection('settings').document('branding').get()
            settings = settings_doc.to_dict() if settings_doc.exists else {}
        except Exception:
            settings = {}
        return {
            'academy_name': settings.get('academy_name', 'JitaKyoApp'),
            'academy_logo_path': settings.get('logo_path', 'logo-horizontal.png')
        }

    # --- REGISTRO DOS BLUEPRINTS ---
    with app.app_context():
        # A inicialização do auth_bp não precisa mais passar o user_service
        init_admin_bp(db, user_service, teacher_service, training_class_service, enrollment_service, attendance_service, payment_service)
        init_student_bp(user_service, enrollment_service, training_class_service, teacher_service, payment_service)
        init_teacher_bp(user_service, teacher_service, training_class_service, enrollment_service, notification_service)

        app.register_blueprint(admin_bp)
        app.register_blueprint(student_bp)
        app.register_blueprint(auth_bp)
        app.register_blueprint(teacher_bp)

    return app

# Cria a instância da aplicação para o Gunicorn
app = create_app()