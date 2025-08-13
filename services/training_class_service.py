from firebase_admin import firestore
from models.training_class import TrainingClass, DayTimeSlot # Importa TrainingClass e DayTimeSlot


class TrainingClassService: # Renomeado de ClassService para TrainingClassService
    def __init__(self, db):
        self.db = db
        self.classes_collection = self.db.collection('classes') # A coleção no Firestore ainda pode ser 'classes'

    def create_class(self, name, discipline, teacher_id, schedule_data, capacity, description):
        """
        Cria uma nova turma no Firestore.
        `schedule_data` deve ser uma lista de dicionários com 'day_of_week', 'start_time', 'end_time'.
        """
        schedule_objects = [DayTimeSlot(**s) for s in schedule_data]
        
        class_obj = TrainingClass( # Usando TrainingClass aqui
            name=name,
            discipline=discipline,
            teacher_id=teacher_id,
            schedule=schedule_objects,
            capacity=capacity,
            description=description
        )
        class_dict = class_obj.to_dict()
        doc_ref = self.classes_collection.add(class_dict)

        class_obj.id = doc_ref[1].id
        print(f"Turma '{class_obj.name}' criada com ID: {class_obj.id}")
        return class_obj

    def get_class_by_id(self, class_id):
        """
        Busca uma turma pelo ID.
        Retorna o objeto TrainingClass ou None se não encontrado.
        """
        doc_ref = self.classes_collection.document(class_id)
        doc = doc_ref.get()
        if doc.exists:
            class_data = doc.to_dict()
            class_data['id'] = doc.id
            return TrainingClass.from_dict(class_data) # Usando TrainingClass aqui
        return None

    def get_all_classes(self):
        """
        Retorna uma lista de todas as turmas.
        """
        classes = []
        docs = self.classes_collection.stream()
        for doc in docs:
            class_data = doc.to_dict()
            class_data['id'] = doc.id
            classes.append(TrainingClass.from_dict(class_data)) # Usando TrainingClass aqui
        return classes

    def get_classes_by_teacher(self, teacher_id):
        """
        Retorna uma lista de turmas ministradas por um professor específico.
        """
        classes = []
        docs = self.classes_collection.where('teacher_id', '==', teacher_id).stream()
        for doc in docs:
            class_data = doc.to_dict()
            class_data['id'] = doc.id
            classes.append(TrainingClass.from_dict(class_data)) # Usando TrainingClass aqui
        return classes

    def update_class(self, class_id, update_data):
        """
        Atualiza dados de uma turma existente.
        `update_data` é um dicionário com os campos a serem atualizados.
        Se 'schedule' estiver em update_data, ele deve ser uma lista de dicionários de DayTimeSlot.
        """
        if 'schedule' in update_data:
            # Garante que os slots de horário sejam convertidos para o formato de dicionário
            # antes de serem enviados para o Firestore, usando o método to_dict de DayTimeSlot.
            update_data['schedule'] = [DayTimeSlot(**s).to_dict() for s in update_data['schedule']]

        class_ref = self.classes_collection.document(class_id)
        class_ref.update(update_data)
        print(f"Turma com ID '{class_id}' atualizada.")
        return True

    def delete_class(self, class_id):
        """
        Deleta uma turma pelo ID.
        """
        self.classes_collection.document(class_id).delete()
        print(f"Turma com ID '{class_id}' deletada.")
        return True