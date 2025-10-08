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
        try:
            token_ref = self.tokens_collection.document(user_id)
            token_ref.set({'token': token, 'user_id': user_id}, merge=True)
            return True
        except Exception as e:
            logging.error(f"Erro ao salvar token para o usuário {user_id}: {e}")
            return False

    def _get_tokens_and_ids_for_users(self, user_ids):
        tokens_map = {}
        if not user_ids:
            return tokens_map
        try:
            refs_to_get = [self.tokens_collection.document(uid) for uid in user_ids]
            docs = self.db.get_all(refs_to_get)
            for doc in docs:
                if doc.exists:
                    token_data = doc.to_dict()
                    if 'token' in token_data:
                        tokens_map[doc.id] = token_data['token']
        except Exception as e:
            logging.error(f"Erro ao buscar tokens para usuários {user_ids}: {e}")
        return tokens_map

    def _get_all_student_tokens_and_ids(self):
        tokens_map = {}
        try:
            all_tokens_docs = self.tokens_collection.stream()
            for doc in all_tokens_docs:
                token_data = doc.to_dict()
                if 'token' in token_data:
                    tokens_map[doc.id] = token_data['token']
        except Exception as e:
            logging.error(f"Erro ao buscar todos os tokens: {e}")
        return tokens_map

    def send_targeted_notification(self, title, body, target_type='all', target_ids=None):
        tokens_map = {}
        if target_type == 'all':
            tokens_map = self._get_all_student_tokens_and_ids()
        elif target_type == 'class' and target_ids and self.enrollment_service:
            class_id = target_ids[0]
            student_ids = self.enrollment_service.get_student_ids_by_class_id(class_id)
            tokens_map = self._get_tokens_and_ids_for_users(student_ids)
        elif target_type == 'individual' and target_ids:
            tokens_map = self._get_tokens_and_ids_for_users(target_ids)

        if not tokens_map:
            return {"success": 0, "failure": 0, "total": 0, "error": "Nenhum destinatário com token de notificação encontrado."}

        tokens = list(tokens_map.values())
        user_ids_with_token = list(tokens_map.keys())

        # --- TESTE DE DIAGNÓSTICO ---
        if not tokens:
            return {"success": 0, "failure": 0, "total": 0}

        success_count = 0
        failure_count = 0
        try:
            print(f"[DIAGNÓSTICO] Tentando enviar notificação para o primeiro token: {tokens[0]}")
            message = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                token=tokens[0],
            )
            messaging.send(message)
            success_count = 1
            print("[DIAGNÓSTICO] Envio único bem-sucedido.")
        except Exception as e:
            failure_count = 1
            logging.error(f"Erro no envio único de notificação: {e}")
            raise
        
        now = datetime.now(timezone.utc)
        notification_data = {'title': title, 'body': body, 'created_at': now, 'read': False}
        batch = self.db.batch()
        for user_id in user_ids_with_token:
            user_notif_ref = self.users_collection.document(user_id).collection('notifications').document()
            batch.set(user_notif_ref, notification_data)
        batch.commit()

        log_data = {
            'title': title, 'body': body, 'sent_at': now, 'target_type': target_type,
            'target_ids': target_ids, 'success_count': success_count,
            'failure_count': failure_count, 'total_recipients': 1
        }
        self.log_collection.add(log_data)

        return {"success": success_count, "failure": failure_count, "total": 1}

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

