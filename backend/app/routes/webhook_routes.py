from flask import Blueprint, request, jsonify
import logging

# Esta variável será injetada com a instância do PaymentService
payment_service = None

webhook_api_bp = Blueprint('webhook_api', __name__, url_prefix='/api/payments')

def init_webhook_bp(ps):
    """Inicializa o Blueprint com a instância do PaymentService."""
    global payment_service
    payment_service = ps

@webhook_api_bp.route('/webhook', methods=['POST'])
def receive_webhook():
    """
    Recebe notificações de webhook do Mercado Pago.
    Esta rota não tem autenticação, pois é chamada por um serviço externo.
    """
    try:
        notification = request.get_json()
        print(f"INFO: Webhook recebido: {notification}")
        
        # O processamento real é delegado para o serviço
        if payment_service.handle_webhook_notification(notification):
            # Retorna 200 OK para confirmar ao Mercado Pago que a notificação foi recebida
            return jsonify(status="received"), 200
        else:
            # Se algo deu errado no processamento, retorna um erro,
            # o que pode fazer o Mercado Pago tentar reenviar a notificação.
            return jsonify(error="Failed to process webhook"), 500
            
    except Exception as e:
        logging.error(f"Erro fatal no endpoint de webhook: {e}", exc_info=True)
        return jsonify(error=str(e)), 500
