
from datetime import datetime
import secrets
import string
from werkzeug.security import generate_password_hash, check_password_hash
from firebase_admin import firestore
from models.user import User

class UserService:
    def __init__(self, db, mail=None):
        self.db = db
        self.mail = mail
        self.users_collection = self.db.collection('users')

    def _generate_random_password(self, length=12):
        alphabet = string.ascii_letters + string.digits + string.punctuation
        return ''.join(secrets.choice(alphabet) for i in range(length))

    def create_user(self, name, email, role, password=None, **kwargs):
        try:
            if self.get_user_by_email(email):
                print(f"Erro: Usuário com e-mail {email} já existe.")
                return None

            password_to_use = password or self._generate_random_password()
            send_email = not password

            user_data = {
                'name': name,
                'email': email,
                'password_hash': generate_password_hash(password_to_use),
                'role': role,
                'created_at': datetime.now(),
                'updated_at': datetime.now()
            }
            user_data.update(kwargs)

            _, doc_ref = self.users_collection.add(user_data)
            
            if send_email and self.mail:
                # Sua lógica de envio de e-mail aqui
                pass

            return self.get_user_by_id(doc_ref.id)
        except Exception as e:
            print(f"Ocorreu um erro ao criar o usuário: {e}")
            return None

    def get_user_by_id(self, user_id):
        try:
            doc = self.users_collection.document(user_id).get()
            if doc.exists:
                # PADRÃO CORRIGIDO: Passando o ID diretamente na criação.
                return User.from_dict(doc.to_dict(), doc.id)
            return None
        except Exception as e:
            print(f"Erro ao buscar usuário por ID '{user_id}': {e}")
            return None

    def get_user_by_email(self, email):
        try:
            query = self.users_collection.where('email', '==', email).limit(1).stream()
            user_doc = next(query, None)
            if user_doc:
                # PADRÃO CORRIGIDO: Passando o ID diretamente na criação.
                return User.from_dict(user_doc.to_dict(), user_doc.id)
            return None
        except Exception as e:
            print(f"Erro ao buscar usuário por e-mail '{email}': {e}")
            return None

    def update_user(self, user_id, update_data):
        try:
            if 'password' in update_data and update_data['password']:
                update_data['password_hash'] = generate_password_hash(update_data.pop('password'))
            
            update_data['updated_at'] = datetime.now()
            self.users_collection.document(user_id).update(update_data)
            return True
        except Exception as e:
            print(f"Erro ao atualizar usuário '{user_id}': {e}")
            return False

    def delete_user(self, user_id):
        try:
            self.users_collection.document(user_id).delete()
            return True
        except Exception as e:
            print(f"Erro ao deletar usuário com ID '{user_id}': {e}")
            return False

    def get_users_by_role(self, role):
        users = []
        try:
            docs = self.users_collection.where('role', '==', role).stream()
            for doc in docs:
                # PADRÃO CORRIGIDO: Passando o ID diretamente na criação.
                users.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar usuários por role '{role}': {e}")
        return users
    
    def get_all_users(self):
        users = []
        try:
            docs = self.users_collection.stream()
            for doc in docs:
                # PADRÃO CORRIGIDO: Passando o ID diretamente na criação.
                users.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar todos os usuários: {e}")
        return users
    
    def add_push_subscription(self, user_id, subscription_data):
        try:
            user_ref = self.users_collection.document(user_id)
            user_ref.update({
                'push_subscriptions': firestore.ArrayUnion([subscription_data])
            })
            return True
        except Exception as e:
            print(f"Erro ao salvar a inscrição push para o usuário {user_id}: {e}")
            return False