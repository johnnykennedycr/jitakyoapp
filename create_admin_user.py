import firebase_admin
from firebase_admin import credentials, firestore
import sys
from pathlib import Path
from datetime import datetime

# Garante que o script encontre os módulos da aplicação
project_root = Path(__file__).resolve().parent
sys.path.append(str(project_root))

# Importa a ferramenta de criptografia correta
from werkzeug.security import generate_password_hash

# --- Configuração do Firebase ---
try:
    cred = credentials.Certificate('firebase_credentials.json')
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    print(f"Erro ao inicializar o Firebase: {e}")
    sys.exit(1)

def create_or_update_admin():
    admin_email = "johnnyribeirodc@gmail.com"
    admin_password = "admin123" # A senha em texto puro
    
    # Criptografa a senha usando o mesmo método da aplicação
    hashed_password = generate_password_hash(admin_password)
    
    print(f"Verificando usuário: {admin_email}...")
    users_collection = db.collection('users')
    user_query = users_collection.where('email', '==', admin_email).limit(1).get()

    if not user_query:
        print("Usuário não encontrado. Criando um novo...")
        user_data = {
            'name': 'Admin Principal',
            'email': admin_email,
            'password_hash': hashed_password, # Salva no campo correto
            'role': 'super_admin', # Ou 'admin'
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        }
        users_collection.add(user_data)
        print("✅ Usuário administrador criado com sucesso!")
    else:
        print("Usuário encontrado. Atualizando a senha para garantir consistência...")
        user_doc = user_query[0]
        user_doc.reference.update({'password_hash': hashed_password})
        print("✅ Senha do administrador atualizada com sucesso!")
        
    print(f"\nUse estas credenciais para o login:\nE-mail: {admin_email}\nSenha: {admin_password}")

if __name__ == "__main__":
    create_or_update_admin()