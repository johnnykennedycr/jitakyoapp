from firebase_admin import firestore
from app.models.training_class import TrainingClass, DayTimeSlot
from datetime import datetime

class TrainingClassService:
    def __init__(self, db):
        self.db = db
        self.collection = self.db.collection('classes')

    def create_class(self, name, discipline, teacher_id, schedule_data, capacity, description, default_monthly_fee=0.0):
        """
        Cria uma nova turma no Firestore.
        """
        try:
            # No seu modelo, DayTimeSlot.from_dict provavelmente não existe, então vamos instanciar diretamente
            schedule_objects = [DayTimeSlot(**s) for s in schedule_data]
            
            new_class = TrainingClass(
                name=name,
                discipline=discipline,
                teacher_id=teacher_id,
                schedule=schedule_objects,
                capacity=capacity,
                description=description,
                default_monthly_fee=float(default_monthly_fee)
            )
            
            class_dict = new_class.to_dict()
            class_dict['created_at'] = datetime.now()
            class_dict['updated_at'] = datetime.now()
            
            timestamp, doc_ref = self.collection.add(class_dict)

            new_class.id = doc_ref.id
            print(f"Turma '{new_class.name}' criada com ID: {new_class.id}")
            return new_class
        except Exception as e:
            print(f"Erro ao criar turma: {e}")
            return None

    def get_class_by_id(self, class_id):
        """
        Busca uma turma pelo ID.
        """
        try:
            doc = self.collection.document(class_id).get()
            if doc.exists:
                # --- CORREÇÃO AQUI ---
                training_class = TrainingClass.from_dict(doc.to_dict())
                training_class.id = doc.id
                return training_class
            return None
        except Exception as e:
            print(f"Erro ao buscar turma por ID '{class_id}': {e}")
            return None

    def get_all_classes(self):
        """
        Retorna uma lista de todas as turmas.
        """
        classes = []
        try:
            docs = self.collection.stream()
            for doc in docs:
                # --- CORREÇÃO AQUI ---
                training_class = TrainingClass.from_dict(doc.to_dict())
                training_class.id = doc.id
                classes.append(training_class)
        except Exception as e:
            print(f"Erro ao buscar todas as turmas: {e}")
        return classes

    def get_classes_by_teacher(self, teacher_id):
        """
        Retorna uma lista de turmas ministradas por um professor específico.
        """
        classes = []
        try:
            docs = self.collection.where('teacher_id', '==', teacher_id).stream()
            for doc in docs:
                # --- CORREÇÃO AQUI ---
                training_class = TrainingClass.from_dict(doc.to_dict())
                training_class.id = doc.id
                classes.append(training_class)
        except Exception as e:
            print(f"Erro ao buscar turmas por professor: {e}")
        return classes

    def update_class(self, class_id, update_data):
        """
        Atualiza dados de uma turma existente.
        """
        try:
            if 'schedule' in update_data:
                update_data['schedule'] = [DayTimeSlot(**s).to_dict() for s in update_data['schedule']]
            
            if 'default_monthly_fee' in update_data:
                update_data['default_monthly_fee'] = float(update_data['default_monthly_fee'])

            update_data['updated_at'] = datetime.now()
            
            self.collection.document(class_id).update(update_data)
            print(f"Turma com ID '{class_id}' atualizada.")
            return True
        except Exception as e:
            print(f"Erro ao atualizar turma com ID '{class_id}': {e}")
            return False

    def delete_class(self, class_id):
        """
        Deleta uma turma pelo ID.
        """
        try:
            self.collection.document(class_id).delete()
            print(f"Turma com ID '{class_id}' deletada.")
            return True
        except Exception as e:
            print(f"Erro ao deletar turma com ID '{class_id}': {e}")
            return False