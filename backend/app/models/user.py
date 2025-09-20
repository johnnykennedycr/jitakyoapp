# backend/app/models/user.py

from datetime import date, datetime

class User:
    """
    Representa um usuário no sistema, com métodos para conversão
    de e para o formato do Firestore.
    """
    def __init__(self, id=None, name=None, email=None, role='student',
                 date_of_birth=None, phone=None,
                 created_at=None, updated_at=None, **kwargs):
        
        self.id = id
        self.name = name
        self.email = email
        self.role = role
        self.date_of_birth = date_of_birth
        self.phone = phone
        
        # LINHAS CORRIGIDAS: Adicionando a atribuição que faltava
        self.created_at = created_at
        self.updated_at = updated_at
        
        self.extra_data = kwargs

    @staticmethod
    def from_dict(source_dict, doc_id):
        """
        Cria um objeto User a partir de um dicionário (geralmente do Firestore).
        Lida com a conversão de Timestamps do Firestore para datetime do Python.
        """
        dob = source_dict.get('date_of_birth')
        if hasattr(dob, 'to_date_time'):
            dob = dob.to_date_time()

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
            created_at=created,
            updated_at=updated
        )

    def to_dict(self):
        """
        Converte o objeto User para um dicionário JSON-serializável para ser
        enviado via API. Datas são convertidas para strings no padrão ISO.
        """
        user_dict = {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "phone": self.phone,
            "age": self.age,
            
            "date_of_birth": self.date_of_birth.isoformat() if isinstance(self.date_of_birth, (datetime, date)) else None,
            "created_at": self.created_at.isoformat() if isinstance(self.created_at, (datetime, date)) else None,
            "updated_at": self.updated_at.isoformat() if isinstance(self.updated_at, (datetime, date)) else None
        }
        user_dict.update(self.extra_data)
        return user_dict

    @property
    def age(self):
        """Calcula a idade com base na data de nascimento."""
        if not self.date_of_birth:
            return None
        
        birth_date = self.date_of_birth
        if isinstance(birth_date, datetime):
            birth_date = birth_date.date()

        today = date.today()
        return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        
    def __repr__(self):
        return f"<User(id='{self.id}', name='{self.name}', role='{self.role}')>"