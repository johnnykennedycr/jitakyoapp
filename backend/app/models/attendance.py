from datetime import datetime

class Attendance:
    def __init__(self, id, class_id, date, present_student_ids, present_student_names=None, created_at=None, updated_at=None):
        self.id = id
        self.class_id = class_id
        self.date = date
        self.present_student_ids = present_student_ids
        self.present_student_names = present_student_names if present_student_names is not None else []
        self.created_at = created_at
        self.updated_at = updated_at

    @staticmethod
    def from_dict(source, id):
        return Attendance(
            id=id,
            class_id=source.get('class_id'),
            date=source.get('date'),
            present_student_ids=source.get('present_student_ids', []),
            present_student_names=source.get('present_student_names', []), # Campo enriquecido
            created_at=source.get('created_at'),
            updated_at=source.get('updated_at')
        )

    def to_dict(self):
        # O campo 'present_student_names' não é armazenado no DB, apenas usado para a resposta da API.
        return {
            "id": self.id,
            "class_id": self.class_id,
            "date": self.date.isoformat() if isinstance(self.date, datetime) else self.date,
            "present_student_ids": self.present_student_ids,
            "present_student_names": self.present_student_names,
            "updated_at": self.updated_at
        }
