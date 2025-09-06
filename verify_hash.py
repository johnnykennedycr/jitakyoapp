import firebase_admin
from firebase_admin import credentials, firestore
import sys
from pathlib import Path
from werkzeug.security import generate_password_hash, check_password_hash

# Garante que o script encontre os módulos da aplicação
project_root = Path(__file__).resolve().parent
sys.path.append(str(project_root))

# --- Configuração do Firebase ---
try:
    cred = credentials.Certificate('firebase_credentials.json')
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✅ Firebase inicializado com sucesso.")
except Exception as e:
    print(f"Erro ao inicializar o Firebase: {e}")
    sys.exit(1)

def verify_admin_password():
    admin_email = "johnnyribeirodc@gmail.com"
    password_to_check = "admin123"

    print("\n--- INICIANDO VERIFICAÇÃO DE HASH ---")
    
    # 1. Gera um hash de referência para "admin123"
    reference_hash = generate_password_hash(password_to_check)
    print(f"Hash de referência para '{password_to_check}':\n{reference_hash}\n")

    # 2. Busca o usuário no banco de dados
    users_collection = db.collection('users')
    user_query = users_collection.where('email', '==', admin_email).limit(1).get()

    if not user_query:
        print(f"❌ ERRO CRÍTICO: Usuário '{admin_email}' não foi encontrado no banco de dados.")
        return

    user_doc = user_query[0]
    user_data = user_doc.to_dict()
    
    stored_hash = user_data.get('password_hash')
    
    if not stored_hash:
        print("❌ ERRO CRÍTICO: O campo 'password_hash' não existe ou está vazio para este usuário no Firestore.")
        return
        
    print(f"Hash que está no banco de dados:\n{stored_hash}\n")

    # 3. Compara a senha com o hash armazenado
    is_match = check_password_hash(stored_hash, password_to_check)
    
    print("--- RESULTADO DA VERIFICAÇÃO ---")
    if is_match:
        print("✅ SUCESSO! A senha 'admin123' corresponde ao hash que está salvo no banco.")
    else:
        print("❌ FALHA! A senha 'admin123' NÃO corresponde ao hash que está salvo no banco.")
        print("   Isso confirma que o hash no banco de dados foi gerado de forma diferente.")

if __name__ == "__main__":
    verify_admin_password()