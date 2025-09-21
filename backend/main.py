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
    
    # --- Configuração de Middlewares ---
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
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

    # --- CRIAÇÃO DO DB ---
    db = firestore.client()
    
    # --- Importação e Inicialização de Serviços ---
    # Importamos os serviços aqui para que eles estejam disponíveis para as rotas
    from app.services.user_service import UserService
    from app.services.teacher_service import TeacherService
    from app.services.training_class_service import TrainingClassService
    from app.services.enrollment_service import EnrollmentService
    
    enrollment_service = EnrollmentService(db)
    user_service = UserService(db, enrollment_service)
    teacher_service = TeacherService(db)
    training_class_service = TrainingClassService(db)
    
    # --- IMPORTAÇÃO E REGISTRO DE ROTAS (BLUEPRINTS) ---
    # Importamos os blueprints AQUI, dentro da função create_app
    from app.routes.user_routes import user_api_bp, init_user_bp
    from app.routes.admin_routes import admin_api_bp, init_admin_bp
    from app.routes.student_routes import student_api_bp, init_student_bp
    from app.routes.teacher_routes import teacher_api_bp, init_teacher_bp
    from app.utils.decorators import init_decorators

    # Injeta as dependências necessárias em cada módulo de rotas
    init_decorators(user_service)
    init_user_bp(user_service)
    init_admin_bp(db, user_service, teacher_service, training_class_service, enrollment_service)
    # Inicialize outros blueprints se necessário
    # init_teacher_bp(...)
    # init_student_bp(...)

    # Registra os blueprints na aplicação
    app.register_blueprint(user_api_bp) 
    app.register_blueprint(admin_api_bp)
    # app.register_blueprint(student_api_bp)
    # app.register_blueprint(teacher_api_bp)

    @app.route('/')
    def index():
        return "JitaKyoApp API is running!"

    return app

# --- Criação da Instância Final ---
# Esta parte é importante para o Gunicorn
app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port, debug=True)

