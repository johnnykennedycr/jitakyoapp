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
    
    app = Flask(__name__)
    load_dotenv()
    
    # --- Configuração de Middlewares e Mail ---
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    
    allowed_origins = [
        "https://jitakyoapp.web.app",
        "https://aluno-jitakyoapp.web.app"
    ]
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, supports_credentials=True)

    app.config.update(
        MAIL_SERVER=os.getenv('MAIL_SERVER'),
        MAIL_PORT=int(os.getenv('MAIL_PORT', 587)),
        MAIL_USE_TLS=os.getenv('MAIL_USE_TLS', 'true').lower() in ('true', '1', 't'),
        MAIL_USERNAME=os.getenv('MAIL_USERNAME'),
        MAIL_PASSWORD=os.getenv('MAIL_PASSWORD'),
        MAIL_DEFAULT_SENDER=os.getenv('MAIL_DEFAULT_SENDER')
    )
    mail = Mail(app)

    # --- Inicialização do Firebase ---
    try:
        if not firebase_admin._apps:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred)
    except Exception as e:
        print(f"ERRO FATAL ao inicializar o Firebase Admin SDK: {e}")

    db = firestore.client()
    
    # --- Importação e Inicialização de Serviços ---
    from app.services.enrollment_service import EnrollmentService
    from app.services.user_service import UserService
    from app.services.teacher_service import TeacherService
    from app.services.training_class_service import TrainingClassService
    from app.services.attendance_service import AttendanceService
    from app.services.payment_service import PaymentService
    from app.services.notification_service import NotificationService
    
    # Nível 0
    user_service = UserService(db, mail=mail)
    teacher_service = TeacherService(db, user_service=user_service)
    training_class_service = TrainingClassService(db, teacher_service=teacher_service)
    
    # Nível 1
    enrollment_service = EnrollmentService(db, user_service=user_service, training_class_service=training_class_service)
    
    # Nível 2
    attendance_service = AttendanceService(db, user_service, enrollment_service, training_class_service)
    payment_service = PaymentService(db, enrollment_service, user_service, training_class_service)
    
    # --- CORREÇÃO APLICADA AQUI ---
    # O NotificationService precisa do enrollment_service para buscar alunos por turma.
    notification_service = NotificationService(db, enrollment_service=enrollment_service)

    # Resolução de dependência circular
    user_service.set_enrollment_service(enrollment_service)

    # --- IMPORTAÇÃO E REGISTRO DE ROTAS (BLUEPRINTS) ---
    from app.routes.user_routes import user_api_bp, init_user_bp
    from app.routes.admin_routes import admin_api_bp, init_admin_bp
    from app.routes.student_routes import student_api_bp, init_student_bp
    from app.routes.teacher_routes import teacher_api_bp, init_teacher_bp
    from app.routes.webhook_routes import webhook_api_bp, init_webhook_bp
    from app.utils.decorators import init_decorators

    init_decorators(user_service)
    init_user_bp(user_service)
    init_admin_bp(db, user_service, teacher_service, training_class_service, enrollment_service, attendance_service, payment_service, notification_service)
    init_teacher_bp(user_service, teacher_service, training_class_service, attendance_service)
    init_student_bp(user_service, enrollment_service, training_class_service, attendance_service, payment_service, notification_service)
    init_webhook_bp(payment_service)

    app.register_blueprint(user_api_bp) 
    app.register_blueprint(admin_api_bp)
    app.register_blueprint(student_api_bp)
    app.register_blueprint(teacher_api_bp)
    app.register_blueprint(webhook_api_bp)

    @app.route('/')
    def index():
        return "JitaKyoApp API is running!"

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port, debug=True)

