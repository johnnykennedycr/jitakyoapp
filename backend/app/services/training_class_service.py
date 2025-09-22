from datetime import datetime
from firebase_admin import firestore
from app.models.training_class import TrainingClass
from app.models.schedule_slot import ScheduleSlot

class TrainingClassService:
    def __init__(self, db):
        self.db = db
        self.collection = self.db.collection('classes')

    def get_all_classes(self):
        """Busca todas as turmas do Firestore."""
        classes = []
        try:
            docs = self.collection.stream()
            for doc in docs:
                classes.append(TrainingClass.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar todas as turmas: {e}")
        return classes

    def get_class_by_id(self, class_id):
        """Busca uma turma específica pelo seu ID."""
        try:
            doc = self.collection.document(class_id).get()
            if doc.exists:
                return TrainingClass.from_dict(doc.to_dict(), doc.id)
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
                'schedule': schedule_objects,
                # CORREÇÃO: Usar o sentinel value do Firestore diretamente.
                'created_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP
            }
            
            doc_ref = self.collection.document()
            doc_ref.set(class_data)
            return self.get_class_by_id(doc_ref.id)
        except Exception as e:
            print(f"Erro ao criar turma: {e}")
            # Re-lança a exceção para que a rota possa capturá-la e retornar um erro apropriado.
            raise e

    def update_class(self, class_id, data):
        """Atualiza uma turma existente."""
        try:
            # Garante que os horários sejam convertidos para dicionários
            if 'schedule' in data:
                data['schedule'] = [ScheduleSlot(**s).to_dict() for s in data.get('schedule', [])]
            
            # CORREÇÃO: Usar o sentinel value do Firestore diretamente.
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
