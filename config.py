import os

class Config:
    # Caminho para o arquivo de credenciais do Firebase
    FIREBASE_CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), 'firebase_credentials.json')

    # Chave secreta para segurança da sessão (deve ser carregada de variáveis de ambiente em produção)
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'uma_chave_secreta_muito_segura_para_dev'

    # Adicione outras configurações aqui conforme necessário
    # Por exemplo: FIREBASE_PROJECT_ID = os.environ.get('FIREBASE_PROJECT_ID')