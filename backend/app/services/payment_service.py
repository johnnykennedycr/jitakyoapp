# services/payment_service.py
from firebase_admin import firestore
from app.models.payment import Payment 
from datetime import datetime
from google.cloud.firestore_v1.base_query import FieldFilter, And

class PaymentService:
    def __init__(self, db, enrollment_service=None):
        self.db = db
        self.payments_collection = self.db.collection('payments')
        self.enrollment_service = enrollment_service

    def generate_monthly_charges(self, year, month, due_day=10):
        if not self.enrollment_service:
            print("Erro: EnrollmentService não foi fornecido ao PaymentService.")
            return {"created": 0, "skipped": 0, "errors": 1, "message": "Serviço de matrícula não configurado."}

        print("\n" + "="*20 + " INICIANDO DEBUG DE GERAÇÃO DE COBRANÇAS " + "="*20)
        active_enrollments = self.enrollment_service.get_all_active_enrollments()
        print(f"1. Total de matrículas ativas encontradas: {len(active_enrollments)}")

        month_ref = f"{year}-{month:02d}"
        summary = {"created": 0, "skipped": 0, "errors": 0}

        for enrollment in active_enrollments:
            print(f"\n-> Processando Matrícula ID: {enrollment.id} (Aluno: {enrollment.student_id})")
            try:
                existing_payment_query = self.payments_collection.where(
                    filter=And([
                        FieldFilter('enrollment_id', '==', enrollment.id),
                        FieldFilter('month_reference', '==', month_ref)
                    ])
                ).limit(1).stream()

                if len(list(existing_payment_query)) > 0:
                    summary["skipped"] += 1
                    print("   - Status: Já existe. Pulando.")
                    continue

                # --- PONTO CRÍTICO DO DEBUG ---
                base_fee = getattr(enrollment, 'base_monthly_fee', 0.0)
                discount = getattr(enrollment, 'discount_amount', 0.0)
                
                print(f"   - Atributo base_monthly_fee: {base_fee} (Tipo: {type(base_fee)})")
                print(f"   - Atributo discount_amount: {discount} (Tipo: {type(discount)})")

                final_amount = float(base_fee) - float(discount)
                print(f"   - VALOR FINAL CALCULADO: {final_amount}")
                # --- FIM DO PONTO CRÍTICO ---

                description = f"Mensalidade {month:02d}/{year}"

                if final_amount <= 0:
                    status = 'paid'
                    payment_date = datetime.now()
                    payment_method = 'Bolsa / Isento'
                    description += " (Bolsa)"
                    final_amount = 0
                    print("   - Ação: Criando cobrança como PAGA.")
                else:
                    status = 'pending'
                    payment_date = None
                    payment_method = None
                    print("   - Ação: Criando cobrança como PENDENTE.")

                new_payment = Payment(
                    student_id=enrollment.student_id,
                    class_id=enrollment.class_id,
                    enrollment_id=enrollment.id,
                    month_reference=month_ref,
                    due_date=datetime(year, month, getattr(enrollment, 'due_day', due_day)),
                    amount=final_amount,
                    status=status,
                    payment_date=payment_date,
                    payment_method=payment_method,
                    description=description
                )

                self.payments_collection.add(new_payment.to_dict())
                summary["created"] += 1
            except Exception as e:
                print(f"   - ❌ ERRO ao gerar cobrança para matrícula {enrollment.id}: {e}")
                summary["errors"] += 1
        
        print("="*20 + " FIM DO DEBUG " + "="*20 + "\n")
        return summary

    def get_pending_and_overdue_payments(self):
        """Busca todos os pagamentos com status 'pending' ou 'overdue'."""
        try:
            query = self.payments_collection.where('status', 'in', ['pending', 'overdue']).order_by('due_date').stream()
            payments = []
            for doc in query:
                payment = Payment.from_dict(doc.to_dict())
                payment.id = doc.id
                payments.append(payment)
            return payments
        except Exception as e:
            print(f"Erro ao buscar pagamentos pendentes e atrasados: {e}")
            return []

    def get_paid_total_for_month(self, year, month):
        """Calcula o total pago em um mês/ano específico."""
        try:
            month_ref = f"{year}-{month:02d}"
            query = self.payments_collection.where(filter=And([
                FieldFilter('month_reference', '==', month_ref),
                FieldFilter('status', '==', 'paid')
            ])).stream()
            
            total = 0.0
            for doc in query:
                payment = Payment.from_dict(doc.to_dict())
                payment.id = doc.id
                if payment.amount:
                    total += payment.amount
            return total
        except Exception as e:
            print(f"Erro ao calcular o total pago para {month_ref}: {e}")
            return 0.0

    def mark_payment_as_paid(self, payment_id, payment_method='N/A'):
        """Marca um pagamento como pago e define a data de pagamento para agora."""
        payment_ref = self.payments_collection.document(payment_id)
        payment_ref.update({
            'status': 'paid',
            'payment_date': datetime.now(),
            'payment_method': payment_method,
            'updated_at': datetime.now()
        })
        return True

    def create_payment(self, student_id, amount, due_date, description, status='pending', payment_date=None):
        payment = Payment(
            student_id=student_id,
            amount=amount,
            due_date=due_date,
            payment_date=payment_date,
            status=status,
            description=description
        )
        payment_dict = payment.to_dict()
        timestamp, doc_ref = self.payments_collection.add(payment_dict)
        payment.id = doc_ref.id
        print(f"Pagamento para o aluno {student_id} ('{description}') criado com ID: {payment.id}")
        return payment

    def get_payment_by_id(self, payment_id):
        doc_ref = self.payments_collection.document(payment_id)
        doc = doc_ref.get()
        if doc.exists:
            # Assumindo que seu from_dict está corrigido
            payment = Payment.from_dict(doc.to_dict())
            payment.id = doc.id
            return payment
        return None

    def get_payments_by_student(self, student_id):
        payments = []
        docs = self.payments_collection.where('student_id', '==', student_id).order_by('due_date').stream()
        for doc in docs:
            payment = Payment.from_dict(doc.to_dict())
            payment.id = doc.id
            payments.append(payment)
        return payments

    def get_payments_by_status(self, status):
        payments = []
        docs = self.payments_collection.where('status', '==', status).order_by('due_date').stream()
        for doc in docs:
            payment = Payment.from_dict(doc.to_dict())
            payment.id = doc.id
            payments.append(payment)
        return payments

    def update_payment(self, payment_id, update_data):
        payment_ref = self.payments_collection.document(payment_id)
        payment_ref.update(update_data)
        print(f"Pagamento com ID '{payment_id}' atualizado.")
        return True
    
    def mark_payment_as_paid(self, payment_id, payment_method='N/A'):
        payment_ref = self.payments_collection.document(payment_id)
        payment_ref.update({
            'status': 'paid',
            'payment_date': datetime.now(),
            'payment_method': payment_method,
            'updated_at': datetime.now()
        })
        print(f"Pagamento com ID '{payment_id}' marcado como pago.")
        return True

    def delete_payment(self, payment_id):
        self.payments_collection.document(payment_id).delete()
        print(f"Pagamento com ID '{payment_id}' deletado.")
        return True
    
    def get_pending_and_overdue_payments(self):
        """Busca todos os pagamentos com status 'pending' ou 'overdue'."""
        try:
            query = self.payments_collection.where('status', 'in', ['pending', 'overdue']).order_by('due_date').stream()
            payments = []
            for doc in query:
                payment = Payment.from_dict(doc.to_dict())
                payment.id = doc.id
                payments.append(payment)
            return payments
        except Exception as e:
            print(f"Erro ao buscar pagamentos pendentes e atrasados: {e}")
            return []

    def get_paid_total_for_month(self, year, month):
        """Calcula o total pago em um mês/ano específico."""
        try:
            month_ref = f"{year}-{month:02d}"
            query = self.payments_collection.where(filter=And([
                FieldFilter('month_reference', '==', month_ref),
                FieldFilter('status', '==', 'paid')
            ])).stream()
            
            total = 0.0
            for doc in query:
                payment = Payment.from_dict(doc.to_dict())
                payment.id = doc.id
                total += payment.amount
            return total
        except Exception as e:
            print(f"Erro ao calcular o total pago para {month_ref}: {e}")
            return 0.0
        
    def get_all_payments_with_filters(self, class_id=None, year=None, month=None, status=None):
        """
        Busca todos os pagamentos, aplicando filtros opcionais, incluindo status.
        """
        try:
            query = self.payments_collection

            if class_id:
                query = query.where('class_id', '==', class_id)
            
            if year and month:
                month_ref = f"{int(year)}-{int(month):02d}"
                query = query.where('month_reference', '==', month_ref)
            
            # --- FILTRO DE STATUS ADICIONADO AQUI ---
            if status:
                query = query.where('status', '==', status)
            
            docs = query.order_by('due_date', direction=firestore.Query.DESCENDING).stream()
            
            payments = []
            for doc in docs:
                payment = Payment.from_dict(doc.to_dict())
                payment.id = doc.id
                payments.append(payment)
            return payments
        except Exception as e:
            print(f"Erro ao buscar pagamentos com filtros: {e}")
            return []
        
    def get_overdue_payments(self):
        """Busca pagamentos pendentes cuja data de vencimento já passou."""
        try:
            today = datetime.now()
            query = self.payments_collection.where('status', '==', 'pending').where('due_date', '<', today).order_by('due_date').stream()
            payments = [self._doc_to_payment(doc) for doc in query]
            return payments
        except Exception as e:
            print(f"Erro ao buscar pagamentos atrasados: {e}")
            return []

    def get_pending_payments(self):
        """Busca pagamentos pendentes cuja data de vencimento está no futuro."""
        try:
            today = datetime.now()
            query = self.payments_collection.where('status', '==', 'pending').where('due_date', '>=', today).order_by('due_date').stream()
            payments = [self._doc_to_payment(doc) for doc in query]
            return payments
        except Exception as e:
            print(f"Erro ao buscar pagamentos pendentes: {e}")
            return []

    def get_recent_paid_payments(self, limit=5):
        """Busca os últimos pagamentos que foram efetuados."""
        try:
            query = self.payments_collection.where('status', '==', 'paid').order_by('payment_date', direction=firestore.Query.DESCENDING).limit(limit).stream()
            payments = [self._doc_to_payment(doc) for doc in query]
            return payments
        except Exception as e:
            print(f"Erro ao buscar pagamentos recentes: {e}")
            return []
        
    def _doc_to_payment(self, doc):
        """Converte um documento do Firestore em um objeto Payment."""
        if not doc.exists:
            return None
        payment = Payment.from_dict(doc.to_dict())
        payment.id = doc.id
        return payment
