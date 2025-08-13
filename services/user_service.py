from firebase_admin import firestore
from models.user import User
from datetime import datetime
import bcrypt
import secrets
import string
from flask_mail import Message

class UserService:
    def __init__(self, db, mail=None):
        self.db = db
        self.users_collection = self.db.collection('users')
        self.mail = mail

    def _generate_random_password(self, length=12):
        """
        Gera uma senha aleatória segura.
        """
        characters = string.ascii_letters + string.digits + string.punctuation
        password = ''.join(secrets.choice(characters) for i in range(length))
        return password

    def _send_welcome_email(self, user_email, username, password):
        """
        Envia um e-mail de boas-vindas com a senha para o novo usuário.
        """
        if not self.mail:
            print("Erro: Instância de Flask-Mail não configurada. E-mail de boas-vindas não enviado.")
            return False
        
        try:
            msg = Message(
                subject="Bem-vindo(a) ao JitaKyoApp! Sua Conta de Aluno Foi Criada",
                recipients=[user_email],
                body=f"""Olá {username},

Sua conta de aluno no JitaKyoApp foi criada com sucesso!

Seu e-mail de acesso é: {user_email}
Sua senha temporária é: {password}

Por favor, faça login em http://127.0.0.1:5000/ e altere sua senha para uma de sua preferência.

Se tiver alguma dúvida, entre em contato.

Atenciosamente,
Equipe JitaKyoApp
"""
            )
            self.mail.send(msg)
            print(f"E-mail de boas-vindas enviado para {user_email}.")
            return True
        except Exception as e:
            print(f"Erro ao enviar e-mail para {user_email}: {e}")
            return False

    def create_user(self, name, email, role='student', date_of_birth=None, phone=None, enrolled_disciplines=None, guardians=None):
        """
        Cria um novo usuário. A senha é gerada automaticamente, e-mail de boas-vindas é enviado.
        Retorna o objeto User se criado com sucesso, ou None se o e-mail já existe.
        """
        existing_user_docs = self.users_collection.where('email', '==', email).limit(1).get()
        if not existing_user_docs.empty: # Correto: verifica se a lista de documentos está vazia
            print(f"Erro: E-mail '{email}' já está em uso.")
            return None

        generated_password = self._generate_random_password()
        hashed_password = bcrypt.hashpw(generated_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        user = User(
            name=name,
            email=email,
            password_hash=hashed_password,
            role=role,
            date_of_birth=date_of_birth,
            phone=phone,
            enrolled_disciplines=enrolled_disciplines,
            guardians=guardians
        )
        user_dict = user.to_dict()
        
        _, doc_ref = self.users_collection.add(user_dict)
        
        user.id = doc_ref.id
        print(f"Usuário '{user.name}' criado com ID: {user.id}")

        self._send_welcome_email(user.email, user.name, generated_password)

        return user

    def authenticate_user(self, email, password):
        """
        Autentica um usuário pelo e-mail e senha.
        Retorna o objeto User (do models.user) se as credenciais forem válidas, caso contrário, None.
        Esta é a função que o Flask-Login usará para verificar as credenciais.
        """
        user_docs = self.users_collection.where('email', '==', email).limit(1).get()
        if not user_docs:
            print(f"Erro: Usuário com e-mail '{email}' não encontrado.")
            return None

        user_doc = user_docs[0]
        user_data = user_doc.to_dict()
        user_data['id'] = user_doc.id
        user = User.from_dict(user_data)

        if user and user.password_hash and bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
            return user
        else:
            print("Erro: Senha incorreta.")
            return None

    def get_user_by_id(self, user_id):
        """
        Busca um usuário pelo ID. Esta é a função que o Flask-Login usa 
        para recarregar o usuário a partir de sua sessão.
        Retorna o objeto User ou None se não encontrado.
        """
        doc_ref = self.users_collection.document(user_id)
        doc = doc_ref.get()
        if doc.exists:
            user_data = doc.to_dict()
            user_data['id'] = doc.id
            return User.from_dict(user_data)
        return None

    def get_all_users(self):
        """
        Retorna uma lista de todos os usuários.
        """
        users = []
        docs = self.users_collection.stream()
        for doc in docs:
            user_data = doc.to_dict()
            user_data['id'] = doc.id
            users.append(User.from_dict(user_data))
        return users

    def get_users_by_role(self, role):
        """
        Retorna uma lista de usuários com uma função (role) específica.
        """
        users = []
        docs = self.users_collection.where('role', '==', role).stream()
        for doc in docs:
            user_data = doc.to_dict()
            user_data['id'] = doc.id
            users.append(User.from_dict(user_data))
        return users

    def update_user(self, user_id, update_data):
        """
        Atualiza dados de um usuário existente.
        Se 'password' estiver em update_data, a senha será hashed antes de atualizar.
        """
        if 'password' in update_data and update_data['password']:
            update_data['password_hash'] = bcrypt.hashpw(update_data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            del update_data['password']

        update_data['updated_at'] = datetime.now()
        
        user_ref = self.users_collection.document(user_id)
        user_ref.update(update_data)
        print(f"Usuário com ID '{user_id}' atualizado.")
        return True

    def delete_user(self, user_id):
        """
        Deleta um usuário pelo ID.
        """
        self.users_collection.document(user_id).delete()
        print(f"Usuário com ID '{user_id}' deletado.")
        return True
