from firebase_admin import firestore
from models.enrollment import Enrollment
from datetime import datetime

class EnrollmentService:
    def __init__(self, db):
        self.db = db
        self.collection = self.db.collection('enrollments')

    def create_enrollment(self, student_id, class_id, base_fee, discount_amount=0, discount_reason=''):
        """
        Cria uma nova matrícula de um aluno em uma turma, incluindo dados financeiros.
        """
        # Verifica se a matrícula já existe para evitar duplicatas
        existing_enrollments_query = self.collection.where(
            'student_id', '==', student_id
        ).where(
            'class_id', '==', class_id
        ).limit(1).stream()

        if len(list(existing_enrollments_query)) > 0:
            print(f"Erro: Aluno {student_id} já está matriculado na turma {class_id}.")
            return None

        enrollment_data = {
            "student_id": student_id,
            "class_id": class_id,
            "enrollment_date": datetime.now(),
            "status": "active",
            "base_monthly_fee": float(base_fee),
            "discount_amount": float(discount_amount),
            "discount_reason": discount_reason,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        timestamp, doc_ref = self.collection.add(enrollment_data)
        enrollment_data['id'] = doc_ref.id
        
        print(f"Matrícula criada para aluno '{student_id}' na turma '{class_id}' com ID: {doc_ref.id}")
        return Enrollment.from_dict(doc_ref.id, enrollment_data)

    def get_enrollment_by_id(self, enrollment_id):
        """
        Busca uma matrícula pelo ID.
        Retorna o objeto Enrollment ou None se não encontrada.
        """
        doc_ref = self.collection.document(enrollment_id)
        doc = doc_ref.get()
        if doc.exists:
            # --- CORREÇÃO AQUI ---
            enrollment_data = doc.to_dict()
            enrollment = Enrollment.from_dict(enrollment_data)
            enrollment.id = doc.id
            return enrollment
        return None

    def get_enrollments_by_student(self, student_id):
        """
        Retorna todas as matrículas de um aluno específico.
        """
        enrollments = []
        docs = self.collection.where('student_id', '==', student_id).stream()
        for doc in docs:
            # --- CORREÇÃO AQUI ---
            enrollment_data = doc.to_dict()
            enrollment = Enrollment.from_dict(enrollment_data)
            enrollment.id = doc.id
            enrollments.append(enrollment)
        return enrollments

    def get_enrollments_by_class(self, class_id):
        """
        Retorna todas as matrículas de uma turma específica.
        """
        enrollments = []
        docs = self.collection.where('class_id', '==', class_id).stream()
        for doc in docs:
            # --- CORREÇÃO AQUI ---
            enrollment_data = doc.to_dict()
            enrollment = Enrollment.from_dict(enrollment_data)
            enrollment.id = doc.id
            enrollments.append(enrollment)
        return enrollments

    def get_enrollments_by_student_and_class(self, student_id: str, class_id: str) -> list[Enrollment]:
        """
        Busca matrículas para um aluno específico em uma turma específica.
        """
        try:
            query = self.collection.where('student_id', '==', student_id).where('class_id', '==', class_id).stream()
            enrollments = []
            for doc in query:
                # --- CORREÇÃO AQUI ---
                enrollment_data = doc.to_dict()
                enrollment = Enrollment.from_dict(enrollment_data)
                enrollment.id = doc.id
                enrollments.append(enrollment)
            return enrollments
        except Exception as e:
            print(f"Erro ao buscar matrícula por aluno '{student_id}' e turma '{class_id}': {e}")
            return []

    def get_all_enrollments(self):
        """
        Retorna todas as matrículas.
        """
        enrollments = []
        docs = self.collection.stream()
        for doc in docs:
            # --- CORREÇÃO AQUI ---
            enrollment_data = doc.to_dict()
            enrollment = Enrollment.from_dict(enrollment_data)
            enrollment.id = doc.id
            enrollments.append(enrollment)
        return enrollments

    def update_enrollment(self, enrollment_id, update_data):
        """
        Atualiza dados de uma matrícula existente.
        """
        try:
            update_data['updated_at'] = datetime.now()
            self.collection.document(enrollment_id).update(update_data)
            print(f"Matrícula com ID '{enrollment_id}' atualizada.")
            return True
        except Exception as e:
            print(f"Erro ao atualizar matrícula com ID '{enrollment_id}': {e}")
            return False

    def delete_enrollment(self, enrollment_id):
        """
        Deleta uma matrícula pelo ID.
        """
        try:
            self.collection.document(enrollment_id).delete()
            print(f"Matrícula com ID '{enrollment_id}' deletada.")
            return True
        except Exception as e:
            print(f"Erro ao deletar matrícula com ID '{enrollment_id}': {e}")
            return False