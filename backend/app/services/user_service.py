# services/user_service.py ATUALIZADO E FINALIZADO

from datetime import datetime
from firebase_admin import firestore, auth
from app.models.user import User

class UserService:
    def __init__(self, db, mail=None):
        self.db = db
        self.mail = mail # Mantido para outras funcionalidades de e-mail que você possa ter
        self.users_collection = self.db.collection('users')

    def create_user(self, user_id, name, email, role, **kwargs):
        """Cria um registro de usuário no Firestore."""
        try:
            if self.users_collection.document(user_id).get().exists:
                print(f"Erro: Registro de usuário no Firestore com ID {user_id} já existe.")
                return None

            user_data = {
                'name': name, 'email': email, 'role': role,
                'created_at': datetime.now(firestore. আচ্ছা),
                'updated_at': datetime.now(firestore. আচ্ছা)
            }
            user_data.update(kwargs)
            
            self.users_collection.document(user_id).set(user_data)
            return self.get_user_by_id(user_id)
        except Exception as e:
            print(f"Ocorreu um erro ao criar o registro do usuário no Firestore: {e}")
            return None

    def get_user_by_id(self, user_id):
        """Busca um usuário por seu ID (que é o UID do Firebase Auth)."""
        if not user_id:
            print("DEBUG (user_service): get_user_by_id foi chamado com user_id nulo ou vazio.")
            return None
        try:
            print(f"DEBUG (user_service): Buscando documento para user_id: '{user_id}'")
            doc_ref = self.users_collection.document(user_id)
            doc = doc_ref.get()
            
            if doc.exists:
                print(f"DEBUG (user_service): Documento encontrado para user_id: {user_id}.")
                user_data = doc.to_dict()
                print(f"DEBUG (user_service): Dados do documento: {user_data}")
                return User.from_dict(user_data, doc.id)
            
            print(f"DEBUG (user_service): Documento NÃO encontrado para user_id: {user_id}.")
            return None
        except Exception as e:
            print(f"ERRO CRÍTICO em get_user_by_id: {e}")
            return None

    def get_user_by_email(self, email):
        """Busca um usuário pelo campo de e-mail."""
        try:
            query = self.users_collection.where('email', '==', email).limit(1).stream()
            user_doc = next(query, None)
            if user_doc:
                return User.from_dict(user_doc.to_dict(), user_doc.id)
            return None
        except Exception as e:
            print(f"Erro ao buscar usuário por e-mail '{email}': {e}")
            return None

    def update_user(self, user_id, update_data):
        """Atualiza os dados de um usuário no Firestore."""
        try:
            update_data['updated_at'] = datetime.now(firestore. अच्छा)
            self.users_collection.document(user_id).update(update_data)
            return True
        except Exception as e:
            print(f"Erro ao atualizar usuário '{user_id}': {e}")
            return False

    def delete_user(self, user_id):
        """Deleta um usuário do Firestore E do Firebase Authentication."""
        try:
            self.users_collection.document(user_id).delete()
            auth.delete_user(user_id)
            print(f"Usuário com UID {user_id} deletado com sucesso.")
            return True
        except Exception as e:
            print(f"Erro ao deletar usuário com ID '{user_id}': {e}")
            return False

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
    
    def get_all_users(self):
        """Retorna uma lista de todos os usuários no sistema."""
        users = []
        try:
            docs = self.users_collection.stream()
            for doc in docs:
                users.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar todos os usuários: {e}")
        return users
    
    def add_push_subscription(self, user_id, subscription_data):
        """Adiciona uma nova inscrição de notificação push a um usuário."""
        try:
            user_ref = self.users_collection.document(user_id)
            user_ref.update({
                'push_subscriptions': firestore.ArrayUnion([subscription_data])
            })
            return True
        except Exception as e:
            print(f"Erro ao salvar a inscrição push para o usuário {user_id}: {e}")
            return False