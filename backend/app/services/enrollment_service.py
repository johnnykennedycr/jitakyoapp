from datetime import datetime
from firebase_admin import firestore
from app.models.enrollment import Enrollment

class EnrollmentService:
    def __init__(self, db, user_service=None, training_class_service=None):
        self.db = db
        self.enrollments_collection = self.db.collection('enrollments')
        self.user_service = user_service
        self.training_class_service = training_class_service

    def create_enrollment(self, data):
        """Cria uma nova matrícula, verificando se já existe."""
        student_id = data.get('student_id')
        class_id = data.get('class_id')

        if not student_id or not class_id:
            raise ValueError("ID do aluno e da turma são obrigatórios.")

        # Validação para impedir matrículas duplicadas
        existing_enrollment_query = self.enrollments_collection.where(
            filter=firestore.And(
                [
                    firestore.FieldFilter('student_id', '==', student_id),
                    firestore.FieldFilter('class_id', '==', class_id)
                ]
            )
        ).limit(1).stream()
        
        if len(list(existing_enrollment_query)) > 0:
            student = self.user_service.get_user_by_id(student_id)
            training_class = self.training_class_service.get_class_by_id(class_id)
            student_name = student.name if student else "desconhecido"
            class_name = training_class.name if training_class else "desconhecida"
            raise ValueError(f"O aluno '{student_name}' já está matriculado na turma '{class_name}'.")

        enrollment_data = {
            'student_id': student_id,
            'class_id': class_id,
            'enrollment_date': datetime.now(),
            'status': 'active',
            'base_monthly_fee': data.get('base_monthly_fee', 0),
            'discount_amount': data.get('discount_amount', 0),
            'discount_reason': data.get('discount_reason', ''),
            'due_day': data.get('due_day', 10),
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        
        doc_ref = self.enrollments_collection.document()
        doc_ref.set(enrollment_data)
        
        return Enrollment.from_dict(enrollment_data, doc_ref.id)

    def get_enrollments_by_student_id(self, student_id):
        """Busca todas as matrículas de um aluno específico."""
        enrollments = []
        try:
            docs = self.enrollments_collection.where('student_id', '==', student_id).stream()
            for doc in docs:
                enrollments.append(Enrollment.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar matrículas do aluno {student_id}: {e}")
        return enrollments
        
    def get_student_ids_by_class_id(self, class_id):
        """Retorna uma lista de IDs de alunos matriculados em uma turma."""
        student_ids = []
        try:
            docs = self.enrollments_collection.where('class_id', '==', class_id).stream()
            for doc in docs:
                student_ids.append(doc.to_dict().get('student_id'))
        except Exception as e:
            print(f"Erro ao buscar IDs de alunos da turma {class_id}: {e}")
        return student_ids

    def delete_enrollment(self, enrollment_id):
        """Deleta uma matrícula pelo seu ID."""
        try:
            self.enrollments_collection.document(enrollment_id).delete()
            return True
        except Exception as e:
            print(f"Erro ao deletar matrícula {enrollment_id}: {e}")
            return False
            
    # --- MÉTODO ADICIONADO ---
    def delete_enrollments_by_student_id(self, student_id):
        """Deleta todas as matrículas de um aluno específico."""
        try:
            enrollments_to_delete = self.enrollments_collection.where('student_id', '==', student_id).stream()
            for doc in enrollments_to_delete:
                doc.reference.delete()
            print(f"Matrículas do aluno {student_id} deletadas com sucesso.")
            return True
        except Exception as e:
            print(f"Erro ao deletar matrículas do aluno {student_id}: {e}")
            return False

    def get_enrollments_by_class_id(self, class_id):
            """Busca todas as matrículas ativas para uma turma específica."""
            enrollments = []
            try:
                docs = self.collection.where('class_id', '==', class_id).where('status', '==', 'active').stream()
                for doc in docs:
                    enrollments.append(Enrollment.from_dict(doc.to_dict(), doc.id))
            except Exception as e:
                print(f"Erro ao buscar matrículas por ID da turma '{class_id}': {e}")
            return enrollments

    def delete_enrollments_by_student_id(self, student_id):
        """Deleta todas as matrículas de um aluno."""
        try:
            docs = self.collection.where('student_id', '==', student_id).stream()
            for doc in docs:
                doc.reference.delete()
            print(f"Matrículas do aluno {student_id} deletadas com sucesso.")
            return True
        except Exception as e:
            print(f"Erro ao deletar matrículas do aluno {student_id}: {e}")
            raise e