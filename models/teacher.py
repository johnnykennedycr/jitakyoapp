from datetime import datetime
from models.discipline_graduation import DisciplineGraduation # Importa o novo modelo

class Teacher:
    def __init__(self, id=None, name=None, contact_info=None, disciplines=None, description=None, created_at=None, updated_at=None):
        self.id = id # ID do documento no Firestore
        self.name = name
        self.contact_info = contact_info if contact_info is not None else {} # Dicionário: {'email': '', 'phone': ''}
        # self.specialties = specialties if specialties is not None else [] # REMOVER ESTA LINHA
        # NOVO: Lista de objetos DisciplineGraduation
        self.disciplines = [DisciplineGraduation.from_dict(d) if isinstance(d, dict) else d for d in (disciplines if disciplines else [])]
        self.description = description
        self.created_at = created_at if created_at else datetime.now()
        self.updated_at = updated_at if updated_at else datetime.now()

    def to_dict(self):
        """Converte o objeto Teacher em um dicionário para salvar no Firestore."""
        return {
            "name": self.name,
            "contact_info": self.contact_info,
            # "specialties": self.specialties, # REMOVER ESTA LINHA
            "disciplines": [d.to_dict() for d in self.disciplines], # NOVO: Converte objetos para dicionários
            "description": self.description,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }

    @staticmethod
    def from_dict(source):
        """Cria um objeto Teacher a partir de um dicionário (do Firestore)."""
        teacher = Teacher(
            id=source.get('id'),
            name=source.get('name'),
            contact_info=source.get('contact_info', {}),
            # specialties=source.get('specialties', []), # REMOVER ESTA LINHA
            # NOVO: Converte dicionários para objetos DisciplineGraduation
            disciplines=[DisciplineGraduation.from_dict(d) for d in source.get('disciplines', [])],
            description=source.get('description'),
            created_at=source.get('created_at'),
            updated_at=source.get('updated_at')
        )
        return teacher

    def __repr__(self):
        return f"<Teacher(id='{self.id}', name='{self.name}')>"