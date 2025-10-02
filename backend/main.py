import os
from dotenv import load_dotenv
from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix
import firebase_admin
from firebase_admin import credentials, firestore
from flask_cors import CORS
from flask_mail import Mail

def create_app():
    """Cria e configura a instância da aplicação Flask."""
    
    print("[DIAGNÓSTICO] Iniciando create_app...")
    app = Flask(__name__)
    load_dotenv()
    
    # --- Configuração de Middlewares ---
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    
    # --- CONFIGURAÇÃO DE CORS ---
    allowed_origins = [
        "https://aluno-jitakyoapp.web.app",
        "https://jitakyoapp.web.app",
        "http://localhost:5173",
        "http://localhost:8080"
    ]
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, supports_credentials=True)
    print("[DIAGNÓSTICO] CORS configurado.")

    try:
        # --- Configuração de Mail ---
        app.config.update(
            MAIL_SERVER=os.getenv('MAIL_SERVER'),
            MAIL_PORT=int(os.getenv('MAIL_PORT', 587)),
            MAIL_USE_TLS=os.getenv('MAIL_USE_TLS', 'true').lower() in ('true', '1', 't'),
            MAIL_USERNAME=os.getenv('MAIL_USERNAME'),
            MAIL_PASSWORD=os.getenv('MAIL_PASSWORD'),
            MAIL_DEFAULT_SENDER=os.getenv('MAIL_DEFAULT_SENDER')
        )
        mail = Mail(app)
        print("[DIAGNÓSTICO] Flask-Mail configurado.")

        # --- Inicialização do Firebase ---
        if not firebase_admin._apps:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred)
            print("[DIAGNÓSTICO] Firebase Admin SDK inicializado.")
        
        db = firestore.client()
        print("[DIAGNÓSTICO] Cliente Firestore obtido.")
        
        # --- Importação e Inicialização de Serviços ---
        print("[DIAGNÓSTICO] Importando serviços...")
        from app.services.enrollment_service import EnrollmentService
        from app.services.user_service import UserService
        from app.services.teacher_service import TeacherService
        from app.services.training_class_service import TrainingClassService
        from app.services.attendance_service import AttendanceService
        from app.services.payment_service import PaymentService
        print("[DIAGNÓSTICO] Serviços importados. Inicializando...")
        
        user_service = UserService(db, mail=mail)
        teacher_service = TeacherService(db, user_service=user_service)
        training_class_service = TrainingClassService(db, teacher_service=teacher_service)
        enrollment_service = EnrollmentService(db, user_service=user_service, training_class_service=training_class_service)
        attendance_service = AttendanceService(db, user_service, enrollment_service, training_class_service)
        payment_service = PaymentService(db, enrollment_service, user_service, training_class_service)
        user_service.set_enrollment_service(enrollment_service)
        print("[DIAGNÓSTICO] Serviços inicializados.")

        # --- IMPORTAÇÃO E REGISTRO DE ROTAS (BLUEPRINTS) ---
        print("[DIAGNÓSTICO] Importando rotas...")
        from app.routes.user_routes import user_api_bp, init_user_bp
        from app.routes.admin_routes import admin_api_bp, init_admin_bp
        from app.routes.student_routes import student_api_bp, init_student_bp
        from app.routes.teacher_routes import teacher_api_bp, init_teacher_bp
        from app.utils.decorators import init_decorators
        print("[DIAGNÓSTICO] Rotas importadas. Inicializando...")

        init_decorators(user_service)
        init_user_bp(user_service)
        init_admin_bp(db, user_service, teacher_service, training_class_service, enrollment_service, attendance_service, payment_service)
        init_teacher_bp(user_service, teacher_service, training_class_service, attendance_service)
        init_student_bp(user_service, enrollment_service, training_class_service, attendance_service, payment_service)
        print("[DIAGNÓSTICO] Rotas inicializadas. Registrando Blueprints...")

        app.register_blueprint(user_api_bp) 
        app.register_blueprint(admin_api_bp)
        app.register_blueprint(student_api_bp)
        app.register_blueprint(teacher_api_bp)
        print("[DIAGNÓSTICO] Blueprints registrados com sucesso.")

    except Exception as e:
        # Se ocorrer qualquer erro durante a inicialização, ele será impresso aqui.
        print(f"!!!!!!!! ERRO FATAL DURANTE A INICIALIZAÇÃO DO APP !!!!!!!!")
        print(f"!!!!!!!! ERRO: {e} !!!!!!!!")
        import traceback
        traceback.print_exc()


    @app.route('/')
    def index():
        return "JitaKyoApp API is running!"

    print("[DIAGNÓSTICO] create_app concluído com sucesso.")
    return app

# Esta linha é crucial para o Gunicorn encontrar a aplicação
app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port, debug=True)

