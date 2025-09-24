import calendar
from datetime import datetime, date
import logging
from app.models.payment import Payment

class PaymentService:
    def __init__(self, db, enrollment_service, user_service, training_class_service):
        self.db = db
        self.collection = self.db.collection('payments')
        self.enrollment_service = enrollment_service
        self.user_service = user_service
        self.training_class_service = training_class_service

    def get_financial_status(self, year, month):
        summary = { "total_paid": 0, "total_pending": 0, "total_overdue": 0 }
        student_financial_status = {}
        today = date.today()

        try:
            active_enrollments = self.enrollment_service.get_all_active_enrollments()
            
            for enrollment in active_enrollments:
                student_id = enrollment.student_id
                
                # *** NOVA VERIFICAÇÃO DE SEGURANÇA CONTRA DADOS ÓRFÃOS ***
                student = self.user_service.get_user_by_id(student_id)
                training_class = self.training_class_service.get_class_by_id(enrollment.class_id)
                if not student or not training_class:
                    logging.warning(f"Matrícula {enrollment.id} ignorada devido a aluno ou turma não encontrado(a).")
                    continue 

                if student_id not in student_financial_status:
                    student_financial_status[student_id] = {
                        "id": student_id,
                        "name": student.name,
                        "total_due": 0,
                        "status": "pending",
                        "due_date": None
                    }
                
                monthly_fee = float(getattr(enrollment, 'base_monthly_fee', 0) or 0)
                discount = float(getattr(enrollment, 'discount_amount', 0) or 0)
                student_financial_status[student_id]["total_due"] += max(0, monthly_fee - discount)
                
                due_day = int(getattr(enrollment, 'due_day', 15) or 15)
                _, last_day_of_month = calendar.monthrange(year, month)
                actual_due_day = min(due_day, last_day_of_month)
                
                current_due_date = date(year, month, actual_due_day)
                if not student_financial_status[student_id]["due_date"] or current_due_date < student_financial_status[student_id]["due_date"]:
                    student_financial_status[student_id]["due_date"] = current_due_date

            for student_id, status_info in student_financial_status.items():
                payment = self.get_payment_for_student(student_id, year, month)
                
                if payment and payment.status == 'paid':
                    status_info['status'] = 'paid'
                    summary['total_paid'] += float(getattr(payment, 'amount', 0) or 0)
                else:
                    if status_info['due_date'] < today:
                        status_info['status'] = 'overdue'
                        summary['total_overdue'] += status_info['total_due']
                    else:
                        status_info['status'] = 'pending'
                        summary['total_pending'] += status_info['total_due']
            
            return {
                "summary": summary,
                "students": list(student_financial_status.values())
            }
        except Exception as e:
            logging.error(f"Erro ao obter status financeiro: {e}", exc_info=True)
            raise e

    def get_payment_for_student(self, student_id, year, month):
        try:
            docs = self.collection.where('student_id', '==', student_id).where('reference_year', '==', year).where('reference_month', '==', month).limit(1).stream()
            payment_doc = next(docs, None)
            return Payment.from_dict(payment_doc.to_dict(), payment_doc.id) if payment_doc else None
        except Exception as e:
            logging.error(f"Erro ao buscar pagamento: {e}", exc_info=True)
            return None

    def record_payment(self, data):
        try:
            student_id = data.get('student_id')
            year = data.get('reference_year')
            month = data.get('reference_month')

            existing_payment = self.get_payment_for_student(student_id, year, month)
            
            payment_data = {
                "student_id": student_id,
                "amount": float(data.get('amount', 0)),
                "payment_date": datetime.fromisoformat(data.get('payment_date')),
                "reference_year": year,
                "reference_month": month,
                "status": "paid",
                "updated_at": datetime.now()
            }

            if existing_payment:
                self.collection.document(existing_payment.id).update(payment_data)
            else:
                payment_data['created_at'] = datetime.now()
                self.collection.document().set(payment_data)
            return True
        except Exception as e:
            logging.error(f"Erro ao registrar pagamento: {e}", exc_info=True)
            return False

