from datetime import datetime, date
from firebase_admin import firestore
from app.models.payment import Payment
import calendar

class PaymentService:
    def __init__(self, db, enrollment_service, user_service):
        self.db = db
        self.collection = self.db.collection('payments')
        self.enrollment_service = enrollment_service
        self.user_service = user_service

    def get_financial_status(self, year, month):
        """
        Calcula e retorna o status financeiro para um determinado mês e ano.
        """
        students = self.user_service.get_students_with_enrollments()
        
        student_statuses = []
        summary = {'paid': 0, 'pending': 0, 'overdue': 0}
        today = date.today()
        
        for student in students:
            if not student.enrollments:
                continue

            monthly_total = 0
            for enrollment in student.enrollments:
                base_fee = float(getattr(enrollment, 'base_monthly_fee', 0) or 0)
                discount = float(getattr(enrollment, 'discount_amount', 0) or 0)
                monthly_total += (base_fee - discount)
            
            if monthly_total <= 0:
                continue

            payment = self.get_payment_for_student(student.id, year, month)
            
            due_day = student.enrollments[0].due_day if student.enrollments else 10
            
            # --- CORREÇÃO: Garante que o dia de vencimento é válido para o mês (ex: dia 31 em Setembro) ---
            last_day_of_month = calendar.monthrange(year, month)[1]
            actual_due_day = min(due_day, last_day_of_month)
            due_date = date(year, month, actual_due_day)
            
            status = 'pending'
            if payment:
                status = 'paid'
                payment_amount = float(getattr(payment, 'amount', 0) or 0)
                summary['paid'] += payment_amount
            elif today > due_date:
                status = 'overdue'
                summary['overdue'] += monthly_total
            else:
                summary['pending'] += monthly_total

            student_statuses.append({
                'student_id': student.id,
                'name': student.name,
                'monthly_fee': monthly_total,
                'status': status,
                'payment_id': payment.id if payment else None,
                'due_day': due_day
            })

        student_statuses.sort(key=lambda x: x['name'])
        
        return {'summary': summary, 'students': student_statuses}

    def get_payment_for_student(self, student_id, year, month):
        """Busca um pagamento específico para um aluno em um mês/ano de referência."""
        try:
            docs = self.collection.where('student_id', '==', student_id).where('reference_year', '==', year).where('reference_month', '==', month).limit(1).stream()
            payment_doc = next(docs, None)
            if payment_doc:
                return Payment.from_dict(payment_doc.to_dict(), payment_doc.id)
            return None
        except Exception as e:
            print(f"Erro ao buscar pagamento para aluno {student_id}: {e}")
            return None

    def record_payment(self, data):
        """Registra um novo pagamento no sistema."""
        try:
            student_id = data.get('student_id')
            year = data.get('year')
            month = data.get('month')
            
            if not all([student_id, year, month]):
                raise ValueError("ID do aluno, ano e mês são obrigatórios.")
            
            if self.get_payment_for_student(student_id, year, month):
                raise ValueError("Pagamento para este mês e ano já foi registrado para este aluno.")

            payment_data = {
                'student_id': student_id,
                'amount': float(data.get('amount')),
                'payment_date': datetime.now(),
                'reference_year': int(year),
                'reference_month': int(month),
                'method': data.get('method', 'Não especificado'),
                'created_at': firestore.SERVER_TIMESTAMP,
            }
            doc_ref = self.collection.document()
            doc_ref.set(payment_data)
            return Payment.from_dict(payment_data, doc_ref.id)
        except Exception as e:
            print(f"Erro ao registrar pagamento: {e}")
            raise e

