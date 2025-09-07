import os
from dotenv import load_dotenv
from flask import Flask, render_template
import firebase_admin
from firebase_admin import credentials, firestore
from flask_mail import Mail
from flask_login import LoginManager
from werkzeug.middleware.proxy_fix import ProxyFix

# Suas importações de módulos (models, routes, services)
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


load_dotenv()

# --- CRIAÇÃO E CONFIGURAÇÃO DO APP FLASK ---
app = Flask(__name__)
# --- CONFIGURAÇÃO ESSENCIAL ---
# Use atribuição direta para a chave secreta. É mais seguro e padrão.
app.secret_key = os.getenv('SECRET_KEY') 
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# Adicione outras configurações ao objeto 'config'
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

# --- INICIALIZAÇÃO DOS SERVIÇOS E DEPENDÊNCIAS ---
mail = Mail(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'



# Inicialização do Firebase (usará as credenciais padrão do ambiente do Google Cloud)
# --- INICIALIZAÇÃO DOS SERVIÇOS ---
# (O Firebase precisa ser inicializado antes de usar o db)
if not firebase_admin._apps:
    firebase_admin.initialize_app()
db = firestore.client()

user_service = UserService(db, mail)
teacher_service = TeacherService(db)
training_class_service = TrainingClassService(db)
enrollment_service = EnrollmentService(db)
attendance_service = AttendanceService(db)
notification_service = NotificationService(db, user_service)
payment_service = PaymentService(db, enrollment_service)

# --- 5. CONFIGURAÇÃO DO USER LOADER (ESSENCIAL ESTAR AQUI) ---
@login_manager.user_loader
def load_user(user_id):
    """Carrega o usuário da sessão. Essencial para o Flask-Login funcionar."""
    print(f"\n--- USER LOADER ATIVADO ---")
    print(f"Tentando carregar usuário da sessão com ID: {user_id}")
    # O user_service já foi inicializado, então podemos usá-lo com segurança
    user = user_service.get_user_by_id(user_id)
    if user:
        print(f"SUCESSO: Usuário {user.email} (Role: {user.role}) carregado.")
    else:
        print(f"FALHA: Nenhum usuário encontrado no DB com o ID {user_id}.")
    print("--- USER LOADER FIM ---\n")
    return user


init_admin_bp(db, user_service, teacher_service, training_class_service, enrollment_service, attendance_service, payment_service)
init_auth_bp(user_service)
init_student_bp(user_service, enrollment_service, training_class_service, teacher_service, payment_service)
init_teacher_bp(user_service, teacher_service, training_class_service, enrollment_service, notification_service)

app.register_blueprint(admin_bp)
app.register_blueprint(student_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(teacher_bp)

# Context processor para o branding pode ficar aqui no final
@app.context_processor
def inject_branding_settings():
    settings_doc = db.collection('settings').document('branding').get()
    settings = settings_doc.to_dict() if settings_doc.exists else {}
    return {
        'academy_name': settings.get('academy_name', 'JitaKyoApp'),
        'academy_logo_path': settings.get('logo_path', 'logo-horizontal.png')
    }

