from datetime import datetime

class Payment:
    def __init__(self, id, student_id, amount, payment_date, reference_month, reference_year, created_at):
        self.id = id
        self.student_id = student_id
        self.amount = amount
        self.payment_date = payment_date
        self.reference_month = reference_month
        self.reference_year = reference_year
        self.created_at = created_at

    @staticmethod
    def from_dict(data, doc_id):
        return Payment(
            id=doc_id,
            student_id=data.get('student_id'),
            amount=data.get('amount'),
            payment_date=data.get('payment_date'),
            reference_month=data.get('reference_month'),
            reference_year=data.get('reference_year'),
            created_at=data.get('created_at')
        )

    def to_dict(self):
        return {
            'student_id': self.student_id,
            'amount': self.amount,
            'payment_date': self.payment_date,
            'reference_month': self.reference_month,
            'reference_year': self.reference_year,
            'created_at': self.created_at
        }
