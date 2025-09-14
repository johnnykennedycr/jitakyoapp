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


def role_required(role):
    def wrapper(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = getattr(request, "user", None)
            if not user:
                return redirect(url_for("auth.login_page"))

            # Se você está salvando roles no Firestore, busque aqui.
            # Exemplo simplificado (role vinda do custom claim):
            user_role = user.get("role")

            if user_role != role:
                return redirect(url_for("auth.login_page"))

            return f(*args, **kwargs)

        return decorated
    return wrapper