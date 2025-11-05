from flask import Flask, request, jsonify, render_template, send_file, Response
import json
from flask_cors import CORS
from json import dumps as json_encode
import boto3
from boto3 import Session
from botocore.exceptions import BotoCoreError, ClientError

app = Flask(__name__)
CORS(app)  # Habilita CORS para todas las rutas

# Configuración de AWS Polly
polly = boto3.client('polly', 
                     aws_access_key_id='ACCESS_KEY',
                     aws_secret_access_key='SECRET_KEY',
                     region_name='us-east-1')

# Configuración de AWS Comprehend
comprehend = boto3.client('comprehend', 
                          aws_access_key_id='ACCESS_KEY',
                          aws_secret_access_key='SECRET_KEY',
                          region_name='us-east-1')

# Ruta principal para servir el frontend desde static
@app.route('/')
def index():
    return send_file('static/index.html')

# Ruta para sintetizar voz con Polly
@app.route('/api/synthesize', methods=['POST'])
def synthesize_speech():
    try:
        data = request.get_json()
        
        text = data.get('text', '')
        voice_id = data.get('voiceId', 'Joanna')
        engine = data.get('engine', 'neural')
        output_format = data.get('outputFormat', 'mp3')
        bucket_name = data.get('bucketName', 'amazon-polly-s3-joedayzperu-2025')
        
        if not text:
            return jsonify({'error': 'El texto es requerido'}), 400
        
        response = polly.start_speech_synthesis_task(
            Text=text,
            Engine=engine,
            VoiceId=voice_id,
            TextType='text',
            OutputS3BucketName=bucket_name,
            OutputFormat=output_format
        )
        
        task = response['SynthesisTask']
        return jsonify({
            'taskId': task['TaskId'],
            'outputUri': task['OutputUri'],
            'status': task.get('TaskStatus', 'scheduled')
        }), 200
        
    except ClientError as e:
        return jsonify({'error': str(e)}), 500
    except BotoCoreError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Ruta para obtener el estado de una tarea
@app.route('/api/task/<task_id>', methods=['GET'])
def get_task_status(task_id):
    try:
        response = polly.get_speech_synthesis_task(TaskId=task_id)
        task = response['SynthesisTask']
        return jsonify({
            'taskId': task['TaskId'],
            'status': task['TaskStatus'],
            'outputUri': task.get('OutputUri', ''),
            'creationTime': task.get('CreationTime', '').isoformat() if task.get('CreationTime') else None
        }), 200
    except ClientError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Ruta para obtener voces disponibles
@app.route('/api/voices', methods=['GET'])
def get_voices():
    try:
        response = polly.describe_voices()
        voices = response['Voices']
        return jsonify({'voices': voices}), 200
    except ClientError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Ruta para obtener voces (formato esperado por el frontend)
@app.route('/voices', methods=['GET'])
def voices():
    try:
        response = polly.describe_voices()
        voices = response['Voices']
        # El frontend espera un array directo de voces
        return jsonify(voices), 200
    except ClientError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Ruta para detectar entidades PII
@app.route('/detect-entities', methods=['POST'])
def detect_entities():
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'El texto es requerido'}), 400
        
        # Detectar entidades PII
        response = comprehend.detect_pii_entities(Text=text, LanguageCode='en')
        entities = response['Entities']
        
        return jsonify({'entities': entities}), 200
        
    except ClientError as e:
        return jsonify({'error': str(e)}), 500
    except BotoCoreError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Ruta para leer/sintetizar voz (streaming)
@app.route('/read', methods=['GET'])
def read():
    try:
        voice_id = request.args.get('voiceId', 'Joanna')
        text = request.args.get('text', '')
        output_format = request.args.get('outputFormat', 'mp3')
        
        if not text:
            return jsonify({'error': 'El texto es requerido'}), 400
        
        # Determinar el formato de audio para Polly
        format_map = {
            'mp3': 'mp3',
            'ogg_vorbis': 'ogg_vorbis',
            'pcm': 'pcm'
        }
        polly_format = format_map.get(output_format, 'mp3')
        
        # Sintetizar voz usando synthesize_speech (streaming directo)
        response = polly.synthesize_speech(
            Text=text,
            OutputFormat=polly_format,
            VoiceId=voice_id,
            Engine='neural'
        )
        
        # Retornar el audio como stream
        audio_stream = response['AudioStream']
        content_type = {
            'mp3': 'audio/mpeg',
            'ogg_vorbis': 'audio/ogg',
            'pcm': 'audio/wave'
        }.get(polly_format, 'audio/mpeg')
        
        return Response(
            audio_stream.read(),
            mimetype=content_type,
            headers={
                'Content-Disposition': 'inline; filename=speech.' + polly_format
            }
        )
        
    except ClientError as e:
        return jsonify({'error': str(e)}), 500
    except BotoCoreError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)

