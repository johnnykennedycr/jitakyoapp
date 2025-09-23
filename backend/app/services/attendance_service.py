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

    # --- NOVO MÉTODO ---
    def get_available_semesters(self, class_id):
        """
        Busca e retorna uma lista de anos e semestres únicos que possuem
        registros de chamada para uma turma específica.
        """
        try:
            docs = self.collection.where('class_id', '==', class_id).stream()
            semesters = set()
            for doc in docs:
                record_data = doc.to_dict()
                # Garante que o campo 'date' é um objeto datetime
                if isinstance(record_data.get('date'), datetime):
                    record_date = record_data.get('date').date()
                    year = record_date.year
                    semester = 1 if record_date.month <= 6 else 2
                    semesters.add((year, semester))
            
            # Ordena a lista para que o mais recente apareça primeiro
            sorted_semesters = sorted(list(semesters), key=lambda x: (x[0], x[1]), reverse=True)
            return [{"year": year, "semester": semester} for year, semester in sorted_semesters]
        except Exception as e:
            print(f"Erro ao buscar semestres disponíveis para a turma {class_id}: {e}")
            return []


    def _calculate_possible_days(self, class_schedule, year, semester):
        """
        Calcula o número total de dias de aula possíveis em um semestre 
        com base no horário da turma de forma robusta.
        """
        weekday_map = {
            'Segunda': 0, 'Terça': 1, 'Quarta': 2, 'Quinta': 3,
            'Sexta': 4, 'Sábado': 5, 'Domingo': 6
        }
        
        start_month, end_month = (1, 6) if semester == 1 else (7, 12)
        
        training_days = set()
        for slot in class_schedule:
            day = None
            if hasattr(slot, 'day_of_week'):
                day = slot.day_of_week
            elif isinstance(slot, dict) and 'day_of_week' in slot:
                day = slot['day_of_week']
            
            if day and day in weekday_map:
                training_days.add(weekday_map[day])

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

            attendance_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            doc_id = f"{class_id}_{date_str}"
            doc_ref = self.collection.document(doc_id)

            # Convertendo a data para um objeto datetime para salvar no Firestore
            attendance_datetime = datetime.combine(attendance_date, datetime.min.time())

            attendance_data = {
                'class_id': class_id,
                'date': attendance_datetime,
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
                        "percentage": round(percentage, 2)
                    })
            
            student_stats.sort(key=lambda x: x['name'])

            return {
                "total_possible_days": total_possible_days,
                "students": student_stats
            }
        except Exception as e:
            print(f"Erro ao buscar histórico de chamadas para a turma {class_id}: {e}")
            raise e

