# create_admin_user.py

import firebase_admin
from firebase_admin import credentials, firestore
import os
import sys
from pathlib import Path

# Adiciona o diretório raiz do projeto ao sys.path
# Isso permite que o script encontre os módulos `services` e `models`
# Substitua o caminho por 'C:\\Users\\Johnny\\Dev\\JitaKyoApp' se for necessário.
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

from services.user_service import UserService
from models.user import User
import bcrypt
from datetime import datetime

# --- Configuração do Firebase Admin SDK ---
# IMPORTANTE: Substitua 'YOUR_PATH_TO_FIREBASE_CREDENTIALS.json'
# pelo caminho real do seu arquivo de credenciais.
try:
    cred = credentials.Certificate('firebase_credentials.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    print(f"Erro ao inicializar o Firebase: {e}")
    print("Verifique se o caminho para o arquivo de credenciais está correto.")
    sys.exit(1)

def create_initial_admin_user():
    """
    Cria um novo usuário administrador se ele ainda não existir.
    """
    user_service = UserService(db=db)

    # Defina as credenciais para o novo administrador
    admin_name = "Admin Principal"
    admin_email = "admin@example.com"  # Substitua pelo e-mail desejado
    admin_role = "admin"

    print("Verificando se o usuário administrador já existe...")
    existing_user_docs = user_service.users_collection.where('email', '==', admin_email).limit(1).get()
    
    # CORREÇÃO: A lógica foi alterada para verificar se a lista de documentos está vazia.
    # 'not existing_user_docs' é True se a lista estiver vazia.
    if not existing_user_docs:
        print("Usuário administrador não encontrado. Criando um novo...")

        # Vamos adaptar a lógica para criar o usuário e definir a senha, já que o método create_user
        # foi projetado para gerar a senha e enviá-la. Para um script avulso, faremos o hash manualmente.
        generated_password = user_service._generate_random_password()
        hashed_password = bcrypt.hashpw(generated_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        admin_user = User(
            name=admin_name,
            email=admin_email,
            password_hash=hashed_password,
            role=admin_role,
        )

        user_dict = admin_user.to_dict()
        _, doc_ref = user_service.users_collection.add(user_dict)
        
        admin_user.id = doc_ref.id
        
        print("-" * 50)
        print(f"Usuário administrador '{admin_name}' criado com sucesso!")
        print(f"ID do Usuário: {admin_user.id}")
        print(f"E-mail de Acesso: {admin_email}")
        print(f"Senha Temporária: {generated_password}")
        print("Por favor, use estas credenciais para fazer o primeiro login e altere a senha na sua aplicação.")
        print("-" * 50)
    else:
        print(f"O usuário com e-mail '{admin_email}' já existe. Não será criado novamente.")
        # Se você precisar da senha do usuário existente para teste, pode recuperá-la
        # user_doc = existing_user_docs[0]
        # user_data = user_doc.to_dict()
        # print(f"Senha hash do usuário existente: {user_data.get('password_hash')}")


if __name__ == "__main__":
    create_initial_admin_user()
