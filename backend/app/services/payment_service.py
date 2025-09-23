from datetime import datetime, date
from firebase_admin import firestore

class PaymentService:
    def __init__(self, db, enrollment_service=None, user_service=None):
        self.db = db
        self.collection = self.db.collection('payments')
        self.enrollment_service = enrollment_service
        self.user_service = user_service

    def create_payment(self, data):
        """Registra um novo pagamento no Firestore."""
        try:
            payment_data = {
                'student_id': data.get('student_id'),
                'amount': data.get('amount'),
                'payment_date': datetime.strptime(data.get('payment_date'), '%Y-%m-%d'),
                'reference_month': int(data.get('reference_month')),
                'reference_year': int(data.get('reference_year')),
                'created_at': datetime.now()
            }
            self.collection.add(payment_data)
            return True
        except Exception as e:
            print(f"Erro ao registrar pagamento: {e}")
            raise e

    def get_financial_status(self, year, month):
        """Calcula o status financeiro para um determinado mês e ano."""
        try:
            # 1. Obter todos os alunos com matrículas ativas
            all_students = self.user_service.get_users_by_role('student')
            active_students = [s for s in all_students if s.enrollments and len(s.enrollments) > 0]

            # 2. Obter todos os pagamentos para o período
            payments_query = self.collection.where(
                filter=firestore.And([
                    firestore.FieldFilter('reference_year', '==', year),
                    firestore.FieldFilter('reference_month', '==', month)
                ])
            ).stream()
            payments_by_student = {}
            for payment in payments_query:
                p_data = payment.to_dict()
                student_id = p_data['student_id']
                if student_id not in payments_by_student:
                    payments_by_student[student_id] = []
                payments_by_student[student_id].append(p_data)

            # 3. Processar o status de cada aluno
            student_financial_details = []
            summary = {'total_paid': 0, 'total_pending': 0, 'total_overdue': 0}
            today = date.today()

            for student in active_students:
                total_due = sum(e.get('base_monthly_fee', 0) - e.get('discount_amount', 0) for e in student.enrollments)
                due_day = student.enrollments[0].get('due_day', 10) if student.enrollments else 10

                status = 'pending'
                if student.id in payments_by_student:
                    status = 'paid'
                    summary['total_paid'] += total_due
                else:
                    # Verifica se está atrasado
                    if today.year > year or (today.year == year and today.month > month) or \
                       (today.year == year and today.month == month and today.day > due_day):
                        status = 'overdue'
                        summary['total_overdue'] += total_due
                    else:
                        status = 'pending'
                        summary['total_pending'] += total_due
                
                student_financial_details.append({
                    'id': student.id,
                    'name': student.name,
                    'total_due': total_due,
                    'status': status
                })

            return {'summary': summary, 'students': student_financial_details}

        except Exception as e:
            print(f"Erro ao obter status financeiro: {e}")
            raise e
