from datetime import datetime
from firebase_admin import firestore, auth
from app.models.user import User

class UserService:
    def __init__(self, db, enrollment_service, mail):
        self.db = db
        self.enrollment_service = enrollment_service
        self.mail = mail
        self.users_collection = self.db.collection('users')

    def create_user_with_enrollments(self, user_data, enrollments_data):
        # ... (código existente, sem alterações)
        try:
            # 1. Gera uma senha segura temporária
            alphabet = string.ascii_letters + string.digits
            temp_password = ''.join(secrets.choice(alphabet) for i in range(10))

            # 2. Cria o usuário no Firebase Authentication com a senha gerada
            auth_user = auth.create_user(
                email=user_data.get('email'),
                password=temp_password,
                display_name=user_data.get('name')
            )
            
            # 3. Prepara os dados para o Firestore (sem a senha)
            firestore_data = user_data.copy()
            if 'password' in firestore_data:
                del firestore_data['password'] # Garante que a senha nunca seja salva
            firestore_data['role'] = 'student'
            
            if 'date_of_birth' in firestore_data and isinstance(firestore_data['date_of_birth'], str) and firestore_data['date_of_birth']:
                try:
                    firestore_data['date_of_birth'] = datetime.strptime(firestore_data['date_of_birth'], '%Y-%m-%d')
                except (ValueError, TypeError):
                    firestore_data['date_of_birth'] = None
            
            firestore_data['created_at'] = datetime.now()
            firestore_data['updated_at'] = datetime.now()

            # 4. Cria o documento do usuário no Firestore
            self.users_collection.document(auth_user.uid).set(firestore_data)
            
            # 5. Cria as matrículas, se houver
            if enrollments_data:
                for enrollment in enrollments_data:
                    enrollment['student_id'] = auth_user.uid
                    self.enrollment_service.create_enrollment(enrollment)
            
            # 6. Envia o e-mail de boas-vindas com a senha
            try:
                msg = Message(
                    'Bem-vindo(a) à JitaKyoApp!',
                    recipients=[user_data.get('email')]
                )
                msg.body = f"""Olá {user_data.get('name')},\n\nSua conta em nossa academia foi criada com sucesso. Aqui estão seus dados de acesso:\n\nEmail: {user_data.get('email')}\nSenha Temporária: {temp_password}\n\nRecomendamos que você altere sua senha assim que possível.\n\nAtenciosamente,\nEquipe JitaKyoApp"""
                self.mail.send(msg)
                print(f"E-mail de boas-vindas enviado para {user_data.get('email')}")
            except Exception as mail_error:
                # O usuário foi criado, mas o e-mail falhou. É importante logar isso.
                print(f"ATENÇÃO: Usuário {auth_user.uid} criado, mas falha ao enviar e-mail de boas-vindas: {mail_error}")

            return self.get_user_by_id(auth_user.uid)
        except Exception as e:
            print(f"Erro ao criar usuário com matrículas: {e}")
            raise e # Lança a exceção para a rota poder tratá-la


    def update_user(self, user_id, update_data):
        """Atualiza os dados de um usuário no Firestore e, opcionalmente, a senha no Firebase Auth."""
        try:
            # 1. Verifica se uma nova senha foi fornecida e a remove dos dados a serem salvos no DB
            new_password = update_data.pop('password', None)
            if new_password and new_password.strip(): # Garante que não é uma string vazia
                # 2. Usa o Admin SDK para atualizar a senha no Firebase Authentication
                auth.update_user(user_id, password=new_password)
                print(f"Senha do usuário '{user_id}' atualizada no Firebase Auth.")

            # 3. Converte a data de nascimento, se presente
            if 'date_of_birth' in update_data and isinstance(update_data['date_of_birth'], str) and update_data['date_of_birth']:
                 try:
                    update_data['date_of_birth'] = datetime.strptime(update_data['date_of_birth'], '%Y-%m-%d')
                 except (ValueError, TypeError):
                    update_data['date_of_birth'] = None

            # 4. Atualiza o timestamp e os outros dados no Firestore
            update_data['updated_at'] = datetime.now()
            self.users_collection.document(user_id).update(update_data)
            print(f"Dados do usuário '{user_id}' atualizados no Firestore.")
            return True
        except Exception as e:
            print(f"Erro ao atualizar usuário '{user_id}': {e}")
            raise e # Lança a exceção para que a rota possa tratá-la
            
    def get_user_by_id(self, user_id):
        # ... (código existente, sem alterações)
        try:
            doc = self.users_collection.document(user_id).get()
            if doc.exists:
                return User.from_dict(doc.to_dict(), doc.id)
            return None
        except Exception as e:
            print(f"Erro ao buscar usuário por ID '{user_id}': {e}")
            return None

    def get_users_by_role(self, role):
        # ... (código existente, sem alterações)
        users = []
        try:
            docs = self.users_collection.where('role', '==', role).stream()
            for doc in docs:
                users.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar usuários por role '{role}': {e}")
        return users

    def delete_user(self, user_id):
        # ... (código existente, sem alterações)
        try:
            enrollments = self.enrollment_service.get_enrollments_by_student_id(user_id)
            for enrollment in enrollments:
                self.enrollment_service.delete_enrollment(enrollment.id)
            self.users_collection.document(user_id).delete()
            auth.delete_user(user_id)
            print(f"Usuário com UID {user_id} e suas matrículas foram deletados com sucesso.")
            return True
        except Exception as e:
            print(f"Erro ao deletar usuário com ID '{user_id}': {e}")
            return False

