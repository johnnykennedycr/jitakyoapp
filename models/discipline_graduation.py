from datetime import datetime

class DisciplineGraduation:
    """Representa uma modalidade e a graduação do professor nela."""
    def __init__(self, discipline_name=None, graduation=None, created_at=None, updated_at=None):
        self.discipline_name = discipline_name # Ex: "Jiu-Jitsu", "Judô", "Muay Thai"
        self.graduation = graduation         # Ex: "Faixa Preta 4º Dan", "Kruang Azul Claro/Escuro"
        self.created_at = created_at if created_at else datetime.now()
        self.updated_at = updated_at if updated_at else datetime.now()

    def to_dict(self):
        """Converte o objeto DisciplineGraduation em um dicionário para salvar no Firestore."""
        return {
            "discipline_name": self.discipline_name,
            "graduation": self.graduation,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }

    @staticmethod
    def from_dict(source):
        """Cria um objeto DisciplineGraduation a partir de um dicionário (do Firestore)."""
        return DisciplineGraduation(
            discipline_name=source.get('discipline_name'),
            graduation=source.get('graduation'),
            created_at=source.get('created_at'),
            updated_at=source.get('updated_at')
        )

    def __repr__(self):
        return f"<DisciplineGraduation(discipline_name='{self.discipline_name}', graduation='{self.graduation}')>"