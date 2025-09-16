# Em models/teacher.py
from datetime import datetime
from app.models.discipline_graduation import DisciplineGraduation

class Teacher:
    def __init__(self, id=None, name=None, contact_info=None, disciplines=None, description=None, user_id=None):
        self.id = id
        self.name = name
        self.contact_info = contact_info if contact_info is not None else {}
        self.disciplines = disciplines if disciplines is not None else []
        self.description = description
        self.user_id = user_id # <-- CAMPO ADICIONADO

    def to_dict(self):
        return {
            "name": self.name,
            "contact_info": self.contact_info,
            # Converte a lista de objetos DisciplineGraduation para dicionários
            "disciplines": [d.to_dict() for d in self.disciplines],
            "description": self.description,
            "user_id": self.user_id # <-- CAMPO ADICIONADO
        }

    @staticmethod
    def from_dict(source):
        # Converte dicionários de disciplina de volta para objetos
        disciplines_data = source.get('disciplines', [])
        disciplines_objects = [DisciplineGraduation.from_dict(d) for d in disciplines_data]
        
        return Teacher(
            # O ID será atribuído pelo serviço
            name=source.get('name'),
            contact_info=source.get('contact_info'),
            disciplines=disciplines_objects,
            description=source.get('description'),
            user_id=source.get('user_id') # <-- CAMPO ADICIONADO
        )

    def __repr__(self):
        return f"<Teacher(id='{self.id}', name='{self.name}')>"