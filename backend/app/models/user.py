from datetime import date, datetime
from app.models.discipline_graduation import DisciplineGraduation

class User:
    """
    Representa um usuário no sistema, que pode ter a role 'student'
    e conter campos adicionais relacionados.
    """
    def __init__(self, id=None, name=None, email=None, role='student',
                 date_of_birth=None, phone=None, guardians=None, 
                 enrolled_disciplines=None, created_at=None, updated_at=None, **kwargs):
        
        self.id = id
        self.name = name
        self.email = email
        self.role = role
        self.date_of_birth = date_of_birth
        self.phone = phone
        self.guardians = guardians if guardians is not None else []
        self.enrolled_disciplines = enrolled_disciplines if enrolled_disciplines is not None else []
        self.created_at = created_at
        self.updated_at = updated_at

    @staticmethod
    def from_dict(source_dict, doc_id):
        """Cria um objeto User a partir de um dicionário do Firestore."""
        
        dob = source_dict.get('date_of_birth')
        if hasattr(dob, 'to_date_time'): # Converte Timestamp para datetime
            dob = dob.to_date_time()

        disciplines_data = source_dict.get('enrolled_disciplines', [])
        disciplines_objects = [DisciplineGraduation.from_dict(d) for d in disciplines_data]

        return User(
            id=doc_id,
            name=source_dict.get('name'),
            email=source_dict.get('email'),
            role=source_dict.get('role', 'student'),
            date_of_birth=dob,
            phone=source_dict.get('phone'),
            guardians=source_dict.get('guardians', []),
            enrolled_disciplines=disciplines_objects,
            created_at=source_dict.get('created_at'),
            updated_at=source_dict.get('updated_at')
        )

    def to_dict(self):
        """Converte o objeto User para um dicionário JSON-serializável."""
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "phone": self.phone,
            "age": self.age,
            "guardians": self.guardians,
            "enrolled_disciplines": [d.to_dict() for d in self.enrolled_disciplines],
            "date_of_birth": self.date_of_birth.isoformat() if isinstance(self.date_of_birth, (datetime, date)) else None,
        }

    @property
    def age(self):
        """Calcula a idade com base na data de nascimento."""
        if not self.date_of_birth: return None
        birth_date = self.date_of_birth
        if isinstance(birth_date, datetime): birth_date = birth_date.date()
        today = date.today()
        return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))

    def __repr__(self):
        return f"<User(id='{self.id}', name='{self.name}', role='{self.role}')>"

