import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";


const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event: ", JSON.stringify(event));
    const pathParameters  = event?.pathParameters;
    const queryParams= event?.queryStringParameters;

    const gameId = pathParameters?.gameId ? parseInt(pathParameters.gameId) : undefined;
    const platform = queryParams?.platform;

    // if (!gameId || !platform) {
    //   return {
    //     statusCode: 404,
    //     headers: {
    //       "content-type": "application/json",
    //     },
    //     body: JSON.stringify({ Message: "Missing game Id or platform" }),
    //   };
    // }

    let result;

    if(gameId && platform){
      result = await ddbDocClient.send(
        new GetCommand({
          TableName: process.env.TABLE_NAME,
          Key: { 
            game_id: gameId,
            platform: platform,
          },
        })
      );
      if (!result.Item|| result.Item.length === 0) {
        return {
          statusCode: 404,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ Message: "Invalid game Id or platform" }),
        };
      }
      const body = {
        data: result.Item,
      };
      return {
        statusCode: 200,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      };
    }else if(gameId && !platform){
      result = await ddbDocClient.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          IndexName: "GameIdIndex",
          KeyConditionExpression: "game_id = :gameId",
          ExpressionAttributeValues: {
            ":gameId": gameId,
          },
        })
      );
      if (!result.Items || result.Items.length === 0) {
        return {
          statusCode: 404,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ Message: "No game found with the provided id" }),
        };
      }
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: result.Items }),
      };
    }else if (!gameId && platform) {

      result = await ddbDocClient.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          KeyConditionExpression: "platform = :platform",
          ExpressionAttributeValues: {
            ":platform": platform,
          },
        })
      );
      if (!result.Items || result.Items.length === 0) {
        return {
          statusCode: 404,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ Message: "No games found for the provided platform" }),
        };
      }
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: result.Items }),
      };
    } else {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ Message: "Missing gameId or platform parameter" }),
      };
    }
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
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
