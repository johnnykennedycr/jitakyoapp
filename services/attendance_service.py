# attendance_service.py
from firebase_admin import firestore
# A correção está aqui. Importamos a classe Timestamp do local correto.
from google.cloud.firestore import Timestamp 
from datetime import datetime, date

# O Firestore guarda a data como um objeto Timestamp, então
# criamos uma função auxiliar para converter para datetime.date
def convert_timestamp_to_date(timestamp):
    """Converte um objeto firestore.Timestamp para datetime.date."""
    # O objeto Timestamp tem um método to_datetime()
    return timestamp.to_datetime().date()

class Attendance:
    """
    Representa um registro de presença.
    É uma boa prática ter uma classe de modelo para padronizar os dados.
    """
    def __init__(self, id, class_id, attendance_date, students):
        self.id = id
        self.class_id = class_id
        self.attendance_date = attendance_date
        self.students = students
    
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
        # Usamos uma constante para o nome da coleção.
        self.collection = self.db.collection(self.ATTENDANCE_COLLECTION)

    def get_attendance_by_class_and_date(self, class_id: str, attendance_date: date) -> Attendance | None:
        """
        Busca um registro de presença para uma turma e data específicas.
        attendance_date já é um objeto datetime.date.
        """
        try:
            query = self.collection.where('class_id', '==', class_id).where('attendance_date', '==', attendance_date).limit(1).stream()
            
            docs = list(query)
            if docs:
                doc = docs[0]
                data = doc.to_dict()
                
                # Agora esta verificação funciona corretamente
                if isinstance(data.get('attendance_date'), Timestamp):
                    data['attendance_date'] = convert_timestamp_to_date(data['attendance_date'])
                
                return Attendance(doc.id, data['class_id'], data['attendance_date'], data['students'])
            
            return None
        except Exception as e:
            print(f"Erro ao buscar registro de presença para turma '{class_id}' e data '{attendance_date}': {e}")
            return None

    def get_all_attendance_by_class(self, class_id: str) -> list[Attendance]:
        """
        NOVO MÉTODO ADICIONADO.
        Busca todos os registros de presença para uma turma específica.

        Args:
            class_id: O ID da turma para a qual buscar os registros.

        Returns:
            Uma lista de objetos Attendance.
        """
        try:
            # A query agora filtra apenas pelo class_id
            query = self.collection.where('class_id', '==', class_id).stream()
            
            docs = list(query)
            
            # Converte os documentos do Firestore em objetos Attendance
            attendance_records = []
            for doc in docs:
                data = doc.to_dict()
                # Agora esta verificação funciona corretamente
                if isinstance(data.get('attendance_date'), Timestamp):
                    data['attendance_date'] = convert_timestamp_to_date(data['attendance_date'])
                
                attendance_records.append(
                    Attendance(doc.id, data['class_id'], data['attendance_date'], data['students'])
                )
            
            return attendance_records
        except Exception as e:
            print(f"Erro ao buscar todos os registros de presença para a turma '{class_id}': {e}")
            return []

    def save_attendance_record(self, class_id: str, attendance_date: date, students_data: list) -> bool:
        """
        Salva ou atualiza um registro de presença.
        attendance_date já é um objeto datetime.date.
        """
        try:
            attendance_record = self.get_attendance_by_class_and_date(class_id, attendance_date)
            
            record_data = {
                'class_id': class_id,
                'attendance_date': attendance_date,
                'students': students_data,
                'updated_at': firestore.SERVER_TIMESTAMP
            }
            
            if attendance_record:
                self.collection.document(attendance_record.id).update(record_data)
                print(f"Registro de presença atualizado para a turma {class_id} na data {attendance_date}")
            else:
                record_data['created_at'] = firestore.SERVER_TIMESTAMP
                self.collection.add(record_data)
                print(f"Novo registro de presença criado para a turma {class_id} na data {attendance_date}")

            return True
        except Exception as e:
            print(f"Erro ao salvar registro de presença: {e}")
            return False

    def get_all_attendance(self) -> list[Attendance]:
        """
        Retorna todos os registros de presença na coleção.
        """
        try:
            attendance_docs = self.collection.stream()
            records = []
            for doc in attendance_docs:
                data = doc.to_dict()
                # Agora esta verificação funciona corretamente
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
