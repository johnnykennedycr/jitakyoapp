from firebase_admin import firestore
from models.user import User
from datetime import datetime
import secrets
import string
from werkzeug.security import generate_password_hash, check_password_hash

class UserService:
    def __init__(self, db, mail=None):
        self.db = db
        self.mail = mail
        self.users_collection = self.db.collection('users')

    def _generate_random_password(self, length=12):
        alphabet = string.ascii_letters + string.digits + string.punctuation
        password = ''.join(secrets.choice(alphabet) for i in range(length))
        return password

    def create_user(self, name, email, role, password=None, **kwargs):
        try:
            existing_user_docs = self.users_collection.where('email', '==', email).limit(1).get()
            if existing_user_docs:
                print(f"Erro: Usuário com e-mail {email} já existe.")
                return None

            if not password:
                password_to_use = self._generate_random_password()
                send_email = True
            else:
                password_to_use = password
                send_email = False
            
            # Padronizado para sempre usar 'password_hash'
            hashed_password = generate_password_hash(password_to_use)
            user_data = {
                'name': name, 'email': email, 'password_hash': hashed_password,
                'role': role, 'created_at': datetime.now(), 'updated_at': datetime.now()
            }
            user_data.update(kwargs)

            timestamp, doc_ref = self.users_collection.add(user_data)
            new_user_id = doc_ref.id
            
            if send_email and self.mail:
                # Sua lógica de envio de e-mail aqui
                pass

            created_user_doc = self.users_collection.document(new_user_id).get()
            user = User.from_dict(created_user_doc.to_dict())
            user.id = new_user_id
            return user
        except Exception as e:
            print(f"Ocorreu um erro ao criar o usuário: {e}")
            return None

    def authenticate_user(self, email, password):
        user_docs = self.users_collection.where('email', '==', email).limit(1).get()
        if not user_docs:
            return None
        
        user_doc = user_docs[0]
        user_data = user_doc.to_dict()
        stored_hash = user_data.get('password_hash')
        
        if stored_hash and check_password_hash(stored_hash, password):
            user = User.from_dict(user_data)
            user.id = user_doc.id
            return user
        
        return None

    def get_user_by_id(self, user_id):
        try:
            doc = self.users_collection.document(user_id).get()
            if doc.exists:
                user = User.from_dict(doc.to_dict())
                user.id = doc.id
                return user
            return None
        except Exception as e:
            print(f"Erro ao buscar usuário por ID '{user_id}': {e}")
            return None

    def update_user(self, user_id, update_data):
        if 'password' in update_data and update_data['password']:
            # Padronizado para sempre atualizar 'password_hash'
            update_data['password_hash'] = generate_password_hash(update_data['password'])
            del update_data['password']

        update_data['updated_at'] = datetime.now()
        self.users_collection.document(user_id).update(update_data)
        return True

    def delete_user(self, user_id):
        try:
            self.users_collection.document(user_id).delete()
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
                user = User.from_dict(doc.to_dict())
                user.id = doc.id
                users.append(user)
        except Exception as e:
            print(f"Erro ao buscar usuários por role '{role}': {e}")
        return users
    
    def get_all_users(self):
        """
        Retorna uma lista de todos os usuários no sistema.
        """
        users = []
        try:
            docs = self.users_collection.stream()
            for doc in docs:
                user = User.from_dict(doc.to_dict())
                user.id = doc.id
                users.append(user)
        except Exception as e:
            print(f"Erro ao buscar todos os usuários: {e}")
        return users
    
    def add_push_subscription(self, user_id, subscription_data):
        """
        Adiciona uma nova inscrição de notificação push a um usuário.
        """
        try:
            user_ref = self.users_collection.document(user_id)
            
            # O Firestore pode armazenar o dicionário JSON diretamente
            # Usamos 'ArrayUnion' para adicionar a uma lista, evitando duplicatas
            user_ref.update({
                'push_subscriptions': firestore.ArrayUnion([subscription_data])
            })
            return True
        except Exception as e:
            print(f"Erro ao salvar a inscrição push para o usuário {user_id}: {e}")
            return False