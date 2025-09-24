from firebase_admin import firestore
from app.models.teacher import Teacher
from app.models.discipline_graduation import DisciplineGraduation
from datetime import datetime

class TeacherService:
    def __init__(self, db, user_service):
        self.db = db
        self.user_service = user_service
        self.teachers_collection = self.db.collection('teachers')
        self.users_collection = self.db.collection('users')

    def get_all_teachers(self):
        teachers = []
        try:
            teacher_docs = self.teachers_collection.stream()
            for doc in teacher_docs:
                teachers.append(Teacher.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar todos os professores: {e}")
        return teachers

    def create_teacher(self, data):
        """Promove um usuário a professor e cria seu perfil de professor."""
        user_id = data.get('user_id')
        if not user_id:
            raise ValueError("O ID do usuário é obrigatório.")

        try:
            # Usando o user_service para centralizar a lógica de usuário
            user = self.user_service.get_user_by_id(user_id)
            if not user:
                raise ValueError(f"Usuário com ID {user_id} não encontrado.")

            # Verifica se o usuário já é um professor
            if self.get_teacher_by_user_id(user_id):
                 raise ValueError(f"O usuário {user.name} já é um professor.")

            # Atualiza a role do usuário para 'teacher'
            self.users_collection.document(user_id).update({'role': 'teacher', 'updated_at': datetime.now()})

            disciplines_data = data.get('disciplines', [])
            disciplines_objects = [DisciplineGraduation(**d) for d in disciplines_data]

            teacher_data = {
                'user_id': user_id,
                'name': user.name, # Pega o nome do perfil do usuário
                'contact_info': data.get('contact_info'),
                'disciplines': [d.to_dict() for d in disciplines_objects],
                'description': data.get('description'),
                'created_at': datetime.now(),
                'updated_at': datetime.now()
            }
            
            # Adiciona o novo professor à coleção 'teachers'
            doc_ref = self.teachers_collection.document()
            doc_ref.set(teacher_data)
            
            return Teacher.from_dict(teacher_data, doc_ref.id)
        except Exception as e:
            print(f"Erro ao criar professor: {e}")
            # Re-lança a exceção para que a rota possa tratá-la
            raise e

    def update_teacher(self, teacher_id, update_data):
        """Atualiza dados de um professor existente."""
        try:
            if 'disciplines' in update_data:
                update_data['disciplines'] = [DisciplineGraduation(**d).to_dict() for d in update_data['disciplines']]

            update_data['updated_at'] = datetime.now()
            
            self.teachers_collection.document(teacher_id).update(update_data)
            print(f"Professor com ID '{teacher_id}' atualizado.")
            return True
        except Exception as e:
            print(f"Erro ao atualizar professor com ID '{teacher_id}': {e}")
            return False

    def delete_teacher(self, teacher_id):
        """Rebaixa um professor para aluno, deletando seu perfil de professor."""
        try:
            teacher_ref = self.teachers_collection.document(teacher_id)
            teacher_doc = teacher_ref.get()
            if not teacher_doc.exists:
                raise ValueError("Professor não encontrado.")

            user_id = teacher_doc.to_dict().get('user_id')
            
            if user_id:
                # Rebaixa a role do usuário de volta para 'student'
                self.users_collection.document(user_id).update({'role': 'student', 'updated_at': datetime.now()})

            # Deleta o documento da coleção 'teachers'
            teacher_ref.delete()
            return True
        except Exception as e:
            print(f"Erro ao deletar professor '{teacher_id}': {e}")
            return False
            
    def get_teacher_by_id(self, teacher_id):
        try:
            doc = self.teachers_collection.document(teacher_id).get()
            if doc.exists:
                return Teacher.from_dict(doc.to_dict(), doc.id)
            return None
        except Exception as e:
            print(f"Erro ao buscar professor por ID '{teacher_id}': {e}")
            return None

    def get_teacher_by_user_id(self, user_id):
        try:
            docs = self.teachers_collection.where('user_id', '==', user_id).limit(1).stream()
            teacher_doc = next(docs, None)
            if teacher_doc:
                return Teacher.from_dict(teacher_doc.to_dict(), teacher_doc.id)
            return None
        except Exception as e:
            print(f"Erro ao buscar professor por user_id '{user_id}': {e}")
            return None
