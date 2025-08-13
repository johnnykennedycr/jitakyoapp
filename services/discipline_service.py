from firebase_admin import firestore
from models.discipline import Discipline # Supondo que você tenha um modelo de Disciplina
from models.user import User

class DisciplineService:
    """
    Serviço para gerenciar a lógica de negócios relacionada a disciplinas no Firestore.
    """
    def __init__(self, db):
        self.db = db
        self.disciplines_collection = self.db.collection('disciplines')
        self.users_collection = self.db.collection('users')

    def get_discipline_by_id(self, discipline_id):
        """
        Busca uma disciplina pelo ID.
        Retorna o objeto Discipline ou None se não encontrado.
        """
        doc_ref = self.disciplines_collection.document(discipline_id)
        doc = doc_ref.get()
        if doc.exists:
            discipline_data = doc.to_dict()
            discipline_data['id'] = doc.id
            return Discipline.from_dict(discipline_data)
        return None

    def get_students_in_discipline(self, discipline_id):
        """
        Retorna uma lista de objetos User matriculados em uma disciplina específica.
        """
        students = []
        # Query para encontrar usuários que têm o 'discipline_id' na lista 'enrolled_disciplines'
        docs = self.users_collection.where('enrolled_disciplines', 'array_contains', discipline_id).stream()
        for doc in docs:
            user_data = doc.to_dict()
            user_data['id'] = doc.id
            students.append(User.from_dict(user_data))
        return students

    def add_student_to_discipline(self, discipline_id, user_id):
        """
        Adiciona um estudante a uma disciplina.
        """
        user_ref = self.users_collection.document(user_id)
        user_ref.update({
            'enrolled_disciplines': firestore.ArrayUnion([discipline_id])
        })
        print(f"Usuário com ID '{user_id}' matriculado na disciplina '{discipline_id}'.")
        return True

    def remove_student_from_discipline(self, discipline_id, user_id):
        """
        Remove um estudante de uma disciplina.
        """
        user_ref = self.users_collection.document(user_id)
        user_ref.update({
            'enrolled_disciplines': firestore.ArrayRemove([discipline_id])
        })
        print(f"Usuário com ID '{user_id}' desmatriculado da disciplina '{discipline_id}'.")
        return True

