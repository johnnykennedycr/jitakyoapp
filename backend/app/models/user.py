from datetime import date, datetime

class User:
    """
    Representa um usuário no sistema, com métodos robustos para conversão
    de e para o formato do Firestore, lidando com diferentes tipos de data.
    """
    def __init__(self, id=None, name=None, email=None, role='student',
                 date_of_birth=None, phone=None, guardians=None, 
                 enrolled_disciplines=None, created_at=None, updated_at=None):
        
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
        """
        Cria um objeto User a partir de um dicionário do Firestore.
        Lida com a conversão de Timestamps e Strings de data para datetime do Python.
        """
        dob = source_dict.get('date_of_birth')
        # LÓGICA DE CONVERSÃO DE DATA ROBUSTA
        if hasattr(dob, 'to_date_time'): # Verifica se é um Timestamp do Firestore
            dob = dob.to_date_time()
        elif isinstance(dob, str): # Se for uma string, tenta converter
            try:
                dob = datetime.strptime(dob, '%Y-%m-%d')
            except ValueError:
                print(f"Aviso: formato de data inválido para a string '{dob}'. Ignorando.")
                dob = None

        created = source_dict.get('created_at')
        if hasattr(created, 'to_date_time'):
            created = created.to_date_time()

        updated = source_dict.get('updated_at')
        if hasattr(updated, 'to_date_time'):
            updated = updated.to_date_time()

        return User(
            id=doc_id,
            name=source_dict.get('name'),
            email=source_dict.get('email'),
            role=source_dict.get('role', 'student'),
            date_of_birth=dob,
            phone=source_dict.get('phone'),
            guardians=source_dict.get('guardians', []),
            enrolled_disciplines=source_dict.get('enrolled_disciplines', []),
            created_at=created,
            updated_at=updated
        )

    def to_dict(self):
        """
        Converte o objeto User para um dicionário JSON-serializável.
        """
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "phone": self.phone,
            "age": self.age,
            "guardians": self.guardians,
            "enrolled_disciplines": self.enrolled_disciplines,
            "date_of_birth": self.date_of_birth.isoformat() if isinstance(self.date_of_birth, (datetime, date)) else None,
            "created_at": self.created_at.isoformat() if isinstance(self.created_at, (datetime, date)) else None,
            "updated_at": self.updated_at.isoformat() if isinstance(self.updated_at, (datetime, date)) else None
        }

    @property
    def age(self):
        """Calcula a idade com base na data de nascimento."""
        if not isinstance(self.date_of_birth, (datetime, date)):
            return None
        
        birth_date = self.date_of_birth
        if isinstance(birth_date, datetime):
            birth_date = birth_date.date()

        today = date.today()
        return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        
    def __repr__(self):
        return f"<User(id='{self.id}', name='{self.name}', role='{self.role}')>"

