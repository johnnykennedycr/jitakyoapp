from datetime import datetime
from firebase_admin import firestore
from app.models.enrollment import Enrollment

class EnrollmentService:
    def __init__(self, db, user_service=None, training_class_service=None):
        self.db = db
        self.collection = self.db.collection('enrollments')
        self.user_service = user_service
        self.training_class_service = training_class_service

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
            raise ValueError("O aluno já está matriculado nesta turma.")

        training_class_dict = self.training_class_service.get_class_by_id_as_dict(class_id)
        default_due_day = training_class_dict.get('default_due_day', 15) if training_class_dict else 15

        enrollment_data = {
            'student_id': student_id,
            'class_id': class_id,
            'enrollment_date': datetime.now(),
            'status': 'active',
            'base_monthly_fee': float(data.get('base_monthly_fee', 0)),
            'discount_amount': float(data.get('discount_amount', 0)),
            'discount_reason': data.get('discount_reason', ''),
            'due_day': int(data.get('due_day') or default_due_day),
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        
        doc_ref = self.collection.document()
        doc_ref.set(enrollment_data)
        
        return Enrollment.from_dict(enrollment_data, doc_ref.id)

    def get_enrollments_by_student_id(self, student_id):
        """Busca todas as matrículas de um aluno, enriquecidas com nomes da turma e do professor."""
        enrollments_details = []
        try:
            enrollment_docs = self.collection.where(filter=firestore.FieldFilter('student_id', '==', student_id)).stream()
            
            for doc in enrollment_docs:
                enrollment = Enrollment.from_dict(doc.to_dict(), doc.id)
                
                # Buscar informações da turma
                class_info = self.training_class_service.get_class_by_id(enrollment.class_id)
                
                teacher_name = "Professor não encontrado"
                if class_info and class_info.teacher_id:
                    # Buscar informações do professor usando o teacher_id da turma
                    teacher_info = self.user_service.get_user_by_id(class_info.teacher_id)
                    if teacher_info:
                        teacher_name = teacher_info.name

                enrollment_dict = enrollment.to_dict()
                enrollment_dict['class_name'] = class_info.name if class_info else "Turma desconhecida"
                enrollment_dict['teacher_name'] = teacher_name
                
                enrollments_details.append(enrollment_dict)
                
        except Exception as e:
            print(f"Erro ao buscar matrículas do aluno {student_id}: {e}")
        return enrollments_details
        
    def get_student_ids_by_class_id(self, class_id):
        """Retorna uma lista de IDs de alunos matriculados em uma turma."""
        student_ids = []
        try:
            docs = self.collection.where(filter=firestore.And([
                firestore.FieldFilter('class_id', '==', class_id),
                firestore.FieldFilter('status', '==', 'active')
            ])).stream()
            for doc in docs:
                student_ids.append(doc.to_dict().get('student_id'))
        except Exception as e:
            print(f"Erro ao buscar IDs de alunos da turma {class_id}: {e}")
        return student_ids

    def get_all_active_enrollments_with_details(self):
        """Busca todas as matrículas ativas e as enriquece com detalhes do aluno e da turma."""
        enrollments_details = []
        try:
            all_students = {s.id: s for s in self.user_service.get_users_by_role('student')}
            all_classes = {c['id']: c for c in self.training_class_service.get_all_classes()}
            
            active_enrollments = self.collection.where(filter=firestore.FieldFilter('status', '==', 'active')).stream()
            
            for enrollment_doc in active_enrollments:
                enrollment_data = enrollment_doc.to_dict()
                enrollment_data['enrollment_id'] = enrollment_doc.id
                
                student_info = all_students.get(enrollment_data['student_id'])
                class_info = all_classes.get(enrollment_data['class_id'])

                if not student_info or not class_info:
                    continue
                
                enrollment_data['student_name'] = student_info.name
                enrollment_data['class_name'] = class_info.get('name')
                
                enrollment_data['base_monthly_fee'] = class_info.get('default_monthly_fee', 0)
                enrollment_data.setdefault('due_day', class_info.get('default_due_day', 15))

                enrollments_details.append(enrollment_data)

        except Exception as e:
            print(f"Erro ao buscar e enriquecer matrículas ativas: {e}")
            
        return enrollments_details

    def delete_enrollment(self, enrollment_id):
        """Deleta uma matrícula pelo seu ID."""
        try:
            self.collection.document(enrollment_id).delete()
            return True
        except Exception as e:
            print(f"Erro ao deletar matrícula {enrollment_id}: {e}")
            return False
            
    def delete_enrollments_by_student_id(self, student_id):
        """Deleta todas as matrículas de um aluno."""
        try:
            docs = self.collection.where(filter=firestore.FieldFilter('student_id', '==', student_id)).stream()
            for doc in docs:
                doc.reference.delete()
            return True
        except Exception as e:
            print(f"Erro ao deletar matrículas do aluno {student_id}: {e}")
            raise e

