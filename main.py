# main.py CORRIGIDO

from flask import Flask, render_template, request, redirect, url_for, session, flash
from functools import wraps
import firebase_admin
from firebase_admin import credentials, auth, firestore
import pyrebase
import os

# --- INICIALIZAÇÃO DO FIREBASE ADMIN SDK ---
# Garante que o Firebase seja inicializado uma única vez quando o módulo é carregado
try:
    # A boa prática é não colocar o credentials.json no repositório.
    # No Cloud Run, o ideal é usar o "Service Account" padrão do ambiente.
    # Esta linha tentará usar as credenciais do ambiente.
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)
    print("Firebase Admin SDK inicializado com as credenciais do ambiente.")
except Exception as e:
    # Se as credenciais do ambiente não funcionarem, ele tentará o arquivo local.
    # Isso mantém a compatibilidade com seu ambiente de desenvolvimento.
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate("credentials.json")
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK inicializado com credentials.json.")
    except ValueError:
        print("Firebase Admin SDK já foi inicializado.")
    except Exception as file_error:
        print(f"Não foi possível inicializar o Firebase Admin: {file_error}")

# --- CONFIGURAÇÃO DO PYREBASE (AUTENTICAÇÃO) ---
# As chaves DEVEM ser configuradas como Variáveis de Ambiente no Cloud Run
config = {
    "apiKey": os.environ.get("API_KEY"),
    "authDomain": os.environ.get("AUTH_DOMAIN"),
    "projectId": os.environ.get("PROJECT_ID"),
    "storageBucket": os.environ.get("STORAGE_BUCKET"),
    "messagingSenderId": os.environ.get("MESSAGING_SENDER_ID"),
    "appId": os.environ.get("APP_ID"),
    "databaseURL": ""
}
firebase = pyrebase.initialize_app(config)
pb_auth = firebase.auth()

# --- INICIALIZAÇÃO DO FLASK E FIRESTORE DB ---
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "uma-chave-secreta-para-desenvolvimento")

# Coloque a inicialização do DB aqui para garantir que o Firebase Admin já foi inicializado
db = firestore.client()

# --- DECORATOR DE LOGIN ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# --- SUAS ROTAS (sem alteração) ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

# ... (cole o resto das suas rotas aqui: /login, /register, /logout) ...
# COLE SUAS ROTAS DE LOGIN, REGISTER E LOGOUT AQUI
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        try:
            user = pb_auth.sign_in_with_email_and_password(email, password)
            user_info = auth.get_user_by_email(email)
            session['user'] = user_info.uid
            return redirect(url_for('dashboard'))
        except Exception as e:
            flash('Email ou senha inválidos. Tente novamente.', 'error')
            return redirect(url_for('login'))
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        try:
            user = auth.create_user(email=email, password=password)
            flash('Conta criada com sucesso! Faça o login.', 'success')
            return redirect(url_for('login'))
        except Exception as e:
            flash(f'Erro ao criar conta: {e}', 'error')
            return redirect(url_for('register'))
    return render_template('register.html')

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('login'))


# Este bloco só será usado se você rodar `python main.py` localmente
if __name__ == '__main__':
    # A porta 8080 é o padrão que o Cloud Run espera
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)), debug=True)