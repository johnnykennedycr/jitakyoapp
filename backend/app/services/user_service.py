from datetime import datetime
from firebase_admin import firestore, auth
from app.models.user import User

class UserService:
    def __init__(self, db, enrollment_service):
        self.db = db
        self.enrollment_service = enrollment_service
        self.users_collection = self.db.collection('users')

    def create_user_with_enrollments(self, user_data, enrollments_data):
        """Cria um novo usuário e opcionalmente o matricula em turmas."""
        try:
            # Cria o usuário no Firebase Authentication
            auth_user = auth.create_user(
                email=user_data.get('email'),
                password=user_data.get('password'),
                display_name=user_data.get('name')
            )
            
            # Prepara os dados para o Firestore
            firestore_data = user_data.copy()
            firestore_data['role'] = 'student'
            del firestore_data['password']
            
            # GARANTE QUE A DATA SEJA UM OBJETO DATETIME
            if 'date_of_birth' in firestore_data and isinstance(firestore_data['date_of_birth'], str):
                try:
                    firestore_data['date_of_birth'] = datetime.strptime(firestore_data['date_of_birth'], '%Y-%m-%d')
                except (ValueError, TypeError):
                    firestore_data['date_of_birth'] = None # Define como nulo se o formato for inválido

            firestore_data['created_at'] = datetime.now()
            firestore_data['updated_at'] = datetime.now()

            # Cria o documento do usuário no Firestore
            self.users_collection.document(auth_user.uid).set(firestore_data)
            
            # Cria as matrículas, se houver
            if enrollments_data:
                for enrollment in enrollments_data:
                    enrollment['student_id'] = auth_user.uid
                    self.enrollment_service.create_enrollment(enrollment)
            
            return self.get_user_by_id(auth_user.uid)
        except Exception as e:
            print(f"Erro ao criar usuário com matrículas: {e}")
            raise e

    def update_user(self, user_id, update_data):
        """Atualiza os dados de um usuário no Firestore."""
        try:
            # GARANTE QUE A DATA SEJA UM OBJETO DATETIME
            if 'date_of_birth' in update_data and isinstance(update_data['date_of_birth'], str):
                 try:
                    update_data['date_of_birth'] = datetime.strptime(update_data['date_of_birth'], '%Y-%m-%d')
                 except (ValueError, TypeError):
                    update_data['date_of_birth'] = None

            update_data['updated_at'] = datetime.now()
            self.users_collection.document(user_id).update(update_data)
            return True
        except Exception as e:
            print(f"Erro ao atualizar usuário '{user_id}': {e}")
            return False
            
    def get_user_by_id(self, user_id):
        """Busca um usuário por seu ID (que é o UID do Firebase Auth)."""
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

    def delete_user(self, user_id):
        """Deleta um usuário do Firestore E do Firebase Authentication."""
        try:
            # Deleta as matrículas do aluno primeiro
            enrollments = self.enrollment_service.get_enrollments_by_student_id(user_id)
            for enrollment in enrollments:
                self.enrollment_service.delete_enrollment(enrollment.id)

            # Deleta o documento do usuário no Firestore
            self.users_collection.document(user_id).delete()
            
            # Deleta o usuário do Firebase Authentication
            auth.delete_user(user_id)
            print(f"Usuário com UID {user_id} e suas matrículas foram deletados com sucesso.")
            return True
        except Exception as e:
            print(f"Erro ao deletar usuário com ID '{user_id}': {e}")
            return False

