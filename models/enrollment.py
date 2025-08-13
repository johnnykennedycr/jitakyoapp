# models/enrollment.py
from datetime import datetime

class Enrollment:
    def __init__(self, student_id, class_id, enrollment_date=None, status="active", id=None):
        self.id = id
        self.student_id = student_id
        self.class_id = class_id
        self.enrollment_date = enrollment_date if enrollment_date else datetime.now()
        self.status = status

    def to_dict(self):
        return {
            "student_id": self.student_id,
            "class_id": self.class_id,
            "enrollment_date": self.enrollment_date,
            "status": self.status
        }

    @staticmethod
    def from_dict(source):
        enrollment = Enrollment(
            student_id=source["student_id"],
            class_id=source["class_id"],
            enrollment_date=source.get("enrollment_date"),
            status=source.get("status", "active"),
            id=source.get("id") # Adicionado para garantir que o ID seja carregado
        )
        return enrollment