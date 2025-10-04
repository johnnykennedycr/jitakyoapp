import calendar
from datetime import date, datetime, timedelta
import logging
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

class PaymentService:
    def __init__(self, db, enrollment_service=None, user_service=None, training_class_service=None):
        self.db = db
        self.collection = self.db.collection('payments')
        self.enrollment_service = enrollment_service
        self.user_service = user_service
        self.training_class_service = training_class_service

    def generate_monthly_payments(self, year, month):
        """
        Gera cobranças de mensalidade individuais para cada matrícula ativa,
        incluindo um campo 'due_date' para facilitar as consultas.
        """
        try:
            active_enrollments = self.enrollment_service.get_all_active_enrollments_with_details()
            
            generated_count = 0
            existing_count = 0

            for enrollment in active_enrollments:
                student_id = enrollment['student_id']
                enrollment_id = enrollment['enrollment_id']
                
                existing_payment_query = self.collection.where(
                    filter=firestore.And(
                        [
                            firestore.FieldFilter('student_id', '==', student_id),
                            firestore.FieldFilter('enrollment_id', '==', enrollment_id),
                            firestore.FieldFilter('reference_year', '==', int(year)),
                            firestore.FieldFilter('reference_month', '==', int(month))
                        ]
                    )
                ).limit(1).stream()
                
                if len(list(existing_payment_query)) > 0:
                    existing_count += 1
                    continue

                total_due = float(enrollment.get('base_monthly_fee', 0)) - float(enrollment.get('discount_amount', 0))
                
                if total_due <= 0:
                    continue

                due_day = int(enrollment.get('due_day', 15))
                try:
                    due_date_obj = datetime(int(year), int(month), due_day)
                except ValueError:
                    _, last_day = calendar.monthrange(int(year), int(month))
                    due_date_obj = datetime(int(year), int(month), last_day)

                payment_data = {
                    'student_id': student_id,
                    'enrollment_id': enrollment_id, 
                    'amount': total_due,
                    'status': 'pending',
                    'reference_month': int(month),
                    'reference_year': int(year),
                    'due_day': due_day,
                    'due_date': due_date_obj,
                    'type': 'Mensalidade',
                    'description': f"Mensalidade {enrollment.get('class_name', 'N/A')} - {int(month):02d}/{int(year)}",
                    'class_name': enrollment.get('class_name', 'N/A'),
                    'payment_date': None,
                    'payment_method': None,
                    'created_at': datetime.now(),
                    'updated_at': datetime.now()
                }
                self.collection.add(payment_data)
                generated_count += 1
            
            return {"generated": generated_count, "skipped": existing_count}

        except Exception as e:
            logging.error(f"Erro ao gerar cobranças mensais para {month}/{year}: {e}", exc_info=True)
            raise

    def create_misc_invoices(self, data):
        student_ids = data.get('student_ids', [])
        invoice_type = data.get('type')
        amount = float(data.get('amount', 0))
        due_date_str = data.get('due_date')

        if not all([student_ids, invoice_type, amount > 0, due_date_str]):
            raise ValueError("Dados insuficientes para criar faturas avulsas.")

        due_date_obj = datetime.strptime(due_date_str, '%Y-%m-%d')
        
        created_count = 0
        for student_id in student_ids:
            payment_data = {
                'student_id': student_id,
                'enrollment_id': None,
                'amount': amount,
                'status': 'pending',
                'reference_month': due_date_obj.month,
                'reference_year': due_date_obj.year,
                'due_day': due_date_obj.day,
                'due_date': due_date_obj,
                'type': invoice_type,
                'description': invoice_type,
                'class_name': 'N/A',
                'payment_date': None,
                'payment_method': None,
                'created_at': datetime.now(),
                'updated_at': datetime.now()
            }
            self.collection.add(payment_data)
            created_count += 1
            
        return created_count

    def get_financial_status(self, year, month):
        summary = {'total_paid': 0, 'total_pending': 0, 'total_overdue': 0}
        paid_payments = []
        pending_payments = []
        today = date.today()

        try:
            payments_query = self.collection.where(filter=firestore.And(
                [
                    firestore.FieldFilter('reference_year', '==', int(year)),
                    firestore.FieldFilter('reference_month', '==', int(month))
                ]
            )).stream()
            
            all_students = {s.id: s.name for s in self.user_service.get_users_by_role('student')}

            for doc in payments_query:
                payment = doc.to_dict()
                payment['id'] = doc.id 

                payment['student_name'] = all_students.get(payment.get('student_id'), "Aluno Desconhecido")
                
                amount = float(payment.get('amount', 0))

                if payment.get('status') == 'paid':
                    summary['total_paid'] += amount
                    paid_payments.append(payment)
                else:
                    _, last_day = calendar.monthrange(int(year), int(month))
                    due_day = min(int(payment.get('due_day', 15)), last_day)
                    due_date = date(int(year), int(month), due_day)
                    payment['due_date_formatted'] = due_date.strftime('%d/%m/%Y')

                    if due_date < today and payment.get('status') != 'paid':
                        summary['total_overdue'] += amount
                        payment['status'] = 'overdue'
                    else:
                        summary['total_pending'] += amount
                        payment['status'] = 'pending'
                    
                    pending_payments.append(payment)

            return {
                "summary": summary,
                "paid_payments": paid_payments,
                "pending_payments": pending_payments
            }
        except Exception as e:
            logging.error(f"Erro ao obter status financeiro para {month}/{year}: {e}", exc_info=True)
            raise

    def record_payment(self, data):
        payment_id = data.get('payment_id')
        if not payment_id:
            raise ValueError("ID do pagamento é obrigatório.")

        payment_ref = self.collection.document(payment_id)
        
        update_data = {
            'status': 'paid',
            'amount': float(data.get('amount')),
            'payment_date': datetime.strptime(data.get('payment_date'), '%Y-%m-%d'),
            'payment_method': data.get('payment_method'),
            'payment_method_details': data.get('payment_method_details', ''),
            'updated_at': datetime.now()
        }
        payment_ref.update(update_data)
        return True
    
    # --- MÉTODO CORRIGIDO ---
    def get_charges_by_user_id(self, student_id):
        """
        Busca todas as cobranças para um aluno e as ordena em Python
        para evitar a necessidade de um índice composto no Firestore.
        """
        charges = []
        try:
            # 1. Busca todos os documentos do aluno sem ordenar na query
            docs = self.collection.where(
                filter=FieldFilter('student_id', '==', student_id)
            ).stream()
            
            raw_charges = []
            for doc in docs:
                charge_data = doc.to_dict()
                charge_data['id'] = doc.id
                
                # Garante que as datas são strings no formato ISO para o frontend
                if 'due_date' in charge_data and hasattr(charge_data['due_date'], 'isoformat'):
                    charge_data['due_date'] = charge_data['due_date'].isoformat()
                if 'payment_date' in charge_data and charge_data.get('payment_date') and hasattr(charge_data['payment_date'], 'isoformat'):
                    charge_data['payment_date'] = charge_data['payment_date'].isoformat()

                raw_charges.append(charge_data)

            # 2. Ordena a lista de resultados em Python, da data mais recente para a mais antiga
            charges = sorted(raw_charges, key=lambda x: x.get('due_date', ''), reverse=True)

        except Exception as e:
            print(f"Erro ao buscar cobranças para o usuário {student_id}: {e}")
            logging.error(f"Erro ao buscar cobranças para o usuário {student_id}: {e}", exc_info=True)

        return charges

