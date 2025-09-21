from datetime import datetime
from firebase_admin import firestore
from app.models.enrollment import Enrollment

class EnrollmentService:
    def __init__(self, db):
        self.db = db
        self.enrollments_collection = self.db.collection('enrollments')
        self.classes_collection = self.db.collection('classes')

    def get_enrollments_by_student_id(self, student_id):
        """Busca todas as matrículas de um aluno específico."""
        enrollments = []
        try:
            enrollment_docs = self.enrollments_collection.where('student_id', '==', student_id).stream()
            for doc in enrollment_docs:
                enrollments.append(Enrollment.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar matrículas do aluno {student_id}: {e}")
        return enrollments

    def create_enrollment(self, data):
        """Cria uma nova matrícula para um aluno em uma turma."""
        try:
            class_id = data.get('class_id')
            student_id = data.get('student_id')

            # Validação: Verifica se o aluno já está matriculado na turma
            existing_enrollment_query = self.enrollments_collection.where('student_id', '==', student_id).where('class_id', '==', class_id).limit(1).stream()
            if next(existing_enrollment_query, None):
                # CORREÇÃO: Usa f-string corretamente para uma mensagem de erro clara
                raise ValueError(f"O aluno com ID {student_id} já está matriculado na turma com ID {class_id}.")

            # Busca a mensalidade base da turma
            class_doc = self.classes_collection.document(class_id).get()
            if not class_doc.exists:
                raise ValueError(f"Turma com ID {class_id} não encontrada.")
            base_fee = class_doc.to_dict().get('default_monthly_fee', 0)

            enrollment_data = {
                'student_id': student_id,
                'class_id': class_id,
                'status': 'active',
                'enrollment_date': datetime.now(),
                'base_monthly_fee': base_fee,
                'due_day': data.get('due_day', 10),
                'discount_amount': float(data.get('discount_amount', 0) or 0),
                'discount_reason': data.get('discount_reason', ""),
                'created_at': datetime.now(),
                'updated_at': datetime.now()
            }
            
            doc_ref = self.enrollments_collection.document()
            doc_ref.set(enrollment_data)
            return Enrollment.from_dict(enrollment_data, doc_ref.id)
        except Exception as e:
            # Propaga o erro para a rota, para que o frontend receba a mensagem específica
            raise e

    def delete_enrollment(self, enrollment_id):
        """Deleta uma matrícula."""
        try:
            self.enrollments_collection.document(enrollment_id).delete()
            return True
        except Exception as e:
            print(f"Erro ao deletar matrícula {enrollment_id}: {e}")
            return False

