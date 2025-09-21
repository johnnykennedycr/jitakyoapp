from datetime import datetime
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from app.models.enrollment import Enrollment

class EnrollmentService:
    def __init__(self, db):
        self.db = db
        self.enrollments_collection = self.db.collection('enrollments')
        # Referências a outras coleções para buscar nomes
        self.users_collection = self.db.collection('users')
        self.classes_collection = self.db.collection('classes')

    def create_enrollment(self, data):
        """Cria uma nova matrícula, validando se ela já existe."""
        student_id = data.get('student_id')
        class_id = data.get('class_id')

        if not student_id or not class_id:
            raise ValueError("ID do aluno e da turma são obrigatórios.")

        # Validação de matrícula duplicada
        existing_enrollment_query = self.enrollments_collection.where(
            filter=FieldFilter('student_id', '==', student_id)
        ).where(
            filter=FieldFilter('class_id', '==', class_id)
        ).limit(1).stream()

        if next(existing_enrollment_query, None):
            # Busca nomes para uma mensagem de erro mais clara
            student_name = self.users_collection.document(student_id).get().to_dict().get('name', 'desconhecido')
            class_name = self.classes_collection.document(class_id).get().to_dict().get('name', 'desconhecida')
            raise ValueError(f"O aluno '{student_name}' já está matriculado na turma '{class_name}'.")

        enrollment_data = {
            'student_id': student_id,
            'class_id': class_id,
            'base_monthly_fee': data.get('base_monthly_fee', 0),
            'discount_amount': float(data.get('discount_amount', 0)),
            'discount_reason': data.get('discount_reason', ''),
            'due_day': int(data.get('due_day', 15)),
            'status': 'active',
            'enrollment_date': datetime.now(),
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        }
        
        doc_ref = self.enrollments_collection.document()
        doc_ref.set(enrollment_data)
        return Enrollment.from_dict(enrollment_data, doc_ref.id)

    def get_enrollments_by_student_id(self, student_id):
        """Busca todas as matrículas de um aluno específico."""
        enrollments = []
        try:
            enrollments_query = self.enrollments_collection.where(filter=FieldFilter('student_id', '==', student_id))
            for doc in enrollments_query.stream():
                enrollments.append(Enrollment.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar matrículas do aluno {student_id}: {e}")
        return enrollments

    def get_student_ids_by_class_id(self, class_id):
        """Busca os IDs de todos os alunos matriculados em uma turma específica."""
        student_ids = []
        try:
            enrollments_query = self.enrollments_collection.where(filter=FieldFilter('class_id', '==', class_id))
            for doc in enrollments_query.stream():
                student_ids.append(doc.to_dict().get('student_id'))
        except Exception as e:
            print(f"Erro ao buscar IDs de alunos por turma '{class_id}': {e}")
        return student_ids

    def delete_enrollment(self, enrollment_id):
        """Deleta uma matrícula pelo seu ID."""
        try:
            self.enrollments_collection.document(enrollment_id).delete()
            return True
        except Exception as e:
            print(f"Erro ao deletar matrícula {enrollment_id}: {e}")
            return False

