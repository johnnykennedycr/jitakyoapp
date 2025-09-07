from datetime import datetime
from pywebpush import webpush
from flask import current_app
import json

class Notification:
    def __init__(self, id=None, teacher_id=None, student_id=None, class_id=None, 
                 title=None, message=None, is_read=False, created_at=None):
        self.id = id
        self.teacher_id = teacher_id
        self.student_id = student_id
        self.class_id = class_id
        self.title = title
        self.message = message
        self.is_read = is_read
        self.created_at = created_at or datetime.now()

    def to_dict(self):
        """Converte o objeto para um dicionário para salvar no Firestore."""
        return {
            "teacher_id": self.teacher_id,
            "student_id": self.student_id,
            "class_id": self.class_id,
            "title": self.title,
            "message": self.message,
            "is_read": self.is_read,
            "created_at": self.created_at,
        }

    @staticmethod
    def from_dict(doc_id, source):
        """Cria um objeto Notification a partir de um dicionário do Firestore."""
        return Notification(
            id=doc_id,
            teacher_id=source.get('teacher_id'),
            student_id=source.get('student_id'),
            class_id=source.get('class_id'),
            title=source.get('title'),
            message=source.get('message'),
            is_read=source.get('is_read', False),
            created_at=source.get('created_at')
        )

    def __repr__(self):
        return f"<Notification(id='{self.id}', student_id='{self.student_id}', title='{self.title}')>"
    
def send_push_notification(self, subscription_info, title, message):
        """Envia uma notificação push para uma única inscrição."""
        try:
            # Converte a string JSON da inscrição de volta para um dicionário
            subscription_data = json.loads(subscription_info)
            
            # Monta o corpo da notificação
            push_payload = json.dumps({
                'title': title,
                'body': message,
                'icon': '/static/logo_192.png' # Ícone que aparecerá na notificação
            })

            webpush(
                subscription_info=subscription_data,
                data=push_payload,
                vapid_private_key=current_app.config['VAPID_PRIVATE_KEY'],
                vapid_claims={'sub': f"mailto:{current_app.config['VAPID_ADMIN_EMAIL']}"}
            )
            return True
        except Exception as e:
            print(f"Erro ao enviar notificação push: {e}")
            return False