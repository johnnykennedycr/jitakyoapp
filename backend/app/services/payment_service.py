import calendar
from datetime import date, datetime
import logging
from firebase_admin import firestore

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
        evitando a criação de duplicatas, usando a sintaxe de consulta moderna.
        """
        try:
            active_enrollments = self.enrollment_service.get_all_active_enrollments_with_details()
            
            generated_count = 0
            existing_count = 0

            for enrollment in active_enrollments:
                student_id = enrollment['student_id']
                enrollment_id = enrollment['enrollment_id']
                
                # A consulta foi reescrita para usar a sintaxe moderna com 'filter'
                # e firestore.And, que é a forma correta e recomendada.
                existing_payment_query = self.collection.where(
                    filter=firestore.And(
                        [
                            firestore.FieldFilter('student_id', '==', student_id),
                            firestore.FieldFilter('enrollment_id', '==', enrollment_id),
                            # --- CORREÇÃO APLICADA AQUI: Garantindo que ano e mês são inteiros ---
                            firestore.FieldFilter('reference_year', '==', int(year)),
                            firestore.FieldFilter('reference_month', '==', int(month))
                        ]
                    )
                ).limit(1).stream()
                
                if len(list(existing_payment_query)) > 0:
                    existing_count += 1
                    continue

                # Calcula o valor devido para esta matrícula
                total_due = float(enrollment.get('base_monthly_fee', 0)) - float(enrollment.get('discount_amount', 0))
                
                if total_due <= 0:
                    continue

                payment_data = {
                    'student_id': student_id,
                    'enrollment_id': enrollment_id, 
                    'amount': total_due,
                    'status': 'pending',
                    'reference_month': int(month),
                    'reference_year': int(year),
                    'due_day': int(enrollment.get('due_day', 15)),
                    'type': 'Mensalidade',
                    'class_name': enrollment.get('class_name', 'N/A'),
                    'payment_date': None,
                    'payment_method': None,
                    'created_at': datetime.now(),
                    'updated_at': datetime.now()
                }
                self.collection.add(payment_data)
                generated_count += 1

            return {"generated": generated_count, "existing": existing_count}

        except Exception as e:
            logging.error(f"Erro ao gerar cobranças mensais para {month}/{year}: {e}", exc_info=True)
            raise

    def get_financial_status(self, year, month):
        """
        Retorna um status financeiro detalhado, buscando pagamentos e enriquecendo com
        detalhes do aluno e da turma.
        """
        summary = {'total_paid': 0, 'total_pending': 0, 'total_overdue': 0}
        paid_payments = []
        pending_payments = []
        today = date.today()

        try:
            # --- CORREÇÃO APLICADA AQUI: Consulta atualizada para a sintaxe moderna ---
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
        """Registra um pagamento para uma cobrança existente."""
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

