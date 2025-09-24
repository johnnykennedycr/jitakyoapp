from datetime import datetime
from firebase_admin import firestore
from app.models.enrollment import Enrollment

def _clean_enrollment_data(data):
    """Função auxiliar para limpar e garantir a tipagem dos dados de uma matrícula."""
    try:
        # Garante que os campos numéricos sejam de fato números, tratando strings e Nones.
        for field in ['base_monthly_fee', 'discount_amount', 'due_day']:
            if field in data:
                try:
                    # Tenta converter para float/int, se falhar, usa um padrão seguro.
                    if data[field] is not None:
                        data[field] = int(float(data[field])) if field == 'due_day' else float(data[field])
                    else:
                        # Se o campo for None, atribui um padrão
                        data[field] = 15 if field == 'due_day' else 0.0
                except (ValueError, TypeError):
                    # Se a conversão falhar (ex: texto "abc"), usa um padrão seguro.
                    data[field] = 15 if field == 'due_day' else 0.0
    except Exception as e:
        print(f"Erro ao limpar dados da matrícula: {e}")
    return data


class EnrollmentService:
    def __init__(self, db, user_service=None, training_class_service=None):
        self.db = db
        self.collection = self.db.collection('enrollments')
        self.user_service = user_service
        self.training_class_service = training_class_service

    def create_enrollment(self, data):
        """Cria uma nova matrícula de forma robusta."""
        student_id = data.get('student_id')
        class_id = data.get('class_id')

        if not student_id or not class_id:
            raise ValueError("ID do aluno e da turma são obrigatórios.")

        existing_enrollment_query = self.collection.where(
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

        # Lógica de vencimento segura
        due_day = 15 # Começa com o padrão do sistema
        due_day_raw = data.get('due_day')
        if due_day_raw is not None and str(due_day_raw).strip().isdigit():
            due_day = int(due_day_raw)
        else:
            training_class = self.training_class_service.get_class_by_id(class_id)
            if training_class and hasattr(training_class, 'default_due_day') and training_class.default_due_day is not None:
                due_day = training_class.default_due_day
        
        enrollment_data = {
            'student_id': student_id,
            'class_id': class_id,
            'enrollment_date': datetime.now(),
            'status': 'active',
            'base_monthly_fee': float(data.get('base_monthly_fee', 0) or 0),
            'discount_amount': float(data.get('discount_amount', 0) or 0),
            'discount_reason': data.get('discount_reason', ''),
            'due_day': due_day,
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        
        doc_ref = self.collection.document()
        doc_ref.set(enrollment_data)
        
        return Enrollment.from_dict(enrollment_data, doc_ref.id)

    def get_all_active_enrollments(self):
        """Busca todas as matrículas com status 'active' e limpa os dados."""
        enrollments = []
        try:
            docs = self.collection.where('status', '==', 'active').stream()
            for doc in docs:
                cleaned_data = _clean_enrollment_data(doc.to_dict())
                enrollments.append(Enrollment.from_dict(cleaned_data, doc.id))
        except Exception as e:
            print(f"Erro ao buscar todas as matrículas ativas: {e}")
        return enrollments

    def get_enrollments_by_student_id(self, student_id):
        """Busca todas as matrículas de um aluno específico e limpa os dados."""
        enrollments = []
        try:
            docs = self.collection.where('student_id', '==', student_id).stream()
            for doc in docs:
                cleaned_data = _clean_enrollment_data(doc.to_dict())
                enrollments.append(Enrollment.from_dict(cleaned_data, doc.id))
        except Exception as e:
            print(f"Erro ao buscar matrículas do aluno {student_id}: {e}")
        return enrollments
        
    def get_student_ids_by_class_id(self, class_id):
        """Retorna uma lista de IDs de alunos matriculados em uma turma."""
        student_ids = []
        try:
            docs = self.collection.where('class_id', '==', class_id).stream()
            for doc in docs:
                student_ids.append(doc.to_dict().get('student_id'))
        except Exception as e:
            print(f"Erro ao buscar IDs de alunos da turma {class_id}: {e}")
        return student_ids

    def delete_enrollment(self, enrollment_id):
        """Deleta uma matrícula pelo seu ID."""
        try:
            self.collection.document(enrollment_id).delete()
            return True
        except Exception as e:
            print(f"Erro ao deletar matrícula {enrollment_id}: {e}")
            return False
            
    def delete_enrollments_by_student_id(self, student_id):
        """Deleta todas as matrículas de um aluno específico."""
        try:
            enrollments_to_delete = self.collection.where('student_id', '==', student_id).stream()
            for doc in enrollments_to_delete:
                doc.reference.delete()
            print(f"Matrículas do aluno {student_id} deletadas com sucesso.")
            return True
        except Exception as e:
            print(f"Erro ao deletar matrículas do aluno {student_id}: {e}")
            return False

    def get_enrollments_by_class_id(self, class_id):
        """Busca todas as matrículas ativas para uma turma específica e limpa os dados."""
        enrollments = []
        try:
            docs = self.collection.where('class_id', '==', class_id).where('status', '==', 'active').stream()
            for doc in docs:
                cleaned_data = _clean_enrollment_data(doc.to_dict())
                enrollments.append(Enrollment.from_dict(cleaned_data, doc.id))
        except Exception as e:
            print(f"Erro ao buscar matrículas por ID da turma '{class_id}': {e}")
        return enrollments

