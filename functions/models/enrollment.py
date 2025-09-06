from datetime import datetime

class Enrollment:
    def __init__(self, id=None, student_id=None, class_id=None, 
                 enrollment_date=None, status='active', 
                 base_monthly_fee=0.0, discount_amount=0.0, 
                 discount_reason='', due_day=15, 
                 created_at=None, updated_at=None):
        
        self.id = id
        self.student_id = student_id
        self.class_id = class_id
        self.enrollment_date = enrollment_date or datetime.now()
        self.status = status
        self.base_monthly_fee = base_monthly_fee
        self.discount_amount = discount_amount
        self.discount_reason = discount_reason
        self.due_day = due_day
        self.created_at = created_at or datetime.now()
        self.updated_at = updated_at or datetime.now()

    def to_dict(self):
        """Converte o objeto Enrollment em um dicionário para salvar no Firestore."""
        return {
            "student_id": self.student_id,
            "class_id": self.class_id,
            "enrollment_date": self.enrollment_date,
            "status": self.status,
            "base_monthly_fee": self.base_monthly_fee,
            "discount_amount": self.discount_amount,
            "discount_reason": self.discount_reason,
            "due_day": self.due_day,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @staticmethod
    def from_dict(source):
        """Cria um objeto Enrollment a partir de um dicionário (do Firestore)."""
        enrollment = Enrollment(
            # O ID é atribuído separadamente no serviço após a criação
            student_id=source.get('student_id'),
            class_id=source.get('class_id'),
            enrollment_date=source.get('enrollment_date'),
            status=source.get('status'),
            base_monthly_fee=source.get('base_monthly_fee', 0.0),
            discount_amount=source.get('discount_amount', 0.0),
            discount_reason=source.get('discount_reason', ''),
            due_day=source.get('due_day', 15),
            created_at=source.get('created_at'),
            updated_at=source.get('updated_at')
        )
        return enrollment

    def __repr__(self):
        return (f"<Enrollment(id='{self.id}', student_id='{self.student_id}', class_id='{self.class_id}')>")