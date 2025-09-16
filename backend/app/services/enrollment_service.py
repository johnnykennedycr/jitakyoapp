from firebase_admin import firestore
from app.models.enrollment import Enrollment
from datetime import datetime

class EnrollmentService:
    def __init__(self, db):
        self.db = db
        self.collection = self.db.collection('enrollments')

    def _doc_to_enrollment(self, doc):
        """Função auxiliar para converter um documento do Firestore em um objeto Enrollment."""
        if not doc.exists:
            return None
        data = doc.to_dict()
        enrollment = Enrollment.from_dict(data)
        enrollment.id = doc.id
        return enrollment

    def create_enrollment(self, student_id, class_id, base_fee, due_day, discount_amount=0, discount_reason=''):
        """Cria uma nova matrícula de um aluno em uma turma."""
        existing_enrollments_query = self.collection.where(
            'student_id', '==', student_id
        ).where(
            'class_id', '==', class_id
        ).limit(1).stream()

        if len(list(existing_enrollments_query)) > 0:
            return None

        enrollment_data = {
            "student_id": student_id, "class_id": class_id,
            "enrollment_date": datetime.now(), "status": "active",
            "base_monthly_fee": float(base_fee), "discount_amount": float(discount_amount),
            "discount_reason": discount_reason, "due_day": int(due_day),
            "created_at": datetime.now(), "updated_at": datetime.now()
        }
        
        timestamp, doc_ref = self.collection.add(enrollment_data)
        
        enrollment = Enrollment.from_dict(enrollment_data)
        enrollment.id = doc_ref.id
        return enrollment

    def get_enrollment_by_id(self, enrollment_id):
        """Busca uma matrícula pelo ID."""
        try:
            doc = self.collection.document(enrollment_id).get()
            return self._doc_to_enrollment(doc)
        except Exception as e:
            print(f"Erro ao buscar matrícula por ID '{enrollment_id}': {e}")
            return None

    def get_enrollments_by_student(self, student_id):
        """Retorna todas as matrículas de um aluno específico."""
        enrollments = []
        try:
            docs = self.collection.where('student_id', '==', student_id).stream()
            for doc in docs:
                enrollments.append(self._doc_to_enrollment(doc))
        except Exception as e:
            print(f"Erro ao buscar matrículas por aluno '{student_id}': {e}")
        return enrollments

    def get_enrollments_by_class(self, class_id):
        """Retorna todas as matrículas de uma turma específica."""
        enrollments = []
        try:
            docs = self.collection.where('class_id', '==', class_id).stream()
            for doc in docs:
                enrollments.append(self._doc_to_enrollment(doc))
        except Exception as e:
            print(f"Erro ao buscar matrículas por turma '{class_id}': {e}")
        return enrollments
        
    def get_all_enrollments(self):
        """Retorna todas as matrículas."""
        enrollments = []
        try:
            docs = self.collection.stream()
            for doc in docs:
                enrollments.append(self._doc_to_enrollment(doc))
        except Exception as e:
            print(f"Erro ao buscar todas as matrículas: {e}")
        return enrollments

    def get_all_active_enrollments(self):
        """Retorna todas as matrículas com status 'active'."""
        active_enrollments = []
        try:
            docs = self.collection.where('status', '==', 'active').stream()
            for doc in docs:
                active_enrollments.append(self._doc_to_enrollment(doc))
        except Exception as e:
            print(f"Erro ao buscar matrículas ativas: {e}")
        return active_enrollments

    def get_enrollments_by_student_and_class(self, student_id: str, class_id: str) -> list:
        """Busca matrículas para um aluno específico em uma turma específica."""
        enrollments = []
        try:
            query = self.collection.where('student_id', '==', student_id).where('class_id', '==', class_id).stream()
            for doc in query:
                enrollments.append(self._doc_to_enrollment(doc))
        except Exception as e:
            print(f"Erro ao buscar matrícula por aluno e turma: {e}")
        return enrollments

    def delete_enrollment(self, enrollment_id):
        """Deleta uma matrícula pelo ID."""
        try:
            self.collection.document(enrollment_id).delete()
            return True
        except Exception as e:
            print(f"Erro ao deletar matrícula com ID '{enrollment_id}': {e}")
            return False