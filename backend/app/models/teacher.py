from datetime import datetime
from app.models.discipline_graduation import DisciplineGraduation

class Teacher:
    def __init__(self, id=None, name=None, contact_info=None, disciplines=None, 
                 description=None, user_id=None, created_at=None, updated_at=None):
        self.id = id
        self.name = name
        self.contact_info = contact_info if contact_info is not None else {}
        self.disciplines = disciplines if disciplines is not None else []
        self.description = description
        self.user_id = user_id
        self.created_at = created_at
        self.updated_at = updated_at

    def to_dict(self):
        return {
            "id": self.id, # Adicionado para conveniência no frontend
            "name": self.name,
            "contact_info": self.contact_info,
            "disciplines": [d.to_dict() for d in self.disciplines],
            "description": self.description,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @staticmethod
    def from_dict(source, doc_id): # Adicionado doc_id para consistência
        disciplines_data = source.get('disciplines', [])
        disciplines_objects = [DisciplineGraduation.from_dict(d) for d in disciplines_data]
        
        teacher = Teacher(
            id=doc_id, # Atribui o ID do documento
            name=source.get('name'),
            contact_info=source.get('contact_info'),
            disciplines=disciplines_objects,
            description=source.get('description'),
            user_id=source.get('user_id'),
            created_at=source.get('created_at'),
            updated_at=source.get('updated_at')
        )
        return teacher

    def __repr__(self):
        return f"<Teacher(id='{self.id}', name='{self.name}')>"