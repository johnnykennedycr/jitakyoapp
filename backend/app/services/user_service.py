from datetime import datetime, date
from firebase_admin import firestore, auth
from flask_mail import Message
from app.models.user import User
import string
import secrets

class UserService:
    def __init__(self, db, mail=None):
        self.db = db
        self.mail = mail
        self.enrollment_service = None # Será injetado depois para evitar dependência circular
        self.users_collection = self.db.collection('users')
    
    def set_enrollment_service(self, enrollment_service):
        """Injeta o EnrollmentService após a inicialização para quebrar dependências circulares."""
        self.enrollment_service = enrollment_service

    def create_user_with_enrollments(self, user_data, enrollments_data):
        """
        Cria um novo usuário e suas matrículas de forma transacional.
        Gera uma senha aleatória e envia por e-mail.
        """
        email = user_data.get('email')
        if not email:
            raise ValueError("O e-mail é obrigatório.")

        try:
            auth.get_user_by_email(email)
            raise ValueError(f"O e-mail {email} já está em uso.")
        except auth.UserNotFoundError:
            pass

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
                except (ValueError, TypeError):
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
                    print(f"INFO: E-mail de boas-vindas para {email} enviado com sucesso.")
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
                except (ValueError, TypeError):
                    del update_data['date_of_birth']

            update_data['updated_at'] = datetime.now()
            self.users_collection.document(user_id).update(update_data)
            return True
        except Exception as e:
            print(f"Erro ao atualizar usuário '{user_id}': {e}")
            return False

    def delete_user(self, user_id):
        """Deleta um usuário do Firebase Auth, do Firestore e suas matrículas."""
        try:
            try:
                auth.delete_user(user_id)
            except auth.UserNotFoundError:
                print(f"AVISO: Usuário com UID {user_id} não encontrado no Firebase Auth. Prosseguindo com a limpeza do Firestore.")
                pass

            if self.enrollment_service:
                self.enrollment_service.delete_enrollments_by_student_id(user_id)
                print(f"Matrículas do aluno {user_id} deletadas com sucesso.")

            self.users_collection.document(user_id).delete()
            
            print(f"Usuário com UID {user_id} e seus dados foram deletados com sucesso.")
            return True
        except Exception as e:
            print(f"Erro inesperado ao deletar usuário {user_id}: {e}")
            raise e

    def get_user_by_id(self, user_id):
        try:
            doc = self.users_collection.document(user_id).get()
            return User.from_dict(doc.to_dict(), doc.id) if doc.exists else None
        except Exception as e:
            print(f"Erro ao buscar usuário por ID '{user_id}': {e}")
            return None
            
    def get_users_by_role(self, role):
        users = []
        try:
            docs = self.users_collection.where(filter=firestore.FieldFilter('role', '==', role)).stream()
            for doc in docs:
                users.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar usuários por role '{role}': {e}")
        return users
        
    def get_students_with_enrollments(self):
        """Busca todos os alunos e enriquece cada um com suas matrículas."""
        students = self.get_users_by_role('student')
        for student in students:
            if self.enrollment_service:
                student.enrollments = self.enrollment_service.get_enrollments_by_student_id(student.id)
            else:
                student.enrollments = []
        return students

    # --- MÉTODO CORRIGIDO ---
    def search_students_by_name(self, search_term):
        """
        Busca alunos por um termo no nome, de forma case-insensitive.
        Retorna apenas alunos que não são professores.
        """
        students = []
        try:
            all_students = self.get_users_by_role('student')
            
            if search_term:
                search_term_lower = search_term.lower()
                for student in all_students:
                    if student.name and student.name.lower().startswith(search_term_lower):
                        students.append(student)
            # Se não houver termo de busca, retorna uma lista vazia,
            # pois o frontend espera isso para não sobrecarregar a UI.
            
        except Exception as e:
            print(f"Erro ao buscar alunos por nome: {e}")
    
        return students

