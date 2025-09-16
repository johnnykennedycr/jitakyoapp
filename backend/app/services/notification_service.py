import json
from firebase_admin import firestore
from flask import current_app
from pywebpush import webpush, WebPushException
from app.models.notification import Notification
from datetime import datetime

class NotificationService:
    def __init__(self, db, user_service=None):
        self.db = db
        self.collection = self.db.collection('notifications')
        self.user_service = user_service

    def _send_push_notification(self, subscription_info, title, message):
        """Função interna para enviar uma única notificação push."""
        try:
            push_payload = json.dumps({'title': title, 'body': message, 'icon': '/static/logo_192.png'})
            
            pywebpush(
                subscription_info=subscription_info,
                data=push_payload,
                vapid_private_key=current_app.config['VAPID_PRIVATE_KEY'],
                vapid_claims={'sub': f"mailto:{current_app.config['VAPID_ADMIN_EMAIL']}"}
            )
            return True
        except WebPushException as e:
            # Erros comuns aqui incluem inscrições expiradas, que podemos tratar no futuro
            print(f"Erro ao enviar notificação push: {e}")
            # Se a inscrição for inválida (ex: 410 Gone), o ideal é removê-la do banco
            if e.response.status_code == 410:
                print("Inscrição expirada. Recomenda-se remover do banco.")
            return False

    def create_batch_notifications(self, teacher_id, student_ids, class_id, title, message):
        """
        Cria notificações no banco E envia o push para cada aluno.
        """
        try:
            batch = self.db.batch()
            count = 0
            for student_id in student_ids:
                # Salva a notificação no banco de dados
                notification = Notification(
                    teacher_id=teacher_id, student_id=student_id, class_id=class_id,
                    title=title, message=message, is_read=False
                )
                doc_ref = self.collection.document()
                batch.set(doc_ref, notification.to_dict())
                count += 1
                
                # Envia a notificação PUSH
                student = self.user_service.get_user_by_id(student_id)
                # Verifica se o usuário tem o campo 'push_subscriptions'
                if student and hasattr(student, 'push_subscriptions') and student.push_subscriptions:
                    for sub in student.push_subscriptions:
                        print(f"Enviando push para o aluno: {student.name}")
                        self._send_push_notification(sub, title, message)

            batch.commit()
            print(f"Lote de {count} notificações de banco de dados criado com sucesso.")
            return True
        except Exception as e:
            print(f"Erro ao criar lote de notificações: {e}")
            return False
            

    def get_notifications_for_student(self, student_id, limit=50):
        """
        Busca as notificações de um aluno específico, ordenadas da mais recente para a mais antiga.
        """
        notifications = []
        try:
            docs = self.collection.where('student_id', '==', student_id).order_by('created_at', direction=firestore.Query.DESCENDING).limit(limit).stream()
            for doc in docs:
                notification = Notification.from_dict(doc.id, doc.to_dict())
                notifications.append(notification)
        except Exception as e:
            print(f"Erro ao buscar notificações para o aluno {student_id}: {e}")
        return notifications

    def get_unread_notification_count(self, student_id):
        """
        Conta quantas notificações não lidas um aluno possui.
        """
        try:
            # O Firestore >v2.2 permite contagem no servidor, que é muito eficiente
            query = self.collection.where('student_id', '==', student_id).where('is_read', '==', False)
            count_query = query.count()
            # Acessa o valor da contagem
            count_result = count_query.get()
            if count_result and len(count_result) > 0:
                 return count_result[0][0].value
            return 0
        except Exception as e:
            print(f"Erro ao contar notificações não lidas para o aluno {student_id}: {e}")
            return 0

    def mark_notifications_as_read(self, student_id):
        """
        Marca todas as notificações de um aluno como lidas.
        """
        try:
            # Encontra todas as notificações não lidas do aluno
            docs_to_update = self.collection.where('student_id', '==', student_id).where('is_read', '==', False).stream()
            
            batch = self.db.batch()
            for doc in docs_to_update:
                batch.update(doc.reference, {'is_read': True})
            
            batch.commit()
            return True
        except Exception as e:
            print(f"Erro ao marcar notificações como lidas para o aluno {student_id}: {e}")
            return False