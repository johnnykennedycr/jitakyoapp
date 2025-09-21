from datetime import datetime
from app.models.schedule_slot import ScheduleSlot

class TrainingClass:
    def __init__(self, id=None, name=None, discipline=None, teacher_id=None,
                 capacity=None, description=None, default_monthly_fee=None,
                 schedule=None, created_at=None, updated_at=None):
        self.id = id
        self.name = name
        self.discipline = discipline
        self.teacher_id = teacher_id
        self.capacity = capacity
        self.description = description
        self.default_monthly_fee = default_monthly_fee
        self.schedule = schedule if schedule is not None else []
        self.created_at = created_at
        self.updated_at = updated_at

    @staticmethod
    def from_dict(source, doc_id):
        """Cria um objeto TrainingClass a partir de um dicionário do Firestore."""
        schedule_data = source.get('schedule', [])
        schedule_objects = [ScheduleSlot.from_dict(s) for s in schedule_data]
        
        return TrainingClass(
            id=doc_id,
            name=source.get('name'),
            discipline=source.get('discipline'),
            teacher_id=source.get('teacher_id'),
            capacity=source.get('capacity'),
            description=source.get('description'),
            default_monthly_fee=source.get('default_monthly_fee'),
            schedule=schedule_objects,
            created_at=source.get('created_at'),
            updated_at=source.get('updated_at')
        )

    def to_dict(self):
        """Converte o objeto TrainingClass para um dicionário JSON-serializável."""
        return {
            "id": self.id,
            "name": self.name,
            "discipline": self.discipline,
            "teacher_id": self.teacher_id,
            "capacity": self.capacity,
            "description": self.description,
            "default_monthly_fee": self.default_monthly_fee,
            "schedule": [s.to_dict() for s in self.schedule],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
