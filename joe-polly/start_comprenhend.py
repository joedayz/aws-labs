from json import dumps as json_encode
import boto3

comprehend = boto3.client('comprehend', aws_access_key_id='ACCESS_KEY',
                    aws_secret_access_key='SECRET_KEY',
                    region_name='us-east-1')

text = 'Hi, my name is Jose Diaz, and I live in Ventanilla, Peru. I have a bank account \
USA40AMCN0011345543234678, and my Debit card is 0234-2804-5823-4038. You can contact \
me at jamdiazdiaz@gmail.com'

entity_response = comprehend.detect_pii_entities(Text=text, LanguageCode='en')
entities = entity_response['Entities']
print(json_encode(entities, indent=4))

