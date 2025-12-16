import face_recognition
import numpy as np
import logging

class FacialRecognitionService:
    def get_face_encoding_from_stream(self, file_stream):
        """
        Lê uma imagem de um stream (upload), detecta o rosto e retorna o encoding (vetor 128d).
        Retorna None se nenhum rosto for encontrado.
        """
        try:
            # Carrega a imagem do stream
            image = face_recognition.load_image_file(file_stream)
            
            # Detecta encodings (assume-se que a foto de cadastro tem apenas 1 rosto)
            encodings = face_recognition.face_encodings(image)
            
            if len(encodings) > 0:
                # Retorna o primeiro rosto encontrado convertido para lista (para salvar em JSON/Firestore)
                return encodings[0].tolist()
            return None
        except Exception as e:
            logging.error(f"Erro ao processar imagem para encoding: {e}")
            return None

    def identify_student(self, file_stream, students_with_encodings):
        """
        Recebe uma imagem do Kiosk e uma lista de alunos (dicionários) que possuem 'face_encoding'.
        Retorna o aluno identificado ou None.
        """
        try:
            # Processa a imagem da câmera do tablet
            unknown_image = face_recognition.load_image_file(file_stream)
            unknown_encodings = face_recognition.face_encodings(unknown_image)

            if not unknown_encodings:
                return None # Ninguém na frente da câmera

            # Pega o rosto mais proeminente na imagem
            unknown_encoding = unknown_encodings[0]

            # Prepara a lista de rostos conhecidos
            known_encodings = []
            known_students = []

            for student in students_with_encodings:
                encoding_list = student.get('face_encoding')
                if encoding_list:
                    known_encodings.append(np.array(encoding_list))
                    known_students.append(student)

            if not known_encodings:
                return None

            # Compara os rostos (tolerance=0.6 é o padrão, menor é mais estrito)
            matches = face_recognition.compare_faces(known_encodings, unknown_encoding, tolerance=0.5)
            
            if True in matches:
                first_match_index = matches.index(True)
                return known_students[first_match_index]
            
            return None
        except Exception as e:
            logging.error(f"Erro ao identificar aluno: {e}")
            return None