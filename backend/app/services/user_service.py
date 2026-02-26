import string
import secrets
import logging
from datetime import datetime, timedelta
from firebase_admin import auth, firestore
from flask_mail import Message
from app.models.user import User

class UserService:
    def __init__(self, db, mail=None):
        """
        Inicializa o serviço de usuários.
        :param db: Instância do Firestore Client.
        :param mail: Instância do Flask-Mail (opcional).
        """
        self.db = db
        self.collection = self.db.collection('users')
        self.mail = mail
        self.enrollment_service = None

    def set_enrollment_service(self, enrollment_service):
        """Define o serviço de matrículas para resolver dependências circulares."""
        self.enrollment_service = enrollment_service

    def _generate_random_password(self, length=12):
        """Gera uma senha aleatória segura para novos usuários."""
        alphabet = string.ascii_letters + string.digits + string.punctuation
        return ''.join(secrets.choice(alphabet) for i in range(length))

    def _get_installation_guide_html(self, name, email, password):
        """
        Gera o corpo do e-mail em HTML com o guia de instalação do PWA incorporado.
        Utiliza o logo oficial de 512px.
        """
        return f"""
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border-radius: 16px; overflow: hidden; background-color: #0f172a; color: #ffffff; border: 1px solid #334155;">
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); padding: 40px 20px; text-align: center;">
                <img src="https://aluno-jitakyoapp.web.app/icons/android-launchericon-512-512.png" alt="Logo" style="width: 80px; height: 80px; margin-bottom: 15px; border-radius: 20px;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.025em;">JitaKyoApp</h1>
                <p style="margin-top: 8px; opacity: 0.9; font-size: 16px;">Seu portal de treinos está pronto!</p>
            </div>
            
            <div style="padding: 30px; line-height: 1.6;">
                <p style="font-size: 18px;">Olá, <strong>{name}</strong>!</p>
                <p style="color: #94a3b8;">Sua conta de aluno foi criada com sucesso. Utilize os dados abaixo para o primeiro acesso:</p>
                
                <div style="background-color: #1e293b; padding: 20px; border-radius: 12px; margin: 24px 0; border: 1px dashed #4f46e5; text-align: center;">
                    <p style="margin: 0; color: #818cf8; font-family: monospace; font-size: 16px;">
                        <strong>E-mail:</strong> {email}<br>
                        <strong>Senha:</strong> {password}
                    </p>
                </div>

                <div style="text-align: center; margin: 32px 0;">
                    <a href="https://aluno-jitakyoapp.web.app/instalar.html" style="background-color: #4f46e5; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.4);">
                        VER GUIA DE INSTALAÇÃO
                    </a>
                </div>

                <hr style="border: 0; border-top: 1px solid #334155; margin: 32px 0;">

                <h3 style="color: #f8fafc; margin-bottom: 16px;">📲 Instalação Rápida:</h3>
                
                <div style="margin-bottom: 20px;">
                    <p style="margin: 0; font-weight: bold; color: #4ade80;">No Android (Chrome):</p>
                    <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 14px;">Abra o link, toque nos <b>três pontinhos (⋮)</b> e selecione <b>"Instalar Aplicativo"</b>.</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <p style="margin: 0; font-weight: bold; color: #60a5fa;">No iPhone (Safari):</p>
                    <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 14px;">Abra o link, toque no ícone de <b>Compartilhar (⇪)</b> e selecione <b>"Adicionar à Tela de Início"</b>.</p>
                </div>
            </div>

            <div style="background-color: #020617; padding: 20px; text-align: center; font-size: 12px; color: #475569;">
                JitaKyoApp &copy; 2026 - Tecnologia para Desporto
            </div>
        </div>
        """

    def send_installation_guide(self, student_id):
        """
        Dispara manualmente o guia de instalação por e-mail para um aluno.
        """
        student = self.get_user_by_id(student_id)
        if not student:
            return False
        
        if self.mail:
            try:
                msg = Message('Guia de Instalação - JitaKyoApp', recipients=[student.email])
                msg.html = self._get_installation_guide_html(student.name, student.email, "Sua senha atual")
                self.mail.send(msg)
                return True
            except Exception as e:
                logging.error(f"Erro ao enviar guia manual para {student.email}: {e}")
                return False
        return False

    def create_user(self, user_id, name, email, role):
        """Cria registro de usuário básico no Firestore (Admins/Professores)."""
        try:
            user_data = {
                'name': name,
                'email': email,
                'role': role,
                'created_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP
            }
            self.collection.document(user_id).set(user_data)
            return self.get_user_by_id(user_id)
        except Exception as e:
            logging.error(f"Erro ao criar registro de usuário: {e}")
            return None

    def create_user_with_enrollments(self, user_data, enrollments_data):
        """Cria um novo aluno no Auth e Firestore e envia o e-mail de boas-vindas."""
        email = user_data.get('email')
        name = user_data.get('name')
        password = user_data.get('password') or self._generate_random_password()
        
        try:
            # 1. Firebase Auth
            firebase_user = auth.create_user(email=email, password=password, display_name=name)
            uid = firebase_user.uid
            
            # 2. Firestore
            db_user_data = {
                'name': name,
                'email': email,
                'role': 'student',
                'created_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP,
                'has_face_registered': False
            }
            
            if 'phone' in user_data: db_user_data['phone'] = user_data['phone']
            if 'date_of_birth' in user_data and user_data['date_of_birth']:
                db_user_data['date_of_birth'] = datetime.strptime(user_data['date_of_birth'], '%Y-%m-%d')
            if 'guardians' in user_data: db_user_data['guardians'] = user_data['guardians']

            self.collection.document(uid).set(db_user_data)
            
            # 3. Matrículas
            if self.enrollment_service and enrollments_data:
                for info in enrollments_data:
                    info['student_id'] = uid
                    self.enrollment_service.create_enrollment(info)

            # 4. Envio do E-mail de Boas-vindas com Guia
            if self.mail:
                try:
                    msg = Message('Bem-vindo à JitaKyoApp!', recipients=[email])
                    msg.html = self._get_installation_guide_html(name, email, password)
                    self.mail.send(msg)
                except Exception as mail_err:
                    logging.warning(f"Erro ao enviar e-mail de boas-vindas: {mail_err}")

            return self.get_user_by_id(uid)
            
        except auth.EmailAlreadyExistsError:
            raise ValueError(f"O email '{email}' já está em uso.")
        except Exception as e:
            if 'uid' in locals(): auth.delete_user(uid)
            logging.error(f"Erro na criação do aluno: {e}")
            raise e

    def get_user_by_id(self, uid):
        try:
            doc = self.collection.document(uid).get()
            if doc.exists:
                return User.from_dict(doc.to_dict(), doc.id)
            return None
        except Exception as e:
            logging.error(f"Erro ao buscar usuário {uid}: {e}")
            return None

    def get_users_by_role(self, role):
        users = []
        try:
            docs = self.collection.where(filter=firestore.FieldFilter('role', '==', role)).stream()
            for doc in docs:
                users.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            logging.error(f"Erro por role {role}: {e}")
        return users
        
    def get_all_users(self):
        users = []
        try:
            docs = self.collection.stream()
            for doc in docs:
                users.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            logging.error(f"Erro buscar todos: {e}")
        return users

    def search_students_by_name(self, search_term):
        students = []
        if not search_term: return []
        try:
            end_term = search_term + '\uf8ff'
            query = self.collection.where(filter=firestore.FieldFilter('role', '==', 'student')) \
                                    .where(filter=firestore.FieldFilter('name', '>=', search_term)) \
                                    .where(filter=firestore.FieldFilter('name', '<=', end_term))
            docs = query.stream()
            for doc in docs:
                students.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            logging.error(f"Erro pesquisa: {e}")
        return students

    def update_user(self, uid, data):
        """Atualiza dados e suporta biometria facial e PAR-Q."""
        try:
            update_data = {}
            auth_update_data = {}

            # IMPORTANTE: par_q_data e par_q_filled foram adicionados à lista de campos permitidos
            fields = ['name', 'email', 'role', 'phone', 'guardians', 'face_descriptor', 'has_face_registered', 'par_q_data', 'par_q_filled']
            for f in fields:
                if f in data: update_data[f] = data[f]

            if 'name' in data: auth_update_data['display_name'] = data['name']
            if 'email' in data: auth_update_data['email'] = data['email']

            if 'date_of_birth' in data:
                if data['date_of_birth']:
                    update_data['date_of_birth'] = datetime.strptime(data['date_of_birth'], '%Y-%m-%d')
                else:
                    update_data['date_of_birth'] = firestore.DELETE_FIELD
            
            # Garantir booleano para o controle de face
            if 'face_descriptor' in data and data['face_descriptor']:
                update_data['has_face_registered'] = True

            if update_data:
                update_data['updated_at'] = firestore.SERVER_TIMESTAMP
                self.collection.document(uid).update(update_data)

            if auth_update_data:
                auth.update_user(uid, **auth_update_data)

            return self.get_user_by_id(uid)
        except Exception as e:
            logging.error(f"Erro ao atualizar {uid}: {e}")
            raise e

    def delete_user(self, uid):
        try:
            batch = self.db.batch()
            if self.enrollment_service:
                enrollments = self.enrollment_service.get_enrollments_by_student_id(uid)
                for e in enrollments:
                    ref = self.enrollment_service.collection.document(e.id if hasattr(e, 'id') else e['id'])
                    batch.delete(ref)

            batch.delete(self.collection.document(uid))
            batch.commit()
            auth.delete_user(uid)
            return True
        except Exception as e:
            logging.error(f"Erro ao deletar {uid}: {e}")
            return False

    def count_active_students(self):
        if not self.enrollment_service: return 0
        try:
            active = self.enrollment_service.get_all_active_enrollments_with_details()
            return len({e['student_id'] for e in active})
        except: return 0

    def get_upcoming_birthdays(self, days_ahead=7):
        upcoming = []
        try:
            today = datetime.now()
            students = self.get_users_by_role('student')
            for student in students:
                if hasattr(student, 'date_of_birth') and student.date_of_birth:
                    b_day = student.date_of_birth.replace(year=today.year)
                    if b_day < today: b_day = b_day.replace(year=today.year + 1)
                    diff = (b_day - today).days
                    if 0 <= diff < days_ahead:
                        s_dict = student.to_dict()
                        s_dict['days_until_birthday'] = diff
                        s_dict['birth_date_formatted'] = student.date_of_birth.strftime('%d/%m')
                        upcoming.append(s_dict)
            return sorted(upcoming, key=lambda x: x['days_until_birthday'])
        except: return []

    def get_new_students_per_month(self, num_months=6):
        try:
            counts = {}
            today = datetime.now()
            for i in range(num_months):
                counts[(today - timedelta(days=i*30.5)).strftime('%Y-%m')] = 0
            
            limit = today - timedelta(days=num_months * 30.5)
            query = self.collection.where(filter=firestore.And([
                firestore.FieldFilter('role', '==', 'student'),
                firestore.FieldFilter('created_at', '>=', limit)
            ])).stream()

            for doc in query:
                c_at = doc.to_dict().get('created_at')
                if isinstance(c_at, datetime):
                    key = c_at.strftime('%Y-%m')
                    if key in counts: counts[key] += 1
            
            sorted_keys = sorted(counts.keys())
            return {
                'labels': [datetime.strptime(k, '%Y-%m').strftime('%b/%y') for k in sorted_keys],
                'data': [counts[k] for k in sorted_keys]
            }
        except: return {'labels': [], 'data': []}