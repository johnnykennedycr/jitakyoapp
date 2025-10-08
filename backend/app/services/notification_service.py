import logging
from datetime import datetime, timezone
from firebase_admin import messaging, firestore

class NotificationService:
    def __init__(self, db, enrollment_service=None, user_service=None):
        self.db = db
        self.tokens_collection = self.db.collection('push_tokens')
        self.users_collection = self.db.collection('users')
        self.log_collection = self.db.collection('sent_notifications_log')
        self.enrollment_service = enrollment_service
        self.user_service = user_service

    def save_token(self, user_id, token):
        """Salva ou atualiza o token de notificação de um usuário."""
        try:
            token_ref = self.tokens_collection.document(user_id)
            token_ref.set({'token': token, 'user_id': user_id}, merge=True)
            return True
        except Exception as e:
            logging.error(f"Erro ao salvar token para o usuário {user_id}: {e}")
            return False

    def _get_tokens_for_users(self, user_ids):
        """Busca os tokens de notificação para uma lista de IDs de usuário."""
        tokens = []
        if not user_ids:
            print("[DIAGNÓSTICO] _get_tokens_for_users: Nenhum user_id fornecido.")
            return []
        
        try:
            print(f"[DIAGNÓSTICO] _get_tokens_for_users: Buscando tokens para os seguintes IDs: {user_ids}")
            
            refs_to_get = [self.tokens_collection.document(uid) for uid in user_ids]
            docs = self.db.get_all(refs_to_get)

            for doc in docs:
                if doc.exists:
                    token_data = doc.to_dict()
                    if 'token' in token_data:
                        tokens.append(token_data['token'])
                        print(f"[DIAGNÓSTICO] _get_tokens_for_users: Token encontrado para o usuário {doc.id}.")
                    else:
                        print(f"[DIAGNÓSTICO] _get_tokens_for_users: Documento existe para {doc.id}, mas não tem o campo 'token'.")
                else:
                    print(f"[DIAGNÓSTICO] _get_tokens_for_users: Nenhum documento de token encontrado para um dos IDs.")
            
            print(f"[DIAGNÓSTICO] _get_tokens_for_users: Total de tokens encontrados: {len(tokens)}")
            return tokens
        except Exception as e:
            logging.error(f"Erro ao buscar tokens para usuários {user_ids}: {e}")
            return []

    def _get_all_student_tokens(self):
        # ... (código existente)
        return [] # Simplesmente para o exemplo, mantenha sua lógica original aqui

    def send_targeted_notification(self, title, body, target_type='all', target_ids=None):
        """Envia uma notificação e salva o histórico."""
        print(f"[DIAGNÓSTICO] send_targeted_notification: Iniciando envio. Alvo: {target_type}, IDs: {target_ids}")
        tokens_map = {}
        student_ids_to_notify = []

        if target_type == 'all':
            # Sua lógica para buscar todos os alunos
            pass
        elif target_type == 'class' and target_ids:
            class_id = target_ids[0]
            print(f"[DIAGNÓSTICO] Buscando alunos para a turma ID: {class_id}")
            student_ids_to_notify = self.enrollment_service.get_student_ids_by_class_id(class_id)
            print(f"[DIAGNÓSTICO] Alunos encontrados na turma: {student_ids_to_notify}")
        elif target_type == 'individual' and target_ids:
            student_ids_to_notify = target_ids
        
        tokens = self._get_tokens_for_users(student_ids_to_notify)
        print(f"[DIAGNÓSTICO] Lista final de tokens para envio: {tokens}")

        if not tokens:
            return {"success": 0, "failure": 0, "total": 0, "error": "Nenhum destinatário com token de notificação encontrado."}

        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            tokens=tokens,
        )

        try:
            response = messaging.send_multicast(message)
            print(f"[DIAGNÓSTICO] Resposta do FCM: Sucesso: {response.success_count}, Falha: {response.failure_count}")

            now = datetime.now(timezone.utc)
            notification_data = {'title': title, 'body': body, 'created_at': now, 'read': False}
            
            batch = self.db.batch()
            for user_id in student_ids_to_notify:
                user_notif_ref = self.users_collection.document(user_id).collection('notifications').document()
                batch.set(user_notif_ref, notification_data)
            batch.commit()
            print(f"[DIAGNÓSTICO] Histórico salvo para {len(student_ids_to_notify)} alunos.")

            log_data = {
                'title': title, 'body': body, 'sent_at': now, 'target_type': target_type,
                'target_ids': target_ids, 'success_count': response.success_count,
                'failure_count': response.failure_count, 'total_recipients': len(tokens)
            }
            self.log_collection.add(log_data)
            print("[DIAGNÓSTICO] Log de envio salvo para o admin.")

            return {"success": response.success_count, "failure": response.failure_count, "total": len(tokens)}
        except Exception as e:
            logging.error(f"Erro ao enviar e salvar notificação: {e}")
            raise

    def get_sent_notification_history(self):
        history = []
        try:
            docs = self.log_collection.order_by('sent_at', direction=firestore.Query.DESCENDING).limit(50).stream()
            for doc in docs:
                log_data = doc.to_dict()
                log_data['id'] = doc.id
                history.append(log_data)
        except Exception as e:
            logging.error(f"Erro ao buscar histórico de notificações: {e}")
        return history

