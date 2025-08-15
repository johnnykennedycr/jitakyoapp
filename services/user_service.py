from firebase_admin import firestore
from models.user import User
from datetime import datetime
import secrets
import string

# Funções para criptografar e verificar senhas
from werkzeug.security import generate_password_hash, check_password_hash

class UserService:
    def __init__(self, db, mail=None):
        self.db = db
        self.mail = mail
        self.users_collection = self.db.collection('users')

    def _generate_random_password(self, length=12):
        """Gera uma senha aleatória segura."""
        alphabet = string.ascii_letters + string.digits + string.punctuation
        password = ''.join(secrets.choice(alphabet) for i in range(length))
        return password

    def create_user(self, name, email, role, password=None, **kwargs):
        """
        Cria um novo usuário, garantindo que o e-mail não esteja duplicado.
        """
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
            
            hashed_password = generate_password_hash(password_to_use)

            user_data = {
                'name': name,
                'email': email,
                'password': hashed_password,
                'role': role,
                'created_at': datetime.now(),
                'updated_at': datetime.now()
            }
            user_data.update(kwargs)

            timestamp, doc_ref = self.users_collection.add(user_data)
            new_user_id = doc_ref.id
            
            created_user_doc = self.users_collection.document(new_user_id).get()
            
            if send_email and self.mail:
                subject = "Sua conta foi criada no JitaKyoApp!"
                body = f"Olá {name},\n\nSua conta foi criada com sucesso.\nSua senha temporária é: {password_to_use}\n\nRecomendamos que você a altere após o primeiro login."
                # Assumindo que você tem uma instância de mail configurada
                # from flask_mail import Message
                # msg = Message(subject=subject, recipients=[email], body=body)
                # self.mail.send(msg)
                print(f"E-mail de boas-vindas (simulado) enviado para {email}")


            # --- CORREÇÃO AQUI ---
            user_obj = User.from_dict(created_user_doc.to_dict())
            user_obj.id = new_user_id
            return user_obj

        except Exception as e:
            print(f"Ocorreu um erro ao criar o usuário: {e}")
            return None

    def authenticate_user(self, email, password):
        """
        Autentica um usuário, verificando e-mail e senha.
        """
        try:
            user_docs = self.users_collection.where('email', '==', email).limit(1).get()
            if not user_docs:
                return None
            
            user_doc = user_docs[0]
            user_data = user_doc.to_dict()
            
            if check_password_hash(user_data.get('password', ''), password):
                # --- CORREÇÃO AQUI ---
                user = User.from_dict(user_data)
                user.id = user_doc.id
                return user
            
            return None
        except Exception as e:
            print(f"Ocorreu um erro durante a autenticação: {e}")
            return None

    def get_user_by_id(self, user_id):
        """Busca um usuário pelo seu ID."""
        try:
            doc = self.users_collection.document(user_id).get()
            if doc.exists:
                # --- CORREÇÃO AQUI ---
                user = User.from_dict(doc.to_dict())
                user.id = doc.id
                return user
            return None
        except Exception as e:
            print(f"Erro ao buscar usuário por ID '{user_id}': {e}")
            return None

    def get_users_by_role(self, role):
        """Busca todos os usuários com uma determinada role (ex: 'student')."""
        try:
            docs = self.users_collection.where('role', '==', role).stream()
            users_list = []
            for doc in docs:
                # --- CORREÇÃO AQUI ---
                user = User.from_dict(doc.to_dict())
                user.id = doc.id
                users_list.append(user)
            return users_list
        except Exception as e:
            print(f"Erro ao buscar usuários por role '{role}': {e}")
            return []
            
    # Inclua aqui seus outros métodos (update_user, delete_user, etc.)
    # Se eles também usarem User.from_dict(), a mesma correção se aplica.
    def update_user(self, user_id, update_data):
        if 'password' in update_data and update_data['password']:
            update_data['password'] = generate_password_hash(update_data['password'])

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