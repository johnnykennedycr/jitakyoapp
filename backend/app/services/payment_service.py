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
        """
        Calcula o status financeiro para um determinado mês e ano usando uma lógica mais direta
        e robusta, começando pelas matrículas ativas.
        """
        summary = {"total_paid": 0, "total_pending": 0, "total_overdue": 0}
        student_financial_status = {}
        
        # O EnrollmentService agora faz o trabalho pesado de buscar e enriquecer os dados.
        enrollments_list = self.enrollment_service.get_all_active_enrollments_with_details()

        # CORREÇÃO: Organiza as matrículas em um mapa para consulta rápida
        student_enrollments_map = {}
        for enroll_data in enrollments_list:
            student_id = enroll_data['student_id']
            if student_id not in student_enrollments_map:
                student_enrollments_map[student_id] = []
            student_enrollments_map[student_id].append(enroll_data)

            # Inicializa o status do aluno se ainda não existir
            if student_id not in student_financial_status:
                student_financial_status[student_id] = {
                    "id": student_id,
                    "name": enroll_data.get('student_name', 'Nome não encontrado'),
                    "total_due": 0,
                    "status": "pending" 
                }
            
            # Calcula o valor devido para esta matrícula específica
            fee = enroll_data.get('base_monthly_fee', 0)
            discount = enroll_data.get('discount_amount', 0)
            student_financial_status[student_id]['total_due'] += max(0, fee - discount)

        # Busca os pagamentos já realizados para o mês
        payments = self.collection.where('reference_year', '==', year).where('reference_month', '==', month).stream()
        for payment in payments:
            payment_data = payment.to_dict()
            student_id = payment_data.get('student_id')
            
            if student_id in student_financial_status:
                amount = payment_data.get('amount', 0)
                summary['total_paid'] += amount
                student_financial_status[student_id]['status'] = 'paid'
        
        # Determina o status (pendente ou atrasado) para quem ainda não pagou
        today = datetime.now().date()
        for student_id, status_info in student_financial_status.items():
            if status_info['status'] != 'paid':
                # CORREÇÃO: Busca o dia de vencimento a partir do mapa de matrículas
                student_enrolls = student_enrollments_map.get(student_id, [])
                due_days = [e.get('due_day', 15) for e in student_enrolls]
                due_day = min(due_days) if due_days else 15
                
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
        """Registra um novo pagamento no Firestore."""
        try:
            data['reference_year'] = int(data['reference_year'])
            data['reference_month'] = int(data['reference_month'])
            data['created_at'] = firestore.SERVER_TIMESTAMP
            data['updated_at'] = firestore.SERVER_TIMESTAMP
            
            self.collection.add(data)
            return True
        except Exception as e:
            print(f"Erro ao registrar pagamento: {e}")
            return False

    def generate_monthly_payments(self, year, month):
        """Gera cobranças para matrículas ativas que ainda não têm pagamento no mês."""
        generated_count = 0
        skipped_count = 0
        
        enrollments = self.enrollment_service.get_all_active_enrollments_with_details()

        student_billings = {}
        for enroll_data in enrollments:
            student_id = enroll_data['student_id']
            if student_id not in student_billings:
                student_billings[student_id] = {
                    'total_due': 0, 
                    'enrollment_ids': [], 
                    'due_day': enroll_data.get('due_day', 15)
                }

            fee = enroll_data.get('base_monthly_fee', 0)
            discount = enroll_data.get('discount_amount', 0)
            student_billings[student_id]['total_due'] += max(0, fee - discount)
            student_billings[student_id]['enrollment_ids'].append(enroll_data['enrollment_id'])

        for student_id, billing_info in student_billings.items():
            existing_payment_query = self.collection.where('student_id', '==', student_id).where('reference_year', '==', year).where('reference_month', '==', month).limit(1).stream()
            
            if len(list(existing_payment_query)) == 0:
                _, last_day_of_month = calendar.monthrange(year, month)
                safe_due_day = min(billing_info['due_day'], last_day_of_month)
                
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

