# find_timestamp.py
import importlib
import pkgutil
import inspect
import sys

# Definimos o nome do pacote que queremos investigar
PACKAGE_NAME = 'google.cloud.firestore_v1'

def find_class_in_package(package_name, class_name):
    """Procura recursivamente por uma classe dentro de um pacote."""
    try:
        package = importlib.import_module(package_name)
    except ImportError:
        print(f"ERRO: Não foi possível importar o pacote base '{package_name}'.")
        print("Verifique se a biblioteca 'google-cloud-firestore' está instalada corretamente.")
        return

    print(f"--- Procurando pela classe '{class_name}' dentro do pacote '{package_name}' ---")
    
    # Percorre todos os submódulos do pacote
    for _, modname, _ in pkgutil.walk_packages(
        path=package.__path__,
        prefix=package.__name__ + '.',
        onerror=lambda x: None):
        
        try:
            # Tenta importar o submódulo
            module = importlib.import_module(modname)
            
            # Verifica se o nome da classe existe como um atributo do módulo
            if hasattr(module, class_name):
                member = getattr(module, class_name)
                
                # Verifica se é de fato uma classe
                if inspect.isclass(member):
                    print("\n" + "="*50)
                    print(f"🎉 SUCESSO! A classe '{class_name}' foi encontrada!")
                    print(f"Módulo exato: {modname}")
                    print(f"👉 A sua linha de importação correta é: from {modname} import {class_name}")
                    print("="*50 + "\n")
                    return
        except Exception:
            # Ignora erros de importação de submódulos, o que é comum
            pass
            
    print("\n--- Pesquisa concluída ---")
    print(f"😭 A classe '{class_name}' não foi encontrada em nenhum submódulo de '{package_name}'.")
    print("Isso sugere uma instalação corrompida ou uma versão muito antiga e incompatível da biblioteca.")

# Executa a busca
find_class_in_package(PACKAGE_NAME, "Timestamp")