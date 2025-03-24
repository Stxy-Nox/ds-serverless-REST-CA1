import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv();
// const isValidQueryParams = ajv.compile(
//   schema.definitions["GameQueryParams"] || {}
// );

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event: ", JSON.stringify(event));

    const pathParams = event.pathParameters;
    if (!pathParams || !pathParams.gameId) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Missing game Id in path parameters " }),
      };
    }


    const gameId = parseInt(pathParams.gameId);
    const queryParams = event.queryStringParameters || {};
    // if (!isValidQueryParams(queryParams)) {
    //   return {
    //     statusCode: 400,
    //     headers: { "content-type": "application/json" },
    //     body: JSON.stringify({
    //       message: "Incorrect query parameters. Must match schema",
    //       schema: schema.definitions["GameQueryParams"],
    //     }),
    //   };
    // }

    let commandInput: QueryCommandInput = {
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: "game_id = :g",
      ExpressionAttributeValues: {
        ":g": gameId,
      },
    };

    if (queryParams.name) {
      commandInput.KeyConditionExpression += " and begins_with(#name, :n)";
      commandInput.ExpressionAttributeNames = { "#name": "name" };
      commandInput.ExpressionAttributeValues![":n"] = queryParams.name;
    }

    const commandOutput = await ddbDocClient.send(new QueryCommand(commandInput));
    if (!commandOutput.Items || commandOutput.Items.length === 0) {
      return {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "No items found with the provided criteria" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: commandOutput.Items }),
    };
  } catch (error: any) {
    console.error("Error: ", error);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error }),
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
