from firebase_admin import firestore
from app.models.teacher import Teacher
from app.models.discipline_graduation import DisciplineGraduation
from datetime import datetime

class TeacherService:
    def __init__(self, db):
        self.db = db
        self.collection = self.db.collection('teachers')

    def _doc_to_teacher(self, doc):
        """Função auxiliar para converter um doc do Firestore em um objeto Teacher."""
        if not doc.exists:
            return None
        teacher = Teacher.from_dict(doc.to_dict())
        teacher.id = doc.id
        return teacher

    def create_teacher(self, name, contact_info, disciplines_data, description, user_id=None):
        """
        Cria um novo professor no Firestore.
        """
        try:
            disciplines_objects = [DisciplineGraduation(**d) for d in disciplines_data]

            teacher = Teacher(
                name=name,
                contact_info=contact_info,
                disciplines=disciplines_objects,
                description=description,
                user_id=user_id
            )
            
            teacher_dict = teacher.to_dict()
            teacher_dict['created_at'] = datetime.now()
            teacher_dict['updated_at'] = datetime.now()
            
            timestamp, doc_ref = self.collection.add(teacher_dict)

            teacher.id = doc_ref.id
            print(f"Professor '{teacher.name}' criado com ID: {teacher.id}")
            return teacher
        except Exception as e:
            print(f"Erro ao criar professor: {e}")
            return None

    def get_teacher_by_id(self, teacher_id):
        """
        Busca um professor pelo ID.
        """
        try:
            doc = self.collection.document(teacher_id).get()
            return self._doc_to_teacher(doc)
        except Exception as e:
            print(f"Erro ao buscar professor por ID '{teacher_id}': {e}")
            return None

    def get_all_teachers(self):
        """
        Retorna uma lista de todos os professores.
        """
        teachers = []
        try:
            docs = self.collection.order_by("name").stream()
            for doc in docs:
                teachers.append(self._doc_to_teacher(doc))
        except Exception as e:
            print(f"Erro ao buscar todos os professores: {e}")
        return teachers

    def update_teacher(self, teacher_id, update_data):
        """
        Atualiza dados de um professor existente.
        """
        try:
            if 'disciplines' in update_data:
                update_data['disciplines'] = [DisciplineGraduation(**d).to_dict() for d in update_data['disciplines']]

            update_data['updated_at'] = datetime.now()
            
            self.collection.document(teacher_id).update(update_data)
            print(f"Professor com ID '{teacher_id}' atualizado.")
            return True
        except Exception as e:
            print(f"Erro ao atualizar professor com ID '{teacher_id}': {e}")
            return False

    def delete_teacher(self, teacher_id):
        """
        Deleta um professor pelo ID.
        """
        try:
            self.collection.document(teacher_id).delete()
            print(f"Professor com ID '{teacher_id}' deletado.")
            return True
        except Exception as e:
            print(f"Erro ao deletar professor com ID '{teacher_id}': {e}")
            return False
    
    def get_teacher_by_user_id(self, user_id):
        """Busca um professor pelo ID do seu usuário correspondente."""
        try:
            teacher_docs = self.collection.where('user_id', '==', user_id).limit(1).stream()
            for doc in teacher_docs:
                return self._doc_to_teacher(doc) # Retorna o primeiro encontrado
            return None
        except Exception as e:
            print(f"Erro ao buscar professor por user_id '{user_id}': {e}")
            return None