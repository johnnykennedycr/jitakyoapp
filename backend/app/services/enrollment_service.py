from datetime import datetime
from firebase_admin import firestore
from app.models.enrollment import Enrollment

class EnrollmentService:
    def __init__(self, db, user_service=None, training_class_service=None):
        self.db = db
        self.collection = self.db.collection('enrollments')
        self.user_service = user_service
        self.training_class_service = training_class_service

    def get_all_active_enrollments_with_details(self):
        """
        Busca todas as matrículas ativas e enriquece os dados com informações
        do aluno (nome) e da turma (mensalidade, vencimento).
        Retorna uma lista de dicionários.
        """
        enrollments_with_details = []
        try:
            # 1. Busca todas as matrículas ativas
            active_enrollments_query = self.collection.where('status', '==', 'active').stream()
            
            # 2. Para otimizar, busca todos os alunos e turmas de uma vez para criar mapas de consulta
            all_students = {s.id: s for s in self.user_service.get_users_by_role('student')}
            all_classes = {c['id']: c for c in self.training_class_service.get_all_classes()}

            for doc in active_enrollments_query:
                enrollment = Enrollment.from_dict(doc.to_dict(), doc.id)
                
                student_info = all_students.get(enrollment.student_id)
                class_info = all_classes.get(enrollment.class_id)

                # Pula matrículas com dados órfãos (apontando para aluno/turma que não existe mais)
                if not student_info or not class_info:
                    continue

                # Garante que os valores numéricos são, de fato, números
                base_fee = float(class_info.get('default_monthly_fee', 0))
                discount = float(enrollment.discount_amount or 0)
                
                # Prioriza o dia de vencimento da matrícula, com fallback para o da turma
                due_day = int(enrollment.due_day or class_info.get('default_due_day', 15))

                enrollments_with_details.append({
                    "enrollment_id": enrollment.id,
                    "student_id": enrollment.student_id,
                    "student_name": student_info.name,
                    "class_id": enrollment.class_id,
                    "class_name": class_info.get('name', 'N/A'),
                    "base_monthly_fee": base_fee,
                    "discount_amount": discount,
                    "due_day": due_day
                })
        except Exception as e:
            print(f"Erro ao buscar matrículas ativas com detalhes: {e}")
        
        return enrollments_with_details

    def create_enrollment(self, data):
        """Cria uma nova matrícula, verificando se já existe."""
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
            training_class_dict = self.training_class_service.get_class_by_id_as_dict(class_id)
            student_name = student.name if student else "desconhecido"
            class_name = training_class_dict.get('name', "desconhecida") if training_class_dict else "desconhecida"
            raise ValueError(f"O aluno '{student_name}' já está matriculado na turma '{class_name}'.")
        
        training_class_dict = self.training_class_service.get_class_by_id_as_dict(class_id)
        default_due_day = training_class_dict.get('default_due_day', 15) if training_class_dict else 15

        enrollment_data = {
            'student_id': student_id,
            'class_id': class_id,
            'enrollment_date': firestore.SERVER_TIMESTAMP,
            'status': 'active',
            'base_monthly_fee': float(data.get('base_monthly_fee', 0)),
            'discount_amount': float(data.get('discount_amount', 0)),
            'discount_reason': data.get('discount_reason', ''),
            'due_day': int(data.get('due_day') or default_due_day),
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP
        }
        
        doc_ref = self.collection.document()
        doc_ref.set(enrollment_data)
        
        enrollment_data['id'] = doc_ref.id
        return enrollment_data

    def get_enrollments_by_student_id(self, student_id):
        """Busca todas as matrículas de um aluno específico."""
        enrollments = []
        try:
            docs = self.collection.where('student_id', '==', student_id).stream()
            for doc in docs:
                enrollments.append(Enrollment.from_dict(doc.to_dict(), doc.id))
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

    def get_all_active_enrollments(self):
        """Busca todas as matrículas com status 'active'."""
        enrollments = []
        try:
            docs = self.collection.where('status', '==', 'active').stream()
            for doc in docs:
                enrollments.append(Enrollment.from_dict(doc.to_dict(), doc.id))
        except Exception as e:
            print(f"Erro ao buscar todas as matrículas ativas: {e}")
        return enrollments

