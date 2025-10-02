import string
import secrets
from firebase_admin import auth, firestore
from flask_mail import Message
from app.models.user import User

class UserService:
    def __init__(self, db, mail=None):
        self.db = db
        self.collection = self.db.collection('users')
        self.mail = mail
        self.enrollment_service = None

    def set_enrollment_service(self, enrollment_service):
        """Define o serviço de matrículas para resolver dependências circulares."""
        self.enrollment_service = enrollment_service

    def _generate_random_password(self, length=12):
        """Gera uma senha aleatória segura."""
        alphabet = string.ascii_letters + string.digits + string.punctuation
        return ''.join(secrets.choice(alphabet) for i in range(length))

    def create_user_with_enrollments(self, user_data, enrollments_data):
        """Cria um novo utilizador e o matricula opcionalmente em turmas."""
        email = user_data.get('email')
        name = user_data.get('name')
        password = user_data.get('password') or self._generate_random_password()
        
        try:
            # 1. Criar utilizador no Firebase Authentication
            firebase_user = auth.create_user(email=email, password=password, display_name=name)
            uid = firebase_user.uid
            
            # 2. Salvar dados do utilizador no Firestore
            db_user_data = {
                'name': name,
                'email': email,
                'role': 'student',
                'created_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP
            }
            self.collection.document(uid).set(db_user_data)
            
            # 3. Criar matrículas, se houver
            if self.enrollment_service and enrollments_data:
                for enrollment_info in enrollments_data:
                    enrollment_info['student_id'] = uid
                    self.enrollment_service.create_enrollment(enrollment_info)

            # 4. Enviar email de boas-vindas (opcional, mas recomendado)
            if self.mail:
                msg = Message(
                    'Bem-vindo à JitaKyoApp!',
                    recipients=[email]
                )
                msg.body = f"Olá {name},\n\nSua conta foi criada com sucesso. Use este email e a senha '{password}' para aceder.\n\nAtenciosamente,\nEquipa JitaKyo"
                self.mail.send(msg)

            return self.get_user_by_id(uid)
            
        except auth.EmailAlreadyExistsError:
            raise ValueError(f"O email '{email}' já está em uso.")
        except Exception as e:
            # Se a criação no Firestore ou matrículas falhar, deleta o utilizador do Auth para evitar inconsistências
            if 'uid' in locals():
                auth.delete_user(uid)
            print(f"Erro ao criar utilizador com matrículas: {e}")
            raise

    def get_user_by_id(self, uid):
        try:
            doc = self.collection.document(uid).get()
            if doc.exists:
                return User.from_dict(doc.to_dict(), doc.id)
            return None
        except Exception as e:
            print(f"Erro ao buscar utilizador por ID {uid}: {e}")
            return None

    def get_users_by_role(self, role):
        users = []
        try:
            docs = self.collection.where(filter=firestore.FieldFilter('role', '==', role)).stream()
            for doc in docs:
                users.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar utilizadores pela role '{role}': {e}")
        return users
        
    def get_all_users(self):
        """Retorna uma lista de todos os objetos User."""
        users = []
        try:
            docs = self.collection.stream()
            for doc in docs:
                users.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar todos os utilizadores: {e}")
        return users

    def search_students_by_name(self, search_term):
        """Busca alunos cujo nome começa com o termo de busca (case-insensitive)."""
        students = []
        try:
            # Firestore não suporta busca case-insensitive ou 'contains' de forma nativa.
            # Esta abordagem busca por prefixo.
            end_term = search_term + '\uf8ff'
            query = self.collection.where(filter=firestore.FieldFilter('role', '==', 'student')) \
                                    .where(filter=firestore.FieldFilter('name', '>=', search_term)) \
                                    .where(filter=firestore.FieldFilter('name', '<=', end_term))
            docs = query.stream()
            for doc in docs:
                students.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao pesquisar alunos: {e}")
        return students

    def update_user(self, uid, data):
        """Atualiza os dados de um utilizador no Firestore e no Firebase Auth."""
        try:
            update_data = {}
            auth_update_data = {}

            if 'name' in data:
                update_data['name'] = data['name']
                auth_update_data['display_name'] = data['name']
            if 'email' in data:
                update_data['email'] = data['email']
                auth_update_data['email'] = data['email']
            if 'role' in data:
                update_data['role'] = data['role']

            if update_data:
                update_data['updated_at'] = firestore.SERVER_TIMESTAMP
                self.collection.document(uid).update(update_data)

            if auth_update_data:
                auth.update_user(uid, **auth_update_data)

            return self.get_user_by_id(uid)
        except Exception as e:
            print(f"Erro ao atualizar utilizador {uid}: {e}")
            raise

    def delete_user(self, uid):
        """Deleta um utilizador do Firestore, Authentication e todas as suas matrículas."""
        try:
            # Inicia um batch para garantir atomicidade
            batch = self.db.batch()

            # 1. Deleta as matrículas do utilizador
            if self.enrollment_service:
                enrollments = self.enrollment_service.get_enrollments_by_student_id(uid)
                for enrollment in enrollments:
                    enrollment_ref = self.enrollment_service.collection.document(enrollment.id)
                    batch.delete(enrollment_ref)

            # 2. Deleta o documento do utilizador no Firestore
            user_ref = self.collection.document(uid)
            batch.delete(user_ref)
            
            # Submete as operações de delete no Firestore
            batch.commit()

            # 3. Deleta o utilizador do Firebase Authentication
            auth.delete_user(uid)
            
            return True
        except Exception as e:
            print(f"Erro ao deletar utilizador {uid}: {e}")
            return False
