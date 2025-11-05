from json import dumps as json_encode
import boto3

polly = boto3.client('polly', aws_access_key_id='ACCESS_KEY',
              aws_secret_access_key='SECRET_KEY',
              region_name='us-east-1')

text = 'Hi, my name is Jose Diaz, and I live in Ventanilla, Peru.'

response = polly.start_speech_synthesis_task(Text=text,
            Engine='neural',
            VoiceId='Joanna',
            TextType='text',
            OutputS3BucketName='amazon-polly-s3-joedayzperu-2025',
            OutputFormat='mp3')
response = response['SynthesisTask']
print('Task ID: {} \n Output URI: {}'.format(response['TaskId'], response['OutputUri']))
