# services/enrollment_service.py
from firebase_admin import firestore
from models.enrollment import Enrollment
from datetime import datetime

class EnrollmentService:
    def __init__(self, db):
        self.db = db
        self.enrollments_collection = self.db.collection('enrollments')

    def create_enrollment(self, student_id, class_id):
        """
        Cria uma nova matrícula de um aluno em uma turma.
        Retorna o objeto Enrollment se criado com sucesso, ou None se já existir.
        """
        # Verifica se a matrícula já existe para evitar duplicatas
        existing_enrollments = self.enrollments_collection.where(
            'student_id', '==', student_id
        ).where(
            'class_id', '==', class_id
        ).limit(1).get()

        if existing_enrollments:
            print(f"Erro: Aluno {student_id} já está matriculado na turma {class_id}.")
            return None

        enrollment = Enrollment(
            student_id=student_id,
            class_id=class_id,
            enrollment_date=datetime.now(),
            status="active"
        )
        enrollment_dict = enrollment.to_dict()
        doc_ref = self.enrollments_collection.add(enrollment_dict)

        enrollment.id = doc_ref[1].id
        print(f"Matrícula criada para aluno '{student_id}' na turma '{class_id}' com ID: {enrollment.id}")
        return enrollment

    def get_enrollment_by_id(self, enrollment_id):
        """
        Busca uma matrícula pelo ID.
        Retorna o objeto Enrollment ou None se não encontrada.
        """
        doc_ref = self.enrollments_collection.document(enrollment_id)
        doc = doc_ref.get()
        if doc.exists:
            enrollment_data = doc.to_dict()
            enrollment_data['id'] = doc.id
            return Enrollment.from_dict(enrollment_data)
        return None

    def get_enrollments_by_student(self, student_id):
        """
        Retorna todas as matrículas de um aluno específico.
        """
        enrollments = []
        docs = self.enrollments_collection.where('student_id', '==', student_id).stream()
        for doc in docs:
            enrollment_data = doc.to_dict()
            enrollment_data['id'] = doc.id
            enrollments.append(Enrollment.from_dict(enrollment_data))
        return enrollments

    def get_enrollments_by_class(self, class_id):
        """
        Retorna todas as matrículas de uma turma específica.
        """
        enrollments = []
        docs = self.enrollments_collection.where('class_id', '==', class_id).stream()
        for doc in docs:
            enrollment_data = doc.to_dict()
            enrollment_data['id'] = doc.id
            enrollments.append(Enrollment.from_dict(enrollment_data))
        return enrollments

    def get_all_enrollments(self):
        """
        Retorna todas as matrículas.
        """
        enrollments = []
        docs = self.enrollments_collection.stream()
        for doc in docs:
            enrollment_data = doc.to_dict()
            enrollment_data['id'] = doc.id
            enrollments.append(Enrollment.from_dict(enrollment_data))
        return enrollments

    def update_enrollment(self, enrollment_id, update_data):
        """
        Atualiza dados de uma matrícula existente.
        """
        update_data['updated_at'] = datetime.now() # Adiciona um timestamp de atualização
        enrollment_ref = self.enrollments_collection.document(enrollment_id)
        enrollment_ref.update(update_data)
        print(f"Matrícula com ID '{enrollment_id}' atualizada.")
        return True

    def delete_enrollment(self, enrollment_id):
        """
        Deleta uma matrícula pelo ID.
        """
        self.enrollments_collection.document(enrollment_id).delete()
        print(f"Matrícula com ID '{enrollment_id}' deletada.")
        return True