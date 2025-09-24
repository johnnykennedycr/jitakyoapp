from datetime import datetime
from firebase_admin import firestore
from app.models.training_class import TrainingClass
from app.models.schedule_slot import ScheduleSlot

class TrainingClassService:
    def __init__(self, db, teacher_service):
        self.db = db
        self.teacher_service = teacher_service
        self.collection = self.db.collection('classes')

    def get_all_classes(self):
        """Busca todas as turmas e enriquece com o nome do professor e vencimento padrão."""
        classes = []
        try:
            all_teachers = self.teacher_service.get_all_teachers()
            teacher_map = {teacher.id: teacher.name for teacher in all_teachers}
            
            docs = self.collection.stream()
            for doc in docs:
                class_data = doc.to_dict()
                class_obj = TrainingClass.from_dict(class_data, doc.id)
                
                # Enriquece com o nome do professor
                class_obj.teacher_name = teacher_map.get(class_obj.teacher_id, 'N/A')
                
                # Garante que o vencimento padrão exista para compatibilidade com dados antigos
                if 'default_due_day' not in class_data:
                    class_obj.default_due_day = 15  # Padrão do sistema
                
                classes.append(class_obj)
        except Exception as e:
            print(f"Erro ao buscar todas as turmas: {e}")
        return classes

    def get_class_by_id(self, class_id):
        """Busca uma turma específica e enriquece com dados."""
        try:
            doc = self.collection.document(class_id).get()
            if doc.exists:
                class_data = doc.to_dict()
                class_obj = TrainingClass.from_dict(class_data, class_id)
                
                # Enriquece com o nome do professor
                if class_obj.teacher_id:
                    teacher = self.teacher_service.get_teacher_by_id(class_obj.teacher_id)
                    class_obj.teacher_name = teacher.name if teacher else 'N/A'
                else:
                    class_obj.teacher_name = 'N/A'
                
                # Garante que o vencimento padrão exista
                if 'default_due_day' not in class_data:
                    class_obj.default_due_day = 15

                return class_obj
            return None
        except Exception as e:
            print(f"Erro ao buscar turma por ID '{class_id}': {e}")
            return None

    def create_class(self, data):
        """Cria uma nova turma no Firestore."""
        try:
            schedule_objects = [ScheduleSlot(**s).to_dict() for s in data.get('schedule', [])]
            
            class_data = {
                'name': data.get('name'),
                'discipline': data.get('discipline'),
                'teacher_id': data.get('teacher_id'),
                'capacity': data.get('capacity'),
                'description': data.get('description'),
                'default_monthly_fee': data.get('default_monthly_fee'),
                'default_due_day': int(data.get('default_due_day', 15)),
                'schedule': schedule_objects,
                'created_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP
            }
            
            doc_ref = self.collection.document()
            doc_ref.set(class_data)
            return self.get_class_by_id(doc_ref.id)
        except Exception as e:
            print(f"Erro ao criar turma: {e}")
            raise e

    def update_class(self, class_id, data):
        """Atualiza uma turma existente."""
        try:
            if 'schedule' in data:
                data['schedule'] = [ScheduleSlot(**s).to_dict() for s in data.get('schedule', [])]
            
            if 'default_due_day' in data:
                data['default_due_day'] = int(data['default_due_day'])

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

