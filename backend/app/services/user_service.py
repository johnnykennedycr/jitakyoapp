from datetime import datetime
from firebase_admin import firestore, auth
from app.models.user import User
import string
import secrets
from flask_mail import Message

class UserService:
    def __init__(self, db, mail=None):
        """Inicializa o serviço com dependências diretas."""
        self.db = db
        self.mail = mail
        self.enrollment_service = None  # Será definido depois para evitar dependência circular
        self.users_collection = self.db.collection('users')

    def set_enrollment_service(self, enrollment_service):
        """
        Define o serviço de matrícula após a inicialização.
        Este método é crucial para resolver a dependência circular com EnrollmentService.
        """
        self.enrollment_service = enrollment_service

    def create_user_with_enrollments(self, user_data, enrollments_data):
        """
        Cria um novo usuário e suas matrículas.
        Gera uma senha aleatória e envia por e-mail.
        """
        email = user_data.get('email')
        if not email:
            raise ValueError("O e-mail é obrigatório.")

        try:
            auth.get_user_by_email(email)
            raise ValueError(f"O e-mail {email} já está em uso.")
        except auth.UserNotFoundError:
            pass  # O e-mail está disponível.

        alphabet = string.ascii_letters + string.digits
        password = ''.join(secrets.choice(alphabet) for i in range(10))

        try:
            auth_user = auth.create_user(
                email=email,
                password=password,
                display_name=user_data.get('name')
            )
            
            user_data['role'] = 'student'
            if 'password' in user_data:
                del user_data['password']

            if 'date_of_birth' in user_data and isinstance(user_data['date_of_birth'], str):
                try:
                    user_data['date_of_birth'] = datetime.strptime(user_data['date_of_birth'], '%Y-%m-%d')
                except ValueError:
                    del user_data['date_of_birth']

            user_data['created_at'] = datetime.now()
            user_data['updated_at'] = datetime.now()

            self.users_collection.document(auth_user.uid).set(user_data)
            
            if self.enrollment_service and enrollments_data:
                for enrollment_info in enrollments_data:
                    enrollment_info['student_id'] = auth_user.uid
                    self.enrollment_service.create_enrollment(enrollment_info)
            
            if self.mail:
                try:
                    msg = Message("Bem-vindo ao JitaKyoApp!", recipients=[email])
                    msg.body = f"Olá {user_data.get('name')},\n\nSua conta foi criada com sucesso.\nSua senha temporária é: {password}\n\nRecomendamos que você a altere no seu primeiro acesso."
                    self.mail.send(msg)
                    print(f"INFO: E-mail de boas-vindas para {email} enviado.")
                except Exception as e:
                    print(f"AVISO: Usuário {email} criado, mas o e-mail de boas-vindas falhou: {e}")

            return self.get_user_by_id(auth_user.uid)
        
        except Exception as e:
            print(f"Erro ao criar usuário com matrículas: {e}")
            raise e

    def update_user(self, user_id, update_data):
        """Atualiza os dados de um usuário."""
        try:
            if 'password' in update_data and update_data['password']:
                password = update_data.pop('password')
                auth.update_user(user_id, password=password)

            if 'date_of_birth' in update_data and isinstance(update_data['date_of_birth'], str):
                try:
                    update_data['date_of_birth'] = datetime.strptime(update_data['date_of_birth'], '%Y-%m-%d')
                except ValueError:
                    del update_data['date_of_birth']

            update_data['updated_at'] = datetime.now()
            self.users_collection.document(user_id).update(update_data)
            return True
        except Exception as e:
            print(f"Erro ao atualizar usuário '{user_id}': {e}")
            return False

    def delete_user(self, user_id):
        """Deleta um usuário, suas matrículas e do Firebase Auth."""
        try:
            # Tenta deletar do Firebase Auth primeiro
            try:
                auth.delete_user(user_id)
            except auth.UserNotFoundError:
                print(f"AVISO: Usuário {user_id} não encontrado no Firebase Auth, mas a limpeza continuará.")
            
            # Deleta as matrículas associadas
            if self.enrollment_service:
                self.enrollment_service.delete_enrollments_by_student_id(user_id)
            
            # Deleta o registro do usuário do Firestore
            self.users_collection.document(user_id).delete()
            
            print(f"Usuário com UID {user_id} e seus dados foram deletados com sucesso.")
            return True
        except Exception as e:
            print(f"Erro ao deletar usuário {user_id}: {e}")
            raise e

    def get_user_by_id(self, user_id, enrich_with_enrollments=False):
        """Busca um usuário por ID, opcionalmente enriquecendo com suas matrículas."""
        try:
            doc = self.users_collection.document(user_id).get()
            if not doc.exists:
                return None
            
            user = User.from_dict(doc.to_dict(), doc.id)
            
            if enrich_with_enrollments and self.enrollment_service:
                user.enrollments = self.enrollment_service.get_enrollments_by_student_id(user.id)
            else:
                user.enrollments = [] # Garante que o atributo sempre exista

            return user
        except Exception as e:
            print(f"Erro ao buscar usuário por ID '{user_id}': {e}")
            return None
            
    def get_users_by_role(self, role):
        users = []
        try:
            docs = self.users_collection.where('role', '==', role).stream()
            for doc in docs:
                users.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar usuários por role '{role}': {e}")
        return users
        
    def get_students_with_enrollments(self):
        """
        Busca todos os usuários com a role 'student' e enriquece cada objeto
        com a lista de suas matrículas ativas.
        """
        students = []
        try:
            student_docs = self.users_collection.where('role', '==', 'student').stream()
            for doc in student_docs:
                student = User.from_dict(doc.to_dict(), doc.id)
                
                if self.enrollment_service:
                    student.enrollments = self.enrollment_service.get_enrollments_by_student_id(student.id)
                else:
                    student.enrollments = []
                    
                students.append(student)
        except Exception as e:
            print(f"Erro ao buscar alunos com matrículas: {e}")
        return students

    def get_available_users_for_promotion(self):
        """Retorna usuários que ainda não são professores."""
        # Esta é uma abordagem simples. Para performance em larga escala,
        # seria melhor buscar todos os user_ids da coleção de professores e
        # usar um filtro 'not-in' na query de usuários.
        all_users = self.get_users_by_role('student') # Simplificação: considera apenas alunos
        return all_users


