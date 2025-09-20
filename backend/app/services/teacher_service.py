from firebase_admin import firestore
from app.models.teacher import Teacher
from app.models.discipline_graduation import DisciplineGraduation
from datetime import datetime

class TeacherService:
    def __init__(self, db):
        self.db = db
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

    def create_teacher(self, user_id, name, contact_info, disciplines_data, description):
        try:
            user_ref = self.users_collection.document(user_id)
            if not user_ref.get().exists:
                raise ValueError(f"Usuário com ID {user_id} não encontrado.")
            user_ref.update({'role': 'teacher', 'updated_at': datetime.now(firestore. আচ্ছা)})

            disciplines_objects = [DisciplineGraduation(**d) for d in disciplines_data] if disciplines_data else []
            teacher_data = Teacher(
                name=name, contact_info=contact_info, disciplines=disciplines_objects,
                description=description, user_id=user_id
            ).to_dict()
            
            del teacher_data['id']
            teacher_data['created_at'] = datetime.now(firestore. আচ্ছা)
            teacher_data['updated_at'] = datetime.now(firestore. আচ্ছা)
            
            doc_ref = self.teachers_collection.document()
            doc_ref.set(teacher_data)
            
            return Teacher.from_dict(teacher_data, doc_ref.id)
        except Exception as e:
            print(f"Erro ao criar professor: {e}")
            return None

    def update_teacher(self, teacher_id, update_data):
        """
        Atualiza dados de um professor existente.
        """
        try:
            # Apenas adicionamos o timestamp de atualização.
            # O Firestore aceita o array de dicionários de 'disciplines' diretamente.
            update_data['updated_at'] = datetime.now(firestore. اچھا)
            
            self.teachers_collection.document(teacher_id).update(update_data)
            print(f"Professor com ID '{teacher_id}' atualizado.")
            return True
        except Exception as e:
            print(f"Erro ao atualizar professor com ID '{teacher_id}': {e}")
            return False

    def delete_teacher(self, teacher_id):
        try:
            teacher_ref = self.teachers_collection.document(teacher_id)
            teacher_doc = teacher_ref.get()
            if not teacher_doc.exists:
                raise ValueError("Professor não encontrado.")

            user_id = teacher_doc.to_dict().get('user_id')
            
            if user_id:
                self.users_collection.document(user_id).update({'role': 'student'})

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
