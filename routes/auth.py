from flask import Blueprint, request, jsonify, redirect, make_response, render_template, url_for
import firebase_admin
from firebase_admin import auth
from datetime import timedelta

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

# Página de login
@auth_bp.route("/login", methods=["GET"])
def login_page():
    return render_template("auth/login.html")


# Rota para criar sessão após o Firebase Auth JS
@auth_bp.route("/api/login-session", methods=["POST"])
def login_session():
    try:
        data = request.get_json()
        id_token = data.get("idToken")

        if not id_token:
            return jsonify({"success": False, "message": "Token ausente"}), 400

        # Cria session cookie válido por 5 dias
        expires_in = timedelta(days=5)
        session_cookie = auth.create_session_cookie(id_token, expires_in=expires_in)

        response = make_response(jsonify({"success": True, "redirect_url": "/"}))
        response.set_cookie(
            "session",
            session_cookie,
            max_age=expires_in.total_seconds(),
            httponly=True,
            secure=True,      # mantenha True em produção (HTTPS obrigatório)
            samesite="Strict" # ou "Lax" se precisar de compatibilidade
        )

        return response

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400


# Logout → limpa o cookie
@auth_bp.route("/logout", methods=["POST"])
def logout():
    response = make_response(redirect(url_for("auth.login_page")))
    response.set_cookie("session", "", expires=0)
    return response
