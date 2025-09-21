from datetime import datetime

class Enrollment:
    """
    Representa uma matrícula de um aluno em uma turma.
    """
    def __init__(self, id, student_id, class_id, status='active', enrollment_date=None,
                 base_monthly_fee=0, discount_amount=0, discount_reason='', due_day=10,
                 created_at=None, updated_at=None):
        self.id = id
        self.student_id = student_id
        self.class_id = class_id
        self.status = status
        self.enrollment_date = enrollment_date
        self.base_monthly_fee = base_monthly_fee
        self.discount_amount = discount_amount
        self.discount_reason = discount_reason
        self.due_day = due_day
        self.created_at = created_at
        self.updated_at = updated_at

    @staticmethod
    def from_dict(source_dict, doc_id):
        """
        Cria um objeto Enrollment a partir de um dicionário do Firestore.
        """
        enrollment_date = source_dict.get('enrollment_date')
        if hasattr(enrollment_date, 'to_date_time'): # Converte Timestamp para datetime
            enrollment_date = enrollment_date.to_date_time()

        created = source_dict.get('created_at')
        if hasattr(created, 'to_date_time'):
            created = created.to_date_time()

        updated = source_dict.get('updated_at')
        if hasattr(updated, 'to_date_time'):
            updated = updated.to_date_time()

        return Enrollment(
            id=doc_id,
            student_id=source_dict.get('student_id'),
            class_id=source_dict.get('class_id'),
            status=source_dict.get('status'),
            enrollment_date=enrollment_date,
            base_monthly_fee=source_dict.get('base_monthly_fee'),
            discount_amount=source_dict.get('discount_amount'),
            discount_reason=source_dict.get('discount_reason'),
            due_day=source_dict.get('due_day'),
            created_at=created,
            updated_at=updated
        )

    def to_dict(self):
        """
        Converte o objeto Enrollment para um dicionário JSON-serializável.
        """
        return {
            "id": self.id,
            "student_id": self.student_id,
            "class_id": self.class_id,
            "status": self.status,
            "enrollment_date": self.enrollment_date.isoformat() if self.enrollment_date else None,
            "base_monthly_fee": self.base_monthly_fee,
            "discount_amount": self.discount_amount,
            "discount_reason": self.discount_reason,
            "due_day": self.due_day,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<Enrollment(id='{self.id}', student='{self.student_id}', class='{self.class_id}')>"

