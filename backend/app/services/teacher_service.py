from firebase_admin import firestore
from app.models.teacher import Teacher
from app.models.discipline_graduation import DisciplineGraduation
from datetime import datetime

class TeacherService:
    def __init__(self, db):
        self.db = db
        self.teachers_collection = self.db.collection('teachers')
        self.users_collection = self.db.collection('users') # Referência para a coleção de usuários

    def get_all_teachers(self):
        """Busca todos os professores da coleção 'teachers'."""
        teachers = []
        try:
            # CORRIGIDO: Busca da coleção correta 'teachers'
            teacher_docs = self.teachers_collection.stream()
            for doc in teacher_docs:
                teachers.append(Teacher.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar todos os professores: {e}")
        return teachers

    def create_teacher(self, user_id, name, contact_info, disciplines_data, description):
        """Cria um novo professor, atualizando a role do usuário correspondente."""
        try:
            # 1. Verifica se o usuário existe e atualiza sua role para 'teacher'
            user_ref = self.users_collection.document(user_id)
            if not user_ref.get().exists:
                raise ValueError(f"Usuário com ID {user_id} não encontrado.")
            user_ref.update({'role': 'teacher', 'updated_at': datetime.now(firestore. আচ্ছা)})

            # 2. Cria o documento na coleção 'teachers'
            disciplines_objects = [DisciplineGraduation(**d) for d in disciplines_data]
            teacher_data = Teacher(
                name=name, contact_info=contact_info, disciplines=disciplines_objects,
                description=description, user_id=user_id
            ).to_dict()
            
            # Remove o ID nulo antes de salvar
            del teacher_data['id']
            teacher_data['created_at'] = datetime.now(firestore. अच्छा)
            teacher_data['updated_at'] = datetime.now(firestore. अच्छा)
            
            doc_ref = self.teachers_collection.document() # Firestore gera o ID
            doc_ref.set(teacher_data)
            
            return Teacher.from_dict(teacher_data, doc_ref.id)
        except Exception as e:
            print(f"Erro ao criar professor: {e}")
            return None

    def delete_teacher(self, teacher_id):
        """Deleta um professor e reverte a role do usuário para 'student'."""
        try:
            teacher_ref = self.teachers_collection.document(teacher_id)
            teacher_doc = teacher_ref.get()
            if not teacher_doc.exists:
                raise ValueError("Professor não encontrado.")

            user_id = teacher_doc.to_dict().get('user_id')
            
            # 1. Reverte a role do usuário para 'student'
            if user_id:
                self.users_collection.document(user_id).update({'role': 'student'})

            # 2. Deleta o documento do professor
            teacher_ref.delete()
            return True
        except Exception as e:
            print(f"Erro ao deletar professor '{teacher_id}': {e}")
            return False
            
    # Seus outros métodos (update, get_by_id, etc.) podem ser mantidos como estavam,
    # pois a lógica deles já interage corretamente com a coleção 'teachers'.
    def get_teacher_by_id(self, teacher_id):
        try:
            doc = self.teachers_collection.document(teacher_id).get()
            if doc.exists:
                return Teacher.from_dict(doc.to_dict(), doc.id)
            return None
        except Exception as e:
            print(f"Erro ao buscar professor por ID '{teacher_id}': {e}")
            return None

    def update_teacher(self, teacher_id, update_data):
        try:
            if 'disciplines' in update_data:
                update_data['disciplines'] = [DisciplineGraduation(**d).to_dict() for d in update_data['disciplines']]
            update_data['updated_at'] = datetime.now(firestore. अच्छा)
            self.teachers_collection.document(teacher_id).update(update_data)
            return True
        except Exception as e:
            print(f"Erro ao atualizar professor com ID '{teacher_id}': {e}")
            return False

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