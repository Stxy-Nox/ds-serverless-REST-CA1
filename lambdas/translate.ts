import { APIGatewayProxyHandler } from 'aws-lambda';
import 'source-map-support/register';
import apiResponses from './common/apiResponses';
import * as AWS from 'aws-sdk';

export const handler: APIGatewayProxyHandler = async (event) => {
  const body = JSON.parse(event.body);
  const { text, language } = body;
  const translate = new AWS.Translate();

  if (!text) {
    return apiResponses._400({ message: 'missing text fom the body' });
  }
  if (!language) {
    return apiResponses._400({ message: 'missing language from the body' });
  }

  const translateParams: AWS.Translate.Types.TranslateTextRequest = {
    Text: text,
    SourceLanguageCode: 'en',
    TargetLanguageCode: language,
};

  try{
    const translatedMessage = await translate.translateText(translateParams).promise();
    return apiResponses._200({ translatedMessage });

  }catch(error){
    console.log('error in the translation', error);
    return apiResponses._400({ message: 'unable to translate the message' });
  }
};