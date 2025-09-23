from datetime import datetime, date
from firebase_admin import firestore
from app.models.attendance import Attendance
import calendar

class AttendanceService:
    def __init__(self, db, user_service, enrollment_service, training_class_service):
        self.db = db
        self.user_service = user_service
        self.enrollment_service = enrollment_service
        self.training_class_service = training_class_service
        self.collection = self.db.collection('attendance')

    def _calculate_possible_days(self, class_schedule, year, semester):
        """
        Calcula o número total de dias de aula possíveis em um semestre 
        com base no horário da turma.
        """
        weekday_map = {
            'Segunda': 0, 'Terça': 1, 'Quarta': 2, 'Quinta': 3,
            'Sexta': 4, 'Sábado': 5, 'Domingo': 6
        }
        
        start_month, end_month = (1, 6) if semester == 1 else (7, 12)
        
        # CORREÇÃO: Acessar o atributo do objeto com .day_of_week em vez de ['day_of_week']
        training_days = {weekday_map[slot.day_of_week] for slot in class_schedule if slot.day_of_week in weekday_map}
        
        if not training_days:
            return 0
            
        total_days = 0
        for month in range(start_month, end_month + 1):
            month_calendar = calendar.monthcalendar(year, month)
            for week in month_calendar:
                for day_weekday in training_days:
                    if week[day_weekday] != 0:
                        total_days += 1
                        
        return total_days

    def create_or_update_attendance(self, data):
        """
        Cria ou atualiza um registro de chamada para uma turma em uma data específica.
        """
        try:
            class_id = data.get('class_id')
            date_str = data.get('date')
            present_student_ids = data.get('present_student_ids', [])

            if not class_id or not date_str:
                raise ValueError("class_id e date são obrigatórios.")

            attendance_date = datetime.strptime(date_str, '%Y-%m-%d')
            doc_id = f"{class_id}_{date_str}"
            doc_ref = self.collection.document(doc_id)

            attendance_data = {
                'class_id': class_id,
                'date': attendance_date,
                'present_student_ids': present_student_ids,
                'updated_at': firestore.SERVER_TIMESTAMP
            }

            doc_ref.set(attendance_data, merge=True)
            return True
        except Exception as e:
            print(f"Erro ao salvar chamada: {e}")
            raise e

    def get_attendance_history_for_class(self, class_id, year, semester):
        """
        Busca o histórico de chamadas e calcula o percentual de presença dos alunos
        para um semestre específico.
        """
        try:
            target_class = self.training_class_service.get_class_by_id(class_id)
            if not target_class or not target_class.schedule:
                return {"total_possible_days": 0, "students": []}

            total_possible_days = self._calculate_possible_days(target_class.schedule, year, semester)
            if total_possible_days == 0:
                return {"total_possible_days": 0, "students": []}

            enrollments = self.enrollment_service.get_enrollments_by_class_id(class_id)
            enrolled_student_ids = {e.student_id for e in enrollments}
            
            start_month, end_month = (1, 6) if semester == 1 else (7, 12)
            start_date = datetime(year, start_month, 1)
            end_date = datetime(year, end_month, calendar.monthrange(year, end_month)[1])

            query = self.collection.where('class_id', '==', class_id).where('date', '>=', start_date).where('date', '<=', end_date)
            docs = query.stream()

            presence_counts = {student_id: 0 for student_id in enrolled_student_ids}
            for doc in docs:
                record = doc.to_dict()
                for student_id in record.get('present_student_ids', []):
                    if student_id in presence_counts:
                        presence_counts[student_id] += 1
            
            student_stats = []
            for student_id, count in presence_counts.items():
                user = self.user_service.get_user_by_id(student_id)
                if user:
                    percentage = (count / total_possible_days) * 100 if total_possible_days > 0 else 0
                    student_stats.append({
                        "id": student_id,
                        "name": user.name,
                        "presence_count": count,
                        "percentage": percentage
                    })
            
            student_stats.sort(key=lambda x: x['name'])

            return {
                "total_possible_days": total_possible_days,
                "students": student_stats
            }
        except Exception as e:
            print(f"Erro ao buscar histórico de chamadas para a turma {class_id}: {e}")
            raise e

