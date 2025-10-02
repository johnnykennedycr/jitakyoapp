from firebase_admin import auth, firestore
from flask_mail import Message
from app.models.user import User

class UserService:
    def __init__(self, db, mail=None):
        self.db = db
        self.collection = self.db.collection('users')
        self.mail = mail
        self.enrollment_service = None

    def set_enrollment_service(self, enrollment_service):
        self.enrollment_service = enrollment_service

    def create_user(self, data):
        try:
            email = data['email']
            password = data['password']
            name = data['name']
            role = data.get('role', 'student') 

            firebase_user = auth.create_user(email=email, password=password, display_name=name)
            
            user_data = {
                'name': name,
                'email': email,
                'role': role,
                'created_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP
            }
            self.collection.document(firebase_user.uid).set(user_data)
            
            user_data['id'] = firebase_user.uid
            return User.from_dict(user_data, firebase_user.uid)
        except Exception as e:
            print(f"Erro ao criar utilizador: {e}")
            raise

    def get_user_by_id(self, uid):
        try:
            doc = self.collection.document(uid).get()
            if doc.exists:
                return User.from_dict(doc.to_dict(), doc.id)
            return None
        except Exception as e:
            print(f"Erro ao buscar utilizador por ID {uid}: {e}")
            return None

    def get_users_by_role(self, role):
        users = []
        try:
            docs = self.collection.where(filter=firestore.FieldFilter('role', '==', role)).stream()
            for doc in docs:
                users.append(User.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar utilizadores pela role '{role}': {e}")
        return users

    def get_all_users_as_dicts(self):
        """ Retorna todos os utilizadores como uma lista de dicionários. """
        users_list = []
        try:
            docs = self.collection.stream()
            for doc in docs:
                user = User.from_dict(doc.to_dict(), doc.id)
                users_list.append(user.to_dict())
        except Exception as e:
            print(f"Erro ao buscar todos os utilizadores: {e}")
        return users_list

    def delete_user(self, uid):
        try:
            # Primeiro, deleta as matrículas associadas, se o serviço estiver disponível
            if self.enrollment_service:
                self.enrollment_service.delete_enrollments_by_student_id(uid)
            
            # Deleta do Firestore
            self.collection.document(uid).delete()
            # Deleta do Firebase Authentication
            auth.delete_user(uid)
            return True
        except Exception as e:
            print(f"Erro ao deletar utilizador {uid}: {e}")
            return False

    def update_user(self, uid, data):
        try:
            # Atualiza no Firestore
            user_ref = self.collection.document(uid)
            update_data = {
                'name': data.get('name'),
                'email': data.get('email'),
                'updated_at': firestore.SERVER_TIMESTAMP
            }
            # Remove chaves com valor None para não sobrescrever campos existentes com nada
            update_data = {k: v for k, v in update_data.items() if v is not None}
            user_ref.update(update_data)
            
            # Atualiza no Firebase Authentication
            auth.update_user(uid, email=data.get('email'), display_name=data.get('name'))

            return self.get_user_by_id(uid)
        except Exception as e:
            print(f"Erro ao atualizar utilizador {uid}: {e}")
            raise
