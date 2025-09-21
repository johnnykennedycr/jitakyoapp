from datetime import datetime
from firebase_admin import firestore, auth
from app.models.user import User
import string
import secrets

class UserService:
    def __init__(self, db, enrollment_service, mail=None):
        self.db = db
        self.mail = mail
        self.enrollment_service = enrollment_service
        self.users_collection = self.db.collection('users')

    def get_user_by_id(self, user_id):
        """Busca um usuário por seu ID (que é o UID do Firebase Auth)."""
        if not user_id:
            return None
        try:
            doc_ref = self.users_collection.document(user_id)
            doc = doc_ref.get()
            if doc.exists:
                return User.from_dict(doc.to_dict(), doc.id)
            return None
        except Exception as e:
            print(f"ERRO CRÍTICO em get_user_by_id: {e}")
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

    def create_user_with_enrollments(self, user_data, enrollments_data):
        """Cria um usuário no Auth, seu perfil no Firestore e suas matrículas."""
        try:
            # 1. Gerar senha segura
            alphabet = string.ascii_letters + string.digits
            password = ''.join(secrets.choice(alphabet) for i in range(10))

            # 2. Criar usuário no Firebase Authentication
            auth_user = auth.create_user(
                email=user_data['email'],
                password=password,
                display_name=user_data['name']
            )

            # 3. Preparar e criar usuário no Firestore
            firestore_data = user_data.copy()
            firestore_data['role'] = 'student'
            firestore_data['created_at'] = datetime.now()
            firestore_data['updated_at'] = datetime.now()
            
            # Converte a string de data de nascimento para um objeto datetime, se existir
            if 'date_of_birth' in firestore_data and firestore_data['date_of_birth']:
                try:
                    firestore_data['date_of_birth'] = datetime.strptime(firestore_data['date_of_birth'], '%Y-%m-%d')
                except (ValueError, TypeError):
                    print(f"Aviso: Formato de data inválido para {firestore_data['date_of_birth']}. Deixando como nulo.")
                    firestore_data['date_of_birth'] = None

            self.users_collection.document(auth_user.uid).set(firestore_data)
            
            # 4. Criar matrículas, se houver
            if enrollments_data:
                for enrollment_data in enrollments_data:
                    enrollment_data['student_id'] = auth_user.uid
                    self.enrollment_service.create_enrollment(enrollment_data)

            # 5. Enviar e-mail com a senha (se o serviço de mail estiver configurado)
            if self.mail:
                # Adapte a mensagem e o template de e-mail conforme necessário
                # self.mail.send_message(...)
                print(f"INFO: E-mail de boas-vindas para {user_data['email']} com a senha {password} seria enviado aqui.")

            return self.get_user_by_id(auth_user.uid)

        except auth.EmailAlreadyExistsError:
            raise ValueError(f"O e-mail {user_data.get('email')} já está em uso.")
        except Exception as e:
            print(f"Erro ao criar usuário com matrículas: {e}")
            # Se a criação no Auth funcionou mas o Firestore falhou, deleta o usuário do Auth
            if 'auth_user' in locals() and auth_user:
                auth.delete_user(auth_user.uid)
                print(f"Usuário {auth_user.uid} removido do Auth devido a erro subsequente.")
            raise e # Re-lança a exceção para ser capturada pela rota

    def update_user(self, user_id, update_data):
        """Atualiza os dados de um usuário no Firestore e, opcionalmente, no Auth."""
        try:
            # Se uma nova senha for fornecida, atualiza no Firebase Auth
            if 'password' in update_data and update_data['password']:
                auth.update_user(user_id, password=update_data['password'])
                del update_data['password'] # Remove para não salvar o hash no Firestore
            
            # Converte a string de data de nascimento para um objeto datetime
            if 'date_of_birth' in update_data and isinstance(update_data['date_of_birth'], str):
                 update_data['date_of_birth'] = datetime.strptime(update_data['date_of_birth'], '%Y-%m-%d')

            update_data['updated_at'] = datetime.now()
            self.users_collection.document(user_id).update(update_data)
            return True
        except Exception as e:
            print(f"Erro ao atualizar usuário '{user_id}': {e}")
            return False

    def delete_user(self, user_id):
        """Deleta um usuário do Firestore e do Firebase Authentication."""
        try:
            # Também precisa deletar matrículas associadas
            enrollments_to_delete = self.enrollment_service.get_enrollments_by_student_id(user_id)
            for enrollment in enrollments_to_delete:
                self.enrollment_service.delete_enrollment(enrollment.id)
            
            self.users_collection.document(user_id).delete()
            auth.delete_user(user_id)
            print(f"Usuário com UID {user_id} e suas matrículas foram deletados com sucesso.")
            return True
        except Exception as e:
            print(f"Erro ao deletar usuário com ID '{user_id}': {e}")
            return False
