from datetime import datetime, date
from firebase_admin import firestore
from app.models.payment import Payment
import calendar

class PaymentService:
    def __init__(self, db, enrollment_service, user_service, training_class_service):
        self.db = db
        self.collection = self.db.collection('payments')
        self.enrollment_service = enrollment_service
        self.user_service = user_service
        self.training_class_service = training_class_service

    def get_financial_status(self, year, month):
        """
        Calcula o status financeiro com uma lógica invertida e mais robusta,
        partindo das matrículas ativas.
        """
        summary = {'paid': 0, 'pending': 0, 'overdue': 0}
        student_finances = {} # Dicionário para agregar dados por aluno
        today = date.today()

        all_enrollments = self.enrollment_service.get_all_active_enrollments()
        
        for enrollment in all_enrollments:
            student_id = enrollment.student_id
            
            # Inicializa o dicionário para o aluno se for a primeira vez
            if student_id not in student_finances:
                student = self.user_service.get_user_by_id(student_id)
                if not student:
                    continue # Pula matrículas de alunos não encontrados
                student_finances[student_id] = {
                    'student_id': student.id,
                    'name': student.name,
                    'monthly_fee': 0,
                    'due_days': [],
                    'status': 'pending' # Status inicial
                }

            # Acumula o valor da mensalidade
            base_fee = float(getattr(enrollment, 'base_monthly_fee', 0) or 0)
            discount = float(getattr(enrollment, 'discount_amount', 0) or 0)
            student_finances[student_id]['monthly_fee'] += (base_fee - discount)
            
            # Acumula os dias de vencimento
            if hasattr(enrollment, 'due_day') and str(enrollment.due_day).isdigit():
                student_finances[student_id]['due_days'].append(int(enrollment.due_day))

        # Processa cada aluno para determinar o status final
        final_student_list = []
        for student_id, data in student_finances.items():
            if data['monthly_fee'] <= 0:
                continue

            payment = self.get_payment_for_student(student_id, year, month)
            
            effective_due_day = min(data['due_days']) if data['due_days'] else 15
            last_day_of_month = calendar.monthrange(year, month)[1]
            actual_due_day = min(effective_due_day, last_day_of_month)
            due_date = date(year, month, actual_due_day)
            
            if payment:
                data['status'] = 'paid'
                payment_amount = float(getattr(payment, 'amount', 0) or 0)
                summary['paid'] += payment_amount
                data['payment_id'] = payment.id
            elif today > due_date:
                data['status'] = 'overdue'
                summary['overdue'] += data['monthly_fee']
            else:
                data['status'] = 'pending'
                summary['pending'] += data['monthly_fee']

            data['due_day'] = effective_due_day
            del data['due_days'] # Limpa o campo auxiliar
            final_student_list.append(data)

        final_student_list.sort(key=lambda x: x['name'])
        
        return {'summary': summary, 'students': final_student_list}

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

