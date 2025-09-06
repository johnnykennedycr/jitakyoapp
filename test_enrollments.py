import os
import firebase_admin
from firebase_admin import credentials, firestore
from models.enrollment import Enrollment

def initialize_firebase():
    """Inicializa a conexão com o Firebase."""
    try:
        cred_path = os.path.join(os.path.dirname(__file__), 'firebase_credentials.json')
        if not os.path.exists(cred_path):
            print(f"ERRO: Arquivo de credenciais não encontrado em {cred_path}")
            return None
        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("✅ Firebase inicializado com sucesso.")
        return db
    except Exception as e:
        print(f"❌ Erro grave ao inicializar Firebase: {e}")
        return None

def run_test(db):
    """Executa o teste na coleção 'enrollments'."""
    if not db:
        print("Teste não pode ser executado. A conexão com o DB falhou.")
        return

    print("\n--- INICIANDO TESTE NA COLEÇÃO 'enrollments' ---")
    
    try:
        enrollments_ref = db.collection('enrollments')
        
        # A consulta exata que está falhando
        query = enrollments_ref.where('status', '==', 'active').stream()
        
        # Convertemos para lista para poder contar e iterar
        docs = list(query)
        
        if not docs:
            print("⚠️ RESULTADO: A consulta `where('status', '==', 'active')` não retornou NENHUM documento.")
            print("   Verifique no console do Firebase se o nome do campo e o valor estão 100% corretos (maiúsculas/minúsculas, espaços, etc.).")
        else:
            print(f"✅ SUCESSO: A consulta encontrou {len(docs)} documento(s) com status 'active'.")
            print("\n--- TENTANDO CONVERTER DOCUMENTOS PARA OBJETOS ---")
            
            conversion_errors = 0
            for doc in docs:
                try:
                    enrollment_data = doc.to_dict()
                    enrollment_obj = Enrollment.from_dict(enrollment_data)
                    enrollment_obj.id = doc.id
                    print(f"  - Sucesso ao converter doc ID: {doc.id} -> {enrollment_obj}")
                except Exception as e:
                    print(f"  - ❌ ERRO ao converter doc ID: {doc.id}. Detalhes: {e}")
                    conversion_errors += 1
            
            if conversion_errors > 0:
                print("\n⚠️ RESULTADO: A consulta ao banco funciona, mas há um erro no seu modelo `Enrollment` (provavelmente no método `from_dict`).")
            else:
                print("\n✅ RESULTADO FINAL: A consulta e a conversão do modelo estão funcionando perfeitamente neste teste.")

    except Exception as e:
        print(f"❌ ERRO GERAL durante a execução do teste: {e}")

if __name__ == '__main__':
    database_client = initialize_firebase()
    run_test(database_client)