from firebase_admin import messaging, firestore

class NotificationService:
    def __init__(self, db):
        self.db = db
        self.collection = self.db.collection('push_subscriptions')

    def save_token(self, user_id, token):
        """Salva ou atualiza o token de inscrição de um usuário."""
        try:
            # Usamos o user_id como ID do documento para fácil acesso
            doc_ref = self.collection.document(user_id)
            doc_ref.set({
                'token': token,
                'updated_at': firestore.SERVER_TIMESTAMP
            }, merge=True)
            print(f"Token salvo/atualizado para o usuário {user_id}")
            return True
        except Exception as e:
            print(f"Erro ao salvar token para o usuário {user_id}: {e}")
            return False

    def send_notification_to_all(self, title, body):
        """Envia uma notificação para todos os usuários inscritos."""
        try:
            subscriptions = self.collection.stream()
            tokens = [sub.to_dict()['token'] for sub in subscriptions if 'token' in sub.to_dict()]

            if not tokens:
                print("Nenhum token de inscrição encontrado para enviar notificações.")
                return {"success": 0, "failure": 0}

            # Monta a mensagem
            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                tokens=tokens,
            )

            # Envia a mensagem
            response = messaging.send_multicast(message)
            
            print(f'Notificações enviadas: {response.success_count} com sucesso, {response.failure_count} com falha.')
            
            # Opcional: Lógica para limpar tokens inválidos do banco de dados
            if response.failure_count > 0:
                responses = response.responses
                failed_tokens = []
                for idx, resp in enumerate(responses):
                    if not resp.success:
                        # O erro 'UNREGISTERED' significa que o token não é mais válido
                        if resp.exception.code == 'UNREGISTERED':
                            failed_tokens.append(tokens[idx])
                # Aqui você poderia implementar a lógica para deletar os failed_tokens do Firestore
                print(f"Tokens inválidos encontrados: {failed_tokens}")

            return {"success": response.success_count, "failure": response.failure_count}
        
        except Exception as e:
            print(f"Erro ao enviar notificações: {e}")
            raise

