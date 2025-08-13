from firebase_admin import firestore
from models.payment import Payment # Importa Payment
from datetime import datetime

class PaymentService:
    def __init__(self, db):
        self.db = db
        self.payments_collection = self.db.collection('payments')

    def create_payment(self, student_id, amount, due_date, description, status='pending', payment_date=None):
        """
        Cria um novo registro de pagamento no Firestore.
        `due_date` deve ser um objeto datetime.
        """
        payment = Payment(
            student_id=student_id,
            amount=amount,
            due_date=due_date,
            payment_date=payment_date, # Pode ser None inicialmente
            status=status,
            description=description
        )
        payment_dict = payment.to_dict()
        doc_ref = self.payments_collection.add(payment_dict)

        payment.id = doc_ref[1].id
        print(f"Pagamento para o aluno {student_id} ('{description}') criado com ID: {payment.id}")
        return payment

    def get_payment_by_id(self, payment_id):
        """
        Busca um pagamento pelo ID.
        Retorna o objeto Payment ou None se não encontrado.
        """
        doc_ref = self.payments_collection.document(payment_id)
        doc = doc_ref.get()
        if doc.exists:
            payment_data = doc.to_dict()
            payment_data['id'] = doc.id
            return Payment.from_dict(payment_data)
        return None

    def get_payments_by_student(self, student_id):
        """
        Retorna todos os pagamentos de um aluno específico, ordenados pela data de vencimento.
        """
        payments = []
        docs = self.payments_collection.where('student_id', '==', student_id).order_by('due_date').stream()
        for doc in docs:
            payment_data = doc.to_dict()
            payment_data['id'] = doc.id
            payments.append(Payment.from_dict(payment_data))
        return payments

    def get_payments_by_status(self, status):
        """
        Retorna pagamentos com um status específico (ex: 'pending', 'overdue').
        """
        payments = []
        docs = self.payments_collection.where('status', '==', status).order_by('due_date').stream()
        for doc in docs:
            payment_data = doc.to_dict()
            payment_data['id'] = doc.id
            payments.append(Payment.from_dict(payment_data))
        return payments

    def update_payment(self, payment_id, update_data):
        """
        Atualiza dados de um pagamento existente.
        `update_data` é um dicionário com os campos a serem atualizados.
        """
        payment_ref = self.payments_collection.document(payment_id)
        payment_ref.update(update_data)
        print(f"Pagamento com ID '{payment_id}' atualizado.")
        return True
    
    def mark_payment_as_paid(self, payment_id):
        """
        Marca um pagamento como pago e define a data de pagamento para agora.
        """
        payment_ref = self.payments_collection.document(payment_id)
        payment_ref.update({
            'status': 'paid',
            'payment_date': datetime.now()
        })
        print(f"Pagamento com ID '{payment_id}' marcado como pago.")
        return True

    def delete_payment(self, payment_id):
        """
        Deleta um pagamento pelo ID.
        """
        self.payments_collection.document(payment_id).delete()
        print(f"Pagamento com ID '{payment_id}' deletado.")
        return True