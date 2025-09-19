# backend/app/models/db.py

from firebase_admin import firestore

class FirestoreClient:
    """
    Um proxy para o cliente do Firestore que permite a inicialização tardia.
    """
    def __init__(self):
        self._client = None

    def init_app(self):
        """Inicializa o cliente do Firestore."""
        if not self._client:
            self._client = firestore.client()

    def __getattr__(self, name):
        """
        Delega chamadas de método (como .collection(), .document())
        para o cliente real do Firestore.
        """
        if self._client is None:
            raise RuntimeError("Cliente do Firestore não foi inicializado. Chame db.init_app() primeiro.")
        return getattr(self._client, name)

# Cria a instância do proxy que será importada em toda a aplicação
db = FirestoreClient()