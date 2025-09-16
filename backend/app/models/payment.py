from datetime import datetime

class Payment:
    def __init__(self, id=None, student_id=None, class_id=None, enrollment_id=None, 
                 month_reference=None, amount=None, due_date=None, payment_date=None, 
                 status='pending', description=None, created_at=None, updated_at=None,
                 payment_method=None):
        
        self.id = id
        self.student_id = student_id
        self.class_id = class_id
        self.enrollment_id = enrollment_id
        self.month_reference = month_reference
        self.amount = amount
        self.due_date = due_date
        self.payment_date = payment_date
        self.status = status
        self.description = description
        self.payment_method = payment_method
        self.created_at = created_at or datetime.now()
        self.updated_at = updated_at or datetime.now()

    def to_dict(self):
        """Converte o objeto Payment em um dicionário para salvar no Firestore."""
        return {
            "student_id": self.student_id,
            "class_id": self.class_id,
            "enrollment_id": self.enrollment_id,
            "month_reference": self.month_reference,
            "amount": self.amount,
            "due_date": self.due_date,
            "payment_date": self.payment_date,
            "status": self.status,
            "description": self.description,
            "payment_method": self.payment_method,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }

    @staticmethod
    def from_dict(source):
        """Cria um objeto Payment a partir de um dicionário (do Firestore)."""
        # O ID será atribuído separadamente pelo serviço
        payment = Payment(
            student_id=source.get('student_id'),
            class_id=source.get('class_id'),
            enrollment_id=source.get('enrollment_id'),
            month_reference=source.get('month_reference'),
            amount=source.get('amount'),
            due_date=source.get('due_date'),
            payment_date=source.get('payment_date'),
            status=source.get('status', 'pending'),
            description=source.get('description'),
            payment_method=source.get('payment_method'),
            created_at=source.get('created_at'),
            updated_at=source.get('updated_at')
        )
        return payment

    def __repr__(self):
        return f"<Payment(id='{self.id}', student_id='{self.student_id}', amount={self.amount}, status='{self.status}')>"