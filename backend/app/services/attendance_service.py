from datetime import datetime
from firebase_admin import firestore
from app.models.attendance import Attendance

class AttendanceService:
    def __init__(self, db, user_service):
        self.db = db
        self.user_service = user_service
        self.collection = self.db.collection('attendance')

    def create_or_update_attendance(self, data):
        """
        Cria ou atualiza um registro de chamada para uma turma em uma data específica.
        Esta operação é 'upsert' (update or insert) para evitar duplicatas.
        """
        try:
            class_id = data.get('class_id')
            date_str = data.get('date')
            present_student_ids = data.get('present_student_ids', [])

            if not class_id or not date_str:
                raise ValueError("class_id e date são obrigatórios.")

            # Converte a string de data para um objeto datetime para o Firestore
            attendance_date = datetime.strptime(date_str, '%Y-%m-%d')

            # O ID do documento será uma combinação da turma e da data para garantir unicidade
            doc_id = f"{class_id}_{date_str}"
            doc_ref = self.collection.document(doc_id)

            attendance_data = {
                'class_id': class_id,
                'date': attendance_date,
                'present_student_ids': present_student_ids,
                'updated_at': firestore.SERVER_TIMESTAMP
            }

            # Usar 'set' com 'merge=True' efetivamente cria um 'upsert'
            # Ele cria o documento se não existir, ou atualiza se já existir.
            doc_ref.set(attendance_data, merge=True)
            
            print(f"Chamada para a turma {class_id} na data {date_str} salva com sucesso.")
            return True
        except Exception as e:
            print(f"Erro ao salvar chamada: {e}")
            raise e

    def get_attendance_history_for_class(self, class_id):
        """
        Busca o histórico de chamadas para uma turma, enriquecendo com os nomes dos alunos.
        """
        try:
            query = self.collection.where('class_id', '==', class_id).order_by('date', direction=firestore.Query.DESCENDING)
            docs = query.stream()
            
            history = []
            for doc in docs:
                record_data = doc.to_dict()
                present_ids = record_data.get('present_student_ids', [])
                
                # Busca os nomes dos alunos presentes
                present_student_names = []
                for student_id in present_ids:
                    user = self.user_service.get_user_by_id(student_id)
                    if user and user.name:
                        present_student_names.append(user.name)

                record_data['present_student_names'] = present_student_names
                history.append(Attendance.from_dict(record_data, doc.id))

            return history
        except Exception as e:
            print(f"Erro ao buscar histórico de chamadas para a turma {class_id}: {e}")
            raise e
