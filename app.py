import os
from dotenv import load_dotenv
from flask import Flask, render_template, redirect, url_for, flash
import firebase_admin
from firebase_admin import credentials, firestore
from flask_mail import Mail
from flask_login import LoginManager, UserMixin, login_required, current_user

# Importar Blueprints
from routes.admin import admin_bp, init_admin_bp

# Importar serviços
from services.user_service import UserService
from services.teacher_service import TeacherService
from services.training_class_service import TrainingClassService
from services.enrollment_service import EnrollmentService
from services.attendance_service import AttendanceService # Novo: Importe o AttendanceService

load_dotenv()

app = Flask(__name__)
print(f"Flask instance created, root path: {app.root_path}")
print(f"Flask template folder: {app.template_folder}")
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'uma_chave_secreta_padrao_muito_forte')

# Configuração do Flask-Mail
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT'))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS').lower() in ('true', '1', 't')
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER')

mail = Mail(app)

# Inicialização do Firebase
try:
    # Ajuste o caminho para 'firebase_credentials.json' se necessário
    cred_path = os.path.join(os.path.dirname(__file__), 'firebase_credentials.json')
    if not os.path.exists(cred_path):
        raise FileNotFoundError(f"Erro: Arquivo de credenciais do Firebase não encontrado em {cred_path}.")

    if not firebase_admin._apps: # Evita inicializar o app Firebase múltiplas vezes em ambientes de recarga
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    print("Firebase inicializado com sucesso!")
except Exception as e:
    print(f"Erro ao inicializar Firebase: {e}")
    db = None

# === Configuração do Flask-Login ===
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'admin.login' # A rota para a página de login <-- AQUI ESTÁ A CORREÇÃO

# Classe de usuário que o Flask-Login usará. 
# Ela herda de UserMixin para fornecer os atributos e métodos necessários.
class User(UserMixin):
    def __init__(self, user_id, role):
        self.id = user_id
        self.role = role

    @property
    def is_active(self):
        return True

# Esta função diz ao Flask-Login como carregar um objeto de usuário a partir do ID
@login_manager.user_loader
def load_user(user_id):
    if db:
        user_data = user_service.get_user_by_id(user_id)
        if user_data:
            # Retorna uma instância da nossa classe User
            return User(user_data.id, user_data.role)
    return None

# Inicializar serviços de aplicação, passando a instância do Mail para UserService
user_service = UserService(db, mail)
teacher_service = TeacherService(db)
training_class_service = TrainingClassService(db)
enrollment_service = EnrollmentService(db)
attendance_service = AttendanceService(db)

# Inicializar Blueprint com os serviços
init_admin_bp(user_service, teacher_service, training_class_service, enrollment_service, attendance_service) 
app.register_blueprint(admin_bp)

# Exemplo de rota principal (home page)
@app.route('/')
def index():
    return render_template('index.html')


if __name__ == '__main__':
    app.run(debug=True)
