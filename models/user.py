from datetime import date, datetime

class User:
    def __init__(self, id=None, name=None, email=None, password_hash=None, role='student',
                 date_of_birth=None, phone=None, # NOVO CAMPO: phone
                 enrolled_disciplines=None, guardians=None,
                 created_at=None, updated_at=None):
        self.id = id
        self.name = name
        self.email = email
        self.password_hash = password_hash
        self.role = role
        
        self.date_of_birth = date_of_birth
        self.phone = phone # NOVO CAMPO
        self.enrolled_disciplines = enrolled_disciplines if enrolled_disciplines is not None else []
        self.guardians = guardians if guardians is not None else []

        self.created_at = created_at if created_at else datetime.now()
        self.updated_at = updated_at if updated_at else datetime.now()

    def to_dict(self):
        """Converte o objeto User em um dicionário para salvar no Firestore."""
        return {
            "name": self.name,
            "email": self.email,
            "password_hash": self.password_hash,
            "role": self.role,
            "date_of_birth": self.date_of_birth,
            "phone": self.phone, # NOVO CAMPO
            "enrolled_disciplines": self.enrolled_disciplines,
            "guardians": self.guardians,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }

    @staticmethod
    def from_dict(source):
        """Cria um objeto User a partir de um dicionário (do Firestore)."""
        user = User(
            id=source.get('id'),
            name=source.get('name'),
            email=source.get('email'),
            password_hash=source.get('password_hash'),
            role=source.get('role', 'student'),
            date_of_birth=source.get('date_of_birth'),
            phone=source.get('phone'), # NOVO CAMPO
            enrolled_disciplines=source.get('enrolled_disciplines', []),
            guardians=source.get('guardians', []),
            created_at=source.get('created_at'),
            updated_at=source.get('updated_at')
        )
        return user

    def __repr__(self):
        return f"<User(id='{self.id}', name='{self.name}', role='{self.role}')>"
    
    def calculate_age(self):
        """Calcula a idade com base na data de nascimento."""
        if not self.date_of_birth:
            return None
        today = date.today()
        # Calcula a idade subtraindo o ano de nascimento do ano atual.
        # Depois, subtrai 1 se o aniversário deste ano ainda não chegou.
        age = today.year - self.date_of_birth.year - ((today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day))
        return age

    @property
    def age(self):
        """Propriedade que retorna a idade calculada."""
        return self.calculate_age()