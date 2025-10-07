import logging
from firebase_admin import messaging, firestore

class NotificationService:
    def __init__(self, db, enrollment_service=None):
        self.db = db
        self.tokens_collection = self.db.collection('push_tokens')
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
        if not user_ids:
            return []
        
        try:
            # --- CORREÇÃO APLICADA AQUI ---
            # A consulta agora busca os documentos diretamente pelos seus IDs,
            # que é a forma correta, já que estamos usando o user_id como ID do documento.
            refs_to_get = [self.tokens_collection.document(uid) for uid in user_ids]
            
            # O método get_all pode buscar múltiplos documentos de forma eficiente.
            docs = self.db.get_all(refs_to_get)

            for doc in docs:
                if doc.exists:
                    token_data = doc.to_dict()
                    if 'token' in token_data:
                        tokens.append(token_data['token'])
        except Exception as e:
            logging.error(f"Erro ao buscar tokens para usuários {user_ids}: {e}")
        
        return tokens

    def _get_all_student_tokens(self):
        """Busca todos os tokens de notificação salvos no sistema."""
        tokens = []
        try:
            all_tokens_docs = self.tokens_collection.stream()
            for doc in all_tokens_docs:
                token_data = doc.to_dict()
                if 'token' in token_data:
                    tokens.append(token_data['token'])
        except Exception as e:
            logging.error(f"Erro ao buscar todos os tokens: {e}")
        return tokens

    def send_targeted_notification(self, title, body, target_type='all', target_ids=None):
        """Envia uma notificação para um público-alvo específico."""
        tokens = []
        if target_type == 'all':
            tokens = self._get_all_student_tokens()
        elif target_type == 'class' and target_ids and self.enrollment_service:
            class_id = target_ids[0]
            student_ids = self.enrollment_service.get_student_ids_by_class_id(class_id)
            tokens = self._get_tokens_for_users(student_ids)
        elif target_type == 'individual' and target_ids:
            tokens = self._get_tokens_for_users(target_ids)

        if not tokens:
            return {"success": 0, "failure": 0, "total": 0, "error": "Nenhum destinatário com token de notificação encontrado."}

        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            tokens=tokens,
        )

        try:
            response = messaging.send_multicast(message)
            return {
                "success": response.success_count, 
                "failure": response.failure_count,
                "total": len(tokens)
            }
        except Exception as e:
            logging.error(f"Erro ao enviar multicast de notificação: {e}")
            raise

