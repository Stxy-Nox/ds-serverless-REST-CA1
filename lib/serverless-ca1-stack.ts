import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import * as apig from "aws-cdk-lib/aws-apigateway";
import { generateBatch } from "../shared/util";
import {games} from "../seed/games";
import * as iam from 'aws-cdk-lib/aws-iam';

export class ServerlessCa1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //Tables
    const gamesTable = new dynamodb.Table(this, "GamesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      sortKey: { name: "name", type: dynamodb.AttributeType.STRING },
      partitionKey: { name: "game_id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Games",
    });

    // gamesTable.addGlobalSecondaryIndex({
    //   indexName: "GameIdIndex",
    //   partitionKey: { name: "game_id", type: dynamodb.AttributeType.NUMBER },
    // });
    
    // gamesTable.addGlobalSecondaryIndex({
    //   indexName: "PlatformIndex",
    //   partitionKey: { name: "platform", type: dynamodb.AttributeType.STRING },
    // });
    

    //Funcitons

    // const testFn = new lambdanode.NodejsFunction(this, "TestFn", {
    //   architecture: lambda.Architecture.ARM_64,
    //   runtime: lambda.Runtime.NODEJS_20_X,
    //   entry: `${__dirname}/../lambdas/test.ts`,
    //   timeout: cdk.Duration.seconds(10),
    //   memorySize: 128,
    // })

    const getGameByIdFn = new lambdanode.NodejsFunction(
      this,
      "GetGameByIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: `${__dirname}/../lambdas/getGameById.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: gamesTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    const getAllGamesFn = new lambdanode.NodejsFunction(
      this,
      "GetAllGamesFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: `${__dirname}/../lambdas/getAllGames.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: gamesTable.tableName,
          REGION: 'eu-west-1',
        },
      }
      );

    const newGameFn = new lambdanode.NodejsFunction(this, "AddGameFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/addGame.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: gamesTable.tableName,
        REGION: "eu-west-1",
      },
    });

    const updateGameFn = new lambdanode.NodejsFunction(this, "UpdateGameFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/updateGame.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: gamesTable.tableName,
        REGION: 'eu-west-1',
      },
    });

    new custom.AwsCustomResource(this, "gamesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [gamesTable.tableName]: generateBatch(games),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("gamesddbInitData"), //.of(Date.now().toString()),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [gamesTable.tableArn],
      }),
    });

    const translateGameFn = new lambdanode.NodejsFunction(this, "TranslateGameFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/translate.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: gamesTable.tableName,
        REGION: 'eu-west-1',
      },
    });

    translateGameFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['translate:TranslateText'],
      resources: ['*'], // Amazon Translate 不支持资源级别权限，因此使用 '*'
    }));

    //Permissions
    gamesTable.grantReadData(getGameByIdFn)
    gamesTable.grantReadData(getAllGamesFn)
    gamesTable.grantReadWriteData(newGameFn)
    gamesTable.grantReadWriteData(updateGameFn);
    gamesTable.grantReadWriteData(translateGameFn);

    
    //REST API
    const api = new apig.RestApi(this, "RestAPI", {
      description: "demo api",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    // const apiKey = api.addApiKey("ApiKey");

    // const usagePlan = api.addUsagePlan("UsagePlan", {
    //   name: "BasicUsagePlan",
    //   throttle: {
    //     rateLimit: 10,
    //     burstLimit: 2,
    //   },
    // });
    // usagePlan.addApiKey(apiKey);
    // usagePlan.addApiStage({ stage: api.deploymentStage });
    //Endpoints
    const gamesEndpoint = api.root.addResource("games");
    gamesEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getAllGamesFn, { proxy: true })
    )
    gamesEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(newGameFn,{proxy:true})
    )

    const gameResource = gamesEndpoint.addResource("{gameId}");
    gameResource.addMethod(
      "GET",
      new apig.LambdaIntegration(getGameByIdFn, { proxy: true }), 
      // { apiKeyRequired: true }
    )

    const updateResource = gameResource.addResource("{name}");
    updateResource.addMethod(
      "PUT", 
      new apig.LambdaIntegration(updateGameFn, { proxy: true }), 
      // { apiKeyRequired: true });
    )
    const translationResource = updateResource.addResource("translation");
    translationResource.addMethod(
      "GET", 
      new apig.LambdaIntegration(translateGameFn, { proxy: true }));
  }
}
