# backend/app/main.py

import os
from dotenv import load_dotenv
from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix
import firebase_admin
from firebase_admin import credentials, firestore
from flask_cors import CORS

# Importa os blueprints e as funções de inicialização
from app.routes.user_routes import user_api_bp, init_user_bp
from app.routes.admin_routes import admin_api_bp, init_admin_bp
from app.routes.student_routes import student_api_bp, init_student_bp
from app.routes.teacher_routes import teacher_api_bp, init_teacher_bp
from app.utils.decorators import init_decorators

# Importa os serviços
from app.services.user_service import UserService
from app.services.teacher_service import TeacherService
from app.services.training_class_service import TrainingClassService
from app.services.enrollment_service import EnrollmentService
from app.services.attendance_service import AttendanceService
from app.services.payment_service import PaymentService


def create_app():
    """Cria e configura a instância da aplicação Flask."""
    
    app = Flask(__name__)
    load_dotenv()
    
    # --- Configuração de Middlewares ---
    # Aplica o ProxyFix para o Flask entender que está atrás de um proxy (HTTPS)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    
    # Aplica o CORS para permitir que o frontend se comunique com a API
    CORS(app)

    # --- INICIALIZAÇÃO DO FIREBASE ADMIN SDK ---
    try:
        if not firebase_admin._apps:
            # Em um ambiente Google Cloud (como Cloud Run), ApplicationDefault()
            # automaticamente encontra as credenciais de serviço corretas.
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK inicializado com sucesso.")
    except Exception as e:
        print(f"ERRO FATAL ao inicializar o Firebase Admin SDK: {e}")

    db = firestore.client()
    
    # --- Injeção de Dependências ---
    # Inicializa os serviços
    user_service = UserService(db)
    teacher_service = TeacherService(db)
    training_class_service = TrainingClassService(db)
    enrollment_service = EnrollmentService(db)
    attendance_service = AttendanceService(db)
    payment_service = PaymentService(db)
    # notification_service = NotificationService(db, user_service)

    # Injeta as dependências nos módulos que precisam delas
    init_decorators(user_service)
    init_user_bp(user_service)
    init_admin_bp(db, user_service, teacher_service, training_class_service, enrollment_service, attendance_service, payment_service)
    init_teacher_bp(user_service, teacher_service, training_class_service, enrollment_service)
    init_student_bp(user_service, enrollment_service, training_class_service, teacher_service, payment_service)

    # --- Registro dos Blueprints (Rotas) ---
    app.register_blueprint(user_api_bp) 
    app.register_blueprint(admin_api_bp)
    app.register_blueprint(student_api_bp)
    app.register_blueprint(teacher_api_bp)

    @app.route('/')
    def index():
        return "JitaKyoApp API is running!"

    return app

# Cria a instância da aplicação que o Gunicorn irá usar
app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port, debug=True)