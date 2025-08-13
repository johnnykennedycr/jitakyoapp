from datetime import datetime

class DayTimeSlot:
    """Representa um slot de dia e horário para uma turma."""
    def __init__(self, day_of_week=None, start_time=None, end_time=None):
        self.day_of_week = day_of_week # Ex: 'Segunda', 'Terça'
        self.start_time = start_time   # Ex: '19:00' (string para facilitar visualização)
        self.end_time = end_time       # Ex: '20:30'

    def to_dict(self):
        return {
            "day_of_week": self.day_of_week,
            "start_time": self.start_time,
            "end_time": self.end_time
        }

    @staticmethod
    def from_dict(source):
        return DayTimeSlot(
            day_of_week=source.get('day_of_week'),
            start_time=source.get('start_time'),
            end_time=source.get('end_time')
        )

    def __repr__(self):
        return f"<{self.day_of_week} {self.start_time}-{self.end_time}>"


class TrainingClass:
    def __init__(self, id=None, name=None, discipline=None, teacher_id=None, schedule=None, capacity=None, description=None, created_at=None, updated_at=None):
        self.id = id # ID do documento no Firestore
        self.name = name # Ex: "Jiu-Jitsu Avançado No-Gi"
        self.discipline = discipline # Ex: "Jiu-Jitsu", "Muay Thai", "Boxe"
        self.teacher_id = teacher_id # ID do professor responsável por esta turma
        self.schedule = [DayTimeSlot.from_dict(s) if isinstance(s, dict) else s for s in (schedule if schedule else [])] # Lista de objetos DayTimeSlot
        self.capacity = capacity # Número máximo de alunos
        self.description = description # Descrição da turma
        self.created_at = created_at if created_at else datetime.now()
        self.updated_at = updated_at if updated_at else datetime.now()

    def to_dict(self):
        """Converte o objeto Class em um dicionário para salvar no Firestore."""
        return {
            "name": self.name,
            "discipline": self.discipline,
            "teacher_id": self.teacher_id,
            "schedule": [slot.to_dict() for slot in self.schedule], # Converte DayTimeSlot para dict
            "capacity": self.capacity,
            "description": self.description,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }

    @staticmethod
    def from_dict(source):
        """Cria um objeto Class a partir de um dicionário (do Firestore)."""
        class_obj = TrainingClass(
            id=source.get('id'),
            name=source.get('name'),
            discipline=source.get('discipline'),
            teacher_id=source.get('teacher_id'),
            schedule=[DayTimeSlot.from_dict(s) for s in source.get('schedule', [])], # Converte dict para DayTimeSlot
            capacity=source.get('capacity'),
            description=source.get('description'),
            created_at=source.get('created_at'),
            updated_at=source.get('updated_at')
        )
        return class_obj

    def __repr__(self):
        return f"<Class(id='{self.id}', name='{self.name}', discipline='{self.discipline}')>"