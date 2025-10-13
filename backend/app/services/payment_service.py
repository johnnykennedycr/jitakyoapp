import os
import calendar
from datetime import date, datetime, timezone, timedelta
import logging
from firebase_admin import firestore
import mercadopago
from collections import defaultdict

class PaymentService:
    def __init__(self, db, enrollment_service=None, user_service=None, training_class_service=None):
        self.db = db
        self.collection = self.db.collection('payments')
        self.enrollment_service = enrollment_service
        self.user_service = user_service
        self.training_class_service = training_class_service
        # Inicializa o SDK do Mercado Pago
        access_token = os.getenv("MERCADO_PAGO_ACCESS_TOKEN")
        if access_token:
            self.sdk = mercadopago.SDK(access_token)
        else:
            self.sdk = None
            print("AVISO: MERCADO_PAGO_ACCESS_TOKEN não está configurado. A funcionalidade de pagamento estará desabilitada.")

    def create_payment_preference(self, payment_id, user, cpf=None):
        """Cria uma preferência de pagamento no Mercado Pago."""
        if not self.sdk:
            raise Exception("SDK do Mercado Pago não inicializado.")

        payment_doc = self.collection.document(payment_id).get()
        if not payment_doc.exists or payment_doc.to_dict().get('student_id') != user.id:
            raise ValueError("Fatura não encontrada ou não pertence a este usuário.")
        
        payment_data = payment_doc.to_dict()
        description = payment_data.get('description', f"{payment_data.get('type', 'Fatura')} - {payment_data.get('reference_month')}/{payment_data.get('reference_year')}")

        base_api_url = os.getenv("BASE_API_URL", "https://jitakyoapp-217073545024.southamerica-east1.run.app")

        preference_data = {
            "items": [
                {
                    "title": description,
                    "quantity": 1,
                    "unit_price": float(payment_data.get('amount'))
                }
            ],
            "payer": {
                "name": user.name,
                "email": user.email,
            },
            "back_urls": {
                "success": "https://aluno-jitakyoapp.web.app",
                "failure": "https://aluno-jitakyoapp.web.app",
                "pending": "https://aluno-jitakyoapp.web.app"
            },
            "auto_return": "approved",
            "payment_methods": {
                "excluded_payment_methods": [],
                "excluded_payment_types": []
            },
            "external_reference": payment_id,
            "notification_url": f"{base_api_url}/api/payments/webhook"
        }
        
        if cpf:
            cleaned_cpf = "".join(filter(str.isdigit, cpf))
            if cleaned_cpf:
                preference_data["payer"]["identification"] = {
                    "type": "CPF",
                    "number": cleaned_cpf
                }
        
        preference_response = self.sdk.preference().create(preference_data)
        preference = preference_response["response"]
        return preference["id"]

    def process_payment(self, payment_id, mp_data, user_id):
        """Processa o pagamento usando o SDK do Mercado Pago no lado do servidor."""
        if not self.sdk:
            return {"status": "failed", "message": "O sistema de pagamentos não está configurado."}
            
        try:
            payment_doc_ref = self.collection.document(payment_id)
            payment_doc = payment_doc_ref.get()
            if not payment_doc.exists or payment_doc.to_dict().get('student_id') != user_id:
                return {"status": "failed", "message": "Fatura não encontrada ou não pertence a este usuário."}

            form_data = mp_data.get("formData", {})
            payment_method_id = form_data.get("payment_method_id")
            
            if not payment_method_id:
                logging.error(f"payment_method_id está faltando nos dados do brick: {mp_data}")
                return {"status": "failed", "message": "O método de pagamento não foi informado. Por favor, selecione um método válido e tente novamente."}

            payment_info_from_db = payment_doc.to_dict()
            transaction_amount_from_db = float(payment_info_from_db.get("amount", 0.0))

            if transaction_amount_from_db <= 0:
                return {"status": "failed", "message": "O valor da fatura é inválido ou nulo."}

            payment_data_to_send = {
                "transaction_amount": transaction_amount_from_db,
                "token": form_data.get("token"),
                "description": payment_info_from_db.get('description', 'Pagamento JitaKyoApp'),
                "installments": int(form_data.get("installments", 1)),
                "payment_method_id": payment_method_id,
                "payer": {
                    "email": form_data.get("payer", {}).get("email"),
                    "identification": {
                        "type": form_data.get("payer", {}).get("identification", {}).get("type"),
                        "number": form_data.get("payer", {}).get("identification", {}).get("number")
                    }
                },
                "external_reference": payment_id,
                "notification_url": f"{os.getenv('BASE_API_URL', 'https://jitakyoapp-217073545024.southamerica-east1.run.app')}/api/payments/webhook"
            }

            payment_response = self.sdk.payment().create(payment_data_to_send)
            payment_result = payment_response["response"]

            if payment_result.get("status") == "approved":
                update_data = {
                    'status': 'paid',
                    'payment_date': datetime.now(timezone.utc),
                    'payment_method': payment_result.get("payment_method_id"),
                    'updated_at': datetime.now(timezone.utc),
                    'mercado_pago_payment_id': payment_result.get("id")
                }
                payment_doc_ref.update(update_data)
                return {"status": "success", "message": "Pagamento aprovado!", "paymentId": payment_result.get("id")}
            else:
                error_message = payment_result.get("message", "Pagamento recusado pelo processador.")
                if "causes" in payment_result and payment_result["causes"] and payment_result["causes"][0].get("description"):
                    error_message = payment_result["causes"][0]["description"]

                logging.warning(f"Pagamento falhou para a fatura {payment_id}. Resposta do MP: {payment_result}")
                return {"status": "failed", "message": error_message, "paymentInfo": payment_result}

        except Exception as e:
            logging.error(f"Erro EXCEPCIONAL ao processar pagamento para a fatura {payment_id}: {e}", exc_info=True)
            return {"status": "failed", "message": f"Ocorreu um erro inesperado no servidor: {e}"}
            
    def handle_webhook_notification(self, notification_data):
        """Processa uma notificação de webhook recebida do Mercado Pago."""
        if not self.sdk:
            print("AVISO: Webhook recebido, mas SDK do Mercado Pago não está configurado.")
            return False

        try:
            if notification_data.get("type") == "payment":
                mp_payment_id = notification_data["data"]["id"]
                print(f"INFO: Recebida notificação de pagamento para o ID: {mp_payment_id}")
                
                payment_info_response = self.sdk.payment().get(mp_payment_id)
                payment_info = payment_info_response["response"]
                
                external_reference = payment_info.get("external_reference")
                payment_status = payment_info.get("status")

                if not external_reference:
                    print(f"AVISO: Webhook para o pagamento {mp_payment_id} não possui referência externa. Ignorando.")
                    return False

                if payment_status == "approved":
                    payment_doc_ref = self.collection.document(external_reference)
                    payment_doc = payment_doc_ref.get()
                    
                    if payment_doc.exists and payment_doc.to_dict().get('status') != 'paid':
                        print(f"INFO: Atualizando fatura {external_reference} para 'pago' via webhook.")
                        update_data = {
                            'status': 'paid',
                            'payment_date': datetime.now(timezone.utc),
                            'payment_method': payment_info.get("payment_method_id"),
                            'updated_at': datetime.now(timezone.utc),
                            'mercado_pago_payment_id': mp_payment_id
                        }
                        payment_doc_ref.update(update_data)
                        return True
                    else:
                        print(f"INFO: Fatura {external_reference} não encontrada ou já estava paga. Nenhuma ação necessária.")
                        
            return True
        except Exception as e:
            logging.error(f"Erro ao processar notificação de webhook: {e}", exc_info=True)
            return False

    def generate_monthly_payments(self, year, month):
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
                _, last_day_of_month = calendar.monthrange(int(year), int(month))
                valid_due_day = min(due_day, last_day_of_month)
                due_date_obj = datetime(int(year), int(month), valid_due_day, tzinfo=timezone.utc)

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
                    'description': f"Mensalidade {enrollment.get('class_name', 'N/A')} - {int(month)}/{int(year)}",
                    'class_name': enrollment.get('class_name', 'N/A'),
                    'payment_date': None,
                    'payment_method': None,
                    'created_at': datetime.now(timezone.utc),
                    'updated_at': datetime.now(timezone.utc)
                }
                self.collection.add(payment_data)
                generated_count += 1
            
            return {"generated": generated_count, "skipped": existing_count}

        except Exception as e:
            logging.error(f"Erro ao gerar cobranças mensais para {month}/{year}: {e}", exc_info=True)
            raise

    def get_charges_by_user_id(self, user_id):
        """Busca todas as cobranças (pagas e pendentes) para um aluno específico, ordenadas no backend."""
        try:
            docs = self.collection.where('student_id', '==', user_id).stream()
            charges = []
            for doc in docs:
                charge_data = doc.to_dict()
                charge_data['id'] = doc.id
                charges.append(charge_data)
            
            charges.sort(key=lambda x: x.get('due_date') or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
            
            return charges
        except Exception as e:
            print(f"Erro ao buscar cobranças para o usuário {user_id}: {e}")
            return []

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
        """Registra um pagamento para uma cobrança existente."""
        payment_id = data.get('payment_id')
        if not payment_id:
            raise ValueError("ID do pagamento é obrigatório.")

        payment_ref = self.collection.document(payment_id)
        
        update_data = {
            'status': 'paid',
            'amount': float(data.get('amount')),
            'payment_date': datetime.strptime(data.get('payment_date'), '%Y-%m-%d').replace(tzinfo=timezone.utc),
            'payment_method': data.get('payment_method'),
            'payment_method_details': data.get('payment_method_details', ''),
            'updated_at': datetime.now(timezone.utc)
        }
        payment_ref.update(update_data)
        return True

    def create_misc_invoices(self, data):
        student_ids = data.get('student_ids', [])
        invoice_type = data.get('type')
        amount = float(data.get('amount', 0))
        due_date_str = data.get('due_date')

        if not all([student_ids, invoice_type, amount > 0, due_date_str]):
            raise ValueError("Dados insuficientes para criar faturas avulsas.")

        due_date = datetime.strptime(due_date_str, '%Y-%m-%d')
        
        created_count = 0
        for student_id in student_ids:
            payment_data = {
                'student_id': student_id,
                'enrollment_id': None,
                'amount': amount,
                'status': 'pending',
                'reference_month': due_date.month,
                'reference_year': due_date.year,
                'due_day': due_date.day,
                'due_date': due_date.replace(tzinfo=timezone.utc),
                'type': invoice_type,
                'description': invoice_type,
                'class_name': 'N/A',
                'payment_date': None,
                'payment_method': None,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc)
            }
            self.collection.add(payment_data)
            created_count += 1
            
        return created_count

    # --- NOVOS MÉTODOS PARA O DASHBOARD ---

    def get_financial_summary_for_dashboard(self):
        """Calcula o faturamento do mês atual e o total de inadimplência."""
        now = datetime.now(timezone.utc)
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        total_paid_this_month = 0
        total_overdue = 0

        try:
            # Calcula faturamento do mês
            paid_docs = self.collection.where(filter=firestore.And([
                firestore.FieldFilter('status', '==', 'paid'),
                firestore.FieldFilter('payment_date', '>=', start_of_month)
            ])).stream()
            for doc in paid_docs:
                total_paid_this_month += doc.to_dict().get('amount', 0)

            # Calcula inadimplência total
            overdue_docs = self.collection.where(filter=firestore.And([
                firestore.FieldFilter('status', '==', 'pending'),
                firestore.FieldFilter('due_date', '<', now)
            ])).stream()
            for doc in overdue_docs:
                total_overdue += doc.to_dict().get('amount', 0)

            return {
                "total_paid_this_month": total_paid_this_month,
                "total_overdue": total_overdue
            }
        except Exception as e:
            print(f"Erro ao calcular resumo financeiro do dashboard: {e}")
            return {"total_paid_this_month": 0, "total_overdue": 0}

    def get_recent_payments(self, limit=5):
        """Busca os pagamentos mais recentes."""
        recent_payments = []
        try:
            # Busca os alunos para enriquecer os dados
            all_students = {s.id: s.name for s in self.user_service.get_users_by_role('student')}

            docs = self.collection.where('status', '==', 'paid') \
                                 .order_by('payment_date', direction=firestore.Query.DESCENDING) \
                                 .limit(limit).stream()
            for doc in docs:
                payment_data = doc.to_dict()
                payment_data['id'] = doc.id
                payment_data['student_name'] = all_students.get(payment_data.get('student_id'), "Aluno Desconhecido")
                recent_payments.append(payment_data)
            return recent_payments
        except Exception as e:
            print(f"Erro ao buscar pagamentos recentes: {e}")
            return []
            
    def get_students_by_discipline(self):
        """Conta o número de alunos matriculados por modalidade."""
        counts = defaultdict(int)
        try:
            active_enrollments = self.enrollment_service.get_all_active_enrollments_with_details()
            
            # Mapeia class_id para discipline para evitar buscas repetidas
            all_classes = self.training_class_service.get_all_classes()
            class_discipline_map = {c['id']: c.get('discipline', 'Sem Modalidade') for c in all_classes}
            
            student_disciplines = defaultdict(set)
            
            # Para cada matrícula, associa o aluno à modalidade da turma
            for enrollment in active_enrollments:
                student_id = enrollment['student_id']
                class_id = enrollment['class_id']
                discipline = class_discipline_map.get(class_id)
                if discipline:
                    student_disciplines[student_id].add(discipline)
            
            # Conta quantos alunos únicos existem em cada modalidade
            for disciplines in student_disciplines.values():
                for discipline in disciplines:
                    counts[discipline] += 1
            
            # Formata a saída para o gráfico
            sorted_disciplines = sorted(counts.keys())
            chart_data = {
                'labels': sorted_disciplines,
                'data': [counts[d] for d in sorted_disciplines]
            }
            return chart_data
        except Exception as e:
            print(f"Erro ao contar alunos por modalidade: {e}")
            return {'labels': [], 'data': []}

