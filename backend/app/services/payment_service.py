import calendar
from datetime import datetime, date
from firebase_admin import firestore
from app.models.payment import Payment

class PaymentService:
    def __init__(self, db, enrollment_service, user_service, training_class_service):
        self.db = db
        self.collection = self.db.collection('payments')
        self.enrollment_service = enrollment_service
        self.user_service = user_service
        self.training_class_service = training_class_service

    def get_financial_status(self, year, month):
        """Busca e calcula o status financeiro para um determinado mês e ano."""
        summary = {
            "total_paid": 0,
            "total_pending": 0,
            "total_overdue": 0,
            "total_due": 0
        }
        student_financials = {}

        # 1. Começamos pelas matrículas ativas para garantir que estamos lidando com alunos relevantes.
        active_enrollments = self.enrollment_service.get_all_active_enrollments()
        
        # 2. Agrupamos as matrículas por aluno.
        enrollments_by_student = {}
        for enrollment in active_enrollments:
            if enrollment.student_id not in enrollments_by_student:
                enrollments_by_student[enrollment.student_id] = []
            enrollments_by_student[enrollment.student_id].append(enrollment)

        # 3. Processamos cada aluno que tem matrícula ativa.
        for student_id, enrollments in enrollments_by_student.items():
            student = self.user_service.get_user_by_id(student_id)
            if not student:
                continue

            # Calcula o valor total devido para o mês com base em todas as matrículas do aluno.
            monthly_total = sum(
                (enroll.base_monthly_fee or 0) - (enroll.discount_amount or 0)
                for enroll in enrollments
            )

            if monthly_total <= 0:
                continue

            # Determina o dia de vencimento (usa o menor dia de todas as matrículas).
            due_day = min(e.due_day for e in enrollments if e.due_day)
            
            # Garante que due_day é um número inteiro válido
            try:
                due_day = int(due_day)
            except (ValueError, TypeError):
                due_day = 15 # Padrão do sistema

            # Lógica de data robusta para evitar dias inválidos (ex: 31 de Fev)
            last_day_of_month = calendar.monthrange(year, month)[1]
            effective_due_day = min(due_day, last_day_of_month)
            due_date = date(year, month, effective_due_day)
            
            # Verifica se já existe um pagamento para este aluno no mês/ano de referência
            payment_doc = self.get_payment_for_student(student_id, year, month)
            
            status = 'pending'
            if payment_doc:
                if payment_doc.status == 'paid':
                    status = 'paid'
                    summary['total_paid'] += payment_doc.amount or 0
            elif date.today() > due_date:
                status = 'overdue'

            if status == 'pending':
                summary['total_pending'] += monthly_total
            elif status == 'overdue':
                summary['total_overdue'] += monthly_total
            
            summary['total_due'] += monthly_total

            student_financials[student_id] = {
                "id": student_id,
                "name": student.name,
                "total_due": monthly_total,
                "status": status,
                "due_date": due_date.strftime('%d/%m/%Y')
            }
            
        return {
            "summary": summary,
            "students": list(student_financials.values())
        }

    def record_payment(self, data):
        """Registra um novo pagamento ou atualiza um existente."""
        student_id = data.get('student_id')
        year = int(data.get('reference_year'))
        month = int(data.get('reference_month'))

        # Procura por um pagamento 'pending' ou 'overdue' para o mesmo período
        existing_payment = self.get_payment_for_student(student_id, year, month)

        if existing_payment and existing_payment.status == 'paid':
            raise ValueError("Já existe um pagamento confirmado para este aluno neste mês.")

        payment_data = {
            'student_id': student_id,
            'amount': float(data.get('amount')),
            'payment_date': datetime.strptime(data.get('payment_date'), '%Y-%m-%d'),
            'reference_month': month,
            'reference_year': year,
            'status': 'paid',
            'updated_at': firestore.SERVER_TIMESTAMP
        }
        
        if existing_payment:
            # Atualiza o pagamento existente
            doc_ref = self.collection.document(existing_payment.id)
            doc_ref.update(payment_data)
        else:
            # Cria um novo registro de pagamento
            payment_data['created_at'] = firestore.SERVER_TIMESTAMP
            self.collection.add(payment_data)
        
        return True

    def get_payment_for_student(self, student_id, year, month):
        """Busca um pagamento para um aluno em um mês/ano específico."""
        docs = self.collection.where('student_id', '==', student_id).where('reference_year', '==', year).where('reference_month', '==', month).limit(1).stream()
        for doc in docs:
            return Payment.from_dict(doc.to_dict(), doc.id)
        return None
        
    def generate_monthly_payments(self, year, month):
        """
        Gera as cobranças para todas as matrículas ativas para um determinado mês/ano.
        Esta função é idempotente: ela não criará cobranças duplicadas.
        """
        active_enrollments = self.enrollment_service.get_all_active_enrollments()
        
        enrollments_by_student = {}
        for enrollment in active_enrollments:
            if enrollment.student_id not in enrollments_by_student:
                enrollments_by_student[enrollment.student_id] = []
            enrollments_by_student[enrollment.student_id].append(enrollment)

        generated_count = 0
        skipped_count = 0

        for student_id, enrollments in enrollments_by_student.items():
            # Verifica se já existe uma cobrança para este aluno neste mês
            existing_payment = self.get_payment_for_student(student_id, year, month)
            if existing_payment:
                skipped_count += 1
                continue

            # Calcula o valor total e o vencimento
            total_due = sum((e.base_monthly_fee or 0) - (e.discount_amount or 0) for e in enrollments)
            due_day = min(e.due_day for e in enrollments if e.due_day)

            if total_due > 0:
                payment_data = {
                    'student_id': student_id,
                    'class_id': enrollments[0].class_id, # Associa à primeira turma encontrada
                    'enrollment_id': enrollments[0].id,
                    'amount': total_due,
                    'status': 'pending',
                    'reference_year': year,
                    'reference_month': month,
                    'due_date': datetime(year, month, int(due_day)),
                    'created_at': firestore.SERVER_TIMESTAMP,
                    'updated_at': firestore.SERVER_TIMESTAMP
                }
                self.collection.add(payment_data)
                generated_count += 1
        
        return {"generated": generated_count, "skipped": skipped_count}

