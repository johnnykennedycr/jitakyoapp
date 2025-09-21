from datetime import datetime
from firebase_admin import firestore, auth
from app.models.user import User

class UserService:
    def __init__(self, db, enrollment_service):
        self.db = db
        self.users_collection = self.db.collection('users')
        self.enrollment_service = enrollment_service

    def create_user_with_enrollments(self, user_data, enrollments_data):
        """
        Cria um usuário no Firebase Auth, um documento de perfil no Firestore,
        e opcionalmente cria suas matrículas em uma única operação.
        """
        auth_user = None
        try:
            # 1. Cria o usuário no Firebase Authentication
            auth_user = auth.create_user(
                email=user_data['email'],
                password=user_data['password'],
                display_name=user_data.get('name')
            )

            # 2. Prepara os dados para salvar no Firestore
            firestore_data = user_data.copy()
            firestore_data['role'] = 'student'  # Garante a role padrão
            if 'password' in firestore_data:
                del firestore_data['password']  # Nunca salve a senha em texto plano

            firestore_data['created_at'] = datetime.now()
            firestore_data['updated_at'] = datetime.now()

            # 3. Cria o documento do usuário no Firestore usando o UID do Auth
            self.users_collection.document(auth_user.uid).set(firestore_data)
            new_user = self.get_user_by_id(auth_user.uid)

            # 4. Cria as matrículas, se houver
            if new_user and enrollments_data:
                for enrollment_data in enrollments_data:
                    enrollment_data['student_id'] = new_user.id
                    # Delega a criação da matrícula para o serviço de matrículas
                    self.enrollment_service.create_enrollment(enrollment_data)
            
            return new_user
        except Exception as e:
            print(f"ERRO CRÍTICO ao criar usuário com matrículas: {e}")
            # Rollback: se a criação falhar em qualquer etapa, deleta o usuário do Auth
            if auth_user:
                auth.delete_user(auth_user.uid)
            return None

    def get_user_by_id(self, user_id):
        """Busca um usuário por seu ID (que é o UID do Firebase Auth)."""
        if not user_id:
            return None
        try:
            doc = self.users_collection.document(user_id).get()
            if doc.exists:
                return User.from_dict(doc.to_dict(), doc.id)
            return None
        except Exception as e:
            print(f"Erro ao buscar usuário por ID '{user_id}': {e}")
            return None

    def get_users_by_role(self, role):
        """Retorna uma lista de usuários com uma função (role) específica."""
        users = []
        try:
            docs = self.users_collection.where('role', '==', role).stream()
            for doc in docs:
                users.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar usuários por role '{role}': {e}")
        return users

    def update_user(self, user_id, update_data):
        """Atualiza os dados de um usuário no Firestore."""
        try:
            update_data['updated_at'] = datetime.now()
            self.users_collection.document(user_id).update(update_data)
            return True
        except Exception as e:
            print(f"Erro ao atualizar usuário '{user_id}': {e}")
            return False

    def delete_user(self, user_id):
        """Deleta um usuário do Firestore, do Firebase Auth e todas as suas matrículas."""
        try:
            # 1. Deleta todas as matrículas associadas ao aluno
            student_enrollments = self.enrollment_service.get_enrollments_by_student_id(user_id)
            for enrollment in student_enrollments:
                self.enrollment_service.delete_enrollment(enrollment.id)
            
            # 2. Deleta o documento do Firestore
            self.users_collection.document(user_id).delete()
            
            # 3. Deleta o usuário do Firebase Authentication
            auth.delete_user(user_id)
            
            print(f"Usuário com UID {user_id} e suas matrículas foram deletados com sucesso.")
            return True
        except Exception as e:
            print(f"Erro ao deletar usuário com ID '{user_id}': {e}")
            return False

