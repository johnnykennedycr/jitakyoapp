from datetime import datetime, date
from firebase_admin import firestore
from app.models.payment import Payment
import calendar

class PaymentService:
    def __init__(self, db, enrollment_service=None, user_service=None, training_class_service=None):
        self.db = db
        self.collection = self.db.collection('payments')
        self.enrollment_service = enrollment_service
        self.user_service = user_service
        self.training_class_service = training_class_service

    def get_financial_status(self, year, month):
        summary = {
            "total_paid": 0,
            "total_pending": 0,
            "total_overdue": 0
        }
        student_financial_status = {}

        active_enrollments = self.enrollment_service.get_all_active_enrollments()
        all_students = {student.id: student for student in self.user_service.get_users_by_role('student')}
        all_classes = {cls['id']: cls for cls in self.training_class_service.get_all_classes()}

        for enrollment in active_enrollments:
            student_id = enrollment.student_id
            student = all_students.get(student_id)
            cls = all_classes.get(enrollment.class_id)

            if not student or not cls:
                continue

            if student_id not in student_financial_status:
                student_financial_status[student_id] = {
                    "id": student_id,
                    "name": student.name,
                    "total_due": 0,
                    "status": "pending" 
                }
            
            fee = enrollment.base_monthly_fee if enrollment.base_monthly_fee is not None else 0
            discount = enrollment.discount_amount if enrollment.discount_amount is not None else 0
            student_financial_status[student_id]['total_due'] += max(0, fee - discount)

        payments = self.collection.where('reference_year', '==', year).where('reference_month', '==', month).stream()
        for payment in payments:
            payment_data = payment.to_dict()
            student_id = payment_data.get('student_id')
            
            if student_id in student_financial_status:
                amount = payment_data.get('amount', 0)
                summary['total_paid'] += amount
                student_financial_status[student_id]['status'] = 'paid'

        today = datetime.now().date()
        
        for student_id, status_info in student_financial_status.items():
            if status_info['status'] != 'paid':
                due_day = 15 # Valor padrão
                enrolls = self.enrollment_service.get_enrollments_by_student_id(student_id)
                if enrolls:
                    due_days = [e.due_day for e in enrolls if e.due_day is not None]
                    if due_days:
                        due_day = min(due_days)

                _, last_day_of_month = calendar.monthrange(year, month)
                safe_due_day = min(due_day, last_day_of_month)
                due_date = date(year, month, safe_due_day)

                if today > due_date:
                    status_info['status'] = 'overdue'
                    summary['total_overdue'] += status_info['total_due']
                else:
                    status_info['status'] = 'pending'
                    summary['total_pending'] += status_info['total_due']
        
        return {
            "summary": summary,
            "students": list(student_financial_status.values())
        }

    def record_payment(self, data):
        try:
            doc_ref = self.collection.document()
            doc_ref.set(data)
            return True
        except Exception as e:
            print(f"Erro ao registrar pagamento: {e}")
            return False

    def generate_monthly_payments(self, year, month):
        """Gera cobranças (documentos de pagamento) para todas as matrículas ativas."""
        generated_count = 0
        skipped_count = 0
        
        active_enrollments = self.enrollment_service.get_all_active_enrollments()
        
        # Agrupa matrículas por aluno para somar os valores
        student_billings = {}
        for enrollment in active_enrollments:
            student_id = enrollment.student_id
            if student_id not in student_billings:
                student_billings[student_id] = {'total_due': 0, 'enrollment_ids': []}
            
            fee = enrollment.base_monthly_fee or 0
            discount = enrollment.discount_amount or 0
            student_billings[student_id]['total_due'] += max(0, fee - discount)
            student_billings[student_id]['enrollment_ids'].append(enrollment.id)

        for student_id, billing_info in student_billings.items():
            # CORREÇÃO: Verifica se já existe um pagamento para ESTE aluno neste mês/ano
            existing_payment_query = self.collection.where('student_id', '==', student_id).where('reference_year', '==', year).where('reference_month', '==', month).limit(1).stream()
            
            if len(list(existing_payment_query)) == 0:
                # Nenhum pagamento encontrado, então podemos criar um novo.
                _, last_day_of_month = calendar.monthrange(year, month)
                enrolls = self.enrollment_service.get_enrollments_by_student_id(student_id)
                due_day = 15 # Padrão
                if enrolls:
                    due_days = [e.due_day for e in enrolls if e.due_day]
                    if due_days:
                        due_day = min(due_days)

                safe_due_day = min(due_day, last_day_of_month)
                
                payment_doc = {
                    "student_id": student_id,
                    "amount": billing_info['total_due'],
                    "status": "pending",
                    "reference_year": year,
                    "reference_month": month,
                    "due_date": datetime(year, month, safe_due_day),
                    "description": f"Mensalidade de {datetime(year, month, 1).strftime('%B/%Y')}",
                    "created_at": firestore.SERVER_TIMESTAMP,
                    "updated_at": firestore.SERVER_TIMESTAMP,
                    "enrollment_ids": billing_info['enrollment_ids']
                }
                self.collection.add(payment_doc)
                generated_count += 1
            else:
                skipped_count += 1
                
        return {"generated": generated_count, "skipped": skipped_count}

