import string
import secrets
from datetime import datetime
from firebase_admin import auth, firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.models.user import User

class UserService:
    def __init__(self, db, enrollment_service, mail_service=None):
        self.db = db
        self.mail_service = mail_service
        self.enrollment_service = enrollment_service
        self.users_collection = self.db.collection('users')

    def _generate_password(self, length=10):
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for i in range(length))

    def create_user_with_enrollments(self, user_data, enrollments_data):
        email = user_data.get('email')
        try:
            # Verifica se o e-mail já está em uso no Firebase Auth
            auth.get_user_by_email(email)
            raise ValueError(f"O e-mail {email} já está em uso.")
        except auth.UserNotFoundError:
            # O e-mail não existe, podemos continuar
            pass

        password = self._generate_password()
        
        try:
            # 1. Cria o usuário no Firebase Authentication
            auth_user = auth.create_user(email=email, password=password)
            
            # 2. Prepara e cria o usuário no Firestore
            user_data['role'] = 'student'
            if 'password' in user_data:
                del user_data['password']
            
            new_user = self.create_user(auth_user.uid, **user_data)

            # 3. Cria as matrículas, se houver
            if enrollments_data:
                for enrollment_info in enrollments_data:
                    enrollment_info['student_id'] = auth_user.uid
                    self.enrollment_service.create_enrollment(enrollment_info)
            
            # 4. Envia o e-mail com a senha
            if self.mail_service:
                try:
                    self.mail_service.send_mail(
                        to=email,
                        subject='Bem-vindo ao JitaKyoApp!',
                        body=f"Olá {user_data['name']},\n\nSua conta foi criada com sucesso.\nSua senha temporária é: {password}\n\nRecomendamos que você a altere após o primeiro login."
                    )
                except Exception as mail_error:
                    print(f"AVISO: Usuário {email} criado, mas o e-mail de boas-vindas falhou: {mail_error}")

            return new_user
        except Exception as e:
            print(f"Erro ao criar usuário com matrículas: {e}")
            raise e

    def create_user(self, user_id, **user_data):
        # ... (código existente)
        if self.users_collection.document(user_id).get().exists:
            return None
        
        user_data['created_at'] = datetime.now()
        user_data['updated_at'] = datetime.now()
        
        if 'date_of_birth' in user_data and isinstance(user_data['date_of_birth'], str):
            user_data['date_of_birth'] = datetime.fromisoformat(user_data['date_of_birth'])

        self.users_collection.document(user_id).set(user_data)
        return self.get_user_by_id(user_id)

    def update_user(self, user_id, update_data):
        # ... (código existente) ...
        try:
            if 'password' in update_data and update_data['password']:
                auth.update_user(user_id, password=update_data['password'])
                del update_data['password']

            if 'date_of_birth' in update_data and isinstance(update_data['date_of_birth'], str):
                update_data['date_of_birth'] = datetime.fromisoformat(update_data['date_of_birth'])
            
            update_data['updated_at'] = datetime.now()
            self.users_collection.document(user_id).update(update_data)
            return True
        except Exception as e:
            print(f"Erro ao atualizar usuário '{user_id}': {e}")
            return False
            
    def get_user_by_id(self, user_id):
        # ... (código existente)
        doc = self.users_collection.document(user_id).get()
        if doc.exists:
            return User.from_dict(doc.to_dict(), doc.id)
        return None
        
    def get_users_by_role(self, role):
        # ... (código existente)
        users = []
        docs = self.users_collection.where(filter=FieldFilter('role', '==', role)).stream()
        for doc in docs:
            users.append(User.from_dict(doc.to_dict(), doc.id))
        return users

    def search_students_by_name(self, search_term):
        """Busca por usuários com a role 'student' cujo nome corresponda ao termo de busca."""
        students = self.get_users_by_role('student')
        if not search_term:
            return students
        
        # Filtra em memória (case-insensitive)
        search_term_lower = search_term.lower()
        return [s for s in students if search_term_lower in s.name.lower()]
        
    def delete_user(self, user_id):
        # ... (código existente)
        try:
            # Deleta matrículas primeiro
            self.enrollment_service.delete_enrollments_by_student_id(user_id)
            self.users_collection.document(user_id).delete()
            auth.delete_user(user_id)
            return True
        except Exception as e:
            print(f"Erro ao deletar usuário {user_id}: {e}")
            return False

