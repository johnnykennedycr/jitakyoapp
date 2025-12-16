# backend/create_admin.py

import os
import sys
import json
from getpass import getpass  # Para digitar a senha de forma segura

# --- Configuração do Caminho ---
# Isso permite que o script encontre e importe os módulos da sua aplicação Flask.
# Adiciona o diretório 'backend' ao path do Python.
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
# -----------------------------

import firebase_admin
from firebase_admin import credentials, firestore, auth

def initialize_firebase():
    """
    Inicializa o SDK do Firebase Admin.
    Procura pelo arquivo de credenciais na raiz do projeto.
    """
    print("Inicializando o Firebase Admin SDK...")
    
    # O caminho para a chave deve ser relativo à raiz do projeto.
    # O script está em /backend, então subimos um nível para encontrar o serviceAccountKey.json
    key_path = os.path.join(os.path.dirname(project_root), 'serviceAccountKey.json')

    if not os.path.exists(key_path):
        print("\n!!! ERRO CRÍTICO !!!")
        print(f"O arquivo de credenciais 'serviceAccountKey.json' não foi encontrado em: {os.path.dirname(key_path)}")
        print("Por favor, baixe o arquivo do seu console do Firebase e coloque-o na raiz do projeto.")
        sys.exit(1) # Encerra o script

    # Extrai o project_id do arquivo JSON para a inicialização
    try:
        with open(key_path, 'r') as f:
            key_data = json.load(f)
        project_id = key_data.get('project_id')
        if not project_id:
            raise ValueError("project_id não encontrado no arquivo de credenciais.")
    except Exception as e:
        print(f"\nERRO: Não foi possível ler o arquivo de credenciais: {e}")
        sys.exit(1)

    cred = credentials.Certificate(key_path)
    
    # Verifica se o app já foi inicializado para evitar erros
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred, {
            'projectId': project_id,
        })
    
    print("Firebase inicializado com sucesso!")
    return firestore.client()


def main():
    """Função principal para criar o usuário administrador."""
    
    db = initialize_firebase()
    users_collection = db.collection('users')

    print("\n--- Criação de Novo Usuário Administrador ---")
    
    # 1. Coletar informações do usuário
    name = input("Nome completo do administrador: ").strip()
    email = input("Email do administrador: ").strip().lower()
    
    if not name or not email:
        print("\nERRO: Nome e email não podem ser vazios.")
        return

    # Usando getpass para que a senha não seja exibida no terminal
    password = getpass("Digite a senha (mínimo 6 caracteres): ")
    password_confirm = getpass("Confirme a senha: ")

    if password != password_confirm:
        print("\nERRO: As senhas não coincidem.")
        return
        
    if len(password) < 6:
        print("\nERRO: A senha deve ter no mínimo 6 caracteres.")
        return

    try:
        # 2. Criar o usuário no Firebase Authentication
        print(f"\nCriando usuário '{email}' no Firebase Authentication...")
        firebase_user = auth.create_user(
            email=email,
            password=password,
            display_name=name
        )
        uid = firebase_user.uid
        print(f"Usuário criado com sucesso no Auth! (UID: {uid})")

        # 3. Salvar as informações do usuário no Firestore com a role de 'admin'
        print(f"Salvando dados do administrador no Firestore...")
        user_data = {
            'name': name,
            'email': email,
            'role': 'admin', # A parte mais importante!
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP
        }
        users_collection.document(uid).set(user_data)
        print("Dados salvos com sucesso no Firestore!")

        print("\n✅ Processo concluído! O administrador foi criado com sucesso.")

    except auth.EmailAlreadyExistsError:
        print(f"\nERRO: O email '{email}' já está em uso por outro usuário.")
    except Exception as e:
        print(f"\nOcorreu um erro inesperado: {e}")
        # Tenta reverter a criação no Auth se a escrita no Firestore falhar
        if 'uid' in locals():
            print(f"Tentando reverter a criação do usuário no Auth (UID: {uid})...")
            auth.delete_user(uid)
            print("Reversão concluída.")

if __name__ == '__main__':
    main()