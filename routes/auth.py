from flask import Blueprint, make_response, render_template, request, redirect, session, url_for, flash
from flask_login import login_user, logout_user, current_user, login_required

user_service = None
auth_bp = Blueprint('auth', __name__)

def init_auth_bp(us):
    global user_service
    user_service = us

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    

    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        if not email or not password:
            flash('E-mail e senha são obrigatórios.', 'danger')
            return redirect(url_for('auth.login'))

        user = user_service.authenticate_user(email, password)

        if user:
            login_user(user, remember=True)
        
            if user.role in ['admin', 'super_admin']:
                target_url = url_for('admin.dashboard')
            elif user.role == 'student':
                target_url = url_for('student.dashboard')
            elif user.role == 'teacher':
                target_url = url_for('teacher.dashboard')
            else:
                target_url = url_for('index') 
            
            # 3. Crie a resposta de redirecionamento
            response = make_response(redirect(target_url))
            
            # 4. Adicione o cabeçalho Cache-Control. Esta é a chave!
            response.headers['Cache-Control'] = 'private'
            print(f"DEBUG: Enviando cabeçalhos de resposta: {response.headers}")
            # 5. Retorne a resposta construída
            return response
            # --- FIM DA ALTERAÇÃO ---
        else:
            flash('Credenciais inválidas.', 'danger')

    if current_user.is_authenticated:
        if current_user.role in ['admin', 'super_admin']:
            return redirect(url_for('admin.dashboard'))
        elif current_user.role == 'student':
            return redirect(url_for('student.dashboard'))
        # --- LÓGICA DE REDIRECIONAMENTO DO PROFESSOR ---
        elif current_user.role == 'teacher':
            return redirect(url_for('teacher.dashboard'))
    
    return render_template('auth/login.html')


@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Você foi desconectado.', 'info')
    return redirect(url_for('auth.login'))