import { APIGatewayProxyHandler } from 'aws-lambda';
import 'source-map-support/register';
    
  export const handler: APIGatewayProxyHandler = async (event) => {
    const body = JSON.parse(event.body);
    const { text, language } = body;
  };