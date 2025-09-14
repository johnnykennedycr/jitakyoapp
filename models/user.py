# models/user.py ATUALIZADO E FINALIZADO
from datetime import date, datetime

class User:
    """
    Representa um usuário no sistema.
    A herança de UserMixin do Flask-Login foi removida.
    O campo 'password_hash' não é mais o responsável principal pela autenticação.
    """
    def __init__(self, id=None, name=None, email=None, role='student',
                 date_of_birth=None, phone=None,
                 enrolled_disciplines=None, guardians=None,
                 created_at=None, updated_at=None):
        
        # O ID deste objeto agora corresponde diretamente ao UID do Firebase Auth
        self.id = id
        self.name = name
        self.email = email
        self.role = role
        self.date_of_birth = date_of_birth
        self.phone = phone 
        self.enrolled_disciplines = enrolled_disciplines if enrolled_disciplines is not None else []
        self.guardians = guardians if guardians is not None else []
        self.created_at = created_at or datetime.now()
        self.updated_at = updated_at or datetime.now()
        # O atributo password_hash foi removido do __init__

    @staticmethod
    def from_dict(source, doc_id):
        return User(
            id=doc_id,
            name=source.get('name'),
            email=source.get('email'),
            role=source.get('role', 'student'),
            date_of_birth=source.get('date_of_birth'),
            phone=source.get('phone'),
            enrolled_disciplines=source.get('enrolled_disciplines', []),
            guardians=source.get('guardians', []),
            created_at=source.get('created_at'),
            updated_at=source.get('updated_at')
        )

    def to_dict(self):
        """Converte o objeto User em um dicionário para salvar no Firestore."""
        # Não salvamos mais o password_hash
        return {
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "date_of_birth": self.date_of_birth,
            "phone": self.phone,
            "enrolled_disciplines": self.enrolled_disciplines,
            "guardians": self.guardians,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }

    def calculate_age(self):
        """Calcula a idade com base na data de nascimento."""
        if not self.date_of_birth:
            return None
        today = date.today()
        
        birth_date = self.date_of_birth
        if isinstance(birth_date, datetime):
            birth_date = birth_date.date()

        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        return age

    @property
    def age(self):
        """Propriedade que retorna a idade calculada."""
        return self.calculate_age()
        
    def __repr__(self):
        return f"<User(id='{self.id}', name='{self.name}', role='{self.role}')>"