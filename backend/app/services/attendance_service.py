from datetime import date, datetime, time
from firebase_admin import firestore
from google.cloud.firestore_v1._helpers import Timestamp
from google.cloud.firestore_v1.base_query import FieldFilter, And

def convert_timestamp_to_date(timestamp: Timestamp) -> date:
    """Converte um objeto firestore.Timestamp para datetime.date."""
    return timestamp.to_datetime().date()

class Attendance:
    """
    Representa um registro de presença.
    """
    def __init__(self, id, class_id, attendance_date, students, db):
        self.id = id
        self.class_id = class_id
        self.attendance_date = attendance_date
        self.students = students
        self.db = db
    
    def __repr__(self):
        """Representação string para debug e logs."""
        return f"Attendance(id='{self.id}', class_id='{self.class_id}', date='{self.attendance_date}')"

class AttendanceService:
    """
    Serviço para interagir com a coleção 'attendance' no Firestore.
    """
    ATTENDANCE_COLLECTION = 'attendance'

    def __init__(self, db):
        self.db = db
        self.collection = self.db.collection(self.ATTENDANCE_COLLECTION)

    def get_attendance_by_class_and_date(self, class_id: str, search_date: date) -> Attendance | None:
        """
        Busca um registro de presença para uma turma em uma data específica,
        comparando corretamente o dia inteiro.
        """
        try:
            # Define o início do dia (00:00:00)
            start_of_day = datetime.combine(search_date, time.min)
            # Define o fim do dia (23:59:59)
            end_of_day = datetime.combine(search_date, time.max)

            # Query que busca um timestamp dentro do intervalo do dia
            query = self.collection.where(
                filter=And([
                    FieldFilter('class_id', '==', class_id),
                    FieldFilter('attendance_date', '>=', start_of_day),
                    FieldFilter('attendance_date', '<=', end_of_day)
                ])
            ).limit(1).stream()
            
            docs = list(query)
            if docs:
                doc = docs[0]
                data = doc.to_dict()
                
                if isinstance(data.get('attendance_date'), Timestamp):
                    data['attendance_date'] = convert_timestamp_to_date(data['attendance_date'])
                
                return Attendance(doc.id, data['class_id'], data['attendance_date'], data['students'])
            
            return None
        except Exception as e:
            print(f"Erro ao buscar registro de presença por data: {e}")
            return None

    def save_attendance_record(self, class_id: str, attendance_datetime: datetime, students_data: list) -> bool:
        """
        Salva ou atualiza um registro de presença.
        """
        try:
            # Busca um registro existente usando apenas a parte da data
            attendance_record = self.get_attendance_by_class_and_date(class_id, attendance_datetime.date())
            
            record_data = {
                'class_id': class_id,
                'attendance_date': attendance_datetime, # Salva o datetime completo para precisão
                'students': students_data,
                'updated_at': firestore.SERVER_TIMESTAMP
            }
            
            if attendance_record:
                # Se encontrou um registro para aquele dia, atualiza-o
                self.collection.document(attendance_record.id).update(record_data)
                print(f"Registro de presença atualizado para a turma {class_id} na data {attendance_datetime.date()}")
            else:
                # Se não, cria um novo
                record_data['created_at'] = firestore.SERVER_TIMESTAMP
                self.collection.add(record_data)
                print(f"Novo registro de presença criado para a turma {class_id} na data {attendance_datetime.date()}")

            return True
        except Exception as e:
            print(f"Erro ao salvar registro de presença: {e}")
            return False

    def get_all_attendance_by_class(self, class_id: str) -> list[Attendance]:
        """
        Busca todos os registros de presença para uma turma específica.
        """
        try:
            query = self.collection.where('class_id', '==', class_id).stream()
            docs = list(query)
            attendance_records = []
            for doc in docs:
                data = doc.to_dict()
                if isinstance(data.get('attendance_date'), Timestamp):
                    data['attendance_date'] = convert_timestamp_to_date(data['attendance_date'])
                
                attendance_records.append(
                    Attendance(doc.id, data['class_id'], data['attendance_date'], data['students'])
                )
            
            return attendance_records
        except Exception as e:
            print(f"Erro ao buscar todos os registros de presença para a turma '{class_id}': {e}")
            return []

    def get_all_attendance(self) -> list[Attendance]:
        """
        Retorna todos os registros de presença na coleção.
        """
        try:
            attendance_docs = self.collection.stream()
            records = []
            for doc in attendance_docs:
                data = doc.to_dict()
                if isinstance(data.get('attendance_date'), Timestamp):
                    data['attendance_date'] = convert_timestamp_to_date(data['attendance_date'])
                records.append(
                    Attendance(
                        doc.id,
                        data.get('class_id'),
                        data.get('attendance_date'),
                        data.get('students')
                    )
                )
            return records
        except Exception as e:
            print(f"Erro ao buscar todos os registros de presença: {e}")
            return []