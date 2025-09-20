# backend/app/main.py

import os
from dotenv import load_dotenv
from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix
import firebase_admin
from firebase_admin import credentials, firestore
from flask_cors import CORS

def create_app():
    """Cria e configura a instância da aplicação Flask."""
    app = Flask(__name__)
    load_dotenv()
    
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    CORS(app)

    # --- Inicialização do Firebase ---
    try:
        if not firebase_admin._apps:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK inicializado.")
    except Exception as e:
        print(f"ERRO FATAL ao inicializar o Firebase Admin SDK: {e}")

    db = firestore.client()
    
    # --- Importações e Inicializações dentro da Fábrica ---
    from app.services.user_service import UserService
    from app.services.teacher_service import TeacherService
    from app.services.training_class_service import TrainingClassService
    from app.services.enrollment_service import EnrollmentService
    from app.services.attendance_service import AttendanceService
    from app.services.payment_service import PaymentService
    
    user_service = UserService(db)
    teacher_service = TeacherService(db)
    # ... inicialize outros serviços se necessário ...

    from app.routes.user_routes import user_api_bp, init_user_bp
    from app.routes.admin_routes import admin_api_bp, init_admin_bp
    # ... importe outros blueprints ...
    from app.utils.decorators import init_decorators

    init_decorators(user_service)
    init_user_bp(user_service)
    # Passe todos os serviços que o admin_bp precisa
    init_admin_bp(db, user_service, teacher_service) 
    
    app.register_blueprint(user_api_bp)
    app.register_blueprint(admin_api_bp)
    # ... registre outros blueprints ...

    @app.route('/')
    def index():
        return "JitaKyoApp API is running!"

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port, debug=True)