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

    def create_user(self, user_id, name, email, role):
        """
        Cria um registro de usuário básico no Firestore (usado para admins/professores).
        Chamado pelas rotas quando um usuário já foi criado no Firebase Auth.
        """
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
            logging.error(f"Erro ao criar registro de usuário no Firestore: {e}")
            return None

    def create_user_with_enrollments(self, user_data, enrollments_data):
        """
        Cria um novo aluno no Firebase Auth e Firestore, vinculando matrículas.
        """
        email = user_data.get('email')
        name = user_data.get('name')
        password = user_data.get('password') or self._generate_random_password()
        
        try:
            # 1. Criar usuário no Firebase Authentication
            firebase_user = auth.create_user(email=email, password=password, display_name=name)
            uid = firebase_user.uid
            
            # 2. Preparar dados para o Firestore
            db_user_data = {
                'name': name,
                'email': email,
                'role': 'student',
                'created_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP,
                'has_face_registered': False # Inicializa controle de face
            }
            
            if 'phone' in user_data and user_data['phone']:
                db_user_data['phone'] = user_data['phone']
            
            if 'date_of_birth' in user_data and user_data['date_of_birth']:
                db_user_data['date_of_birth'] = datetime.strptime(user_data['date_of_birth'], '%Y-%m-%d')
            
            if 'guardians' in user_data:
                 db_user_data['guardians'] = user_data['guardians']

            # Salva no banco
            self.collection.document(uid).set(db_user_data)
            
            # 3. Criar matrículas vinculadas, se houver
            if self.enrollment_service and enrollments_data:
                for enrollment_info in enrollments_data:
                    enrollment_info['student_id'] = uid
                    self.enrollment_service.create_enrollment(enrollment_info)

            # 4. Envio de e-mail de credenciais
            if self.mail:
                try:
                    msg = Message('Bem-vindo à JitaKyoApp!', recipients=[email])
                    msg.body = f"Olá {name},\n\nSua conta foi criada. Use o e-mail {email} e a senha '{password}' para acessar.\n\nAtenciosamente,\nEquipe JitaKyo"
                    self.mail.send(msg)
                except Exception as mail_err:
                    logging.warning(f"Usuário criado mas falha ao enviar e-mail: {mail_err}")

            return self.get_user_by_id(uid)
            
        except auth.EmailAlreadyExistsError:
            raise ValueError(f"O email '{email}' já está em uso.")
        except Exception as e:
            if 'uid' in locals():
                auth.delete_user(uid)
            logging.error(f"Erro ao criar utilizador com matrículas: {e}")
            raise

    def get_user_by_id(self, uid):
        """Busca um usuário pelo UID e retorna um objeto User model."""
        try:
            doc = self.collection.document(uid).get()
            if doc.exists:
                return User.from_dict(doc.to_dict(), doc.id)
            return None
        except Exception as e:
            logging.error(f"Erro ao buscar utilizador por ID {uid}: {e}")
            return None

    def get_users_by_role(self, role):
        """Lista usuários filtrando pela função (admin, student, etc)."""
        users = []
        try:
            docs = self.collection.where(filter=firestore.FieldFilter('role', '==', role)).stream()
            for doc in docs:
                users.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            logging.error(f"Erro ao buscar utilizadores pela role '{role}': {e}")
        return users
        
    def get_all_users(self):
        """Retorna uma lista de todos os usuários cadastrados."""
        users = []
        try:
            docs = self.collection.stream()
            for doc in docs:
                users.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            logging.error(f"Erro ao buscar todos os utilizadores: {e}")
        return users

    def search_students_by_name(self, search_term):
        """Busca alunos por prefixo de nome (Case-sensitive no Firestore)."""
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
            logging.error(f"Erro ao pesquisar alunos: {e}")
        return students

    def update_user(self, uid, data):
        """
        Atualiza dados do usuário. Suporta campos de perfil, 
        responsáveis e Biometria Facial.
        """
        try:
            update_data = {}
            auth_update_data = {}

            # Filtro de campos permitidos
            if 'name' in data:
                update_data['name'] = data['name']
                auth_update_data['display_name'] = data['name']
            if 'email' in data:
                update_data['email'] = data['email']
                auth_update_data['email'] = data['email']
            if 'role' in data:
                update_data['role'] = data['role']
            if 'phone' in data:
                update_data['phone'] = data['phone']

            if 'date_of_birth' in data:
                if data['date_of_birth']:
                    update_data['date_of_birth'] = datetime.strptime(data['date_of_birth'], '%Y-%m-%d')
                else:
                    update_data['date_of_birth'] = firestore.DELETE_FIELD
            
            if 'guardians' in data:
                 update_data['guardians'] = data['guardians']

            # --- SUPORTE PARA BIOMETRIA FACIAL ---
            if 'face_descriptor' in data:
                update_data['face_descriptor'] = data['face_descriptor']
                update_data['has_face_registered'] = True
            
            if 'has_face_registered' in data:
                update_data['has_face_registered'] = bool(data['has_face_registered'])
            # ------------------------------------

            if update_data:
                update_data['updated_at'] = firestore.SERVER_TIMESTAMP
                self.collection.document(uid).update(update_data)

            if auth_update_data:
                auth.update_user(uid, **auth_update_data)

            return self.get_user_by_id(uid)
        except ValueError as ve:
            logging.error(f"Erro de validação ao atualizar {uid}: {ve}")
            raise ValueError(f"Dados inválidos: {ve}")
        except Exception as e:
            logging.error(f"Erro crítico ao atualizar utilizador {uid}: {e}")
            raise

    def delete_user(self, uid):
        """Remove o usuário do Firestore, do Auth e apaga matrículas vinculadas."""
        try:
            batch = self.db.batch()
            if self.enrollment_service:
                enrollments = self.enrollment_service.get_enrollments_by_student_id(uid)
                for enrollment in enrollments:
                    if hasattr(enrollment, 'id'):
                        batch.delete(self.enrollment_service.collection.document(enrollment.id))
                    elif isinstance(enrollment, dict) and 'id' in enrollment:
                        batch.delete(self.enrollment_service.collection.document(enrollment['id']))

            batch.delete(self.collection.document(uid))
            batch.commit()
            auth.delete_user(uid)
            return True
        except Exception as e:
            logging.error(f"Erro ao deletar utilizador {uid}: {e}")
            return False

    def count_active_students(self):
        """Calcula o total de alunos com matrículas vigentes."""
        if not self.enrollment_service:
            return 0
        try:
            active_enrollments = self.enrollment_service.get_all_active_enrollments_with_details()
            return len({e['student_id'] for e in active_enrollments})
        except Exception as e:
            logging.error(f"Erro ao contar alunos ativos: {e}")
            return 0

    def get_upcoming_birthdays(self, days_ahead=7):
        """Lista aniversariantes na janela de dias informada."""
        upcoming = []
        try:
            today = datetime.now()
            all_users = self.get_all_users() 
            students = [u for u in all_users if u.role == 'student' and hasattr(u, 'date_of_birth') and u.date_of_birth]

            for student in students:
                if isinstance(student.date_of_birth, datetime):
                    b_day = student.date_of_birth.replace(year=today.year)
                    if b_day < today:
                        b_day = b_day.replace(year=today.year + 1)
                    
                    diff = (b_day - today).days
                    if 0 <= diff < days_ahead:
                        s_dict = student.to_dict()
                        s_dict['days_until_birthday'] = diff
                        s_dict['birth_date_formatted'] = student.date_of_birth.strftime('%d/%m')
                        upcoming.append(s_dict)
            
            upcoming.sort(key=lambda x: x['days_until_birthday'])
            return upcoming
        except Exception as e:
            logging.error(f"Erro ao buscar aniversariantes: {e}")
            return []

    def get_new_students_per_month(self, num_months=6):
        """Gera dados estatísticos de novos alunos para gráficos."""
        try:
            counts = {}
            today = datetime.now()
            for i in range(num_months):
                dt = today - timedelta(days=i * 30.5)
                counts[dt.strftime('%Y-%m')] = 0
            
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
        except Exception as e:
            logging.error(f"Erro estatístico: {e}")
            return {'labels': [], 'data': []}