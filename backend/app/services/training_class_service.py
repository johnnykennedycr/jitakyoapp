from datetime import datetime
from firebase_admin import firestore
from app.models.training_class import TrainingClass
from app.models.schedule_slot import ScheduleSlot

class TrainingClassService:
    def __init__(self, db, teacher_service=None):
        self.db = db
        self.teacher_service = teacher_service
        self.collection = self.db.collection('classes')

    def get_all_classes(self):
        """
        Busca todas as turmas e retorna uma lista de dicionários enriquecidos,
        prontos para serem convertidos em JSON.
        """
        classes_data = []
        try:
            all_teachers = self.teacher_service.get_all_teachers()
            teacher_map = {teacher.id: teacher.name for teacher in all_teachers}
            
            docs = self.collection.stream()
            for doc in docs:
                class_dict = doc.to_dict()
                class_dict['id'] = doc.id
                
                # Enriquece com o nome do professor
                class_dict['teacher_name'] = teacher_map.get(class_dict.get('teacher_id'), 'N/A')
                
                # Garante que o vencimento padrão existe para consistência da UI
                if 'default_due_day' not in class_dict:
                    class_dict['default_due_day'] = 15 
                
                classes_data.append(class_dict)
        except Exception as e:
            print(f"Erro ao buscar todas as turmas: {e}")
        return classes_data

    def get_class_by_id(self, class_id):
        """Busca uma turma específica e retorna um objeto TrainingClass."""
        try:
            doc = self.collection.document(class_id).get()
            if doc.exists:
                return TrainingClass.from_dict(doc.to_dict(), class_id)
            return None
        except Exception as e:
            print(f"Erro ao buscar turma por ID '{class_id}': {e}")
            return None
            
    # --- NOVO MÉTODO ADICIONADO ---
    def get_class_by_id_as_dict(self, class_id):
        """Busca uma turma específica e retorna um dicionário enriquecido."""
        try:
            class_obj = self.get_class_by_id(class_id)
            if not class_obj:
                return None
            
            class_dict = class_obj.to_dict()
            if class_obj.teacher_id and self.teacher_service:
                teacher = self.teacher_service.get_teacher_by_id(class_obj.teacher_id)
                class_dict['teacher_name'] = teacher.name if teacher else 'N/A'
            else:
                class_dict['teacher_name'] = 'N/A'
            
            # Garante consistência dos dados para turmas antigas
            if 'default_due_day' not in class_dict:
                class_dict['default_due_day'] = 15

            return class_dict
        except Exception as e:
            print(f"Erro ao buscar turma como dicionário por ID '{class_id}': {e}")
            return None

    def create_class(self, data):
        """Cria uma nova turma e retorna um dicionário enriquecido."""
        try:
            schedule_objects = [ScheduleSlot(**s).to_dict() for s in data.get('schedule', [])]
            
            class_data = {
                'name': data.get('name'),
                'discipline': data.get('discipline'),
                'teacher_id': data.get('teacher_id'),
                'capacity': int(data.get('capacity', 0)),
                'default_monthly_fee': float(data.get('default_monthly_fee', 0)),
                'default_due_day': int(data.get('default_due_day', 15)),
                'schedule': schedule_objects,
                'created_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP
            }
            
            doc_ref = self.collection.document()
            doc_ref.set(class_data)
            
            # Retorna o dicionário completo para a API
            return self.get_class_by_id_as_dict(doc_ref.id)
        except Exception as e:
            print(f"Erro ao criar turma: {e}")
            raise e

    def update_class(self, class_id, data):
        """Atualiza uma turma existente."""
        try:
            if 'schedule' in data:
                data['schedule'] = [ScheduleSlot(**s).to_dict() for s in data.get('schedule', [])]
            
            data['updated_at'] = firestore.SERVER_TIMESTAMP
            self.collection.document(class_id).update(data)
            return True
        except Exception as e:
            print(f"Erro ao atualizar turma com ID '{class_id}': {e}")
            return False

    def delete_class(self, class_id):
        """Deleta uma turma pelo seu ID."""
        try:
            self.collection.document(class_id).delete()
            return True
        except Exception as e:
            print(f"Erro ao deletar turma com ID '{class_id}': {e}")
            return False

