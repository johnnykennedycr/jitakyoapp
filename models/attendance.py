from datetime import datetime

class Attendance:
    """
    Modelo para representar a presença de um aluno em uma turma.
    """
    def __init__(self, id=None, student_id=None, class_id=None, attendance_date=None, status='Presente', created_at=None, updated_at=None):
        self.id = id # ID do documento no Firestore
        self.student_id = student_id # ID do aluno
        self.class_id = class_id # ID da turma
        self.attendance_date = attendance_date # Data da chamada
        self.status = status # 'Presente' ou 'Falta'
        self.created_at = created_at if created_at else datetime.now()
        self.updated_at = updated_at if updated_at else datetime.now()

    def to_dict(self):
        """
        Converte o objeto Attendance em um dicionário para salvar no Firestore.
        """
        return {
            "student_id": self.student_id,
            "class_id": self.class_id,
            "attendance_date": self.attendance_date,
            "status": self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }

    @staticmethod
    def from_dict(source):
        """
        Cria um objeto Attendance a partir de um dicionário (do Firestore).
        """
        attendance = Attendance(
            id=source.get('id'),
            student_id=source.get('student_id'),
            class_id=source.get('class_id'),
            attendance_date=source.get('attendance_date'),
            status=source.get('status', 'Presente'),
            created_at=source.get('created_at'),
            updated_at=source.get('updated_at')
        )
        return attendance

    def __repr__(self):
        return f"<Attendance(student_id='{self.student_id}', class_id='{self.class_id}', date='{self.attendance_date}', status='{self.status}')>"
