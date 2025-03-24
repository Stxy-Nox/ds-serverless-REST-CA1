// import { APIGatewayProxyHandler } from 'aws-lambda';
// import 'source-map-support/register';
// import apiResponses from './common/apiResponses';
// import * as AWS from 'aws-sdk';

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Translate Event: ", JSON.stringify(event));

    // 1. 从路径参数中获取 game_id 和 name
    const pathParams = event.pathParameters;
    if (!pathParams || !pathParams.game_id || !pathParams.name) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "Missing game_id or name in path parameters",
        }),
      };
    }
    const gameId = parseInt(pathParams.game_id);
    const name = pathParams.name;
    if (isNaN(gameId)) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Invalid game_id, must be a number" }),
      };
    }

    // 2. 从查询字符串中获取目标语言
    const queryParams = event.queryStringParameters;
    if (!queryParams || !queryParams.language) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Missing language query parameter" }),
      };
    }
    const targetLanguage = queryParams.language;

    // 3. 从 DynamoDB 中读取该记录，假设主要文本属性为 summary
    const getCommand = new GetCommand({
      TableName: process.env.TABLE_NAME,
      Key: { game_id: gameId, name: name },
    });
    const getResult = await ddbDocClient.send(getCommand);
    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Item not found" }),
      };
    }
    const item = getResult.Item;
    const sourceText = item.summary;
    if (!sourceText) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Item does not have a summary to translate" }),
      };
    }

    // 4. 检查缓存：如果 item.translations[targetLanguage] 存在，则直接返回缓存的翻译结果
    if (item.translations && item.translations[targetLanguage]) {
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data: { ...item, translatedSummary: item.translations[targetLanguage] },
          cached: true,
        }),
      };
    }

    // 5. 调用 Amazon Translate 进行翻译
    const translateClient = new TranslateClient({ region: process.env.REGION });
    const translateCommand = new TranslateTextCommand({
      Text: sourceText,
      SourceLanguageCode: "auto", // 自动检测源语言
      TargetLanguageCode: targetLanguage,
    });
    const translateResult = await translateClient.send(translateCommand);
    const translatedText = translateResult.TranslatedText;
    if (!translatedText) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Translation failed" }),
      };
    }

    // 6. 将翻译结果缓存到 DynamoDB：更新 item.translations 为 map 类型（如果不存在则创建）
    const updateCommand = new UpdateCommand({
      TableName: process.env.TABLE_NAME,
      Key: { game_id: gameId, name: name },
      UpdateExpression: "SET translations.#lang = :translatedText",
      ExpressionAttributeNames: { "#lang": targetLanguage },
      ExpressionAttributeValues: { ":translatedText": translatedText },
      ReturnValues: "ALL_NEW",
    });
    const updateResult = await ddbDocClient.send(updateCommand);

    // 7. 返回更新后的数据，其中包含翻译后的描述
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        data: { ...updateResult.Attributes, translatedSummary: translatedText },
        cached: false,
      }),
    };
  } catch (error: any) {
    console.error("Translation Error: ", error);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}

// export const handler: APIGatewayProxyHandler = async (event) => {
//   const body = JSON.parse(event.body);
//   const { text, language } = body;
//   const translate = new AWS.Translate();

//   if (!text) {
//     return apiResponses._400({ message: 'missing text fom the body' });
//   }
//   if (!language) {
//     return apiResponses._400({ message: 'missing language from the body' });
//   }

//   const translateParams: AWS.Translate.Types.TranslateTextRequest = {
//     Text: text,
//     SourceLanguageCode: 'en',
//     TargetLanguageCode: language,
// };

//   try{
//     const translatedMessage = await translate.translateText(translateParams).promise();
//     return apiResponses._200({ translatedMessage });

//   }catch(error){
//     console.log('error in the translation', error);
//     return apiResponses._400({ message: 'unable to translate the message' });
//   }
// };