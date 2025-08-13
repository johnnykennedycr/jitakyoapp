from firebase_admin import firestore
from models.teacher import Teacher
from models.discipline_graduation import DisciplineGraduation # NOVO: Importa o novo modelo
from datetime import datetime # Para updated_at

class TeacherService:
    def __init__(self, db):
        self.db = db
        self.teachers_collection = self.db.collection('teachers')

    def create_teacher(self, name, contact_info, disciplines_data, description):
        """
        Cria um novo professor no Firestore.
        `disciplines_data` deve ser uma lista de dicionários no formato {'discipline_name': '...', 'graduation': '...'}.
        """
        disciplines_objects = [DisciplineGraduation(**d) for d in disciplines_data] # Converte para objetos DisciplineGraduation

        teacher = Teacher(
            name=name,
            contact_info=contact_info,
            disciplines=disciplines_objects, # Usa a nova lista de objetos
            description=description
        )
        teacher_dict = teacher.to_dict()
        doc_ref = self.teachers_collection.add(teacher_dict)

        teacher.id = doc_ref[1].id
        print(f"Professor '{teacher.name}' criado com ID: {teacher.id}")
        return teacher

    def get_teacher_by_id(self, teacher_id):
        """
        Busca um professor pelo ID.
        Retorna o objeto Teacher ou None se não encontrado.
        """
        doc_ref = self.teachers_collection.document(teacher_id)
        doc = doc_ref.get()
        if doc.exists:
            teacher_data = doc.to_dict()
            teacher_data['id'] = doc.id
            return Teacher.from_dict(teacher_data)
        return None

    def get_all_teachers(self):
        """
        Retorna uma lista de todos os professores.
        """
        teachers = []
        docs = self.teachers_collection.stream()
        for doc in docs:
            teacher_data = doc.to_dict()
            teacher_data['id'] = doc.id
            teachers.append(Teacher.from_dict(teacher_data))
        return teachers

    def update_teacher(self, teacher_id, update_data):
        """
        Atualiza dados de um professor existente.
        `update_data` é um dicionário com os campos a serem atualizados.
        Se 'disciplines' estiver em update_data, ele deve ser uma lista de dicionários.
        """
        # NOVO: Converte dicionários de disciplina para objetos DisciplineGraduation
        if 'disciplines' in update_data:
            update_data['disciplines'] = [DisciplineGraduation(**d).to_dict() for d in update_data['disciplines']]

        update_data['updated_at'] = datetime.now() # Atualiza o timestamp de atualização
        
        teacher_ref = self.teachers_collection.document(teacher_id)
        teacher_ref.update(update_data)
        print(f"Professor com ID '{teacher_id}' atualizado.")
        return True

    def delete_teacher(self, teacher_id):
        """
        Deleta um professor pelo ID.
        """
        self.teachers_collection.document(teacher_id).delete()
        print(f"Professor com ID '{teacher_id}' deletado.")
        return True