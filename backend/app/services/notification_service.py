import logging
from datetime import datetime, timezone
from firebase_admin import messaging

class NotificationService:
    def __init__(self, db, enrollment_service=None):
        self.db = db
        self.tokens_collection = self.db.collection('push_tokens')
        self.users_collection = self.db.collection('users')
        self.enrollment_service = enrollment_service

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
        user_id_map = {} # Mapeia token para user_id
        if not user_ids:
            return [], {}
        
        try:
            refs_to_get = [self.tokens_collection.document(uid) for uid in user_ids]
            docs = self.db.get_all(refs_to_get)

            for doc in docs:
                if doc.exists:
                    token_data = doc.to_dict()
                    if 'token' in token_data:
                        token = token_data['token']
                        tokens.append(token)
                        user_id_map[token] = doc.id
        except Exception as e:
            logging.error(f"Erro ao buscar tokens para usuários {user_ids}: {e}")
        
        return tokens, user_id_map

    def _get_all_student_tokens(self):
        """Busca todos os tokens de notificação salvos no sistema."""
        tokens = []
        user_id_map = {}
        try:
            all_tokens_docs = self.tokens_collection.stream()
            for doc in all_tokens_docs:
                token_data = doc.to_dict()
                if 'token' in token_data:
                    token = token_data['token']
                    tokens.append(token)
                    user_id_map[token] = doc.id
        except Exception as e:
            logging.error(f"Erro ao buscar todos os tokens: {e}")
        return tokens, user_id_map
        
    def _save_notification_for_users(self, user_ids, title, body):
        """Salva uma cópia da notificação para cada usuário em uma subcoleção."""
        batch = self.db.batch()
        for user_id in user_ids:
            user_ref = self.users_collection.document(user_id)
            notification_ref = user_ref.collection('notifications').document()
            batch.set(notification_ref, {
                'title': title,
                'body': body,
                'read': False,
                'created_at': datetime.now(timezone.utc)
            })
        try:
            batch.commit()
            logging.info(f"Notificação salva para {len(user_ids)} usuários.")
        except Exception as e:
            logging.error(f"Erro ao salvar notificação em lote: {e}")


    def send_targeted_notification(self, title, body, target_type='all', target_ids=None):
        """Envia uma notificação e salva uma cópia para o histórico."""
        tokens = []
        user_id_map = {}
        target_user_ids = []

        if target_type == 'all':
            tokens, user_id_map = self._get_all_student_tokens()
            target_user_ids = list(user_id_map.values())
        elif target_type == 'class' and target_ids and self.enrollment_service:
            class_id = target_ids[0]
            target_user_ids = self.enrollment_service.get_student_ids_by_class_id(class_id)
            tokens, user_id_map = self._get_tokens_for_users(target_user_ids)
        elif target_type == 'individual' and target_ids:
            target_user_ids = target_ids
            tokens, user_id_map = self._get_tokens_for_users(target_user_ids)

        if not tokens:
            return {"success": 0, "failure": 0, "total": 0, "error": "Nenhum destinatário com token de notificação encontrado."}

        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            tokens=tokens,
        )

        try:
            response = messaging.send_multicast(message)
            
            # Identifica para quais usuários a notificação foi enviada com sucesso
            successful_tokens = [tokens[i] for i, res in enumerate(response.responses) if res.success]
            successful_user_ids = [user_id_map[token] for token in successful_tokens if token in user_id_map]

            # Salva a notificação apenas para quem recebeu
            if successful_user_ids:
                self._save_notification_for_users(successful_user_ids, title, body)

            return {
                "success": response.success_count, 
                "failure": response.failure_count,
                "total": len(tokens)
            }
        except Exception as e:
            logging.error(f"Erro ao enviar multicast de notificação: {e}")
            raise

