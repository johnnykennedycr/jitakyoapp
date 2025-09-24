import calendar
from datetime import date, datetime
import logging

class PaymentService:
    def __init__(self, db, enrollment_service=None, user_service=None, training_class_service=None):
        self.db = db
        self.collection = self.db.collection('payments')
        self.enrollment_service = enrollment_service
        self.user_service = user_service
        self.training_class_service = training_class_service

    def generate_monthly_payments(self, year, month):
        """
        Gera as cobranças de mensalidade para todos os alunos com matrículas ativas
        para um determinado mês e ano, evitando duplicatas.
        """
        try:
            active_enrollments = self.enrollment_service.get_all_active_enrollments_with_details()
            
            # Agrupa matrículas por aluno para consolidar a cobrança
            student_enrollments = {}
            for enr in active_enrollments:
                student_id = enr['student_id']
                if student_id not in student_enrollments:
                    student_enrollments[student_id] = []
                student_enrollments[student_id].append(enr)

            generated_count = 0
            existing_count = 0

            for student_id, enrollments in student_enrollments.items():
                # Verifica se já existe uma cobrança de mensalidade para este aluno no mês/ano
                existing_payment_query = self.collection.where('student_id', '==', student_id) \
                                                       .where('reference_year', '==', year) \
                                                       .where('reference_month', '==', month) \
                                                       .where('description', '==', f"Mensalidade {month:02d}/{year}") \
                                                       .limit(1).stream()
                
                if len(list(existing_payment_query)) > 0:
                    existing_count += 1
                    continue

                # Calcula o valor total devido e o vencimento
                total_due = sum(float(enr.get('base_monthly_fee', 0)) - float(enr.get('discount_amount', 0)) for enr in enrollments)
                due_day = min(int(enr.get('due_day', 15)) for enr in enrollments)

                payment_data = {
                    'student_id': student_id,
                    'amount': total_due,
                    'status': 'pending',
                    'reference_month': month,
                    'reference_year': year,
                    'due_day': due_day,
                    'description': f"Mensalidade {month:02d}/{year}",
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
        Retorna um status financeiro detalhado para um mês/ano, separado por
        pagamentos realizados e pendentes.
        """
        summary = {'total_paid': 0, 'total_pending': 0, 'total_overdue': 0}
        paid_payments = []
        pending_payments = []
        today = date.today()

        try:
            # 1. Busca todos os pagamentos do mês de referência
            payments_query = self.collection.where('reference_year', '==', year).where('reference_month', '==', month).stream()
            
            all_payments = [p.to_dict() for p in payments_query]
            
            # Otimização: Busca todos os alunos e turmas de uma vez
            all_students = {s.id: s.name for s in self.user_service.get_users_by_role('student')}
            all_classes = {c['id']: c['name'] for c in self.training_class_service.get_all_classes()}

            for payment in all_payments:
                student_name = all_students.get(payment.get('student_id'), "Aluno Desconhecido")
                payment['student_name'] = student_name

                # Para pagamentos de mensalidade, busca o nome da turma da matrícula associada
                if payment.get('enrollment_id'):
                     # Esta parte pode ser otimizada se necessário
                    enrollment_doc = self.enrollment_service.collection.document(payment['enrollment_id']).get()
                    if enrollment_doc.exists:
                        class_id = enrollment_doc.to_dict().get('class_id')
                        payment['class_name'] = all_classes.get(class_id, "Turma Desconhecida")
                else:
                    payment['class_name'] = "N/A" # Para pagamentos avulsos
                
                amount = float(payment.get('amount', 0))

                if payment.get('status') == 'paid':
                    summary['total_paid'] += amount
                    paid_payments.append(payment)
                else:
                    _, last_day = calendar.monthrange(year, month)
                    due_day = min(int(payment.get('due_day', 15)), last_day)
                    due_date = date(year, month, due_day)
                    payment['due_date_formatted'] = due_date.strftime('%d/%m/%Y')

                    if due_date < today:
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
        payment_id = data.get('payment_id') # Assumimos que o frontend enviará o ID do documento de pagamento
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

