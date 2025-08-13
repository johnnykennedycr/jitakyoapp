from datetime import datetime

class Payment:
    def __init__(self, id=None, student_id=None, amount=None, due_date=None, payment_date=None, status='pending', description=None, created_at=None, updated_at=None):
        self.id = id # ID do documento no Firestore
        self.student_id = student_id # ID do aluno que fez o pagamento
        self.amount = amount         # Valor do pagamento
        self.due_date = due_date     # Data de vencimento (datetime object)
        self.payment_date = payment_date # Data em que o pagamento foi realizado (datetime object, pode ser None se pendente)
        self.status = status         # Ex: 'pending', 'paid', 'overdue', 'cancelled'
        self.description = description # Ex: "Mensalidade de Outubro", "Taxa de Matrícula"
        self.created_at = created_at if created_at else datetime.now()
        self.updated_at = updated_at if updated_at else datetime.now()

    def to_dict(self):
        """Converte o objeto Payment em um dicionário para salvar no Firestore."""
        return {
            "student_id": self.student_id,
            "amount": self.amount,
            "due_date": self.due_date,
            "payment_date": self.payment_date,
            "status": self.status,
            "description": self.description,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }

    @staticmethod
    def from_dict(source):
        """Cria um objeto Payment a partir de um dicionário (do Firestore)."""
        payment = Payment(
            id=source.get('id'),
            student_id=source.get('student_id'),
            amount=source.get('amount'),
            due_date=source.get('due_date'),
            payment_date=source.get('payment_date'),
            status=source.get('status', 'pending'),
            description=source.get('description'),
            created_at=source.get('created_at'),
            updated_at=source.get('updated_at')
        )
        return payment

    def __repr__(self):
        return f"<Payment(id='{self.id}', student_id='{self.student_id}', amount={self.amount}, status='{self.status}')>"