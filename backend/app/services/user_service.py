from datetime import datetime
from firebase_admin import firestore, auth
from app.models.user import User

class UserService:
    def __init__(self, db):
        self.db = db
        self.users_collection = self.db.collection('users')
        self.enrollments_collection = self.db.collection('enrollments') # Referência para matrículas

    def create_user_with_enrollments(self, user_data, enrollments_data):
        """
        Cria um usuário no Firebase Auth e seu perfil no Firestore,
        juntamente com múltiplas matrículas, em uma única transação.
        """
        try:
            # 1. Cria o usuário no Firebase Authentication
            new_auth_user = auth.create_user(
                email=user_data.get('email'),
                password=user_data.get('password'),
                display_name=user_data.get('name')
            )
            user_id = new_auth_user.uid

            # Inicia um batch para garantir que todas as operações sejam atômicas
            batch = self.db.batch()

            # 2. Prepara o perfil do usuário para o Firestore
            profile_data = {
                'name': user_data.get('name'),
                'email': user_data.get('email'),
                'role': 'student',
                'phone': user_data.get('phone'),
                'date_of_birth': datetime.strptime(user_data.get('date_of_birth'), '%Y-%m-%d') if user_data.get('date_of_birth') else None,
                'guardians': user_data.get('guardians', []),
                'enrolled_disciplines': user_data.get('enrolled_disciplines', []),
                'created_at': datetime.now(),
                'updated_at': datetime.now()
            }
            user_ref = self.users_collection.document(user_id)
            batch.set(user_ref, profile_data)

            # 3. Prepara as matrículas para serem adicionadas ao batch
            for enroll_data in enrollments_data:
                enrollment_ref = self.enrollments_collection.document()
                enrollment_record = {
                    'student_id': user_id,
                    'class_id': enroll_data.get('class_id'),
                    'status': 'active',
                    'enrollment_date': datetime.now(),
                    'base_monthly_fee': enroll_data.get('base_monthly_fee'),
                    'due_day': 10, # Ou um valor padrão
                    'discount_amount': float(enroll_data.get('discount_amount', 0)),
                    'discount_reason': enroll_data.get('discount_reason', ""),
                    'created_at': datetime.now(),
                    'updated_at': datetime.now()
                }
                batch.set(enrollment_ref, enrollment_record)

            # 4. Executa todas as operações de uma vez
            batch.commit()
            
            return self.get_user_by_id(user_id)
        except Exception as e:
            print(f"Erro ao criar usuário com matrículas: {e}")
            # Se a criação no Auth funcionou mas o Firestore falhou, deleta o usuário do Auth para consistência
            if 'new_auth_user' in locals():
                auth.delete_user(new_auth_user.uid)
            return None
    
    # Seus outros métodos (get_user_by_id, update_user, etc.) permanecem aqui
    def get_user_by_id(self, user_id):
        try:
            doc = self.users_collection.document(user_id).get()
            if doc.exists:
                return User.from_dict(doc.to_dict(), doc.id)
            return None
        except Exception as e:
            print(f"ERRO CRÍTICO em get_user_by_id: {e}")
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
    
    def update_user(self, user_id, update_data):
        try:
            update_data['updated_at'] = datetime.now()
            self.users_collection.document(user_id).update(update_data)
            return True
        except Exception as e:
            print(f"Erro ao atualizar usuário '{user_id}': {e}")
            return False

    def delete_user(self, user_id):
        # Esta função precisará ser expandida para também deletar matrículas associadas
        try:
            self.users_collection.document(user_id).delete()
            auth.delete_user(user_id)
            return True
        except Exception as e:
            print(f"Erro ao deletar usuário com ID '{user_id}': {e}")
            return False

