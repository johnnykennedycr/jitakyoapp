from functools import wraps
from flask import request, jsonify, g, flash, redirect, url_for
from firebase_admin import auth, firestore

# O user_service será necessário para buscar as roles do Firestore
# Vamos inicializá-lo a partir do app no main.py
user_service = None

def init_decorators(service):
    """Função para injetar o user_service nos decoradores."""
    global user_service

    user_service = service


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            session_cookie = request.cookies.get("session")
            if not session_cookie:
                return redirect(url_for("auth.login_page"))

            decoded_claims = auth.verify_session_cookie(session_cookie, check_revoked=True)
            request.user = decoded_claims
            return f(*args, **kwargs)

        except Exception:
            return redirect(url_for("auth.login_page"))

    return decorated


def role_required(*roles):
    """
    Decorator que garante que o usuário tenha pelo menos um dos papéis exigidos.
    Uso: @role_required('admin', 'super_admin')
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            user = getattr(g, 'current_user', None)
            if not user:
                return jsonify({'error': 'Usuário não autenticado'}), 401

            if not hasattr(user, 'role') or user.role not in roles:
                return jsonify({'error': 'Acesso negado: permissão insuficiente'}), 403

            return f(*args, **kwargs)
        return wrapper
    return decorator