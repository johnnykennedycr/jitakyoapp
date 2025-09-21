from datetime import datetime
from firebase_admin import firestore
from app.models.enrollment import Enrollment

class EnrollmentService:
    def __init__(self, db):
        self.db = db
        self.enrollments_collection = self.db.collection('enrollments')
        self.users_collection = self.db.collection('users')
        self.classes_collection = self.db.collection('classes')

    def create_enrollment(self, data):
        """
        Cria uma nova matrícula, validando se já não existe uma para o mesmo aluno e turma.
        """
        student_id = data.get('student_id')
        class_id = data.get('class_id')

        if not student_id or not class_id:
            raise ValueError("ID do aluno e da turma são obrigatórios.")

        # VERIFICAÇÃO DE MATRÍCULA DUPLICADA
        # Usando a sintaxe de filtro recomendada com keyword arguments
        existing_enrollment_query = self.enrollments_collection.where(
            filter=firestore.And(
                [
                    firestore.FieldFilter('student_id', '==', student_id),
                    firestore.FieldFilter('class_id', '==', class_id)
                ]
            )
        ).limit(1).stream()

        if len(list(existing_enrollment_query)) > 0:
            student_name = self.users_collection.document(student_id).get().to_dict().get('name', 'desconhecido')
            class_name = self.classes_collection.document(class_id).get().to_dict().get('name', 'desconhecida')
            raise ValueError(f"O aluno '{student_name}' já está matriculado na turma '{class_name}'.")

        class_doc = self.classes_collection.document(class_id).get()
        if not class_doc.exists:
            raise ValueError(f"Turma com ID {class_id} não encontrada.")
        base_fee = class_doc.to_dict().get('default_monthly_fee', 0)

        enrollment_data = {
            'student_id': student_id,
            'class_id': class_id,
            'status': 'active',
            'enrollment_date': datetime.now(),
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            'base_monthly_fee': base_fee,
            'discount_amount': float(data.get('discount_amount', 0) or 0),
            'discount_reason': data.get('discount_reason', ''),
            'due_day': data.get('due_day', 10)
        }
        
        doc_ref = self.enrollments_collection.document()
        doc_ref.set(enrollment_data)
        
        return Enrollment.from_dict(enrollment_data, doc_ref.id)

    def get_enrollments_by_student_id(self, student_id):
        """Busca todas as matrículas ativas de um aluno."""
        enrollments = []
        try:
            enrollment_docs = self.enrollments_collection.where('student_id', '==', student_id).stream()
            for doc in enrollment_docs:
                enrollments.append(Enrollment.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar matrículas do aluno {student_id}: {e}")
        return enrollments

    def delete_enrollment(self, enrollment_id):
        """Deleta uma matrícula pelo seu ID."""
        try:
            self.enrollments_collection.document(enrollment_id).delete()
            return True
        except Exception as e:
            print(f"Erro ao deletar matrícula {enrollment_id}: {e}")
            return False

